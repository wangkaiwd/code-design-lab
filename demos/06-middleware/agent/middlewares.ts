import { type ChatModel, createMiddleware } from './create-agent.ts'

export const logging = createMiddleware({
  name: 'logging',
  beforeAgent: (state) => console.log(`  [logging] beforeAgent  共 ${state.messages.length} 条消息`),
  beforeModel: (state) => console.log(`  [logging] beforeModel  共 ${state.messages.length} 条消息`),
  afterModel(state) {
    const last = state.messages.at(-1)!
    if (last.role !== 'ai') return
    const summary = last.toolCalls.length > 0 ? `调用工具 ${last.toolCalls.map((call) => call.name).join(', ')}` : `回答「${last.content}」`
    console.log(`  [logging] afterModel   ${summary}`)
  },
  afterAgent: (state) => console.log(`  [logging] afterAgent   共 ${state.messages.length} 条消息`),
})

// 对应 LangChain 的 modelFallbackMiddleware：主模型失败就换个模型重新调用 handler
export const modelFallback = (fallback: ChatModel) =>
  createMiddleware({
    name: 'modelFallback',
    async wrapModelCall(request, handler) {
      try {
        return await handler(request)
      } catch (error) {
        console.log(`  [modelFallback] ${request.model.name} 失败（${(error as Error).message}），改用 ${fallback.name}`)
        return handler({ ...request, model: fallback })
      }
    },
  })

// 对应 LangChain 的 toolRetryMiddleware：同一个 handler 可以调用多次，这是节点钩子做不到的
export const toolRetry = (maxRetries: number) =>
  createMiddleware({
    name: 'toolRetry',
    async wrapToolCall(request, handler) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await handler(request)
        } catch (error) {
          if (attempt >= maxRetries) throw error
          console.log(`  [toolRetry] ${request.toolCall.name} 失败（${(error as Error).message}），第 ${attempt + 1} 次重试`)
        }
      }
    },
  })

// 对应 LangChain 的 modelCallLimitMiddleware：超过上限就用 jumpTo 跳到结束。
// LangChain 把计数放在 agent state 里，这里为了简单用闭包，所以同一个实例不能并发使用
export const modelCallLimit = (runLimit: number) => {
  let count = 0
  return createMiddleware({
    name: 'modelCallLimit',
    beforeAgent() {
      count = 0
    },
    beforeModel() {
      if (count < runLimit) {
        count++
        return
      }
      console.log(`  [modelCallLimit] 已调用 ${runLimit} 次模型，提前结束`)
      return { jumpTo: 'end', messages: [{ role: 'ai', content: `已达到模型调用上限（${runLimit} 次）`, toolCalls: [] }] }
    },
  })
}
