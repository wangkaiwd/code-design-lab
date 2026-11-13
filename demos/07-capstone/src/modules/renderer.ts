import type { Store } from './store.ts'

export class Renderer {
  #store: Store

  constructor(store: Store) {
    this.#store = store
  }

  run() {
    const { user, count } = this.#store.get()
    return `<p>${user} clicked ${count} times</p>`
  }
}
