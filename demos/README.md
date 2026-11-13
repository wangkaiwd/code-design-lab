# 配套 Demo

这些 demo 对应 [如何避免库的核心类膨胀](../how-to-avoid-core-bloated.md) 中的各个章节。每个都是可直接运行的最小实现，读代码时建议对照运行输出。先看 [学习路线与演进过程](../learning-guide.md)，可以知道每种设计是在解决什么变化。

Node.js 24+ 可以直接运行 `.ts`（原生类型剥离），不需要编译。

```bash
pnpm install
pnpm typecheck      # tsc 类型检查，04 保留 module augmentation 的反例
pnpm test           # 通过公共接口验证关键契约，使用 Node 内置测试工具
pnpm 01             # 每个 demo 单独运行，完整命令见下表
```

| 命令 | 对应章节 | 参照的项目 |
| --- | --- | --- |
| `pnpm 01` | 1. 组合 + 委托 | axios、Tiptap |
| `pnpm 02` | 2. 插件系统 | Rollup `PluginDriver`、Vite `resolvePlugins` |
| `pnpm 02:agent` | 2. 插件系统：agent 扩展 | pi extension（`pi.on` / `registerTool` / `registerCommand`） |
| `pnpm 03` | 3. 独立函数 + tree-shaking | Vue 3、Vercel AI SDK |
| `pnpm 04` | 4. 原型 Mixin（反面教材） | jQuery |
| `pnpm 05:renderer` | 5. 适配器：平台 | Vue `createRenderer`、`@vue/runtime-test` |
| `pnpm 05:llm` | 5. 适配器：厂商 | Vercel AI SDK provider |
| `pnpm 06:koa` | 6. 中间件：洋葱模型 | Koa、koa-compose |
| `pnpm 06:llm` | 6. 中间件：包装模型 | AI SDK `wrapLanguageModel` |
| `pnpm 06:agent` | 6. 中间件：agent 循环 | LangChain.js `createAgent` + `createMiddleware` |
| `pnpm 07` | 组合与显式可选能力 | 门面、hooks、存储适配器 |
| `pnpm 08` | AI 应用：检查点与恢复范围 | Cline |

安装依赖和运行命令都在项目根目录执行。LLM、agent 和 Cline 示例使用模拟数据，不需要 API Key，也不会访问真实模型或修改项目文件。

---

## 01-facade：门面

- `LibraryX.ts` 只有装配和转发，对外只有 `on`、`setState`、`render` 三个方法。
- 依赖是单向的：`Renderer → Store → EventBus`，子模块都不知道 `LibraryX` 的存在，所以 `main.ts` 最后能脱离门面单独测试 `Store + Renderer`。
- `Store` 复制初始对象并冻结每次产生的状态。当前 `State` 只有基本类型字段，因此浅冻结足够；初始对象后续被修改也不会影响内部状态。

**取舍**：门面适合集中装配已形成独立职责的模块。这里渲染只有一行逻辑，真实小项目可以直接用函数；学习重点是依赖方向。

**动手试试**：加一个 `History` 模块订阅 `change` 事件，并在门面转发 `undo()`。预期 `0 → 1 → 2 → undo → 1 → undo → 0`。提示：恢复本身也会触发 `change`，History 必须区分普通变更与撤销，避免把撤销再次记入历史。先对照 `08` 理解快照与当前状态的归属。

## 02-plugin：插件系统

- `rollup.ts` 的核心只负责遍历模块图，在固定时机调用 hook，**连读文件都不会**。运行输出的最后一段证明了这一点：不挂插件，第一步就会失败。
- 插件就是一个普通对象，实现了哪个 hook 就参与哪个阶段。hook 怎么组合由 hook 名决定，对应 `plugin-driver.ts` 中的几个方法：
  - `hookFirst`：「谁能处理谁处理」，用于 `resolveId` / `load`。`alias`、`virtual-build-info`、`memory-fs` 都挂在 `resolveId` 上，各自只处理自己认识的路径，返回 `null` 表示交给下一个。
  - `hookReduceArg0`：逐步加工同一份数据，用于 `transform` / `renderChunk`。`minify` 的输出会作为 `banner` 的输入。
  - `hookParallel`：同时启动、全部完成后再继续，用于 `buildStart`；`hookSeq` 依次执行、忽略返回值，用于 `generateBundle`。
