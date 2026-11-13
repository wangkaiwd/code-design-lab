import assert from 'node:assert/strict'
import { EventBus } from './event-bus.ts'
import { LibraryX } from './LibraryX.ts'
import { Renderer } from './renderer.ts'
import { Store } from './store.ts'
import type { Events } from './types.ts'

console.log('— 通过门面使用 —')
const x = new LibraryX({ user: 'Ada', count: 0 })
const off = x.on('change', ({ prev, next }) => console.log(`  [change] count: ${prev.count} → ${next.count}`))
x.setState({ count: 1 })
x.setState({ count: 2 })
off()
x.setState({ count: 3 })
console.log(`  ${x.render()}`)

console.log('\n— 门面对外暴露的 API —')
console.log(' ', Object.getOwnPropertyNames(LibraryX.prototype).filter((key) => key !== 'constructor'))

console.log('\n— 子模块可以脱离 LibraryX 单独组装、单独测试 —')
const store = new Store(new EventBus<Events>(), { user: 'test', count: 0 })
store.set({ count: 42 })
assert.equal(new Renderer(store).run(), '<p>test clicked 42 times</p>')
console.log('  Store + Renderer 测试通过')
