import type { Plugin } from '../plugin-driver.ts'

export const define = (values: Record<string, string>): Plugin => ({
  name: 'define',
  transform: (code) =>
    Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(key, JSON.stringify(value)), code),
})
