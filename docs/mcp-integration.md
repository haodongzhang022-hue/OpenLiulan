# MCP / deepseek harness / cnb.cool 适配

本框架通过 `packages/mcp-server` 把 Forge 能力封装为**标准 MCP 工具集**，并针对 deepseek harness 与 cnb.cool 提供专门适配。

## MCP 工具集

| 工具 | 说明 | Token |
| :--- | :--- | :--- |
| `observe` | 高效页面快照（可交互索引 + 统计） | ⭐ 高效 |
| `act` | 统一动作执行（13 种） | 中 |
| `diagnose` | 5 星调试诊断（健康度 + 建议） | 按需 |
| `eval` | 注入 JS 高级诊断 | 低 |
| `screenshot` | 截图（base64） | 高（按需） |
| `close` | 关闭浏览器 | - |

## deepseek harness 适配

deepseek harness 通过 **function calling** 与工具交互。Forge 提供 OpenAI 兼容的函数 schema：

```ts
import { ForgeMcp, buildHarnessFunctionSchemas, toHarnessTools } from "@browser-ai-forge/mcp-server";

const mcp = new ForgeMcp({ headless: true });

// 方式 1：函数调用 schema（注入 harness 的 tools 参数）
const schemas = buildHarnessFunctionSchemas(mcp);
// schemas = [ { type:"function", function:{ name:"observe", parameters:{...} } }, ... ]

// 方式 2：可直接调用的函数集合（harness tool_loop）
const tools = toHarnessTools(mcp);
// const r = await tools.find(t=>t.name==="act").fn({ type:"click", ref:"r3" });
```

> deepseek harness 端只需把 `schemas` 传入 function calling 配置，然后在循环里调用 `tools` 即可完成「规划 → 观察 → 行动 → 诊断」闭环。

### 增强：自愈 AgentLoop + 双调试模式（自带眼睛 & 控制/诊断分离）

相比仅暴露裸工具，Forge 提供**自动化排障代理** `runAgentLoop`，把 deepseek 的
多步规划/思考能力与 Forge 的 5 星诊断闭环成「目标 → 观察 → 行动 → 失败自愈 → 再行动」。

**核心价值：MCP 自带眼睛。** 它直接连接真实浏览器，能直接观察到 DOM、控制台、
网络、JS 异常等一手信息——不必像「开发 AI」那样隔着代码猜测。因此它的调试反馈
是**可行动的**，不是猜测。

#### 双调试模式（`mode`）

用户可指定 Agent 的角色：

```ts
import { ForgeMcp, toHarnessTools, runAgentLoop } from "@browser-ai-forge/mcp-server";

const mcp = new ForgeMcp({ headless: true });
const tools = toHarnessTools(mcp);

const decision = async (tools, history) => { /* 调用 deepseek，返回 {name,args} */ };

// mode: "debug" —— Agent 负责完整调试（自动诊断/自愈重试/assert 自校验）
// mode: "report" —— Agent 只负责控制与观察，把结构化调试报告反馈给开发 AI 决策
const result = await runAgentLoop(mcp, tools, {
  act: decision,
  maxSteps: 20,
  maxRetries: 2,          // 失败自愈重试
  autoObserve: true,       // 每步基于最新快照决策
  mode: "report",          // debug | report
  goal: "排查登录页报错",   // report 模式的报告标题
  verify: async (turns, mcp) => {
    // 可选：用 assert 自校验目标是否「真实达成」而非「自以为成功」
    return true;
  },
  knowledgeContext: "仓库知识库片段...",
});
```

**这正是「之前做不到的」**：
- `debug` 模式：动作失败会**自动采集诊断**并把「为什么失败 + 建议」喂回给 LLM，
  驱动其修正定位/策略后重试（自愈）；
- `report` 模式：Agent 只负责**控制与观察**，把结构化的调试报告（`report.findings` + `report.markdown`）
  反馈给开发 AI（CodeBuddy/cnb.cool），由开发 AI 结合代码全局视角修复——控制与诊断分离；
- 用可选 `verify` 断言自校验目标是否**真实达成**；
- 每步决策都基于最新、Token 高效、带 ref 的页面快照（`observeContext`）。

#### 结构化调试发现

失败动作的原始错误会被**结构化成可行动发现**（`DebugFinding`）：

```ts
{
  category: "console" | "network" | "js-exception" | "performance" | "dom",
  severity: "error" | "warning" | "info",
  message: "控制台有 2 条错误",
  suggestion: "检查 JS 异常堆栈与资源加载，定位未捕获异常或 404/500 资源"
}
```

这些发现既可用于驱动 debug 模式的自愈，也可作为 report 模式反馈给开发 AI 的**一手调试信息**。

#### 工程加固：超时 / 去重升级 / stopReason（稳定可工程化）

为了让它**稳定可用**（而非只是演示），`runAgentLoop` 内置了几道工程护栏：

```ts
const result = await runAgentLoop(mcp, tools, {
  act: decision,
  mode: "debug",
  timeoutMs: 60_000,   // ① 整环超时：防止死循环/长时间卡死
  maxRetries: 2,       // ② 失败重试，达上限即升级停止自动修复
  maxSteps: 20,
});

// ③ 结束原因清晰可观测：
// result.stopReason ∈
//   "goal-achieved"    目标真实达成（verify 自验收通过 / close）
//   "max-steps"        达到最大步数
//   "too-many-retries" 失败自愈重试达上限，升级为停止自动修复（避免死循环）
//   "timeout"          整环超时
//   "report-handoff"   report 模式：已生成结构化报告，转交开发 AI 决策
```

