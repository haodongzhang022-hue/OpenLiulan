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

### 增强：自愈 AgentLoop（发挥 deepseek 原生规划 + Forge 诊断）

相比仅暴露裸工具，Forge 提供**自动化排障代理** `runAgentLoop`，把 deepseek 的
多步规划/思考能力与 Forge 的 5 星诊断闭环成「目标 → 观察 → 行动 → 失败自愈 → 再行动」：

```ts
import { ForgeMcp, toHarnessTools, runAgentLoop } from "@browser-ai-forge/mcp-server";

const mcp = new ForgeMcp({ headless: true });
const tools = toHarnessTools(mcp);

// act：由 deepseek harness 端实现的函数-calling 决策（基于 tools + 历史选下一步）
const decision = async (tools, history) => { /* 调用 deepseek，返回 {name,args} */ };

const result = await runAgentLoop(mcp, tools, {
  act: decision,
  maxSteps: 20,
  maxRetries: 2, // 动作失败自动诊断并让 LLM 修正后重试
  autoObserve: true,
});
```

**这正是「之前做不到的」**：
- 动作失败会**自动采集诊断**并把建议喂回给 LLM，驱动其修正定位/策略后重试（自愈）；
- 用 `assert` 自校验目标是否**真实达成**，而非「自以为成功」；
- 每步决策都基于最新、Token 高效、带 ref 的页面快照（`observeContext`）。

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
