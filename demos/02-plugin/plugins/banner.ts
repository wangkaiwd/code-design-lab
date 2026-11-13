import type { Plugin } from '../plugin-driver.ts'

export const banner = (text: string): Plugin => ({
  name: 'banner',
  renderChunk: (code) => `/*! ${text} */\n${code}`,
})