- `vite.ts` 的 `resolvePlugins` 对应 Vite 的同名函数：**配置项本质上是内置插件的开关**，用户插件按 `enforce` 分成 `pre` / normal / `post` 三组，插到内置插件之间，排好序后再交给 Rollup。`enforce` 是 Vite 扩展的字段，Rollup 本身不认识。
- `virtual-build-info` 演示了 Vite 生态常见的虚拟模块：`resolveId` 认领一个不存在的路径，`load` 直接返回代码。
- `report` 的状态（构建开始时间）放在闭包里，核心不需要为插件预留任何字段。

**取舍**：先读 `rollup.ts` 的调用顺序，再读 `plugin-driver.ts` 的循环；`Parameters<Hooks[H]>` 只是让 hook 名与参数类型对应。这个例子省略了 AST 解析、作用域、导出重命名、source map 和插件上下文，仅支持示例中的 import 形式，不能作为通用打包器。

**动手试试**：

1. 去掉 `minify: true`，看产物里的注释重新出现。
2. 写一个插件，在 `transform` 里把 `console.log` 替换成 `void 0`。整个过程不需要改 `rollup.ts`。
3. 给第 2 步的插件分别加上 `enforce: 'pre'` 和 `enforce: 'post'`，对照开头的 hook 列表，看它的 `transform` 排在 `define` 前面还是后面。

### agent-harness：agent 的扩展

参照 pi 的 extension。`harness.ts` 只有 agent 循环、事件分发和 `read` / `write` 两个内置工具。扩展是一个 `(pi) => void` 函数，只能通过 `pi.on`、`pi.registerTool`、`pi.registerCommand` 接入。

- 和 Rollup 一样，组合方式由事件（hook 名）本身决定，区别是这里所有事件都用 `pi.on` 订阅，而不是在插件对象上实现同名方法。与 pi 文档里的 Handler Composition 一致：
  - **闸门**：`tool_call` 遇到第一个 `{ block: true }` 就停下，工具不执行，`tool_result` 也不触发。`protected-paths` 和 `plan-mode` 都挂在这里。
  - **链式变换**：`before_agent_start` 和 `tool_result` 中，后一个 handler 拿到的是前一个改过的值。`redact-secrets` 把密钥打码后，模型拿到的就是打码后的结果。
  - **通知**：`agent_end` 只观察，返回值会被忽略。
- `plan-mode.ts` 一个功能同时用到三种接入方式：`/plan` 命令负责开关，`before_agent_start` 往 system prompt 里加说明，`tool_call` 拦下写操作。这正是 pi 不内置 plan mode 的原因：用扩展就能完整实现。
- 运行输出的最后一段：不挂扩展时，`.env` 能被直接读出来，`/plan` 也只会被当成普通文本发给模型。

**动手试试**：写一个扩展，在 `tool_call` 里直接修改 `event.input.path`（例如去掉开头的 `./`）。想想它应该放在 `protected-paths` 前面还是后面。

## 03-functional：模块化接口与 tree-shaking

两个入口都**只用了 `parse`**，运行后对比 esbuild 的打包产物：

- 当前 esbuild 配置下，class 版保留了 `format` 和 `validate`。class 的原型方法不按独立导出进行删除。
- 函数版只剩 `createParser` 和 `parse`，其他具名导出被删除。四个函数都在同一个 `parser.ts` 中，文件数量不是 tree-shaking 的前提。

**取舍**：这是本例和当前打包配置下的结果，不能据此判断所有 class 都不利于优化。这里为了识别产物保留了日志，展示模块化接口，不以此代替纯函数与副作用隔离的学习。解析器也只支持示例中的简单键值对，不处理 URL 编解码等协议细节。

**动手试试**：改用 `import * as lib from './parser.ts'` 并调用 `lib.parse(...)`，预期仍能删除未用函数；再打印 `Object.keys(lib)`，观察为了暴露整个导出对象，产物保留了哪些实现。静态访问与整体使用模块对象的区别比 import 写法本身更重要。

## 04-mixin：原型 Mixin

运行输出展示了这种方式的两个问题：

1. **看不出方法的来源**：`Q.prototype` 上的方法来自 3 个文件，只看实例无法知道 `addClass` 定义在哪里。
2. **同名方法被静默覆盖**：加载 `legacy-plugin.ts` 后，`addClass` 被替换掉（类名变成了 `legacy-selected`，并开始触发事件）。TS 和运行时都不会报错。

