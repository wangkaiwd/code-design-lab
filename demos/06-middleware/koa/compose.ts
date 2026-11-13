export type Next = () => Promise<void>
export type Middleware<Ctx> = (ctx: Ctx, next: Next) => Promise<void> | void

// 与 koa-compose 的实现思路一致：dispatch(i) 执行第 i 个中间件，并把 dispatch(i + 1) 作为它的 next。
// async 函数会把同步抛出的异常也转成 rejection，所以不需要 koa-compose 里的 try/catch + Promise.resolve
export function compose<Ctx>(middleware: Middleware<Ctx>[]) {
  return (ctx: Ctx) => {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      await middleware[i]?.(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}
