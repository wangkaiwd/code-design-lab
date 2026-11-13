import { MiniKoa, type Request } from './app.ts'

const app = new MiniKoa()
  .use(async (ctx, next) => {
    console.log('  → errorHandler')
    try {
      await next()
    } catch (error) {
      ctx.status = 500
      ctx.body = (error as Error).message
    }
    console.log('  ← errorHandler')
  })
  .use(async (ctx, next) => {
    const start = performance.now()
    console.log('    → logger')
    await next()
    console.log(`    ← logger ${ctx.status} ${(performance.now() - start).toFixed(2)}ms`)
  })
  .use(async (ctx, next) => {
    console.log('      → auth')
    if (ctx.headers.authorization !== 'token') {
      ctx.status = 401
      ctx.body = 'Unauthorized'
      console.log('      ← auth（未调用 next，后面的中间件不会执行）')
      return
    }
    await next()
    console.log('      ← auth')
  })
  .use((ctx) => {
    console.log('        → router')
    if (ctx.path === '/boom') throw new Error('router 抛出的异常')
    if (ctx.path === '/hello') {
      ctx.status = 200
      ctx.body = 'Hello'
    }
  })

const requests: Request[] = [
  { path: '/hello', headers: { authorization: 'token' } },
  { path: '/hello' },
  { path: '/boom', headers: { authorization: 'token' } },
  { path: '/missing', headers: { authorization: 'token' } },
]

for (const request of requests) {
  console.log(`\nGET ${request.path} ${request.headers ? '(已登录)' : '(未登录)'}`)
  const { status, body } = await app.handle(request)
  console.log(`  响应：${status} ${body}`)
}

console.log('\n— 同一个中间件里调用两次 next —')
const broken = new MiniKoa().use(async (_ctx, next) => {
  await next()
  await next()
})
await broken.handle({ path: '/' }).catch((error: Error) => console.log(`  ${error.message}`))