另外，`legacy-plugin.ts` 通过 `this.trigger` 隐式依赖 `events.ts`。module augmentation 会影响当前类型检查程序中的所有 `Q` 实例，即使运行时没有加载 `events.ts`，类型检查也能通过。

**动手试试**：在 `main.ts` 里删掉 `import './events.ts'`。`pnpm typecheck` 仍然通过（`events.ts` 在 tsconfig 的 include 范围内，它的类型声明照样生效），但运行 `pnpm 04` 会报 `list.on is not a function`。类型和实现是分开维护的，TS 无法保证两者一致。

## 05-adapter：适配器

**renderer**：同一个 `runtime-core.ts` 分别接入两个宿主，一个是 runtime-test（JS 对象树），一个是 runtime-terminal（ANSI 彩色输出）。

- 第二次 `render(view(3))` 时，ops 只剩 2 条（`patchProp` + `setElementText`）。说明 **diff 在核心里完成**，宿主只执行最基本的操作。
- 平台差异集中在 `patchProp`：runtime-test 原样保存属性，runtime-terminal 把 `color` 翻译成 ANSI 转义码。runtime-dom 也是这样区分处理 `class`、`style` 和 `onXxx` 事件的。

**llm**：`generate-text.ts` 里没有任何厂商分支。

- 对比两条请求日志：OpenAI 把 system 作为一条消息，Anthropic 则把它放在顶层字段，并且必须传 `max_tokens`。这些差异都封装在各自的 provider 里。
- `main.ts` 里的 `localEcho` 说明：用户只要实现 `LanguageModel` 接口，就能接入新模型，核心代码不用改。

**取舍**：renderer 只按下标 diff，不处理 key、组件、事件或卸载生命周期。LLM provider 使用内置模拟服务器，token 用字符长度代替；两者都用来观察接口如何隔离差异，不代表真实服务的完整协议。新增适配器时，先验证共同行为，再讨论各自额外能力。

## 06-middleware：中间件

**koa**：`compose.ts` 只有十几行，就是 koa-compose 的核心逻辑。

- 缩进画出了洋葱模型：`await next()` 之前的代码由外向内执行，之后的代码由内向外执行。
- `/hello`（未登录）：auth 不调用 `next`，请求被短路，router 不会执行。
- `/boom`：router 抛出异常后，logger 和 auth 的「←」都没有打印，因为异常沿着 Promise 链一路冒泡到 errorHandler 的 `try/catch`。**这就是错误处理中间件要放在最外层的原因**。
- `index` 计数器用来防止同一个中间件调用两次 `next`。

**llm**：直接复用 05 的 `openai` provider 和 `generateText`，两者的代码都没有改动。

- `wrapLanguageModel` 返回的仍是一个 `LanguageModel`，所以**中间件和适配器可以自由组合**。
- 中间件的顺序很重要：`redactPhone` 放在最外层，所以 logger 和 cache 拿到的都是脱敏后的参数。第二次调用命中缓存，没有发出真实请求。
- 缓存键包含 `provider`、`modelId` 和参数。同一个缓存实例可以用于不同模型，已有测试验证它们不会互相命中；本例不实现过期、容量管理或流式缓存。模型身份相同的实现应具有相同配置语义。

**动手试试**：临时在 `cache()` 的 `key` 定义后打印它，再把顺序改成 `[logger, cache(), redactPhone]`。预期缓存键包含原始手机号；恢复原顺序后，键中的号码变成 `[手机号]`。

**agent**：参照 LangChain.js 的 `createAgent` + `createMiddleware`。`create-agent.ts` 的核心只有 ReAct 循环：调模型，有工具调用就执行，再调模型，直到模型不再调用工具。

- 和 `wrapLanguageModel` 的区别在于挂载位置：`wrapLanguageModel` 只包住单次模型调用，agent 中间件挂在整个循环上，模型调用和工具调用都能拦截，还能提前结束循环。
- 中间件有两类钩子：
  - **节点钩子**（`beforeAgent` / `beforeModel` / `afterModel` / `afterAgent`）在固定位置读写 state。`modelCallLimit` 在 `beforeModel` 返回 `jumpTo: 'end'`，循环就提前结束（第二段输出）。
  - **包裹钩子**（`wrapModelCall` / `wrapToolCall`）拿到 `handler`，可以自己决定调不调、调几次、换什么参数调。`modelFallback` 换了模型，`toolRetry` 调用了两次 handler。
