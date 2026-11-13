import path from 'node:path/posix'
import type { Plugin } from '../plugin-driver.ts'

export const memoryFs = (files: Record<string, string>): Plugin => ({
  name: 'memory-fs',
  resolveId(source, importer) {
    if (!importer) return source
    if (!source.startsWith('.')) return
    const id = path.resolve(path.dirname(importer), source)
    return id.endsWith('.js') ? id : `${id}.js`
  },
  load: (id) => files[id],
})
