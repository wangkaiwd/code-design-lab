# 如何避免库的核心类膨胀

> 问题：实现一个库时定义了 `class LibraryX {}`，如何避免它的代码量越来越大？GitHub 上的顶级项目是如何解决的？

核心思路是：**把一起变化的知识放在同一个模块，把确实会变化的实现放在可替换的位置。** `LibraryX` 可以作为装配和委托的门面，也可以保留属于自己的核心逻辑。是否优雅，要看调用者需要理解多少约定、一次需求变更会影响多少地方。

> 每种手段都有可运行的最小实现，见 [demos/](./demos/README.md)。

> 建议先读 [学习路线与演进过程](./learning-guide.md)，再运行 demo。原有框架案例用于说明机制；新增 AI 应用案例是 [Cline 的检查点恢复](#7-ai-应用案例cline-检查点恢复)，源码链接固定到核对过的 commit。示例提取设计思路，不复刻这些项目的完整实现。

## 先明确设计目标

模块的接口还包括类型之外的约定：状态能否修改、方法是否需要先初始化、回调以什么顺序执行、错误由谁处理、订阅由谁取消。只把方法挪到其他文件，可能让文件变短，却让调用者需要记住更多事情。

**深模块**通过一个小接口隐藏有用的复杂性。例如，检查点的 `restore()` 可以隐藏快照保存和恢复范围的选择。判断是否值得抽取，可以问：删掉这个模块后，它处理的知识是否会散落到多个调用处？

---

## 1. 组合 + 委托：class 只做门面（Facade）

当状态管理、渲染等职责已经有独立的变化原因时，可以让 class 负责装配和委托：

```ts
// src/LibraryX.ts
export class LibraryX {
  private events = new EventBus()
  private store = new Store(this.events)
  private renderer = new Renderer(this.store)

  on = this.events.on.bind(this.events)
  setState(patch: Partial<State>) { this.store.set(patch) }
  render() { return this.renderer.run() }
}
```

**案例：**

- **axios**：`Axios` 持有请求配置和拦截器，请求流程还涉及 `dispatchRequest`，真正发请求的差异集中在 `adapters/`（xhr / http / fetch）。重点是职责分工，不能据此推导核心 class 必须很短。
- **Tiptap**：`Editor` 把扩展交给 `ExtensionManager`，命令交给 `CommandManager`。
- **pi**：拆成按层叠加的独立包：`pi-ai`（统一的多厂商 LLM API）→ `pi-agent-core`（agent 运行时、工具调用、状态管理）→ `pi-coding-agent`（CLI 产品）。终端渲染另由 `pi-tui` 负责。上层通过组合下层实现，不把所有能力塞进一个类。

**取舍**：只有几行字符串拼接时，独立函数通常就够了。demo 中的 `Renderer` class 用于展示依赖方向；真实项目应在出现可独立维护的职责后再拆。相关字段共同保证一个不变量时，把它们留在一个模块往往更容易理解。

## 2. 插件系统：核心只保留扩展点

当确实需要独立安装或由第三方提供的功能时，核心可以定义生命周期和钩子，插件在这些时机接入。核心仍然负责执行流程和核心语义。

```ts
type Plugin = (ctx: LibraryX) => void

export class LibraryX {
  hooks = {
    beforeInit: new Hook<[Options]>(),
    transform: new WaterfallHook<[Data]>(),
  }
  use(plugin: Plugin) { plugin(this); return this }
}

// plugins/logger.ts，与核心解耦
export const logger: Plugin = (x) => {
  x.hooks.transform.tap('logger', (data) => { console.log(data); return data })
}
```

**案例：**

- **webpack**：`Compiler` 定义基于 Tapable 的 hooks，也实现 `run`、`watch`、资源输出等流程。`WebpackOptionsApply` 根据配置安装内置插件，插件扩展流程中的特定阶段。见 [webpack 5.112.2 的 Compiler](https://github.com/webpack/webpack/blob/v5.112.2/lib/Compiler.js)。
- **Vite / Rolldown**：Vite 8 使用 Rolldown，插件沿用 Rollup 风格的 `resolveId`、`load`、`transform` 等 hook。模块图遍历和产物生成仍然需要核心实现，插件负责在规定的时机参与处理。
- **Vue 3**：`app.use(plugin)` 会调用插件的 `install(app)`，插件可以通过 `app.component`、`app.directive`、`app.provide` 等方法扩展应用。vue-router、Pinia 都是这样接入的。
- **pi**：自称 "a minimal, extensible agent harness"。核心刻意不内置 sub-agents、plan mode 等功能，需要时通过 extension 或 Pi package（npm / git 分发）加进来。extension 写法如下：

  ```ts
  import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

  export default function (pi: ExtensionAPI) {
    // pi.on('tool_call' | 'turn_start' | 'session_start' | ..., handler)
    // pi.registerTool / pi.registerCommand / pi.registerProvider / pi.registerShortcut ...
  }
  ```

- **Day.js**：核心大约 2KB，`dayjs.extend(relativeTime)` 按需加功能。

**取舍**：扩展点也是需要维护的公共契约，包括调用顺序、错误传播和订阅清理。新增一项所有用户都会使用的核心功能，直接修改核心即可；只有出现独立扩展的需要时，再设计 hook。`07` 的 `tap()` 会返回取消订阅函数，临时订阅由创建它的调用者清理。

## 3. 方法改成独立函数（模块化 API）

可以导出独立函数，通过参数传入实例或依赖，让调用者按需使用能力：

```ts
// 之前：x.parse()、x.format()、x.validate() 都写在 class 里
// 之后：
export function createX(opts: Options): XInstance { ... }
export function parse(x: XInstance, input: string) { ... }
export function format(x: XInstance) { ... }
```

**案例：**

- **Vue 3**：`nextTick` 等全局 API 改成具名导出（`import { nextTick } from 'vue'`），不再挂在全局 `Vue` 对象上。Composition API（`ref`、`computed`、`watch`）也全是独立函数，没用到的会被 tree-shaking 掉。
- **React**：Hooks 把逻辑从 class 组件的生命周期方法里拆成独立函数（`useState`、`useEffect`、自定义 Hook），每块逻辑可以单独放在一个文件里复用。
- **Vercel AI SDK**：没有一个大的 client class，核心 API 是 `generateText`、`streamText`、`embed`、`generateImage` 等独立函数，模型作为参数传入。结构化输出也不再单独提供 `generateObject`，而是给 `generateText` / `streamText` 传 `output: Output.object(...)`：

  ```ts
  import { generateText } from 'ai'
  const { text } = await generateText({ model, prompt: '...' })
  ```

**好处**：具名导出方便调用者按需使用功能。相关函数可以留在同一个文件里；`03` 的 `parser.ts` 就演示了这种写法也能 **tree-shake**。esbuild 按声明消除未使用代码，依赖 ESM 的静态可分析性及副作用判断。参见 [esbuild 文档](https://esbuild.github.io/api/#tree-shaking)。

**取舍**：模块化接口与纯函数是两个维度。独立函数也可以修改外部状态、记录日志或访问网络；纯函数要求输出由输入决定，并且不产生可观察的副作用。`03` 为了识别打包结果保留了日志，展示的是模块化接口。class 仍然适合封装状态及其不变量，无需为了写成函数而暴露内部字段。

## 4. 原型方法分文件挂载（Mixin）

一个对象的方法分散到多个文件里定义：

```js
// jQuery：各模块各自往 jQuery.fn（即 jQuery.prototype）上扩展
jQuery.fn.extend({ addClass() { ... }, removeClass() { ... } }) // attributes 模块
jQuery.fn.extend({ on() { ... }, off() { ... } })               // event 模块
```

缺点是对 TS 类型不友好，各模块之间也会隐式共享 `this`，**新项目一般不推荐**，优先用第 1 种和第 3 种。

## 5. 策略 / 适配器：把会变化的部分抽成接口

```ts
interface Storage { get(k: string): unknown; set(k: string, v: unknown): void }
new LibraryX({ storage: new IndexedDBStorage() })
```

**案例：**

- **axios**：adapters（xhr / http / fetch）。
- **Prisma**：从 Prisma 7 起，Client 通过 driver adapter 连接数据库，例如 `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`。适配器隔离连接驱动，数据库之间的 schema、SQL 和能力差异仍需单独处理。
- **Vue 3**：`@vue/runtime-core` 与平台无关，`@vue/runtime-dom` 通过 `createRenderer(options)` 把 DOM 操作作为参数传进去。自定义渲染器（Canvas、终端等）也只需要实现这组操作。
- **React**：`react` 包只定义组件 API，协调逻辑在 `react-reconciler`，各平台通过实现 host config 接入。react-dom、React Native、Ink（终端）、React Three Fiber 都是这样做的。
- **Vercel AI SDK**：`@ai-sdk/provider` 定义了 `LanguageModelV4` 等规范接口，`@ai-sdk/openai`、`@ai-sdk/anthropic` 等 provider 包各自实现，核心函数完全不关心具体厂商。
- **LangChain.js**：`@langchain/core` 定义 `BaseChatModel` 等抽象，`@langchain/openai`、`@langchain/anthropic` 等独立包各自实现。
- **pi**：`pi-ai` 用统一 API 屏蔽各 LLM 厂商的差异，extension 还可以通过 `pi.registerProvider` 接入新厂商。

核心代码不用写 `if (provider === 'openai') ... else ...` 这种分支。

**取舍**：先找到真实存在的共同语义，再定义接口。两个实现使用同一个接口，不代表能力、错误、流式行为和性能完全相同。`05` 的 LLM 示例只统一文本生成，不尝试覆盖多模态、工具调用或全部厂商选项。

## 6. 中间件管道

请求类、流程类的库常用这种方式：

```ts
x.use(async (ctx, next) => { /* before */ await next(); /* after */ })
```

**案例：**

- **Koa**：`koa-compose`，核心只有几百行。
- **Redux middleware**、**Express Router**。
- **Vercel AI SDK**：`wrapLanguageModel` 给模型套中间件，用于缓存、日志、RAG、guardrails 等横切逻辑，不需要修改 provider 或核心函数：

  ```ts
  import { wrapLanguageModel } from 'ai'

  const model = wrapLanguageModel({
    model: baseModel,
    middleware: [cacheMiddleware, logMiddleware], // 实现 transformParams / wrapGenerate / wrapStream
  })
  ```

- **LangChain.js**：`createAgent` 接收 `middleware` 数组，用 `createMiddleware` 在 agent 循环的固定节点插入逻辑。`beforeAgent` / `afterAgent`、`beforeModel` / `afterModel` 在固定时机运行，`wrapModelCall` / `wrapToolCall` 包裹每次模型或工具调用：

  ```ts
  import { createAgent, createMiddleware } from 'langchain'

  const logging = createMiddleware({
    name: 'LoggingMiddleware',
    beforeModel: (state) => { /* ... */ },
    afterModel: (state) => { /* ... */ },
  })

  const agent = createAgent({ model, tools, middleware: [logging] })
  ```

**取舍**：中间件能包装执行、短路或重试，所以顺序属于接口的一部分；普通的数据处理步骤直接按顺序调用函数即可。重试示例使用可重复查询的天气工具，有外部写入的工具需要先明确重复执行的业务含义。共享缓存要包含模型身份和请求参数，不能让不同模型互相命中。

## 7. AI 应用案例：Cline 检查点恢复

Cline 是以 TypeScript 为主的 AI 编码应用。它的检查点体现了一个通用设计问题：**会话状态和工作区状态可以分别恢复**。例如，修改结果有问题时可以恢复文件并保留讨论；希望改变提问方式时可以恢复会话并保留文件。参见 [Cline 检查点说明](https://github.com/cline/cline/blob/72b3d7140553a733242126e51a7c2e87efe75c64/docs/core-workflows/checkpoints.mdx)。

这里固定阅读 [commit 72b3d714 的恢复模块](https://github.com/cline/cline/blob/72b3d7140553a733242126e51a7c2e87efe75c64/sdk/packages/core/src/session/checkpoint-restore.ts)：

- `trimMessagesToCheckpoint`：根据用户轮次选择应保留的会话记录。
- `createCheckpointRestorePlan`：决定目标检查点、工作目录，以及是否恢复消息。
- `applyCheckpointToWorktree`：执行实际文件恢复。
- `beginWorktreeRestoreTransaction`：管理恢复过程的提交与回滚。

源码把恢复计划和实际文件操作分开。学习时先看“选择什么状态”，再看“如何执行副作用”，不必先理解全部 Git 细节。

配套的 [08-cline](./demos/08-cline/checkpoint.ts) 提取最小模型：

```ts
const checkpoint = createCheckpoint(task)
// AI 修改了 task.files，并追加 task.messages
const retry = checkpoint.restore(task, 'files')
```

恢复范围用 `'files' | 'conversation' | 'both'` 表达，快照由闭包持有，恢复返回新状态。调用者无需了解保存时如何复制数据，也不能通过恢复结果修改原检查点。**这个例子同时展示状态归属、显式操作和通过返回值表达变化。**

**取舍与省略**：demo 只处理内存中的普通消息和文件内容，不接入模型或真实文件系统，不执行 Git 命令，也不模拟正在执行的任务、重启后的持久化及恢复失败的事务处理。这些能力应在真实需求出现后再引入。

---

## 给 `LibraryX` 的推荐组合

```
src/
├── index.ts            # 对外导出 createX + 公共类型
├── core/
│   ├── LibraryX.ts     # 门面：持有子模块，暴露少量核心 API + use()
│   ├── hooks.ts        # 生命周期钩子
│   └── types.ts        # 公共类型：State、Options、Plugin
├── modules/            # 内部子系统（组合进 LibraryX）
│   ├── store.ts
│   └── renderer.ts
├── plugins/            # 接入生命周期的可选行为
│   └── logger.ts
└── features/           # 显式创建的可选能力
    └── persistence.ts
```

不必把每项可选功能都挂到实例上。`07` 的日志通过 hook 观察变化，持久化功能则显式创建并返回：

```ts
const x = createX({ initialState: { user: 'Ada', count: 0 } }).use(logger).init()
const persistence = createPersistence(x, storage)
await persistence.save()
```

这样普通 `LibraryX` 的类型中没有 `persist()`，只有创建过的持久化对象才有 `save/restore`。module augmentation 可以补充类型，但它会影响整个类型检查程序，无法证明某个实例安装过插件；`04` 保留了这种类型与运行时脱节的反例。

这套目录用于展示组合方式。小项目可以先把相关逻辑放在一个文件中，出现独立职责后再拆。单独入口方便组织依赖，是否能消除未用代码仍取决于导出形式和副作用。

## 怎么判断该拆了

| 信号 | 对策 |
| --- | --- |
| 某个方法改动时，需要读懂 class 里一大半的其他字段 | 拆成子模块（第 1 种） |
| 很多功能只有部分用户会用 | 做成插件或独立函数（第 2、3 种） |
| 同一能力已经有多个平台或厂商实现 | 找到共同语义后抽成适配器（第 5 种） |
| 多个独立扩展反复需要介入相同阶段 | 明确顺序与错误语义后补 hooks 或中间件（第 2、6 种） |
| 只是增加稳定的核心行为 | 直接修改核心，不必预先做插件 |
| 调用者必须记住对象能否修改、插件是否安装等隐藏约定 | 先改善接口及类型，必要时显式返回能力或状态（第 7 种） |

## 总结

组合、插件、独立函数、适配器和中间件分别解决不同的变化问题。Cline 的恢复模块则说明，业务状态的划分也会直接决定接口是否清楚。评估设计时，先提出一个具体需求变化，再观察修改能否集中在一个模块、调用者是否需要学习更多约定。
