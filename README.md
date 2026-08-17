<div align="center">

# 🚀 OpenLiulan · 开放浏览

> **开「浏览」之眼，赋「AI」以行动** —— 让 AI 真正看懂网页、精准操作、自愈排障的下一代浏览器控制框架。

**OpenLiulan（开放浏览）** 整合 **Browser-Use / Stagehand / Chrome DevTools MCP / Playwright MCP**
四大浏览器自动化项目的精华，为 AI Agent 打造「**精确操作 + 深度调试诊断 + 高效 Token**」的一体化能力，
开箱即用地接入 **DeepSeek Harness** 与 **cnb.cool** 生态。

`TypeScript` · `npm workspace` · `MIT License` · 统一 MCP Server · 自带眼睛 · 自愈调试

</div>

---

## ✨ 为什么选择 OpenLiulan？

市面上浏览器自动化工具很多，但**各有短板**。OpenLiulan 把它们的长处拼在一起，取长补短：

| 维度 | Browser-Use | Stagehand | Chrome DevTools MCP | Playwright MCP | **OpenLiulan** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🧠 AI 语义层 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ✅ **集大成** |
| 🎯 操作精确性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **最精确** |
| ⚡ Token 效率 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ✅ **最高效** |
| 🔍 调试/诊断 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ **5 星自带** |
| 🔌 MCP 集成 | ✅ | ✅ | ✅ | ⚠️ 过时 | ✅ **统一接入** |
| 🛠️ 双引擎 | — | — | — | — | ✅ **CDP + Playwright** |

> **一句话**：别人给 AI 的是「手」，OpenLiulan 给 AI 的是一双**能看、能查、能自愈的眼睛**。

---

## 🎯 它到底能做什么？

OpenLiulan 让 AI 像人一样使用浏览器，并且**比人更靠谱**：

- 🧭 **自然语言操控网页** —— 把「帮我打开登录页并排查报错」翻译成精确的浏览器动作序列；
- 🔍 **自带眼睛看网页** —— 直接读取真实 DOM、控制台、网络请求、JS 异常，不再隔着代码瞎猜；
- 🛠️ **精确点击 / 输入 / 跳转** —— 强选择器 + 自动等待 + 稳定性重试，指哪打哪；
- 💾 **提取结构化信息** —— 一键抽取页面标题、正文、表单等关键数据；
- ⚡ **Token 高效省电** —— 精简 DOM、按需读取、结构化快照，帮大模型省钱省时；
- 🚑 **自愈式调试排障** —— 出错自动诊断 → 匹配解决方案 → 重试直到目标真实达成；
- 🤝 **无缝对接外部 AI** —— 日志、截图、报错以结构化消息喂给 IDE / CodeBuddy / cnb.cool；
- 🧠 **可成长方案库** —— 解决过的问题沉淀入库，越用越聪明，不重复踩坑。

---

## 🏗️ 架构一览

```
openliulan/
├── packages/
│   ├── core/          # 🧠 核心调度引擎（动作编排、状态机、页面快照）
│   ├── engines/       # 🛠️ 底层驱动适配（Playwright / CDP 双引擎）
│   ├── diagnosis/     # 🔍 调试诊断中心（5 星能力）
│   ├── ai-layer/      # 🧠 AI 语义层（自然语言 -> 动作）
│   ├── token/         # ⚡ Token 高效提取策略
│   └── mcp-server/    # 🔌 统一 MCP Server + deepseek/cnb 适配
│       ├── events/    # 📡 事件协议（动作/诊断/错误/截图/日志）
│       ├── logger/    # 📋 会话事件日志器（SessionLogger）
│       └── message/   # 💬 AI 协作消息协议（AIMessage）
├── examples/          # 🧪 示例与快速上手
└── docs/              # 📚 架构设计文档
```

---

## 🌟 核心亮点

### 👁️ 自带眼睛：看到即行动，行动即反馈

OpenLiulan 直接连接真实浏览器，能第一时间观察到 **DOM、控制台、网络、JS 异常**等一手信息。
调试反馈不再是「猜」，而是**可行动的结论**。

### 🚑 自愈调试：双模式任你选

通过 `runAgentLoop` / `runDebugSession` 提供两种调试模式：

- **`debug` 模式** —— Agent 全权负责：自动诊断 → 自愈重试 → assert 自校验目标真实达成；
- **`report` 模式** —— Agent 只负责**控制与观察**，把结构化发现（`report.findings`）交给开发 AI
  （CodeBuddy / cnb.cool）结合全局代码视角修复，**控制与诊断分离**。

### 🧰 错误自动匹配解决方案：不多余，也不困境

调试 / CI 出错时自动匹配**内置解决方案知识库**，按难度分级反馈：

