export type Message = { role: 'system' | 'user' | 'assistant'; content: string }

export type CallParams = { messages: Message[]; maxTokens?: number }

export type GenerateResult = {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

// 对应 @ai-sdk/provider 的 LanguageModelV4：核心函数只认这个接口，厂商差异都封装在各 provider 里
export interface LanguageModel {
  provider: string
  modelId: string
  doGenerate(params: CallParams): Promise<GenerateResult>
}
