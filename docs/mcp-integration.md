# MCP / deepseek harness / cnb.cool 适配

本框架通过 `packages/mcp-server` 把 Forge 能力封装为**标准 MCP 工具集**，并针对 deepseek harness 与 cnb.cool 提供专门适配。

## MCP 工具集

| 工具 | 说明 | Token |
| :--- | :--- | :--- |
| `observe` | 高效页面快照（可交互索引 + 统计） | ⭐ 高效 |
| `act` | 统一动作执行（13 种） | 中 |
| `diagnose` | 5 星调试诊断（健康度 + 建议） | 按需 |
| `eval` | 注入 JS 高级诊断 | 低 |
| `screenshot` | 截图（base64，写入图片事件供多模态 AI） | 高（按需） |
| `session_log` | 会话事件日志流（动作/诊断/错误/截图轨迹，AI 协作追踪） | 中 |
| `close` | 关闭浏览器 | - |

> 完整的 AI 协作消息传递 / 日志 / 图片 / 错误传递协议见
> **[docs/ai-collaboration.md](./ai-collaboration.md)**。

## deepseek harness 适配

deepseek harness 通过 **function calling** 与工具交互。Forge 提供 OpenAI 兼容的函数 schema：

```ts
import { ForgeMcp, buildHarnessFunctionSchemas, toHarnessTools } from "@openliulan/mcp-server";

const mcp = new ForgeMcp({ headless: true });

// 方式 1：函数调用 schema（注入 harness 的 tools 参数）
const schemas = buildHarnessFunctionSchemas(mcp);
// schemas = [ { type:"function", function:{ name:"observe", parameters:{...} } }, ... ]

// 方式 2：可直接调用的函数集合（harness tool_loop）
const tools = toHarnessTools(mcp);
// const r = await tools.find(t=>t.name==="act").fn({ type:"click", ref:"r3" });
```

> deepseek harness 端只需把 `schemas` 传入 function calling 配置，然后在循环里调用 `tools` 即可完成「规划 → 观察 → 行动 → 诊断」闭环。

#### r7 版本适配说明（已完成）

适配**不依赖 harness 具体版本号**，而是基于两条**协议无关**的标准通道，天然兼容 deepseek harness 当前及后续版本（含 r7）：

1. **标准 MCP stdio 服务**（推荐，供 `@deepseek-ai/dsh-mcp-client` 使用）：`forge-mcp --stdio` 暴露标准 `initialize / tools/list / tools/call`，工具定义完整规范（observe / act / diagnose / eval / screenshot / session_log / close / stealth_status），客户端无需针对版本适配即可发现并调用全部工具；
2. **OpenAI 兼容 function calling schema**（供直接注入 tool_loop）：`buildHarnessFunctionSchemas` 输出标准 `{type:"function",function:{name,description,parameters}}`，r7 的原生 function-calling / 多步思考可直接消费。

> 针对 r7 强化的「原生 tool_loop + thinking + 多步规划」，Forge 另提供自愈 `runAgentLoop`（见下节），把 harness 的规划能力与 Forge 的 5 星诊断闭环成自动化排障代理，做到「不是能用，而是增强」。

### 增强：自愈 AgentLoop + 双调试模式（自带眼睛 & 控制/诊断分离）

相比仅暴露裸工具，Forge 提供**自动化排障代理** `runAgentLoop`，把 deepseek 的
多步规划/思考能力与 Forge 的 5 星诊断闭环成「目标 → 观察 → 行动 → 失败自愈 → 再行动」。

**核心价值：MCP 自带眼睛。** 它直接连接真实浏览器，能直接观察到 DOM、控制台、
网络、JS 异常等一手信息——不必像「开发 AI」那样隔着代码猜测。因此它的调试反馈
是**可行动的**，不是猜测。

#### 双调试模式（`mode`）

用户可指定 Agent 的角色：

```ts
import { ForgeMcp, toHarnessTools, runAgentLoop } from "@openliulan/mcp-server";

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

> **HTTP 与 stdio 行为一致**：HTTP 的 `/tools/call` 同样走 `AIMessage` 协议序列化，
> 截图结果会输出标准的 MCP `image` content 块（`{type:"image", data, mimeType}`），
> 供多模态 IDE / AI 直接消费——与 stdio 一致，不再需要外部自行从 `structured.image` 解析。

### MCP 工具 schema（供 IDE / harness 的 function calling 完整声明）

`act` 工具已在 schema 中**完整声明所有动作参数**（`fullPage` / `deltaY` / `delay` /
`waitUntil` / `waitForNavigation` 等），避免 IDE 的 function calling 因参数未声明而
**隐藏能力**。`buildHarnessFunctionSchemas` 输出的 OpenAI 兼容 schema 可直接注入 IDE / harness。

```ts
import { ForgeMcp, buildHarnessFunctionSchemas } from "@openliulan/mcp-server";
const schemas = buildHarnessFunctionSchemas(new ForgeMcp());
// schemas 完整暴露 observe / act / diagnose / eval / screenshot / session_log / close
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
  "artifactDir": "./forge-artifacts",
  "solutionRepoFile": "./solutions-repo.json"   // 可选：CLI 已透传，启用可成长方案库
}
```

代码中可直接调用 `runCiCheck`，返回 `{ok, passed, failed, report, artifacts}`，
失败会返回非零退出码，从而让 cnb CI 的步骤失败/通过，并把结果回写为 PR 评论（`toPrComment`）。

### 增强：CNB 调试会话（cnb.cool + harness + 自定义接口）

`runDebugSession` 是「cnb.cool + deepseek harness + 自定义接口」的编排入口，
解决调试问题：**让开发 AI 拿到直接观察到的、可行动的调试信息**，而不是隔着代码猜测。

```ts
import { ForgeMcp, runDebugSession } from "@openliulan/mcp-server";

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
import { buildKnowledgeContext } from "@openliulan/mcp-server";

