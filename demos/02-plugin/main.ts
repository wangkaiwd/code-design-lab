import type { HookName, Plugin } from './plugin-driver.ts'
import { rollup } from './rollup.ts'
import { build, resolvePlugins, type UserConfig } from './vite.ts'

const files = {
  '/src/index.js': [
    "import { add } from './math'",
    "import { log } from '@/utils/log'",
    "import { builtAt } from 'virtual:build-info'",
    '// 入口文件',
    'log(`v${__VERSION__}`, builtAt, add(1, 2))',
  ].join('\n'),
  '/src/math.js': '// 加法\nexport const add = (a, b) => a + b',
  '/src/utils/log.js': "export const log = (...args) => console.log('[app]', ...args)",
}

// 虚拟模块：resolveId 认领一个不存在的路径，load 直接返回代码。\0 前缀是 Rollup 约定，告诉其他插件别处理它
const virtualBuildInfo: Plugin = {
  name: 'virtual-build-info',
  enforce: 'pre',
  resolveId: (source) => (source === 'virtual:build-info' ? '\0virtual:build-info' : null),
  load: (id) => (id === '\0virtual:build-info' ? "export const builtAt = '2026-11-05'" : null),
}

// 状态放在闭包里，核心不需要为插件预留任何字段
const report = (): Plugin => {
  let start = 0
  return {
    name: 'report',
    async buildStart() {
      start = performance.now()
      await new Promise((resolve) => setTimeout(resolve, 50))
      console.log('  [report] buildStart 中的异步任务完成，例如清理输出目录')
    },
    generateBundle(bundle) {
      const time = performance.now() - start
      console.log(`  [report] 共 ${bundle.modules.length} 个模块，耗时 ${time.toFixed(1)}ms`)
    },
  }
}

const config: UserConfig = {
  files,
  alias: { '@/': '/src/' },
  define: { __VERSION__: '1.0.0' },
  minify: true,
  banner: 'demo bundle',
  plugins: [report(), virtualBuildInfo],
}

console.log('— 每个 hook 上挂了哪些插件（按调用顺序） —')
const plugins = resolvePlugins(config)
const hooks: HookName[] = ['buildStart', 'resolveId', 'load', 'transform', 'renderChunk', 'generateBundle']
for (const hook of hooks) {
  const names = plugins.filter((plugin) => plugin[hook]).map((plugin) => plugin.name)
  console.log(`  ${hook.padEnd(15)} ${names.join(', ')}`)
}

console.log('\n— 运行 —')
const { output } = await build('/src/index.js', config)

console.log('\n— 产物 —')
console.log(output)

console.log('\n— 不挂任何插件时，核心什么也做不了 —')
await rollup({ input: '/src/index.js', plugins: [] }).catch((error: Error) => console.log(`  ${error.message}`))
