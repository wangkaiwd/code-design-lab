import { generateText } from './generate-text.ts'
import type { LanguageModel } from './provider.ts'
import { anthropic } from './providers/anthropic.ts'
import { openai } from './providers/openai.ts'

// 用户也能自己实现接口接入新模型，核心和已有 provider 都不需要改
const localEcho: LanguageModel = {
  provider: 'local',
  modelId: 'echo',
  async doGenerate({ messages }) {
    const text = `echo：${messages.at(-1)?.content}`
    return { text, usage: { inputTokens: 0, outputTokens: 0 } }
  },
}

for (const model of [openai('gpt-x'), anthropic('claude-x'), localEcho]) {
  console.log(`\n— ${model.provider}/${model.modelId} —`)
  const { text, usage } = await generateText({ model, system: '回答尽量简短', prompt: '你好' })
  console.log(`  text:  ${text}`)
  console.log(`  usage: ${JSON.stringify(usage)}`)
}
