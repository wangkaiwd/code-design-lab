export type VNode = {
  type: string
  props: Record<string, unknown>
  children: string | VNode[]
  el?: unknown
}

export function h(type: string, props: Record<string, unknown> = {}, children: string | VNode[] = []): VNode {
  return { type, props, children }
}

// 对应 Vue 的 RendererOptions：平台只需实现这组原子操作，diff 逻辑完全在核心里
export interface RendererOptions<HostNode> {
  createElement(type: string): HostNode
  setElementText(el: HostNode, text: string): void
  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void
  remove(child: HostNode): void
  nextSibling(node: HostNode): HostNode | null
  patchProp(el: HostNode, key: string, prev: unknown, next: unknown): void
}

export function createRenderer<HostNode>(options: RendererOptions<HostNode>) {
  const { createElement, setElementText, insert, remove, nextSibling, patchProp } = options
  const roots = new Map<HostNode, VNode>()

  function mount(vnode: VNode, container: HostNode, anchor: HostNode | null = null) {
    const el = createElement(vnode.type)
    vnode.el = el
    for (const [key, value] of Object.entries(vnode.props)) patchProp(el, key, undefined, value)
    if (typeof vnode.children === 'string') setElementText(el, vnode.children)
    else for (const child of vnode.children) mount(child, el)
    insert(el, container, anchor)
  }

  function patch(prev: VNode, next: VNode, container: HostNode) {
    const el = prev.el as HostNode
    if (prev.type !== next.type) {
      const anchor = nextSibling(el)
      remove(el)
      mount(next, container, anchor)
      return
    }

    next.el = el
    for (const key of new Set([...Object.keys(prev.props), ...Object.keys(next.props)])) {
      if (prev.props[key] !== next.props[key]) patchProp(el, key, prev.props[key], next.props[key])
    }
    patchChildren(prev, next, el)
  }

  function patchChildren(prev: VNode, next: VNode, el: HostNode) {
    if (typeof next.children === 'string') {
      if (next.children !== prev.children) setElementText(el, next.children)
      return
    }
    if (typeof prev.children === 'string') {
      setElementText(el, '')
      for (const child of next.children) mount(child, el)
      return
    }

    // 简化版：按下标逐个对比，不处理 key
    const prevChildren = prev.children
    const nextChildren = next.children
    const common = Math.min(prevChildren.length, nextChildren.length)
    for (let i = 0; i < common; i++) patch(prevChildren[i], nextChildren[i], el)
    for (const child of nextChildren.slice(common)) mount(child, el)
    for (const child of prevChildren.slice(common)) remove(child.el as HostNode)
  }

  return {
    render(vnode: VNode, container: HostNode) {
      const prev = roots.get(container)
      if (prev) patch(prev, vnode, container)
      else mount(vnode, container)
      roots.set(container, vnode)
    },
  }
}
