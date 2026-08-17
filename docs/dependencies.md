# Browser AI Forge 依赖说明

> 本文档完整说明 **Browser AI Forge** 的运行环境、直接依赖、内部 Workspace 依赖、
> 安装步骤、DeepSeek Harness 集成依赖以及实测验证版本，方便用户克隆后开箱即用。

---

## 1. 运行环境

| 依赖 | 最低版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | >= 20，推荐 22 LTS | 运行 MCP 服务、TypeScript 编译与 Playwright |
| npm | 与 Node.js 配套 | 安装 workspace 依赖、执行构建与测试 |
| Chromium（Playwright 管理） | 与 Playwright 对应 | 实际启动和控制浏览器 |
| 网络访问 | 必需 | 首次下载 npm 包和 Playwright 浏览器；被测网页也可能需要网络 |

> **当前项目已经用 Node.js 22.20.0 和 Playwright Chromium 完成实际测试。**

---

## 2. 项目直接 npm 依赖

### 2.1 生产依赖

| 包 | 版本 | 所属模块 | 作用 |
| :--- | :--- | :--- | :--- |
| `playwright` | `^1.45.0`（当前锁定 1.62.1） | `@browser-ai-forge/engines` | 浏览器启动、CDP 连接、DOM 操作、导航、点击、输入、截图和断言等底层浏览器自动化能力。 |
| `zod` | `^3.23.0` | `@browser-ai-forge/core` | 浏览器统一动作、输入参数与核心数据结构的运行时校验。 |

### 2.2 开发与构建依赖

| 包 | 版本 | 用途 |
| :--- | :--- | :--- |
| `typescript` | `^5.5.0` | 编译所有 `packages/*` 下的 TypeScript 源码到 `dist/`。 |
| `vitest` | `^3.0.0` / 根目录 `^3.2.7` | 单元测试及真实浏览器验收测试。 |
| `@types/node` | `^20.0.0` | MCP CLI、文件读写、HTTP 服务等 Node.js API 的 TypeScript 类型。 |

---

## 3. 内部 Workspace 依赖关系

项目是 npm workspace，以下 `@browser-ai-forge/*` 都是**仓库内部包**，
不需要分别从 npm 发布源安装：

```text
@browser-ai-forge/mcp-server
├── @browser-ai-forge/core
├── @browser-ai-forge/engines
├── @browser-ai-forge/diagnosis
├── @browser-ai-forge/token
└── @browser-ai-forge/ai-layer

@browser-ai-forge/engines
├── @browser-ai-forge/core
├── @browser-ai-forge/diagnosis
├── @browser-ai-forge/ai-layer
└── playwright

@browser-ai-forge/core
└── zod
```

### 各模块职责

| 模块 | 职责 |
| :--- | :--- |
| `@browser-ai-forge/core` | 动作模型、状态协调、浏览器门面、页面快照抽象。 |
| `@browser-ai-forge/engines` | Playwright/CDP 浏览器驱动、DOM 定位、快照、诊断采集。 |
| `@browser-ai-forge/diagnosis` | 控制台、网络、JS 异常、性能和 DOM 的结构化诊断。 |
| `@browser-ai-forge/token` | DOM 精简、快照压缩与 Token 控制策略。 |
| `@browser-ai-forge/ai-layer` | 语义元素定位、自然语言动作规划辅助。 |
| `@browser-ai-forge/mcp-server` | 把 Forge 能力暴露为 stdio MCP、HTTP 服务、CI 冒烟测试 CLI。 |

---

## 4. 安装步骤

在项目根目录执行：

```bash
npm install
npm run build
npx playwright install chromium
```

说明：

- `npm install`：安装 npm workspace 中全部依赖。
- `npm run build`：编译各包，生成每个包的 `dist/` 目录。
- `npx playwright install chromium`：下载 Forge 实际使用的 Chromium 和 Headless Shell。

若仅需要无界面自动化，安装 Chromium 即可：

```bash
npx playwright install chromium
```

---

## 5. DeepSeek Harness 集成额外依赖

若需要将 Forge 接入 DeepSeek Harness，除本项目依赖外，Harness 侧需要：

| 依赖 | 用途 |
| :--- | :--- |
| `@deepseek-ai/dsh-mcp-client` | 负责启动 stdio MCP 子进程、发现 MCP tools，并注册到 DSH 工具列表。 |
| 已构建的 `@browser-ai-forge/mcp-server` | MCP Server 的实际启动入口。 |
| Node.js 可执行文件 | Harness 启动 forge-mcp stdio 子进程时使用。 |
| Playwright Chromium | MCP 服务实际控制浏览器时使用。 |

Harness 中的配置核心如下：

```yaml
insert:
  id: browser-ai-forge-mcp
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: forge
    transport: stdio
    command: node
    args:
      - /绝对路径/liulanzengqiang/packages/mcp-server/dist/cli.js
      - --stdio
    cwd: /绝对路径/liulanzengqiang
    failOnStartupError: true
    toolCallTimeoutMs: 60000
```

配置成功后，DSH 会提供以下 MCP 工具：

```text
mcp__forge__observe
mcp__forge__act
mcp__forge__diagnose
mcp__forge__eval
mcp__forge__screenshot
mcp__forge__session_log
mcp__forge__close
```

---

## 6. 当前实测验证的依赖版本

```text
Node.js:   v22.20.0
TypeScript: 5.5.x
Vitest:     3.2.7
Playwright: 1.62.1
Chromium:   Playwright Chromium v1234
```

已验证结果：

```text
Vitest:                        10 个测试文件通过，91 个测试通过
真实 Chromium 浏览器验收：      4/4 通过
Forge MCP CI 冒烟：            4/4 通过
DSH MCP 实测：                 observe / navigate / extract / diagnose 均成功
```

---

## 7. 常见注意事项

### 必须运行构建

MCP CLI 实际执行的是：

```text
packages/mcp-server/dist/cli.js
```

所以修改 `src/` 后，必须重新执行：

```bash
npm run build
```

### 首次必须安装浏览器

仅 `npm install` 不会自动下载 Chromium；需额外执行：

```bash
npx playwright install chromium
```

### stdio MCP 标准输出必须干净

MCP 协议通过 stdout 通信，普通启动日志应写入 stderr，不能污染 stdout。

### Node.js 路径必须可被 Harness 子进程访问

DSH 拉起 MCP 服务时需要能执行 node。若机器上的 Node 安装目录存在权限或路径解析问题，
应在 MCP 配置中使用一个明确可访问的 `node.exe` 绝对路径。

### 浏览器依赖的升级需同步验证

修改 playwright 版本后，重新执行：

```bash
npm install
npx playwright install chromium
npm test
```

以确保 Node、Playwright 运行库和 Chromium 浏览器版本匹配。
