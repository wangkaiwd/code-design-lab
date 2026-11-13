import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { build } from 'esbuild'
import { PluginDriver } from '../02-plugin/plugin-driver.ts'
import { generateText } from '../05-adapter/llm/generate-text.ts'
import type { LanguageModel } from '../05-adapter/llm/provider.ts'
import { h, type VNode } from '../05-adapter/renderer/runtime-core.ts'
import * as terminal from '../05-adapter/renderer/runtime-terminal.ts'
import * as hostTest from '../05-adapter/renderer/runtime-test.ts'
import { compose } from '../06-middleware/koa/compose.ts'
import { cache } from '../06-middleware/llm/middlewares.ts'
import { wrapLanguageModel } from '../06-middleware/llm/wrap-language-model.ts'

test('hookFirst 跳过 null，在第一个有效结果处短路，空字符串也是有效结果', async () => {
  const calls: string[] = []
  const driver = new PluginDriver([
    { name: 'skip', load: () => { calls.push('skip'); return null } },
    { name: 'empty', load: async () => { calls.push('empty'); return '' } },
    { name: 'later', load: () => { calls.push('later'); return 'unreachable' } },
  ])
  assert.equal(await driver.hookFirst('load', '/empty.js'), '')
  assert.deepEqual(calls, ['skip', 'empty'])
})

test('waterfall 按顺序加工数据，插件错误原样冒泡', async () => {
  const driver = new PluginDriver([
    { name: 'first', transform: (code) => `${code}:first` },
    { name: 'skip', transform: () => null },
    { name: 'last', transform: async (code) => `${code}:last` },
  ])
  assert.equal(await driver.hookReduceArg0('transform', 'input', '/input.js'), 'input:first:last')
  const error = new Error('plugin failed')
  await assert.rejects(new PluginDriver([{ name: 'broken', load: () => { throw error } }]).hookFirst('load', '/x'), error)
})

test('同文件具名导出也能删除未使用函数；当前 class 示例保留所有方法', async () => {
  for (const [entry, expected] of [['entry-fn.ts', false], ['entry-class.ts', true]] as const) {
    const result = await build({
      entryPoints: [path.join(import.meta.dirname, '../03-functional', entry)],
      bundle: true,
      write: false,
      format: 'esm',
    })
    const code = result.outputFiles[0].text
    assert.ok(code.includes('[impl] parse'))
    assert.equal(code.includes('[impl] format'), expected)
    assert.equal(code.includes('[impl] validate'), expected)
  }
})

test('两个渲染宿主共享相同的更新行为', () => {
  const objectRoot = hostTest.createRoot()
  const terminalRoot = terminal.createRoot()
  const hosts = [
    { render: (vnode: VNode) => hostTest.render(vnode, objectRoot), read: () => hostTest.serialize(objectRoot) },
    { render: (vnode: VNode) => terminal.render(vnode, terminalRoot), read: () => terminal.paint(terminalRoot) },
  ]
  for (const host of hosts) {
    host.render(h('text', { color: 'green' }, 'count = 1'))
    assert.match(host.read(), /count = 1/)
    host.render(h('text', { color: 'red' }, 'count = 3'))
    assert.match(host.read(), /count = 3/)
    assert.doesNotMatch(host.read(), /count = 1/)
  }
})

test('洋葱顺序、短路和异常传播都通过 compose 的接口验证', async () => {
  const events: string[] = []
  await compose<object>([
    async (_ctx, next) => { events.push('outer:before'); await next(); events.push('outer:after') },
    async (_ctx, next) => { events.push('inner:before'); await next(); events.push('inner:after') },
  ])({})
  assert.deepEqual(events, ['outer:before', 'inner:before', 'inner:after', 'outer:after'])

  await compose<object>([() => {}, () => assert.fail('短路后不应执行')])({})
  const error = new Error('downstream failed')
  await assert.rejects(compose<object>([async (_ctx, next) => { await next() }, () => { throw error }])({}), error)
  await assert.rejects(compose<object>([async (_ctx, next) => { await next(); await next() }])({}), /next\(\) called multiple times/)
})

test('共享缓存按 provider、modelId 和请求参数隔离', async () => {
  const sharedCache = cache()
  const calls: string[] = []
  const createModel = (provider: string, modelId: string): LanguageModel => ({
    provider,
    modelId,
    async doGenerate({ messages }) {
      const text = `${provider}/${modelId}:${messages.at(-1)!.content}`
      calls.push(text)
      return { text, usage: { inputTokens: 1, outputTokens: 1 } }
    },
  })
  const models = [createModel('a', 'one'), createModel('a', 'two'), createModel('b', 'one')]
    .map((model) => wrapLanguageModel({ model, middleware: [sharedCache] }))
  for (const model of models) {
    const expected = `${model.provider}/${model.modelId}:hello`
    assert.equal((await generateText({ model, prompt: 'hello' })).text, expected)
    assert.equal((await generateText({ model, prompt: 'hello' })).text, expected)
  }
  assert.equal(calls.length, 3)
  assert.equal((await generateText({ model: models[0], prompt: 'different' })).text, 'a/one:different')
  assert.equal(calls.length, 4)
})
