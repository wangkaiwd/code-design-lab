import { createCheckpoint, type RestoreScope, type TaskState } from './checkpoint.ts'

const task: TaskState = {
  messages: [{ role: 'user', content: '把标题改成 Hello' }],
  files: { 'page.ts': 'export const title = "Old"' },
}
const checkpoint = createCheckpoint(task)

// 模拟 AI 执行一次修改，产生文件变更和新的会话记录。
task.files['page.ts'] = 'export const title = "Hello"'
task.messages.push({ role: 'assistant', content: '标题已经修改为 Hello' })

const scopes: RestoreScope[] = ['files', 'conversation', 'both']
for (const scope of scopes) {
  const restored = checkpoint.restore(task, scope)
  console.log(`— 恢复 ${scope} —`)
  console.log(`  会话条数：${restored.messages.length}`)
  console.log(`  文件内容：${restored.files['page.ts']}`)
}

console.log(`\n当前任务保持不变：${task.messages.length} 条消息，${task.files['page.ts']}`)
