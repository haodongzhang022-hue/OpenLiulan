# OpenLiulan 每周同步机制

> 版本：v1 · 2026-08-23
> 后续如需变更，请先更新本节版本号与日期，并保留旧版本说明。

## 目的

本仓库 `E:\1shuju\1gitgengxin\liulanzengqiang` 是 OpenLiulan 插件的**唯一权威源码位置**（cloud 源在 cnb.cool）。
TRAE 各会话与 dsh-home 均通过**绝对路径 / package.json 引用**它，并不各自持有副本。
因此只需保证本目录与云端一致，所有消费端即自动获得最新能力。

本机制定义：**每周一次的「云端 → 本地」只读单向同步**，不主动上推本地改动。

## 权威源与消费端关系（不需要各自同步）

| 路径 | 类型 | 是否需手动同步 |
|---|---|---|
| `liulanzengqiang\` | 源码源（git，cnb.cool 云端） | ✅ 唯一同步对象 |
| `liulanzengqiang\node_modules\@openliulan\*` | Junction 链接（9 包→packages/*） | ❌ npm install 自动生成 |
| `dsh-home\profiles\web\package.json` | 以 `file:` 引用 `packages/mcp-server` | ❌ 引用同一源 |
| 全局 `opencode.jsonc` 的 `openliulan` MCP | 绝对路径 → `packages/mcp-server/dist/cli.js` | ❌ 引用同一源 |
| `.trae-cn\mcps\s_*\*\mcp_OpenLiulan\tools\*.json` | TRAE 会话工具快照 | ❌ 会话重启自动重新发现 |

> 判断：**不存在独立软件副本**。各位置只是链接 / 空占位 / 会话缓存，均指向同一 `dist/cli.js`。

## 同步步骤（每周执行一次）

在 `E:\1shuju\1gitgengxin\liulanzengqiang` 目录执行：

```powershell
# 1. 检查本地未提交改动 —— 若有，先人工处理，勿覆盖
git status --short

# 2. 拉取云端最新（不改变本地工作区）
git fetch origin

# 3. 检查当前 HEAD 相对云端分叉（left=独有右=落后）
git rev-list --left-right --count HEAD...origin/auto/browser-ai-forge-a3d8

# 4. 若右 > 0（落后云端），fast-forward 对齐
git merge --ff-only origin/auto/browser-ai-forge-a3d8

# 5. 云端新增了 workspace 包 / 依赖，需重建链接
npm install

# 6. 重新构建 dist（TRAE/dsh 引用的是 dist/cli.js，必须刷新）
npm run build

# 7. 验证 MCP 入口存在
Test-Path packages/mcp-server/dist/cli.js
```

## 安全注意事项

- **只读单向**：只从云端拉取，不把本地改动 push 回云端。本地适配如有需要上云，走独立流程审核。
- **不覆盖本地未提交改动**：第 1 步若发现 `git status` 有未提交改动，停止并先由人工决定（可 `git stash` 备份）。
- **构建后立即冒烟**：`npm run build` 成功后，用 stdio 握手确认 MCP 可启动（见 `docs/mcp-management.md`）。
- 若 `git merge --ff-only` 因本地存在独有提交而失败，说明本地与云端分叉，须人工决策，勿强推。

## 待办/已知限制

- 云端推送需具备推送权限的凭据；当前 token 仅受邀可读（403），上云适配文件由用户手动提交。
- 2026-08-23：本地新增 harness 适配提交 `7078d6f` 尚未推送云端，待有权限后处理。
