import { $ } from './core.ts'

// 模拟某个第三方插件：
// 1. 定义了同名的 addClass，会静默覆盖 attributes 模块的实现，TS 和运行时都不报错
// 2. 通过 this.trigger 隐式依赖 events 模块；如果 events 没被加载，类型检查照样通过，运行时才会报错
$.fn.extend({
  addClass(name) {
    for (const el of this.elements) el.classes.add(`legacy-${name}`)
    return this.trigger('classchange')
  },
})
