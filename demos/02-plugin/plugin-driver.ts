type Awaitable<T> = T | Promise<T>
type Nullable<T> = T | null | undefined

export type Module = { id: string; code: string }
export type Bundle = { modules: Module[]; output: string }

// 插件就是一个普通对象，实现了哪个 hook 就参与哪个阶段
export type Plugin = {
  name: string
  // Vite 扩展的字段，Rollup 本身不认识，由 vite.ts 在交给 Rollup 之前排序
  enforce?: 'pre' | 'post'
  buildStart?: () => Awaitable<void>
  resolveId?: (source: string, importer: string | undefined) => Awaitable<Nullable<string>>
  load?: (id: string) => Awaitable<Nullable<string>>
  transform?: (code: string, id: string) => Awaitable<Nullable<string>>
  renderChunk?: (code: string) => Awaitable<Nullable<string>>
  generateBundle?: (bundle: Bundle) => Awaitable<void>
}

type Hooks = Required<Omit<Plugin, 'name' | 'enforce'>>
export type HookName = keyof Hooks

// 对应 Rollup 的 PluginDriver：hook 怎么组合由 hook 名决定，插件作者只管实现函数
export class PluginDriver {
  #plugins: Plugin[]

  constructor(plugins: Plugin[]) {
    this.#plugins = plugins
  }

  // first：依次调用，第一个返回非 null 的结果生效，适合"谁能处理谁处理"
  async hookFirst<H extends 'resolveId' | 'load'>(hook: H, ...args: Parameters<Hooks[H]>) {
    for (const plugin of this.#plugins) {
      const result = await this.#run(plugin, hook, args)
      if (result != null) return result as string
    }
  }

  // sequential：上一个插件的返回值作为下一个插件的第一个参数，返回 null 表示不改动
  async hookReduceArg0<H extends 'transform' | 'renderChunk'>(hook: H, ...args: Parameters<Hooks[H]>) {
    let [code, ...rest] = args
    for (const plugin of this.#plugins) {
      const result = await this.#run(plugin, hook, [code, ...rest])
      if (result != null) code = result as string
    }
    return code
  }

  // sequential：依次 await，忽略返回值
  async hookSeq<H extends 'generateBundle'>(hook: H, ...args: Parameters<Hooks[H]>) {
    for (const plugin of this.#plugins) await this.#run(plugin, hook, args)
  }

  // parallel：同时启动，全部完成后才继续
  async hookParallel<H extends 'buildStart'>(hook: H, ...args: Parameters<Hooks[H]>) {
    await Promise.all(this.#plugins.map((plugin) => this.#run(plugin, hook, args)))
  }

  #run(plugin: Plugin, hook: HookName, args: unknown[]) {
    const handler = plugin[hook] as ((...args: unknown[]) => unknown) | undefined
    return handler?.(...args)
  }
}
