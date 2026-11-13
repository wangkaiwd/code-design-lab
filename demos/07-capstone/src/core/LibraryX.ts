import { Renderer } from '../modules/renderer.ts'
import { Store } from '../modules/store.ts'
import { Hook } from './hooks.ts'
import type { ChangeEvent, Options, Plugin, State } from './types.ts'

export class LibraryX {
  readonly hooks = {
    init: new Hook<[options: Options]>(),
    change: new Hook<[event: ChangeEvent]>(),
  }

  #options: Options
  #store: Store
  #renderer: Renderer

  constructor(options: Options) {
    this.#store = new Store(options.initialState, (event) => this.hooks.change.call(event))
    this.#options = { initialState: this.#store.get() }
    this.#renderer = new Renderer(this.#store)
  }

  use(plugin: Plugin) {
    plugin(this)
    return this
  }

  init() {
    this.hooks.init.call(this.#options)
    return this
  }

  getState() {
    return this.#store.get()
  }

  setState(patch: Partial<State>) {
    this.#store.set(patch)
  }

  render() {
    return this.#renderer.run()
  }
}
