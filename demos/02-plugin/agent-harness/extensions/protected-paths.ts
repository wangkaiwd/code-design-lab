import type { ExtensionAPI } from '../harness.ts'

const protectedFiles = ['.env']

export default function protectedPaths(pi: ExtensionAPI) {
  pi.on('tool_call', (event) => {
    if (protectedFiles.includes(event.input.path)) return { block: true, reason: `${event.input.path} 受保护` }
  })
}
