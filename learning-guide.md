# 学习路线与设计判断

本项目的目标是理解：需求为什么推动接口变化，一次变化会影响多少地方，以及调用者必须遵守什么约定。

## 推荐顺序

| 顺序 | 示例与入口 | 先回答的问题 |
| --- | --- | --- |
| 1 | [01 的 main](./demos/01-facade/main.ts) → [门面](./demos/01-facade/LibraryX.ts) → [Store](./demos/01-facade/store.ts) | 子模块是否需要知道门面？状态由谁拥有？ |
| 2 | [03 的两个入口](./demos/03-functional/entry-fn.ts) → [parser](./demos/03-functional/parser.ts) → [打包对比](./demos/03-functional/main.ts) | 同文件的函数能否按需删除？模块化接口与纯函数有什么区别？ |
| 3 | [05 的 generateText](./demos/05-adapter/llm/generate-text.ts) → [接口](./demos/05-adapter/llm/provider.ts) → [两个 provider](./demos/05-adapter/llm/providers/anthropic.ts) | 哪些变化集中在适配器，哪些是公共语义？ |
| 4 | [06 的 compose](./demos/06-middleware/koa/compose.ts) → [main](./demos/06-middleware/koa/main.ts) | `next()` 控制什么？短路和抛错分别怎样返回？ |
| 5 | [07 的 main](./demos/07-capstone/main.ts) → [持久化能力](./demos/07-capstone/src/features/persistence.ts) | 哪些行为适合 hook，哪些能力直接返回更清楚？ |
| 6 | [08 的 main](./demos/08-cline/main.ts) → [检查点](./demos/08-cline/checkpoint.ts) | 恢复文件时，会话是否也应恢复？恢复结果由谁拥有？ |

之后再读 `02` 的 hook 组合、`04` 的原型修改反例，以及 `05:renderer`、`06:llm`、`06:agent` 的进阶变体。复杂的泛型可以第二遍再看，第一遍先追踪输入、输出和调用顺序。

## 用一条需求演进理解拆分

### 第一步：状态与渲染都很简单

最开始可以直接实现，不必预设目录或扩展点：

