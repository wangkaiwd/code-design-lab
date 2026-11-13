import type { CallParams, GenerateResult, LanguageModel } from '../../05-adapter/llm/provider.ts'

export type LanguageModelMiddleware = {
  transformParams?: (options: { params: CallParams }) => CallParams | Promise<CallParams>
  wrapGenerate?: (options: {
    doGenerate: () => Promise<GenerateResult>
    params: CallParams
    model: LanguageModel
  }) => Promise<GenerateResult>
}

// 包装后仍然是一个 LanguageModel，所以 generateText 和 provider 都无需改动。
// 数组里第一个中间件在最外层，最后一个直接包着原始模型（与 AI SDK 的顺序一致）。
export function wrapLanguageModel(options: { model: LanguageModel; middleware: LanguageModelMiddleware[] }): LanguageModel {
  return options.middleware.reduceRight<LanguageModel>(
    (inner, middleware) => ({
      ...inner,
      async doGenerate(params) {
        const transformed = middleware.transformParams ? await middleware.transformParams({ params }) : params
        const doGenerate = () => inner.doGenerate(transformed)
        return middleware.wrapGenerate
          ? middleware.wrapGenerate({ doGenerate, params: transformed, model: inner })
          : doGenerate()
      },
    }),
    options.model,
  )
}
