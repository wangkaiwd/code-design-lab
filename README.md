# 从可运行示例学习代码设计

这个项目研究：功能逐渐增加时，如何保持接口清楚、状态归属明确，并让修改集中在合适的模块中。

## 阅读入口

- [学习指南](./learning-guide.md)：阅读顺序、需求演进、源码入口和 TypeScript 词汇。
- [如何避免库的核心类膨胀](./how-to-avoid-core-bloated.md)：组合、插件、模块化接口、适配器、中间件，以及 Cline 的检查点案例。
- [Demo 说明](./demos/README.md)：每个示例的运行命令、契约、简化范围和练习预期。

## 运行

需要 Node.js 24+ 和 pnpm。在项目根目录执行以下命令。示例无需 API Key，使用内存或模拟模型。

```bash
pnpm install
pnpm 01
pnpm 08        # 新增 Cline 检查点与恢复范围示例
pnpm typecheck
pnpm test
```

建议按 `01 → 03 → 05:llm → 06:koa → 07 → 08` 学习，再按兴趣阅读插件与其他变体。每次先提出一个需求变化，预测要修改哪些文件，最后通过输出和断言验证判断。