```ts
type State = Readonly<{ user: string; count: number }>

class LibraryX {
  #state: State

  constructor(initial: State) {
    this.#state = Object.freeze({ ...initial })
  }

  setState(patch: Partial<State>) {
    this.#state = Object.freeze({ ...this.#state, ...patch })
  }

  render() {
    return `<p>${this.#state.user} clicked ${this.#state.count} times</p>`
  }
}
```

这里状态归属、修改和输出都在一个位置，很容易理解。文件短并不意味着需要进一步拆分。

### 第二步：外部需要观察变化

出现“每次变化都要通知多个订阅者”的需求后，才需要管理订阅与取消订阅。`01` 的 EventBus 把这些规则集中起来，Store 只负责生成新状态并通知。

`01` 展示完整装配关系；如果只有一个接收者，像 `07` 的 Store 那样接受一个回调就足够了。可以比较两者：为什么内部 Store 不必依赖整个事件总线？

### 第三步：某些调用者需要持久化

把读写存储放进所有 `setState()`，会要求所有使用者接受存储依赖与异步错误。`07` 选择显式创建持久化能力，保存时才执行 I/O：

```ts
const x = createX({ initialState: { user: 'Ada', count: 0 } })
const persistence = createPersistence(x, storage)
x.setState({ count: 5 })
await persistence.save()
```

如果产品明确要求每次变更都保存，就需要重新讨论同步状态和异步存储的关系。本例没有这个需求，因此不增加自动保存、重试或额外配置。

### 第四步：日志需要观察多个阶段

`logger` 需要知道初始化和状态变化，但不改变保存逻辑，适合通过现有 hook 接入。临时订阅由创建者持有 `tap()` 返回的取消函数，使用结束后调用它。

### 第五步：AI 任务需要选择性恢复

Cline 的恢复功能引出另一种变化：用户希望保留讨论、仅恢复文件，或保留文件、仅恢复会话。`08` 将两个维度放在明确的任务数据中，并用 `RestoreScope` 表达操作意图。只要输入和检查点相同，恢复结果就相同；内部快照不会被调用者的后续修改污染。

从 `01` 到 `07` 是同一 LibraryX 示例的演进，`08` 则用 AI 应用验证状态划分的思路。无需把所有模式塞进同一个例子。

## 阅读真实源码

下表用于定位设计机制，并非要求完整阅读整个仓库。Cline 固定到 2026-11-13 核对过的 commit；其他基础示例链接中，版本标签固定版本，分支链接可能继续变化。

| 本地示例 | 上游入口 | 阅读问题 |
| --- | --- | --- |
| 01 | [axios v1.21.0 的 createInstance](https://github.com/axios/axios/blob/v1.21.0/lib/axios.js) | 对外函数与内部 Axios 实例怎样装配、委托？ |
| 02 | [Rollup 的 PluginDriver](https://github.com/rollup/rollup/blob/master/src/utils/PluginDriver.ts) | 为什么需要 first、parallel、reduce 等不同组合方式？ |
| 03 | [esbuild 的 tree-shaking 说明](https://esbuild.github.io/api/#tree-shaking) | 静态导出与副作用如何影响删除结果？ |
| 04 | [jQuery 4.0.0 的 classes 模块](https://github.com/jquery/jquery/blob/4.0.0/src/attributes/classes.js) | 方法怎样进入共享原型？加载另一个模块会改变哪些实例？ |
| 05 | [Vue 的 createRenderer](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts) | 核心 diff 与平台操作之间的接口放在哪里？ |
| 06 | [koa-compose](https://github.com/koajs/compose) | 延续函数如何表达嵌套执行？何时传播异常？ |
| 07 | [本地持久化能力](./demos/07-capstone/src/features/persistence.ts)与 [04 的声明合并反例](./demos/04-mixin/attributes.ts) | 显式返回能力，如何减少“类型存在但方法未安装”的约定？ |
| 08 | [Cline 的恢复模块，72b3d714](https://github.com/cline/cline/blob/72b3d7140553a733242126e51a7c2e87efe75c64/sdk/packages/core/src/session/checkpoint-restore.ts) | 恢复计划、消息裁剪、文件执行各自知道哪些事情？ |

Cline 建议按 `trimMessagesToCheckpoint → createCheckpointRestorePlan → applyCheckpointToWorktree → beginWorktreeRestoreTransaction` 的顺序阅读。前三步先建立业务含义，最后再理解 Git 执行失败时的恢复处理。demo 只提取状态选择与快照隔离，没有实现完整应用。

## 接口契约与省略范围

| 示例 | 调用者需要知道 | 省略或成本 |
| --- | --- | --- |
| 01、07 状态 | 通过 set 修改；读取值和事件中的状态是只读的 | State 只有基本类型字段，冻结不递归处理嵌套对象 |
| 02 插件 | 数组顺序、null 的含义、异步完成与错误传播 | 插件上下文、插件卸载、真实语法解析未实现 |
| 03 函数 | 明确传入依赖；按需导出不等于纯函数 | 简单键值对解析、当前 esbuild 配置 |
| 05 适配器 | 满足共同接口；不假定全部额外能力等价 | 无真实 LLM 请求、多模态与流式生成；renderer 无 key diff |
| 06 中间件 | 顺序决定包装范围；错误会 reject | 不提供普遍适用的重试策略；agent 计数器仅用于串行运行 |
| 07 能力与订阅 | 先安装初始化插件，再 init；持久化按需调用；临时订阅自行取消 | 同一存储对应同一份状态；没有数据迁移、自动保存和通用 dispose |
| 08 检查点 | 恢复返回新状态，调用者决定是否采用；检查点和当前任务相互隔离 | 内存复制有成本；不覆盖真实 Git、任务停止、外部系统副作用 |

## TypeScript 词汇

| 写法 | 在这里解决什么 | 不代表什么 |
| --- | --- | --- |
| `Readonly<T>` | 阻止通过类型允许的属性赋值 | 不会在运行时冻结数据；本例用 Object.freeze 保证扁平状态不可写 |
| `Partial<T>` | 表示只修改部分状态字段 | 不检查运行时传入的 JSON |
| `Pick<T, K>` | 持久化只依赖读写状态两个方法 | 不要求传入对象必须由某个 class 创建 |
| `K extends keyof Events` | 让事件名决定载荷类型 | 不自动实现事件分发 |
| `Parameters<Hooks[H]>` | 根据 hook 名得到参数元组 | 不决定 hook 的执行顺序 |
| `declare module` | 合并类型声明，方便表达已有扩展 | 不会安装运行时方法，也不能证明单个实例装过插件 |
| `'files' \| 'conversation' \| 'both'` | 限定明确的业务操作范围 | 不需要为每个操作再建立继承体系 |

## 练习怎样验证

每次修改前先写预期结果，再运行对应 demo。已有关键断言位于 [组合契约测试](./demos/tests/composition.test.ts)与 [状态及恢复测试](./demos/tests/state.test.ts)。

- `01` 的连续撤销：`0 → 1 → 2 → undo → 1 → undo → 0`。恢复不能产生新的普通历史项，History 可在内部标记正在恢复，并提供订阅清理。
- `02` 的 hook：第一个非 null 结果生效，后续插件不再执行；加工链必须拿到前一项输出。不要把空字符串当成未处理。
- `03` 的合并文件：未用的 format、validate 仍应删除；观察产物内容，比只比较字节数更能说明原因。
- `05` 的替换实现：两个宿主更新后都只显示新内容；LLM 核心无需增加厂商分支。
- `06` 的调用上限：设为 2 时能获得天气回答；设为 1 时在第二次模型调用前结束。零次重试会直接传播第一次工具错误。
- `07` 的状态：初始对象后续修改不影响实例，冻结状态不能被外部改写；保存后另一个实例可以恢复。
- `08` 的恢复：只恢复文件时保留讨论并移除新增文件；修改恢复结果后，再次恢复仍得到原检查点。

最后回答三个问题：本次修改集中在哪个模块？调用者新增了哪些约定？如果去掉这层抽象，这些知识会散落到哪里？
