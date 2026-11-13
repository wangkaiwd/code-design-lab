import type { GenerateResult } from '../../05-adapter/llm/provider.ts'
import type { LanguageModelMiddleware } from './wrap-language-model.ts'

export const redactPhone: LanguageModelMiddleware = {
  transformParams: ({ params }) => ({
    ...params,
    messages: params.messages.map((message) => ({ ...message, content: message.content.replace(/1\d{10}/g, '[手机号]') })),
  }),
}

export const logger: LanguageModelMiddleware = {
  async wrapGenerate({ doGenerate, model }) {
    const start = performance.now()
    const result = await doGenerate()
    console.log(
      `  [logger] ${model.provider}/${model.modelId} ${(performance.now() - start).toFixed(2)}ms usage=${JSON.stringify(result.usage)}`,
    )
    return result
  },
}

export function cache(): LanguageModelMiddleware {
  const store = new Map<string, GenerateResult>()
  return {
    async wrapGenerate({ doGenerate, params, model }) {
      // 缓存实例可以被多个模型共享，请求的模型身份也是缓存键的一部分。
      const key = JSON.stringify([model.provider, model.modelId, params])
      const hit = store.get(key)
      if (hit) {
        console.log('  [cache] 命中，跳过真实请求')
        return hit
      }
      const result = await doGenerate()
      store.set(key, result)
      return result
    },
  }
}
