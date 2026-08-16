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
