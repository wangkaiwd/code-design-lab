export type El = {
  tag: string
  classes: Set<string>
  listeners: Map<string, Array<(el: El) => void>>
}

export class Q {
  elements: El[]

  constructor(elements: El[]) {
    this.elements = elements
  }

  // 对应 jQuery.fn.extend：把一批方法直接合并到原型上
  extend(methods: Partial<Q> & ThisType<Q>) {
    Object.assign(this, methods)
  }
}

export function $(...tags: string[]) {
  return new Q(tags.map((tag) => ({ tag, classes: new Set(), listeners: new Map() })))
}

$.fn = Q.prototype
