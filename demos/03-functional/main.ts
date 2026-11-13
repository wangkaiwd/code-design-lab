import path from 'node:path'
import { build } from 'esbuild'

// 两个入口都只用到了 parse，对比打包产物里还剩下哪些实现
const entries = {
  'class 版': 'entry-class.ts',
  '函数版': 'entry-fn.ts',
}

for (const [label, file] of Object.entries(entries)) {
  const result = await build({
    entryPoints: [path.join(import.meta.dirname, file)],
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  const kept = ['parse', 'format', 'validate'].map((name) => `${name} ${code.includes(`[impl] ${name}`) ? '✓' : '✗'}`)

  console.log(`— ${label}（${file}）：${code.length} bytes，保留的实现：${kept.join('  ')} —`)
  console.log(code)
}
