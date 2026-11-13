import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventBus } from '../01-facade/event-bus.ts'
import { Store as FacadeStore } from '../01-facade/store.ts'
import type { Events, State } from '../01-facade/types.ts'
import { createCheckpoint, type TaskState } from '../08-cline/checkpoint.ts'
import { createX } from '../07-capstone/src/index.ts'
import { Store as CapstoneStore } from '../07-capstone/src/modules/store.ts'
import { createPersistence, memoryStorage } from '../07-capstone/src/features/persistence.ts'

test('两个 Store 都拥有独立的只读状态，修改只能经过 set', () => {
  const factories = [
    (initial: State, notify: (event: Events['change']) => void) => {
      const events = new EventBus<Events>()
      events.on('change', notify)
      return new FacadeStore(events, initial)
    },
    (initial: State, notify: (event: Events['change']) => void) => new CapstoneStore(initial, notify),
  ]

  for (const createStore of factories) {
    const initial = { user: 'Ada', count: 0 }
    const changes: Events['change'][] = []
    const store = createStore(initial, (event) => changes.push(event))
    const before = store.get()
    initial.count = 99
    assert.equal(store.get().count, 0)
    assert.equal(Reflect.set(before, 'count', 10), false)
    assert.equal(changes.length, 0)

    store.set({ count: 1 })
    assert.equal(before.count, 0)
    assert.deepEqual(changes, [{ prev: { user: 'Ada', count: 0 }, next: { user: 'Ada', count: 1 } }])
    assert.equal(Reflect.set(changes[0].next, 'count', 20), false)
    assert.equal(store.get().count, 1)
  }
})

test('持久化能力显式创建，两个实例可以通过同一存储恢复状态', async () => {
  const storage = memoryStorage()
  const a = createX({ initialState: { user: 'Ada', count: 0 } })
  const b = createX({ initialState: { user: 'Bob', count: 0 } })
  a.setState({ count: 5 })
  await createPersistence(a, storage).save()
  await createPersistence(b, storage).restore()

  assert.deepEqual(b.getState(), { user: 'Ada', count: 5 })
  assert.equal('persist' in a, false)
  assert.equal('restore' in b, false)
})

test('未保存时恢复保持原状态，存储错误原样交给调用者', async () => {
  const x = createX({ initialState: { user: 'Ada', count: 0 } })
  await createPersistence(x, memoryStorage()).restore()
  assert.equal(x.getState().count, 0)

  const error = new Error('storage unavailable')
  const persistence = createPersistence(x, {
    async get() { throw error },
    async set() { throw error },
  })
  await assert.rejects(persistence.save(), error)
  await assert.rejects(persistence.restore(), error)
})

test('临时 hook 取消订阅后不再接收状态变化', () => {
  const x = createX({ initialState: { user: 'Ada', count: 0 } })
  const counts: number[] = []
  const off = x.hooks.change.tap('temporary', ({ next }) => counts.push(next.count))
  x.setState({ count: 1 })
  off()
  x.setState({ count: 2 })
  assert.deepEqual(counts, [1])
})

test('Cline 检查点区分文件、会话和整体恢复', () => {
  const initial: TaskState = {
    messages: [{ role: 'user', content: '修改标题' }],
    files: { 'page.ts': 'Old' },
  }
  const task = structuredClone(initial)
  const checkpoint = createCheckpoint(task)
  task.files['page.ts'] = 'Hello'
  task.files['new.ts'] = 'new file'
  task.messages.push({ role: 'assistant', content: '已修改' })

  assert.deepEqual(checkpoint.restore(task, 'files'), { messages: task.messages, files: initial.files })
  assert.deepEqual(checkpoint.restore(task, 'conversation'), { messages: initial.messages, files: task.files })
  assert.deepEqual(checkpoint.restore(task, 'both'), initial)
  assert.equal(task.messages.length, 2)
  assert.equal(task.files['page.ts'], 'Hello')

  const restored = checkpoint.restore(task, 'both')
  restored.files['page.ts'] = 'another attempt'
  restored.messages[0].content = 'another question'
  assert.deepEqual(checkpoint.restore(task, 'both'), initial)
})
