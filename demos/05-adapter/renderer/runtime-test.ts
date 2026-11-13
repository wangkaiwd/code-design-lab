import { createRenderer } from './runtime-core.ts'

// 参考 @vue/runtime-test：宿主节点是普通 JS 对象，并记录核心调用了哪些操作，Vue 自己的单测就用它跑
export type TestNode = {
  tag: string
  props: Record<string, unknown>
  text: string
  children: TestNode[]
  parent: TestNode | null
}

let ops: string[] = []

export function takeOps() {
  const result = ops
  ops = []
  return result
}

export function createRoot(): TestNode {
  return { tag: 'root', props: {}, text: '', children: [], parent: null }
}

export const { render } = createRenderer<TestNode>({
  createElement(tag) {
    ops.push(`createElement(${tag})`)
    return { tag, props: {}, text: '', children: [], parent: null }
  },
  setElementText(el, text) {
    ops.push(`setElementText(${el.tag}, ${JSON.stringify(text)})`)
    el.text = text
    el.children = []
  },
  insert(child, parent, anchor) {
    ops.push(`insert(${child.tag} → ${parent.tag})`)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index === -1) parent.children.push(child)
    else parent.children.splice(index, 0, child)
    child.parent = parent
  },
  remove(child) {
    ops.push(`remove(${child.tag})`)
    const siblings = child.parent?.children ?? []
    siblings.splice(siblings.indexOf(child), 1)
    child.parent = null
  },
  nextSibling(node) {
    const siblings = node.parent?.children ?? []
    return siblings[siblings.indexOf(node) + 1] ?? null
  },
  patchProp(el, key, _prev, next) {
    ops.push(`patchProp(${el.tag}.${key} = ${JSON.stringify(next)})`)
    if (next === undefined) delete el.props[key]
    else el.props[key] = next
  },
})

export function serialize(node: TestNode): string {
  const attrs = Object.entries(node.props)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('')
  return `<${node.tag}${attrs}>${node.text}${node.children.map(serialize).join('')}</${node.tag}>`
}
