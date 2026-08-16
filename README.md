# Browser AI Forge

整合 **Browser-Use**、**Stagehand**、**Chrome DevTools MCP** 与 **Playwright MCP** 四大浏览器自动化项目，构建一个**更强大、更可控、更强诊断能力**的统一 AI 浏览器控制框架。

> 为 AI Agent（适配 deepseek harness 与 cnb.cool 生态）提供「精确操作 + 深度调试诊断 + 高效 Token」的一体化能力。

---

## 背景：为什么整合

| 维度 | Browser-Use | Stagehand | Chrome DevTools MCP | 原生 Playwright MCP |
| :--- | :--- | :--- | :--- | :--- |
| AI 适配度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| 操作精确性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Token 效率 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 调试/诊断能力 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 社区活跃度 | 🔥🔥🔥🔥🔥 | 🔥🔥🔥 | 🔥🔥🔥 | 🔥 |
| MCP 集成 | ✅ 官方 | ✅ 官方 | ✅ 官方 | ✅ 但已过时 |
| 许可证 | MIT | MIT | Apache-2.0 | Apache-2.0 |

**每个项目各有短板，整合可形成互补：**

- **Browser-Use** 提供最强的 AI 语义层（自然语言动作、元素语义化、多步规划）
- **Stagehand / Playwright** 提供最精确的底层操作（强选择器、稳定性重试）
- **Chrome DevTools MCP** 提供 5 星调试/诊断与 5 星 Token 效率
- **Playwright MCP** 提供成熟的浏览器协议接入（虽过时但协议仍是地基）

## 整合后的能力矩阵（目标）

| 能力 | 来源 | 说明 |
| :--- | :--- | :--- |
| 🧠 AI 语义层 | Browser-Use | 自然语言 -> 动作规划、元素语义化描述 |
| 🎯 精确操作 | Stagehand / Playwright | 强选择器、自动等待、重试与稳定性保障 |
| 🔍 调试诊断 | Chrome DevTools MCP | DOM/网络/控制台/性能/JS 异常全链路诊断 |
| ⚡ Token 高效 | Chrome DevTools MCP | 精简 DOM、按需读取、结构化快照 |
| 🔌 MCP 集成 | 全项目 | 统一 MCP Server，供 Agent / harness 调用 |
| 🛠️ 协议层 | Playwright MCP | CDP 直连 / Playwright 驱动双引擎 |

## 目录结构

```
browser-ai-forge/
├── packages/
│   ├── core/          # 核心调度引擎（动作编排、状态机、快照）
│   ├── engines/       # 底层驱动适配（Playwright / CDP 双引擎）
│   ├── diagnosis/     # 调试诊断中心（5 星能力）
│   ├── ai-layer/      # AI 语义层（自然语言 -> 动作）
│   ├── token/         # Token 高效提取策略
│   └── mcp-server/    # 统一 MCP Server + deepseek/cnb 适配
├── examples/          # 示例与快速上手
└── docs/              # 架构设计文档
```

## 核心亮点：自愈调试 + 自带眼睛

Forge MCP 直接连接真实浏览器，**自带眼睛**——能直接观察到 DOM、控制台、网络、
JS 异常等一手信息，不必像「开发 AI」那样隔着代码猜测。调试反馈是**可行动的**。

通过 `runAgentLoop` / `runDebugSession` 提供**双调试模式**，允许用户选择调试负责方：

- **`debug` 模式**：Agent 负责完整调试——自动诊断 → 自愈重试 → assert 自校验目标真实达成；
- **`report` 模式**：Agent 只负责**控制与观察**，把结构化调试发现（`report.findings`）
  反馈给开发 AI（CodeBuddy/cnb.cool），由开发 AI 结合代码全局视角修复——控制与诊断分离。

### 错误自动匹配解决方案（不多余，也不困境）

在调试/CI 过程中出现问题时会**自动匹配内置解决方案知识库**，按问题难度分级反馈：

- **简单问题** → 直接标准化自动化，返回可直接落地的修复步骤（反馈即结果）；
- **复杂问题** → 识别问题类型后推荐**模块 skill / 开源项目 / 解决思路**，点破「没往这里想」的困境；
- **二次触发**：同一类错误（错误指纹）**出现 2 次才触发推荐**，避免每次打扰。

该引擎自动接入 `runAgentLoop` 与 `runCiCheck`，详见 [MCP/知识库/解决方案文档](docs/mcp-integration.md)。

**可成长的在线方案库**：内置 playbook 之上叠加 `SolutionRepository` 持久化沉淀库——
新错误（内置未命中）会被记录为候选，解决后 `addSolution()` 入库并跨会话持久化，
下次同类错误直接命中。方案库文件可提交仓库/作 CI 制品导出，**解决过的问题不再依赖检索、越用越大**。
`runCiCheck` 传 `solutionRepoFile` 即可启用。

```ts
import { ForgeMcp, runAgentLoop } from "@browser-ai-forge/mcp-server";

const mcp = new ForgeMcp({ headless: true });
const result = await runAgentLoop(mcp, toHarnessTools(mcp), {
  act: async (tools, history) => /* 调 deepseek 选下一步 */,
  maxRetries: 2,          // 失败自愈重试
  mode: "report",          // debug | report
  goal: "排查登录页报错",
  verify: async (turns, mcp) => /* assert 自校验目标真实达成 */,
});
// result.report.findings —— 结构化调试发现（供开发 AI 决策）
```

## 快速开始

```bash
npm install
npm run build
node examples/quickstart.mjs
```

## 文档

- [架构设计](docs/architecture.md)
- [调试诊断中心](docs/diagnosis.md)
- [MCP / deepseek harness 适配](docs/mcp-integration.md)
- [Token 策略](docs/token-strategy.md)

## License

MIT