| 护栏 | 作用 |
| :--- | :--- |
| `timeoutMs` | 整环超时（默认 120s），超时即 `stopReason=timeout`，避免死循环 |
| 失败去重升级 | 同一失败累计达 `maxRetries` 即 `stopReason=too-many-retries`，不再无脑重试 |
| report 自动转交 | report 模式失败即 `stopReason=report-handoff`，只反馈不自动修 |
| verify 权威 | 提供 `verify` 时以 assert 自验收为准，避免 close 抢占退出 |
| `stopReason` | 结束原因可观测，工程上能明确判断为何退出 |


## cnb.cool 适配

cnb.cool 的 CodeBuddy 等 AI 助手可通过两种方式接入：

### 方式 1：stdio MCP 服务

```bash
npx forge-mcp --stdio
```

供支持 MCP stdio 的客户端（如 Claude Desktop、cnb 的 MCP 客户端）连接。

### 方式 2：HTTP 服务（webhook / 远程）

```bash
npx forge-mcp --http --port 8787
```

```bash
# 健康检查
curl http://localhost:8787/health

# 调用工具
curl -X POST http://localhost:8787/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"observe","arguments":{}}'
```

### 方式 3：CNB CI/Pipeline 冒烟检查（发挥 cnb 云端构建能力）

这是「单靠 HTTP 接口做不到」的端到端增强：让 Forge 作为 `.cnb.yml` 里的一个 step
在 cnb 云端构建机中启动真实浏览器，按断言脚本验收，并把截图/诊断报告落盘为 CI 制品：

```bash
# 定义 ci-spec.json 步骤（navigate/click/fill/assert/screenshot…）
npx forge-mcp --ci-spec ./ci-spec.json
```

```jsonc
// ci-spec.json
{
  "steps": [
    { "action": "observe", "args": {} },
    { "action": "act", "args": { "type": "navigate", "url": "https://example.com" } },
    { "action": "act", "args": { "type": "assert", "text": "Example", "mode": "text-contains" } },
    { "action": "screenshot", "args": { "fullPage": true }, "nonFatal": true }
  ],
  "artifactDir": "./forge-artifacts"
}
```

代码中可直接调用 `runCiCheck`，返回 `{ok, passed, failed, report, artifacts}`，
失败会返回非零退出码，从而让 cnb CI 的步骤失败/通过，并把结果回写为 PR 评论（`toPrComment`）。

### 增强：CNB 调试会话（cnb.cool + harness + 自定义接口）

`runDebugSession` 是「cnb.cool + deepseek harness + 自定义接口」的编排入口，
解决调试问题：**让开发 AI 拿到直接观察到的、可行动的调试信息**，而不是隔着代码猜测。

```ts
import { ForgeMcp, runDebugSession } from "@browser-ai-forge/mcp-server";

const mcp = new ForgeMcp({ headless: true });

const report = await runDebugSession(mcp, {
  goal: "排查登录页报错",
  url: "https://example.com/login",
  owner: "developer-ai",      // 交给开发 AI（CodeBuddy/cnb.cool）结合代码全局视角修复
  // owner: "agent"           // 由本 Agent 负责完整调试
  // owner: { channel: "pr-comment" }  // 生成可粘贴到 cnb.cool PR 的评论文本
  // owner: { channel: "file", target: "./debug-report.md" }
  reportFile: "./forge-debug-report.md",
  screenshot: true,
});

// report.findings —— 结构化调试发现（供开发 AI 直接消费）
// report.markdown  —— 可直接回写 PR/Issue 的 markdown
```

**核心价值**：允许用户选择调试的负责方——
- `owner: "developer-ai"`：Agent 只负责**控制与观察**，反馈结构化调试发现，
  由开发 AI（具备代码全局视角）结合代码修复 bug——「控制与诊断分离」；
- `owner: "agent"`：由 Agent 负责完整调试（debug 模式），自动诊断/自愈/自校验；
- 自定义 `{ channel: "pr-comment" | "file" | "webhook" }`：把报告投递到指定渠道。

### 增强：CNB 仓库知识库注入

CNB 独有的「仓库知识库」能力可被用来给 AI 决策带上项目语境
（URL 约定、测试账号、页面结构、已知坑），让诊断/规划更精准：

```ts
import { buildKnowledgeContext } from "@browser-ai-forge/mcp-server";

const ctx = buildKnowledgeContext([
  { title: "登录流程", snippet: "测试账号 / 内网域名约定", source: "docs/" },
]);
// 把 ctx 注入 Agent 的 system prompt，AI 即带上了仓库知识决策
```

## CDP 直连（复用 DevTools 调试通道）

当需要调试**真实运行中的浏览器**时，连接其 CDP 端点：

```bash
npx forge-mcp --connect ws://localhost:9222/devtools/browser/xxx
```

这复用了 Chrome DevTools MCP 的调试优势，让 Forge 同时拥有「Playwright 的易用性」与「DevTools 的深度」。

## 在 cnb.cool 中使用

1. 在仓库 `.cnb.yml` 中安装依赖并启动服务（见项目配置示例）。
2. 通过 HTTP `/tools/call` 或 MCP stdio 调用工具。
3. CodeBuddy 在对话中即可「观察页面 → 操作 → 诊断」辅助控制浏览器。
