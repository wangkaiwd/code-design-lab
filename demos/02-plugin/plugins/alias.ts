import type { Plugin } from '../plugin-driver.ts'

export const alias = (entries: Record<string, string>): Plugin => ({
  name: 'alias',
  resolveId(source) {
    for (const [find, replacement] of Object.entries(entries)) {
      if (!source.startsWith(find)) continue
      const id = `${replacement}${source.slice(find.length)}.js`
      console.log(`  [alias] ${source} → ${id}`)
      return id
    }
  },
})
