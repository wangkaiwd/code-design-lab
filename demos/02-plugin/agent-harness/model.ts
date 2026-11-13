import type { Model } from './harness.ts'

// 模拟模型：根据最后一条消息决定调哪个工具。指令格式为「读 <path>」「写 <path> <content>」「记 <text>」
export const model: Model = async ({ systemPrompt, messages, tools }) => {
  const last = messages.at(-1)!
  if (last.role === 'tool') {
    return { content: last.isError ? `没能完成：${last.content}` : `完成：${last.content}`, toolCalls: [] }
  }

  console.log(`  [model] tools=${tools.join(',')} system="${systemPrompt.replaceAll('\n', ' ')}"`)

  const [action, first, ...rest] = last.content.split(' ')
  if (action === '读') return { content: '', toolCalls: [{ name: 'read', input: { path: first } }] }
  if (action === '写') return { content: '', toolCalls: [{ name: 'write', input: { path: first, content: rest.join(' ') } }] }
  if (action === '记' && tools.includes('todo')) return { content: '', toolCalls: [{ name: 'todo', input: { text: first } }] }
  return { content: '这个我做不了', toolCalls: [] }
}
