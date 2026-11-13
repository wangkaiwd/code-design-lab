import type { ExtensionAPI } from '../harness.ts'

// 一个功能同时用到三种接入方式：命令负责开关，before_agent_start 告诉模型，tool_call 兜底拦截
export default function planMode(pi: ExtensionAPI) {
  let enabled = false

  pi.registerCommand('plan', {
    description: '切换只读的计划模式',
    handler(_args, ctx) {
      enabled = !enabled
      ctx.notify(`计划模式已${enabled ? '开启' : '关闭'}`)
    },
  })

  pi.on('before_agent_start', (event) => {
    if (enabled) return { systemPrompt: `${event.systemPrompt}\n当前是计划模式，只读不写。` }
  })

  pi.on('tool_call', (event) => {
    if (enabled && event.toolName === 'write') return { block: true, reason: '计划模式下禁止写文件' }
  })
}
