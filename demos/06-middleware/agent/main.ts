import { createAgent } from './create-agent.ts'
import { logging, modelCallLimit, modelFallback, toolRetry } from './middlewares.ts'
import { backupModel, createWeatherTool, primaryModel } from './models.ts'

const question = { role: 'user' as const, content: '杭州天气怎么样？' }

console.log('— 主模型限流、工具第一次超时，都由中间件兜住 —')
const agent = createAgent({
  model: primaryModel,
  tools: [createWeatherTool()],
  middleware: [logging, modelFallback(backupModel), toolRetry(2), modelCallLimit(5)],
})
const { messages } = await agent.invoke({ messages: [question] })
console.log(`  最终回答：${messages.at(-1)!.content}`)

// 只允许调用 1 次模型：第一次请求工具后，第二次 beforeModel 用 jumpTo 直接结束
console.log('\n— 调用次数达到上限，beforeModel 提前结束循环 —')
const limited = createAgent({
  model: backupModel,
  tools: [createWeatherTool()],
  middleware: [logging, toolRetry(2), modelCallLimit(1)],
})
const result = await limited.invoke({ messages: [question] })
console.log(`  最终回答：${result.messages.at(-1)!.content}`)
