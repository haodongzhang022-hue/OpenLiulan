# MCP 管理中心接入

OpenLiulan 是本项目的默认浏览器 MCP：网页浏览、页面操作、自动化测试和页面排障均先使用 OpenLiulan 的 `observe`、`act`、`diagnose`、`screenshot` 与 `session_log` 工具。仅当 OpenLiulan 服务不可用或明确缺少任务所需能力时，才使用其他 Playwright 或 CDP MCP 作为兜底。

先在仓库根目录完成构建和浏览器安装：

```bash
npm install
npm run build
npx playwright install chromium
```

## DeepSeek Harness

在用户拥有的 profile `cordis.patch.yml` 中添加一个 `@deepseek-ai/dsh-mcp-client` 条目。`serverName` 决定工具前缀，因此使用 `openliulan` 后，工具名为 `mcp__openliulan__observe`、`mcp__openliulan__act` 等。

```yaml
- insert:
    - id: openliulan-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: openliulan
        transport: stdio
        command: node
        args:
          - /absolute/path/to/OpenLiulan/packages/mcp-server/dist/cli.js
          - --stdio
        cwd: /absolute/path/to/OpenLiulan
        failOnStartupError: true
        toolCallTimeoutMs: 60000
```

不要编辑 DSH 随部署附带的 preset。把配置放到用户 profile 或用户 preset，修改后等待 MCP 工具发现完成，再启动新会话验证工具列表。

## Trae

仓库已经提供项目级配置 [`../.trae/mcp.json`](../.trae/mcp.json)。以此项目作为 Trae workspace 打开后，Trae 可发现 `OpenLiulan` MCP。若 Trae 已配置其他 Playwright MCP，应禁用它们，避免浏览器任务出现重复工具并降低 OpenLiulan 的优先级。

全局配置可使用同一条目，Windows 示例：

```json
{
  "mcpServers": {
    "OpenLiulan": {
      "command": "E:/path/to/node.exe",
      "args": [
        "E:/path/to/OpenLiulan/packages/mcp-server/dist/cli.js",
        "--stdio"
      ],
      "cwd": "E:/path/to/OpenLiulan"
    }
  }
}
```

## OpenCode

仓库根目录的 [`../opencode.jsonc`](../opencode.jsonc) 是可合并到 OpenCode 用户配置的最小条目。使用全局配置时，保留现有 `mcp` 条目并加入：

```jsonc
"openliulan": {
  "type": "local",
  "command": ["node"],
  "args": ["/absolute/path/to/OpenLiulan/packages/mcp-server/dist/cli.js", "--stdio"],
  "enabled": true
}
```

OpenCode 配置中的相对路径以其配置文件所在目录解析；全局配置应改用绝对路径。项目级 `opencode.jsonc` 可使用仓库相对路径。

## MCP 工具闭环

1. 先调用 `observe` 获取页面快照和稳定的 `ref`。
2. 用 `act` 执行导航、点击、输入、断言、提取等动作，优先传递 `ref`。
3. 动作失败或页面异常时，先调用 `diagnose`，按需补充 `screenshot` 与 `session_log`。
4. 诊断后再决定重试、调整定位，或使用其他浏览器 MCP 兜底。

可用工具、HTTP/CI 用法及安全边界见 [MCP 集成](mcp-integration.md) 和 [安全说明](security.md)。
