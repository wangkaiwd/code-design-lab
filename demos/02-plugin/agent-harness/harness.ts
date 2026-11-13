export type ToolCall = { name: string; input: Record<string, string> }

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls: ToolCall[] }
  | { role: 'tool'; content: string; isError: boolean }

export type Model = (request: {
  systemPrompt: string
  messages: Message[]
  tools: string[]
}) => Promise<{ content: string; toolCalls: ToolCall[] }>

export type Context = { notify(message: string): void }
export type Tool = { name: string; description: string; execute(input: Record<string, string>): string | Promise<string> }
export type Command = { description: string; handler(args: string, ctx: Context): void | Promise<void> }

type ToolResult = { content: string; isError: boolean }

// 每个事件：[事件参数, handler 可返回的值]
type Events = {
  before_agent_start: [event: { prompt: string; systemPrompt: string }, result: { systemPrompt?: string }]
  tool_call: [event: { toolName: string; input: Record<string, string> }, result: { block: true; reason: string }]
  tool_result: [event: ToolResult & { toolName: string; input: Record<string, string> }, result: Partial<ToolResult>]
  agent_end: [event: { messages: Message[] }, result: void]
}
type Handler<K extends keyof Events> = (event: Events[K][0], ctx: Context) => Events[K][1] | void | Promise<Events[K][1] | void>

// 对应 pi 的 ExtensionAPI：扩展只能通过这三个方法接入，拿不到核心的内部状态
export type ExtensionAPI = {
  on<K extends keyof Events>(event: K, handler: Handler<K>): void
  registerTool(tool: Tool): void
  registerCommand(name: string, command: Command): void
}
export type Extension = (pi: ExtensionAPI) => void

function builtinTools(files: Map<string, string>): Tool[] {
  return [
    {
      name: 'read',
      description: '读取文件',
      execute({ path }) {
        const content = files.get(path)
        if (content === undefined) throw new Error(`文件不存在：${path}`)
        return content
      },
    },
    {
      name: 'write',
      description: '写入文件',
      execute({ path, content }) {
        files.set(path, content)
        return `已写入 ${path}`
      },
    },
  ]
}

// 核心只有 agent 循环、事件分发和 read / write 两个内置工具。
// 计划模式、路径保护、待办这些功能都不在这里，由扩展按需加上。
export function createHarness(options: {
  model: Model
  systemPrompt: string
  files: Map<string, string>
  extensions: Extension[]
}) {
  const tools = new Map(builtinTools(options.files).map((tool) => [tool.name, tool]))
  const commands = new Map<string, Command>()
  const handlers: { [K in keyof Events]: Handler<K>[] } = {
    before_agent_start: [],
    tool_call: [],
    tool_result: [],
    agent_end: [],
  }
  const ctx: Context = { notify: (message) => console.log(`  [notify] ${message}`) }
  const messages: Message[] = []

  const pi: ExtensionAPI = {
    on: (event, handler) => handlers[event].push(handler),
    registerTool: (tool) => tools.set(tool.name, tool),
    registerCommand: (name, command) => commands.set(name, command),
  }
  for (const extension of options.extensions) extension(pi)

  async function executeTool(call: ToolCall): Promise<Message> {
    // 闸门：第一个返回 block 的 handler 直接拦下，工具不执行，tool_result 也不会触发
    for (const handler of handlers.tool_call) {
      const decision = await handler({ toolName: call.name, input: call.input }, ctx)
      if (decision) return { role: 'tool', content: `已拦截：${decision.reason}`, isError: true }
    }

    let result: ToolResult
    try {
      result = { content: await tools.get(call.name)!.execute(call.input), isError: false }
    } catch (error) {
      result = { content: (error as Error).message, isError: true }
    }

    // 链式变换：每个 handler 拿到前一个改过的结果，只需返回要改的字段
    for (const handler of handlers.tool_result) {
      result = { ...result, ...(await handler({ ...result, toolName: call.name, input: call.input }, ctx)) }
    }
    return { role: 'tool', ...result }
  }

  return {
    tools,
    commands,
    async prompt(text: string) {
      const [, name, args] = text.match(/^\/(\S+)\s*(.*)$/) ?? []
      const command = commands.get(name)
      if (command) return command.handler(args, ctx)

      // 链式变换：后一个 handler 拿到的是前一个改过的 system prompt
      let systemPrompt = options.systemPrompt
      for (const handler of handlers.before_agent_start) {
        systemPrompt = (await handler({ prompt: text, systemPrompt }, ctx))?.systemPrompt ?? systemPrompt
      }

      messages.push({ role: 'user', content: text })
      while (true) {
        const response = await options.model({ systemPrompt, messages, tools: [...tools.keys()] })
        messages.push({ role: 'assistant', ...response })
        if (response.toolCalls.length === 0) break
        for (const call of response.toolCalls) messages.push(await executeTool(call))
      }

      // 通知：只观察，返回值被忽略
      for (const handler of handlers.agent_end) await handler({ messages }, ctx)
      return messages.at(-1)!.content
    },
  }
}
