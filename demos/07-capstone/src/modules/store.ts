import type { ChangeEvent, State } from '../core/types.ts'

export class Store {
  #state: State
  #onChange: (event: ChangeEvent) => void

  constructor(initial: State, onChange: (event: ChangeEvent) => void) {
    // 当前 State 是扁平对象；有嵌套数据时需要重新决定不可变数据的契约。
    this.#state = Object.freeze({ ...initial })
    this.#onChange = onChange
  }

  get() {
    return this.#state
  }

  set(patch: Partial<State>) {
    const prev = this.#state
    this.#state = Object.freeze({ ...prev, ...patch })
    this.#onChange({ prev, next: this.#state })
  }
}
