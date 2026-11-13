import { compose, type Middleware } from './compose.ts'

export type Request = { path: string; headers?: Record<string, string> }

export type Context = {
  path: string
  headers: Record<string, string>
  status: number
  body: unknown
}

// 核心只有"收集中间件 + 组合执行"，鉴权、路由、日志、错误处理全部是中间件
export class MiniKoa {
  #middleware: Middleware<Context>[] = []

  use(fn: Middleware<Context>) {
    this.#middleware.push(fn)
    return this
  }

  async handle(request: Request) {
    const ctx: Context = { path: request.path, headers: request.headers ?? {}, status: 404, body: 'Not Found' }
    await compose(this.#middleware)(ctx)
    return ctx
  }
}
