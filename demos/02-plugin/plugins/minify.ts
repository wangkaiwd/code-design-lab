import type { Plugin } from '../plugin-driver.ts'

// 与 Vite 一致，压缩发生在 renderChunk，处理的是合并后的整个 chunk
export const minify = (): Plugin => ({
  name: 'minify',
  renderChunk: (code) =>
    code
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('//'))
      .join('\n'),
})
