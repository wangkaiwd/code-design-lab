import type { Plugin } from './plugin-driver.ts'
import { alias } from './plugins/alias.ts'
import { banner } from './plugins/banner.ts'
import { define } from './plugins/define.ts'
import { memoryFs } from './plugins/memory-fs.ts'
import { minify } from './plugins/minify.ts'
import { rollup } from './rollup.ts'

export type UserConfig = {
  files: Record<string, string>
  alias?: Record<string, string>
  define?: Record<string, string>
  minify?: boolean
  banner?: string
  plugins?: Plugin[]
}

// 对应 Vite 的 resolvePlugins：配置项本质上是内置插件的开关，
// 用户插件按 enforce 分成三组，插到内置插件之间
export function resolvePlugins(config: UserConfig): Plugin[] {
  const userPlugins = config.plugins ?? []
  const pre = userPlugins.filter((plugin) => plugin.enforce === 'pre')
  const normal = userPlugins.filter((plugin) => !plugin.enforce)
  const post = userPlugins.filter((plugin) => plugin.enforce === 'post')

  return [
    config.alias && alias(config.alias),
    ...pre,
    memoryFs(config.files),
    ...normal,
    config.define && define(config.define),
    ...post,
    config.minify && minify(),
    config.banner && banner(config.banner),
  ].filter((plugin) => !!plugin)
}

export function build(input: string, config: UserConfig) {
  return rollup({ input, plugins: resolvePlugins(config) })
}
