# dsh-OpenLiulan 升级日志（CHANGELOG）

> **统一时间戳基线：2026-08-18** —— 本项目版本化统一采用 `YYYY-MM-DD`，同一版本的所有条目共用同一个时间戳；新版本永远最高权重，早期内容保留供参考、不作为当前实现的直接依据。
> 规则：按功能分节，每节内按版本正序（最新在最前）。

---

## 最新版本（最高权重）· v1.2.0 — 可安装 DSH 插件包（2026-08-29）

v1.2.0 把 dsh-OpenLiulan 从「源码接入」升级为「一行命令可安装的 **DSH 插件包**」，对标 DSH Plugin Hub 的一键安装体验：

| 增强点 | 做了什么 |
| :--- | :--- |
| 可安装插件包 | 顶层包更名 `@openliulan/dsh-openliulan`，声明 `dsh.bundle.patch → cordis.patch.yml`，`main/exports/files` 只暴露自包含 `lib/index.js` + 装配补丁 |
| 一条命令安装 | `dsh plugin --profile web add <cnb.cool|GitHub|npm>` 即可装进 dsh web profile；安装器自动把插件并入 `dsh.profile.bundles` 装配层 |
| 自包含构建 | `scripts/build-plugin.mjs` 用 esbuild 把所有 `@openliulan/*` 源码内联成单文件，仅外置已发布的 `playwright`，不依赖任何未发布包即可被他人安装 |
| 进程内插件入口 | `src/plugin.ts` 的 `apply(ctx)` 构造进程内 ForgeMcp，把 8 个浏览器工具以 `browser_*` 前缀注册为 harness 原生工具 |
| 装配补丁 | `cordis.patch.yml` 声明插件 `insert`，`prefix: browser`、无头模式均可覆盖 |
| 分发作自动 | 增加 `prepare` 脚本，git 源码通道克隆即构建；`lib/` 入库保证即使构建被拦也能直接装配 |

---

## 最新版本（最高权重）· v1.1.0 — DeepSeek Harness 接入适配增强（2026-08-29）



v1.1.0 是「从自研可调，到生态里开箱即接」的一轮增强：把 OpenLiulan 统一 MCP Server 直接接进 **DeepSeek Harness** 运行环境（profile `@deepseek-ai/dsh-mcp-client`），并补齐 Trae / OpenCode 三客户端一键接入。

| 增强点 | 做了什么 |
| :--- | :--- |
| Harness MCP 接入 | profile 内加 `@deepseek-ai/dsh-mcp-client` 条目，`serverName: openliulan`，工具化为 `mcp__openliulan__observe/act/diagnose/eval/screenshot/session_log/close`；工程参数 `failOnStartupError`、`toolCallTimeoutMs` 一次配好 |
| 三客户端接入 | DeepSeek Harness（`docs/mcp-management.md`）+ Trae（`.trae/mcp.json`）+ OpenCode（`opencode.jsonc`）一个库全搞定 |
| 函数式适配 | `toHarnessTools` / `buildHarnessFunctionSchemas` 输出 OpenAI 兼容 function calling schema，注入 harness tools / system prompt |
| 权威单点 + 周同步 | `docs/SYNC_WINDOW.md` 明确本目录为唯一权威源码源，消费端（node_modules junction / dsh-home / 全局 MCP）都引用同一 `dist/cli.js`，每周云端→本地只读单向同步 |

> 依赖说明见 `docs/dependencies.md` 与 `DEPENDENCIES.md`；接入配置见 `docs/mcp-management.md`。

---

## 功能分节 · 版本迭代时间线

> 以下各功能节内，**最新版本在最前（最高权重）**；旧版本仅保留作参考。

### DeepSeek Harness / cnb.cool 适配
- **v1.1.0（2026-08-29）**：新增 Harness 接入文档 `docs/mcp-management.md` + `.trae/mcp.json` + `opencode.jsonc`，Harness / Trae / OpenCode 三客户端开箱即接。
- **v1.0.0（2026-08-18）**：`packages/mcp-server/src/adapters/harness.ts`「强化版」——`toHarnessTools` / `buildHarnessFunctionSchemas` 把 Forge 工具映射为 harness 可调用函数与 OpenAI 兼容 schema；`adapters/cnb.ts` 提供 cnb.cool stdio / HTTP / CI 三接入。

### 自愈 AgentLoop · 双调试模式
- **v1.0.0（2026-08-18）**：`runAgentLoop` 闭环节点——MCP 自带眼睛直接观察 DOM/控制台/网络/JS 异常；`debug`（Agent 全权调试）与 `report`（控制/诊断分离，结构化报告交开发 AI）双模式；`buildSelfHealContext` 生成可行动自愈上下文；`stopReason` 明确退出原因；`verify` assert 自校验目标真实达成；整环 `timeoutMs` 防死循环。

### 错误自动匹配解决方案引擎
- **v1.0.0（2026-08-18）**：`RepeatErrorRegistry` 二次触发（不多余不困境）、`fingerprintError` 错误指纹归一、内置 `SOLUTION_PLAYBOOK`；自动接入 `runAgentLoop` / `runCiCheck`。

### 可成长在线解决方案库 + 决策上下文注入
- **v1.0.0（2026-08-18）**：`SolutionRepository` 持久化沉淀（`solutions-repo.json`）、未命中新错误记候选、`addSolution` 入库；`buildSolutionKnowledgeContext` 把沉淀方案注入 system prompt，在线 CodeBuddy / 本地 Agent 默认携带已解决问题。

### cnb.cool · 云端 CI 冒烟
- **v1.0.0（2026-08-18）**：`.cnb.yml` 固化 `browser-smoke`——云端真实启动 Chromium 跑 `--ci-spec --solution-repo`，失败即驱动 CI 红/绿；`runDebugSession` 支持 owner 选择（developer-ai / agent / 自定义渠道）；`buildKnowledgeContext` 注入仓库知识。

### 双引擎 · Token 效率 · 安全（基础能力，历史保留）
- **v1.0.0（2026-08-18）**：CDP + Playwright 真双引擎同代码切换；快照裁剪 / 增量读取 / 结构化压缩省 Token；防令牌泄露 / 防渗透 / 防提权 / 统一 SSRF 防护（含云元数据 `169.254/16` 拦截）。

---

## 版本速览

| 版本 | 时间戳 | 一句话 |
| :--- | :--- | :--- |
| **v1.2.0** | 2026-08-29 | 可安装 DSH 插件包：一个命令安装到 dsh profile（cnb.cool/GitHub/npm） |
| **v1.1.0** | 2026-08-29 | DeepSeek Harness 接入适配增强（Harness/Trae/OpenCode 开箱即接） |
| v1.0.0 | 2026-08-18 | 首个正式版：四合一框架 + 自愈调试 + 6星能力 + 双引擎 + 安全加固 |