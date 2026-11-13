import { type Bundle, type Module, type Plugin, PluginDriver } from './plugin-driver.ts'

const IMPORT = /^import .+ from ['"](.+)['"]\n?/gm

// 核心只负责"遍历模块图，并在固定时机调用 hook"，自己只会从 import 语句里找依赖、按依赖顺序拼接。
// 路径怎么解析、文件从哪里读、代码怎么转换，核心一概不知，全部由插件决定。
export async function rollup({ input, plugins }: { input: string; plugins: Plugin[] }): Promise<Bundle> {
  const driver = new PluginDriver(plugins)
  await driver.hookParallel('buildStart')

  const seen = new Set<string>()
  const modules: Module[] = []
  const build = async (source: string, importer?: string) => {
    const id = await driver.hookFirst('resolveId', source, importer)
    if (id === undefined) throw new Error(`没有插件能解析 "${source}"`)
    if (seen.has(id)) return
    seen.add(id)

    const raw = await driver.hookFirst('load', id)
    if (raw === undefined) throw new Error(`没有插件能加载 "${id}"`)

    const code = await driver.hookReduceArg0('transform', raw, id)
    for (const [, dep] of code.matchAll(IMPORT)) await build(dep, id)
    // 后序：依赖都处理完才记录自己，拼接时依赖自然排在前面
    modules.push({ id, code })
  }
  await build(input)

  const chunk = modules.map(({ id, code }) => `// ${id}\n${code.replace(IMPORT, '')}`).join('\n\n')
  const bundle: Bundle = { modules, output: await driver.hookReduceArg0('renderChunk', chunk) }
  await driver.hookSeq('generateBundle', bundle)
  return bundle
}
