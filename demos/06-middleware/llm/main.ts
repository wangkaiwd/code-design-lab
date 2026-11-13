import { generateText } from '../../05-adapter/llm/generate-text.ts'
import { openai } from '../../05-adapter/llm/providers/openai.ts'
import { cache, logger, redactPhone } from './middlewares.ts'
import { wrapLanguageModel } from './wrap-language-model.ts'

// redactPhone 放最外层：logger 和 cache 看到的都是脱敏后的参数，缓存 key 也不含手机号
const model = wrapLanguageModel({
  model: openai('gpt-x'),
  middleware: [redactPhone, logger, cache()],
})

const prompts = ['我的手机号是 13800138000，帮我记住', '我的手机号是 13800138000，帮我记住', '换个问题']

for (const prompt of prompts) {
  console.log(`\ngenerateText("${prompt}")`)
  const { text } = await generateText({ model, prompt })
  console.log(`  text: ${text}`)
}
