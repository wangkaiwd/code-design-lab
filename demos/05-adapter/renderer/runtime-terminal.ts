import { createRenderer } from './runtime-core.ts'

type TermNode = {
  type: string
  ansi: number | undefined
  text: string
  children: TermNode[]
  parent: TermNode | null
}

const ANSI_COLORS: Record<string, number> = { red: 31, green: 32, yellow: 33, cyan: 36 }

export function createRoot(): TermNode {
  return { type: 'root', ansi: undefined, text: '', children: [], parent: null }
}

export const { render } = createRenderer<TermNode>({
  createElement(type) {
    return { type, ansi: undefined, text: '', children: [], parent: null }
  },
  setElementText(el, text) {
    el.text = text
    el.children = []
  },
  insert(child, parent, anchor) {
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index === -1) parent.children.push(child)
    else parent.children.splice(index, 0, child)
    child.parent = parent
  },
  remove(child) {
    const siblings = child.parent?.children ?? []
    siblings.splice(siblings.indexOf(child), 1)
    child.parent = null
  },
  nextSibling(node) {
    const siblings = node.parent?.children ?? []
    return siblings[siblings.indexOf(node) + 1] ?? null
  },
  // 平台差异集中在这里：终端没有 CSS，color 属性要翻译成 ANSI 转义码
  patchProp(el, key, _prev, next) {
    if (key === 'color') el.ansi = ANSI_COLORS[next as string]
  },
})

export function paint(root: TermNode) {
  const lines: string[] = []
  const walk = (node: TermNode, depth: number) => {
    if (node.text) {
      const text = node.ansi ? `\x1b[${node.ansi}m${node.text}\x1b[0m` : node.text
      lines.push(`${'  '.repeat(depth)}${node.type === 'title' ? '■ ' : '· '}${text}`)
    }
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return lines.join('\n')
}
