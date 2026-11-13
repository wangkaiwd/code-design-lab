import type { ExtensionAPI } from '../harness.ts'

// 改写工具结果，模型永远看不到原始密钥
export default function redactSecrets(pi: ExtensionAPI) {
  pi.on('tool_result', (event) => {
    if (event.toolName === 'read') return { content: event.content.replace(/sk-\w+/g, 'sk-***') }
  })
}
