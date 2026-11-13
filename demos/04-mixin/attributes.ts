import { $ } from './core.ts'

// 每个模块都要手写一遍类型声明，且 TS 不会检查"声明了的方法是否真的被挂上去了"
declare module './core.ts' {
  interface Q {
    addClass(name: string): this
    hasClass(name: string): boolean
  }
}

$.fn.extend({
  addClass(name) {
    for (const el of this.elements) el.classes.add(name)
    return this
  },
  hasClass(name) {
    return this.elements.some((el) => el.classes.has(name))
  },
})
