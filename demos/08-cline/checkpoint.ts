export type Message = { role: 'user' | 'assistant'; content: string }
export type TaskState = { messages: Message[]; files: Record<string, string> }
export type RestoreScope = 'files' | 'conversation' | 'both'

// 参照 Cline 的检查点恢复：会话和工作区是两个独立的状态维度。
// 这里只保存普通数据的内存快照；Cline 的实际文件恢复还涉及 Git 和执行中的任务。
export function createCheckpoint(state: TaskState) {
  const snapshot = structuredClone(state)

  return {
    restore(current: TaskState, scope: RestoreScope): TaskState {
      // 返回新状态，保留当前状态和检查点，允许从同一个检查点尝试不同恢复方式。
      return structuredClone({
        messages: scope === 'files' ? current.messages : snapshot.messages,
        files: scope === 'conversation' ? current.files : snapshot.files,
      })
    },
  }
}
