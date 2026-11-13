import { $, type El } from './core.ts'

declare module './core.ts' {
  interface Q {
    on(type: string, handler: (el: El) => void): this
    trigger(type: string): this
  }
}

$.fn.extend({
  on(type, handler) {
    for (const el of this.elements) el.listeners.set(type, [...(el.listeners.get(type) ?? []), handler])
    return this
  },
  trigger(type) {
    for (const el of this.elements) el.listeners.get(type)?.forEach((handler) => handler(el))
    return this
  },
})
