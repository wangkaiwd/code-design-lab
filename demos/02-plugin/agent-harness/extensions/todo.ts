import type { ExtensionAPI } from '../harness.ts'

export default function todo(pi: ExtensionAPI) {
  const items: string[] = []

  pi.registerTool({
    name: 'todo',
    description: '添加一条待办',
    execute({ text }) {
      items.push(text)
      return `已添加待办「${text}」`
    },
  })

  pi.on('agent_end', (_event, ctx) => {
    if (items.length > 0) ctx.notify(`当前待办：${items.join('、')}`)
  })
}
