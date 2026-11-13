export type ToolCall = { id: string; name: string; args: Record<string, string> }
export type AIMessage = { role: 'ai'; content: string; toolCalls: ToolCall[] }
export type ToolMessage = { role: 'tool'; content: string; toolCallId: string }
export type Message = { role: 'user'; content: string } | AIMessage | ToolMessage

export type ChatModel = { name: string; invoke(messages: Message[], tools: Tool[]): Promise<AIMessage> }
export type Tool = { name: string; invoke(args: Record<string, string>): Promise<string> }

export type AgentState = { messages: Message[] }
// 返回的 messages 会追加到 state 里；LangChain 的 jumpTo 还支持 'model' / 'tools'，这里只实现 'end'
type StateUpdate = { messages?: Message[]; jumpTo?: 'end' } | void
type NodeHook = (state: AgentState) => StateUpdate | Promise<StateUpdate>

export type ModelRequest = { model: ChatModel; messages: Message[]; tools: Tool[] }
export type ToolCallRequest = { toolCall: ToolCall; tool: Tool }
type ModelHandler = (request: ModelRequest) => Promise<AIMessage>
type ToolHandler = (request: ToolCallRequest) => Promise<ToolMessage>

export type AgentMiddleware = {
  name: string
  // 节点钩子：在 agent 循环的固定位置读写 state
  beforeAgent?: NodeHook
  beforeModel?: NodeHook
  afterModel?: NodeHook
  afterAgent?: NodeHook
  // 包裹钩子：决定是否调用 handler、调用几次、换什么参数调用
  wrapModelCall?: (request: ModelRequest, handler: ModelHandler) => Promise<AIMessage>
  wrapToolCall?: (request: ToolCallRequest, handler: ToolHandler) => Promise<ToolMessage>
}

export const createMiddleware = (middleware: AgentMiddleware) => middleware

// 核心只有 ReAct 循环：调模型 → 有工具调用就执行 → 再调模型，直到模型不再调工具。
// 降级、重试、限流、日志都写成中间件挂进来。
export function createAgent(options: { model: ChatModel; tools: Tool[]; middleware?: AgentMiddleware[] }) {
  const middleware = options.middleware ?? []
  // 与 LangChain 一致：before* 按数组顺序执行，after* 倒序执行，wrap* 第一个在最外层
  const reversed = middleware.toReversed()

  const callModel = middleware.reduceRight<ModelHandler>(
    (next, m) => (m.wrapModelCall ? (request) => m.wrapModelCall!(request, next) : next),
    (request) => request.model.invoke(request.messages, request.tools),
  )
  const callTool = middleware.reduceRight<ToolHandler>(
    (next, m) => (m.wrapToolCall ? (request) => m.wrapToolCall!(request, next) : next),
    async ({ toolCall, tool }) => ({ role: 'tool', toolCallId: toolCall.id, content: await tool.invoke(toolCall.args) }),
  )

  return {
    async invoke(input: AgentState): Promise<AgentState> {
      const state: AgentState = { messages: [...input.messages] }

      // 依次执行某个节点钩子，返回 true 表示有中间件要求直接结束
      const runHooks = async (hook: 'beforeAgent' | 'beforeModel' | 'afterModel' | 'afterAgent', list: AgentMiddleware[]) => {
        for (const m of list) {
          const update = await m[hook]?.(state)
          if (update?.messages) state.messages.push(...update.messages)
          if (update?.jumpTo === 'end') return true
        }
        return false
      }

      if (!(await runHooks('beforeAgent', middleware))) {
        while (true) {
          if (await runHooks('beforeModel', middleware)) break
          const response = await callModel({ model: options.model, messages: state.messages, tools: options.tools })
          state.messages.push(response)
          if (await runHooks('afterModel', reversed)) break
          if (response.toolCalls.length === 0) break

          for (const toolCall of response.toolCalls) {
            const tool = options.tools.find((t) => t.name === toolCall.name)!
            state.messages.push(await callTool({ toolCall, tool }))
          }
        }
      }
      await runHooks('afterAgent', reversed)
      return state
    },
  }
}
