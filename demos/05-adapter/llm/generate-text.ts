import type { LanguageModel, Message } from './provider.ts'

// 核心函数里没有任何 if (provider === 'openai') 之类的分支
export async function generateText(options: {
  model: LanguageModel
  system?: string
  prompt: string
  maxTokens?: number
}) {
  const messages: Message[] = []
  if (options.system) messages.push({ role: 'system', content: options.system })
  messages.push({ role: 'user', content: options.prompt })

  return options.model.doGenerate({ messages, maxTokens: options.maxTokens })
}
