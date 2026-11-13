import type { EventBus } from './event-bus.ts'
import type { Events, State } from './types.ts'

export class Store {
  #events: EventBus<Events>
  #state: State

  constructor(events: EventBus<Events>, initial: State) {
    this.#events = events
    // State 只有基本类型字段：复制切断初始对象的引用，冻结保证所有修改都经过 set。
    this.#state = Object.freeze({ ...initial })
  }

  get() {
    return this.#state
  }

  set(patch: Partial<State>) {
    const prev = this.#state
    this.#state = Object.freeze({ ...prev, ...patch })
    this.#events.emit('change', { prev, next: this.#state })
  }
}