const ctx = buildKnowledgeContext([
  { title: "登录流程", snippet: "测试账号 / 内网域名约定", source: "docs/" },
]);
// 把 ctx 注入 Agent 的 system prompt，AI 即带上了仓库知识决策
```

### 增强：错误自动匹配解决方案（二次触发，不多余也不困境）

这是「cnb.cool 在线优势」的进一步升级：当调试/CI 过程中出现问题时，把「问题情况」
检索匹配到内置解决方案知识库（`solutions.ts` 的 `SOLUTION_PLAYBOOK`），自动推荐方案。

**分级处理**：
- **简单问题（`level: "auto"`）** → 直接标准化自动化，给出可直接落地的修复步骤，反馈即结果；
- **复杂问题（`level: "guide"`）** → 识别问题类型后，推荐对应的 **模块 skill / 开源项目 / 解决思路**，
  把「没往这里想」的困境点破。

**二次触发机制**：为避免每次都打扰，同一类错误（用**错误指纹**归一化）出现 **2 次才触发**
推荐——第 1 次静默计数，第 2 次给出方案。这就是「不多余，也不困境」。

```ts
import {
  RepeatErrorRegistry,
  matchSolution,
  fingerprintError,
  SOLUTION_PLAYBOOK,
} from "@openliulan/mcp-server";

const registry = new RepeatErrorRegistry(); // 默认阈值 2

// 第 1 次同类错误：仅计数，不触发
const m1 = matchSolution(registry, "网络存在 1 个失败请求 404");
// { triggered: false, fingerprint: "network:http-error", occurrences: 1 }

// 第 2 次同类错误（同指纹）：触发推荐
const m2 = matchSolution(registry, "请求失败 GET /api 404");
// { triggered: true, occurrences: 2, entry, advice: "…" }
```

内置 playbook 覆盖常见前端/浏览器问题（网络 404/500、CORS 跨域、JS 未捕获异常、DOM 定位失败、
性能 TTFB、SSR 水合、登录鉴权重定向、白屏等），并与仓库知识库（`buildKnowledgeContext`）互补。

该引擎已自动接入：
- **`runAgentLoop`**（debug/report 调试循环）：失败动作经诊断后自动匹配，二次触发时把方案注入
  决策上下文（`result.solutions` 保留触发记录）；
- **`runCiCheck`**（CI 冒烟）：步骤失败自动匹配，方案汇入 `result.solutions` 与 CI 报告/制品；

```ts
// runAgentLoop 中自动启用（可传 solutionRegistry 复用外部计数，或 enableSolutionMatcher:false 关闭）
const result = await runAgentLoop(mcp, tools, {
  act: decision,
  mode: "debug",
  goal: "排查登录页报错",
  // solutionRegistry?: 外部注册表（多轮共用计数）
  // enableSolutionMatcher?: 默认 true
});
console.log(result.solutions); // 触发的解决方案列表
```

### 增强：可成长的在线解决方案库（不依赖检索，越用越大）

内置 playbook 是静态基线；为了「系统能持续成长、上限持续提高」，引入 **`SolutionRepository`**：
在内置 playbook 之上叠加一层**持久化的用户沉淀方案库**，实现「在线库积累解决方案」的成长闭环：

- **新错误沉淀**：内置库未命中的新错误（第 2 次触发时）会被记录为 `unknownErrors` 候选，
  供开发 AI / 用户补充方案；
- **方案入库**：`addSolution()` 把新方案写入库文件（`solutions-repo.json`），去重后持久化；
- **跨会话成长**：`SolutionRepository(filePath)` 加载上次沉淀的方案，下次同类错误直接命中——
  **解决过的问题不再重复造轮子，也无需依赖外部检索**；
- **在线库形态**：库文件可提交进仓库 / 作为 CI 制品导出（`exportSolutionRepoMarkdown`），
  实现团队共享与版本化。

```ts
import { SolutionRepository, RepeatErrorRegistry, exportSolutionRepoMarkdown } from "@openliulan/mcp-server";

const repo = new SolutionRepository("./solutions-repo.json"); // 加载已有沉淀
const reg = new RepeatErrorRegistry();

// 内置未命中的新错误 → 记为候选
const m = repo.match(reg, "后端返回 429 too many requests");
console.log(repo.unknownErrors); // ["generic:action-failed"]

