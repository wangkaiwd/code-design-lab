import type { LanguageModel } from '../provider.ts'

type MessagesRequest = {
  model: string
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  max_tokens: number
}
type MessagesResponse = {
  content: { type: 'text'; text: string }[]
  usage: { input_tokens: number; output_tokens: number }
}

// 模拟 Anthropic 服务端，返回 Messages API 格式的响应
async function fakeServer(body: MessagesRequest): Promise<MessagesResponse> {
  const prompt = (body.system ?? '') + body.messages.map((message) => message.content).join('')
  const text = `Claude 收到：${body.messages.at(-1)?.content}`
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: prompt.length, output_tokens: text.length },
  }
}

export function anthropic(modelId: string): LanguageModel {
  return {
    provider: 'anthropic',
    modelId,
    async doGenerate({ messages, maxTokens }) {
      // 与 OpenAI 的差异：system 是顶层字段而不是一条消息；max_tokens 必填
      const body: MessagesRequest = {
        model: modelId,
        system: messages.find((message) => message.role === 'system')?.content,
        messages: messages.flatMap(({ role, content }) => (role === 'system' ? [] : [{ role, content }])),
        max_tokens: maxTokens ?? 1024,
      }
      console.log(`  [anthropic] POST /v1/messages ${JSON.stringify(body)}`)
      const response = await fakeServer(body)
      return {
        text: response.content.map((block) => block.text).join(''),
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      }
    },
  }
}
