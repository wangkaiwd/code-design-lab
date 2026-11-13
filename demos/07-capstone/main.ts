import { createX } from './src/index.ts'
import { createPersistence, memoryStorage } from './src/features/persistence.ts'
import { logger } from './src/plugins/logger.ts'

const storage = memoryStorage()

console.log('— 实例 a：日志通过 hook 观察状态，持久化能力显式创建 —')
const a = createX({ initialState: { user: 'Ada', count: 0 } }).use(logger).init()
const persistenceA = createPersistence(a, storage)
a.setState({ count: 5 })
await persistenceA.save()
console.log(`  ${a.render()}`)

console.log('\n— 实例 b：从同一个 storage 恢复，没有日志输出 —')
const b = createX({ initialState: { user: 'Ada', count: 0 } }).init()
await createPersistence(b, storage).restore()
console.log(`  ${b.render()}`)

console.log('\n— 普通实例无需知道持久化方法，状态只能通过 setState 修改 —')
const bare = createX({ initialState: { user: 'Bob', count: 0 } }).init()
console.log(`  ${bare.render()}，状态已冻结：${Object.isFrozen(bare.getState())}`)

const off = bare.hooks.change.tap('temporary', ({ next }) => console.log(`  [temporary] count=${next.count}`))
bare.setState({ count: 1 })
off()
bare.setState({ count: 2 })
console.log('  取消订阅后，第二次修改没有触发 temporary')