- **简单问题** → 直接给出可落地的修复步骤，反馈即结果；
- **复杂问题** → 识别问题类型后推荐模块 / 开源项目 / 解决思路，点破「没往这里想」的困境；
- **二次触发** → 同一错误指纹出现 2 次才推荐，避免每次打扰。

### 🤝 AI 协作：日志 / 图片 / 错误一键传递

- **📋 日志系统**：`SessionLogger` 维护连贯事件流（动作/诊断/错误/截图/日志），可订阅、可拉取、可导出；
- **🖼️ 图片传递**：截图序列化为标准 `image` content 块，供多模态 AI 看图定位；
- **🐛 Bug 传递**：失败自动生成 `ForgeErrorEvent`，携带**错误码 + 根因 + 解释 + 修复建议 + 截图**；
- **📡 可追踪**：`session_log` 工具让 AI 随时拉取事件流，功能对 AI 完全透明。

### 🧠 可成长的方案库：越用越聪明

内置 playbook 之上叠加 `SolutionRepository` 持久化沉淀库——新错误记录为候选，
解决后 `addSolution()` 入库并跨会话持久化。**解决过的问题不再依赖检索，越用越大**。
沉淀的方案可注入 system prompt 决策上下文，在线与本地调试信息全量打通，**避免重复造轮子**。

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 编译所有包
npm run build

# 3. （首次必做）安装浏览器
npx playwright install chromium

# 4. 跑一个示例
node examples/quickstart.mjs
```

> ⚠️ **注意**：仅 `npm install` 不会自动下载 Playwright 浏览器，
> 使用真实浏览器自动化前**必须**执行 `npx playwright install chromium`。

### 最小示例：让 AI 排查登录页报错

```ts
import { ForgeMcp, runAgentLoop } from "@openliulan/mcp-server";

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

---

## 📦 依赖说明

OpenLiulan 基于 **npm workspace**，克隆后需准备：

| 类别 | 依赖 | 版本 | 用途 |
| :--- | :--- | :--- | :--- |
| 运行环境 | Node.js | >= 20（推荐 22 LTS） | 运行 MCP 服务、编译、Playwright |
| 生产依赖 | playwright | ^1.45（锁定 1.62.1） | 浏览器启动、CDP、DOM 操作、导航、截图、断言 |
| 生产依赖 | zod | ^3.23.0 | 动作与数据结构的运行时校验 |
| 开发依赖 | typescript / vitest / @types/node | — | 编译、单测与真实浏览器验收 |

> 其余 `@openliulan/*` 均为仓库内部包，无需单独安装。
> 完整依赖树、DeepSeek Harness 集成配置与实测版本详见
> **[docs/dependencies.md](docs/dependencies.md)** 与 **[DEPENDENCIES.md](DEPENDENCIES.md)**。

---

## 📚 文档

| 文档 | 说明 |
| :--- | :--- |
| [架构设计](docs/architecture.md) | 整体架构、门面、双引擎、五层能力 |
| [调试诊断中心](docs/diagnosis.md) | 5 星诊断能力详解 |
| [MCP / Harness 适配](docs/mcp-integration.md) | DeepSeek Harness 与 cnb.cool 接入 |
| [AI 协作消息](docs/ai-collaboration.md) | 日志 / 图片 / 错误传递协议 |
| [Token 策略](docs/token-strategy.md) | 高效提取与省电策略 |
| [依赖说明](docs/dependencies.md) | 完整依赖与安装指引 |
| [安全加固](docs/security.md) | 防令牌泄露 / 防渗透 / 防提权 |

## 🔒 安全加固（Security）

> Forge 是「真实浏览器控制」的高权限自动化工具，框架已内建多层安全加固，
> 详见 **[docs/security.md](docs/security.md)**。要点：
>
> - **防令牌/密码泄露**：页面快照对 `password`/`token`/`jwt` 等敏感输入框脱敏，
>   日志/事件流/报告/HTTP 响应统一做敏感信息脱敏；
> - **防远程渗透**：HTTP 服务默认仅允许本机回环访问，需远程时必须配置
>   `FORGE_HTTP_TOKEN`（Bearer 鉴权）与 `FORGE_HTTP_ALLOWED_ORIGINS`；
> - **防提权**：`eval` 拦截文件系统/子进程/环境变量等高危注入；
> - **防 SSRF**：webhook 投递统一走 `isPrivateOrLoopbackHost()`，拦截私有网段、
>   回环、IPv6（含 `[::1]`）、**云元数据 `169.254/16`**（防窃取 IAM 凭证）等内网目标。

## 📄 License

**MIT License** —— 自由使用、自由修改、自由分发。

---

<div align="center">

**OpenLiulan · 开放浏览** — 让每一个 AI 都长出一双会浏览的「眼睛」

⭐ 如果它对你有帮助，欢迎 Star 支持！⭐

</div>
