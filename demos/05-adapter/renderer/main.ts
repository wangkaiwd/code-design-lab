import { h } from './runtime-core.ts'
import * as terminal from './runtime-terminal.ts'
import * as test from './runtime-test.ts'

const view = (count: number) =>
  h('box', {}, [
    h('title', { color: 'cyan' }, 'Counter'),
    h('text', { color: count > 2 ? 'red' : 'green' }, `count = ${count}`),
  ])

const testRoot = test.createRoot()
const terminalRoot = terminal.createRoot()

for (const count of [1, 3]) {
  console.log(`\n========== render(view(${count})) ==========`)

  test.render(view(count), testRoot)
  console.log('— runtime-test：核心调用了哪些宿主操作 —')
  for (const op of test.takeOps()) console.log(`  ${op}`)
  console.log(`  结果：${test.serialize(testRoot)}`)

  terminal.render(view(count), terminalRoot)
  console.log('— runtime-terminal：同一棵 VNode 树渲染到终端 —')
  console.log(terminal.paint(terminalRoot))
}
