import { EventBus } from './event-bus.ts'
import { Renderer } from './renderer.ts'
import { Store } from './store.ts'
import type { Events, State } from './types.ts'

// 门面只做两件事：装配子模块、转发少量公共方法。
// 依赖方向是单向的：Renderer → Store → EventBus，子模块都不知道 LibraryX 的存在。
export class LibraryX {
  #events = new EventBus<Events>()
  #store: Store
  #renderer: Renderer

  constructor(initial: State) {
    this.#store = new Store(this.#events, initial)
    this.#renderer = new Renderer(this.#store)
  }

  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void) {
    return this.#events.on(type, handler)
  }

  setState(patch: Partial<State>) {
    this.#store.set(patch)
  }

  render() {
    return this.#renderer.run()
  }
}
