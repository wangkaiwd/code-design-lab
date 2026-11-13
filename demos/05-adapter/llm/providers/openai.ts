import type { LanguageModel, Message } from '../provider.ts'

type ChatCompletionRequest = { model: string; messages: Message[]; max_completion_tokens?: number }
type ChatCompletionResponse = {
  choices: { message: { role: 'assistant'; content: string } }[]
  usage: { prompt_tokens: number; completion_tokens: number }
}

// 模拟 OpenAI 服务端，返回 Chat Completions 格式的响应
async function fakeServer(body: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const prompt = body.messages.map((message) => message.content).join('')
  const content = `OpenAI 收到：${body.messages.at(-1)?.content}`
  return {
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: prompt.length, completion_tokens: content.length },
  }
}

export function openai(modelId: string): LanguageModel {
  return {
    provider: 'openai',
    modelId,
    async doGenerate({ messages, maxTokens }) {
      const body: ChatCompletionRequest = { model: modelId, messages, max_completion_tokens: maxTokens }
      console.log(`  [openai] POST /v1/chat/completions ${JSON.stringify(body)}`)
      const response = await fakeServer(body)
      return {
        text: response.choices[0].message.content,
        usage: { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens },
      }
    },
  }
}