// 解决后沉淀进库（系统成长）
repo.addSolution({
  id: "api-rate-limit",
  fingerprint: "api:rate-limit",
  title: "后端接口限流（429）",
  pattern: /429|rate.?limit|限流/i,
  level: "guide",
  solution: "加指数退避重试；减少并发；检查高频轮询。",
});
repo.persist(); // 写入 ./solutions-repo.json

// 导出为 markdown（可作 PR/制品/文档 = 在线库）
const md = exportSolutionRepoMarkdown(repo, { title: "项目解决方案库" });
```

`runCiCheck` 可通过 `solutionRepoFile` 配置启用成长库：

```ts
const result = await runCiCheck(mcp, {
  steps, artifactDir: "./forge-artifacts", persistArtifacts: true,
  solutionRepoFile: "./solutions-repo.json", // 启用可成长方案库
});
// report 中会显示「方案库: 内置 8 条 + 沉淀 N 条」
```

> 说明：真实验收测试还暴露并修复了两处缺陷——`runCiCheck` 的 `nonFatal` 默认应为 true（允许失败后继续，否则二次触发机制无法生效）；`fingerprintError` 对真实报错「无法定位元素」未正确识别为 `dom:locator-failed`（已补充正则与回归测试）。

### 沉淀方案 → 决策上下文（在线/本地信息打通）

成长库积累的方案不应只停留在匹配引擎里，还应注入到**决策上下文**，让在线 CodeBuddy 与本地 Agent
诊断/规划时默认携带项目已经解决的问题——**避免重复造轮子**。

`buildSolutionKnowledgeContext(repo)` 把方案库（内置 + 沉淀）转为与 `buildKnowledgeContext` 入参一致的
知识片段（title/snippet/source），可直接拼接到仓库知识库上下文之后：

```ts
import {
  SolutionRepository, buildSolutionKnowledgeContext, buildKnowledgeContext,
} from "@openliulan/mcp-server";

const repo = new SolutionRepository("./solutions-repo.json"); // 加载已沉淀方案
// ① 把沉淀方案转为知识片段（仅沉淀部分，避免重复注入内置基线）
const solKb = buildSolutionKnowledgeContext(repo, { includeBuiltin: false });
// ② 与仓库知识库合并，一起注入 system prompt
const ctx = buildKnowledgeContext([
  { title: "登录流程", snippet: "测试账号 / 内网域名约定", source: "docs/" },
  ...solKb,
]);
// 在线 CodeBuddy / 本地 Agent 决策时默认携带这些积累方案
```

**自动注入**：`runCiCheck` / `runDebugSession` 传 `solutionRepoFile` 后，CI 报告与调试报告会
自动追加「项目已沉淀方案」区块，供在线（PR 评论/CI 制品）与本地（报告文件）两侧的 AI 一起引用：

```ts
// CI 冒烟：报告自动携带沉淀方案
const result = await runCiCheck(mcp, {
  steps, artifactDir: "./forge-artifacts", persistArtifacts: true,
  solutionRepoFile: "./solutions-repo.json",
});
// 调试会话：本地/在线报告自动注入沉淀方案
await runDebugSession(mcp, {
  goal: "排查登录页报错", url: "http://localhost:3000/login",
  owner: "developer-ai", solutionRepoFile: "./solutions-repo.json",
});
```

CLI 也支持透传：`forge-mcp --ci-spec ./ci-spec.json --solution-repo ./solutions-repo.json`
与 `forge-mcp --debug-session ./debug-session.json --solution-repo ./solutions-repo.json`。

### 云端 CI 冒烟固化（`.cnb.yml`）

`.cnb.yml` 的 `smoke` 流水线已正式启用，每次构建都在云端真实启动 Chromium 跑
`--ci-spec ./examples/ci-spec.json --solution-repo ./solutions-repo.json`：真实导航/断言/截图，
失败即驱动 CI 红/绿，方案库沉淀随构建积累——把「真实验收 + 在线库成长」固化为持续流程。


## IDE / 工具链项目级接入（Trae / OpenCode）

除 deepseek harness 与 cnb.cool 之外，本仓库还直接提供了 **Trae** 与 **OpenCode** 两类
**项目级 MCP 接入**，方便在对应 IDE / 工具链中以仓库相对路径零配置启动 `OpenLiulan`：

| 接入对象 | 项目级配置 | 说明 |
| :--- | :--- | :--- |
| Trae | [`../.trae/mcp.json`](../.trae/mcp.json) | 以本仓库为 workspace 打开即可发现 `OpenLiulan` MCP |
| OpenCode | [`../opencode.jsonc`](../opencode.jsonc) | 项目级 `mcp` 条目，直接启用 `openliulan` 本地 MCP |

> 两类配置均以仓库相对路径指向 `packages/mcp-server/dist/cli.js`（`--stdio`），免去全局
> 绝对路径的重复维护；全局使用时可参考下方文档改用绝对路径。

完整的分步接入指南（含 DeepSeek Harness / Trae / OpenCode、全局配置示例与 Windows 说明）见
**[docs/mcp-management.md](./mcp-management.md)**。


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