- 第一段输出里，`logging` 的 `afterModel` 只看到最终结果，看不到主模型失败过，因为降级发生在包裹钩子内部。
- 执行顺序与 LangChain 一致：`before*` 按数组顺序，`after*` 倒序，`wrap*` 第一个在最外层，和洋葱模型一样。

**动手试试**：把 `modelCallLimit(1)` 改成 `modelCallLimit(2)`，或者把 `toolRetry(2)` 改成 `toolRetry(0)`，看看分别会怎样结束。

**取舍**：`modelCallLimit` 的计数器放在闭包中，按单次运行重置，不支持并发调用同一个中间件实例；生产框架可把运行数据放在对应的运行状态中。天气工具适合重复查询，有写入副作用的工具需另行明确重试语义。`afterAgent` 在本例正常结束时运行，不是异常路径的清理钩子。

## 07-capstone：推荐组合

目录结构对应文章中的组合示例：`core/` 是门面和 hooks，`modules/` 是内部子系统，`plugins/` 是生命周期扩展，`features/` 显式返回可选能力。

- `logger` 需要观察初始化和状态变更，因此通过 `use()` 安装。
- `createPersistence(x, storage)` 返回 `save/restore`，不会给 `LibraryX` 添加方法。只依赖 `getState/setState` 这两个能力，存储差异由 `Storage` 接口隔离。
- 旧的类型扩展方案会让没有安装功能的实例也拥有 `persist()` 类型。新方案中，持久化对象是否存在由调用代码直接表达；`04` 继续展示类型扩展的反例。
- 初始状态和 `getState()` 返回值都不会泄漏可写状态；`tap()` 返回取消订阅函数，临时订阅可以自行清理。
- 可选能力使用独立入口便于组织依赖，是否 tree-shake 仍取决于 ESM 和副作用。

**契约**：先安装依赖初始化事件的插件，再调用一次 `init()`。本例不会自动持久化；`save/restore` 的存储错误直接 reject，由调用者决定处理方式。读取内容限于该功能自己保存的 State JSON；未实现外部数据 schema 校验或版本迁移。同一 storage 表示同一份状态，示例中的两个实例有意共享它。

**动手试试**：为实例 a 保存 `count: 5`，让实例 b 从同一 storage 恢复。预期 b 为 `{ user: 'Ada', count: 5 }`；未保存时恢复保持初值。取消临时 hook 后再修改状态，预期不再收到通知。这些行为已经包含在 `pnpm test` 中。

## 08-cline：AI 应用的检查点与恢复

来源是 [Cline 的检查点功能及固定版本源码](../how-to-avoid-core-bloated.md#7-ai-应用案例cline-检查点恢复)。只新增这个 AI 应用案例。

建议先读 `main.ts` 的用户操作，再读 `checkpoint.ts`：

1. 保存检查点时复制任务数据，后续 AI 修改不会改变快照。
2. 会话记录与文件状态分别建模，`RestoreScope` 表达恢复范围。
3. 恢复返回新任务状态；修改恢复结果，也不会污染当前任务或检查点。

| 恢复范围 | 会话条数 | `page.ts` 的标题 |
| --- | --- | --- |
| `files` | 2，保留讨论 | Old |
| `conversation` | 1，退回提问 | Hello |
| `both` | 1 | Old |

**取舍**：数据快照和恢复操作已经足够表达本例需求，因此不引入插件、事件总线或任务执行器。完整实现还需要处理真实文件、Git、持久化和正在执行的任务；本例只保存内存中的普通数据。

**动手试试**：AI 新建一个文件后，只恢复文件，预期新文件消失而会话保留；修改一次恢复结果后，再用相同检查点恢复，预期仍得到原始快照。对应断言见 `tests/state.test.ts`。

## 验证与继续阅读

`pnpm test` 验证状态归属、持久化往返与错误传播、hook 的短路与加工顺序、取消订阅、两个渲染宿主的共同行为、中间件执行、模型缓存隔离、同文件 tree-shaking，以及 Cline 的恢复语义。日志用于理解过程，断言用于验证结果。

每章的源码入口、适用条件、练习提示及类型词汇见 [学习指南](../learning-guide.md)。修改示例后优先运行对应测试，例如 `node --test demos/tests/state.test.ts`；不需要执行全量构建。
