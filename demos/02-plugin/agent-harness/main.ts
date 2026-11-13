import planMode from './extensions/plan-mode.ts'
import protectedPaths from './extensions/protected-paths.ts'
import redactSecrets from './extensions/redact-secrets.ts'
import todo from './extensions/todo.ts'
import { createHarness } from './harness.ts'
import { model } from './model.ts'

const createFiles = () =>
  new Map([
    ['config.json', '{"apiKey":"sk-abc123","debug":false}'],
    ['.env', 'DB_PASSWORD=hunter2'],
  ])

const harness = createHarness({
  model,
  systemPrompt: '你是编码助手。',
  files: createFiles(),
  extensions: [protectedPaths, redactSecrets, planMode, todo],
})

console.log('— 核心只内置 read / write，其余能力都来自扩展 —')
console.log(`  tools:    ${[...harness.tools.keys()].join(', ')}`)
console.log(`  commands: ${[...harness.commands.keys()].map((name) => `/${name}`).join(', ')}`)

const prompts = [
  '读 config.json',
  '读 .env',
  '/plan',
  '写 config.json {"debug":true}',
  '/plan',
  '写 config.json {"debug":true}',
  '记 补单测',
]

for (const text of prompts) {
  console.log(`\n> ${text}`)
  const reply = await harness.prompt(text)
  if (reply) console.log(`  ${reply}`)
}

console.log('\n— 不挂任何扩展时，核心没有任何保护 —')
const bare = createHarness({ model, systemPrompt: '你是编码助手。', files: createFiles(), extensions: [] })
for (const text of ['读 .env', '/plan']) {
  console.log(`\n> ${text}`)
  console.log(`  ${await bare.prompt(text)}`)
}
