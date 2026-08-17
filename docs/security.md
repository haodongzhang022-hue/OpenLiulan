# 安全加固（Security Hardening）

Browser AI Forge 提供「真实浏览器控制」能力，是**高权限**的自动化工具——能导航任意页面、
执行 JS（`eval`）、读取页面快照与截图。因此必须做好安全加固，防止**令牌泄露**、
**被渗透**、**被提权**。

本文件说明框架内建的安全机制，以及部署/使用时必须注意的配置。

---

## 1. 敏感信息脱敏（防令牌/密码泄露）

框架在**输出链路**上统一做脱敏（`packages/mcp-server/src/security.ts`），防止页面中的
令牌、密码、API Key 通过快照/日志/事件流/报告/HTTP 响应外泄：

| 泄露点 | 加固措施 |
| :--- | :--- |
| 页面快照 | `password` / `token` / `secret` / `api-key` 等敏感输入框的 `value` **不进入快照**，仅显示占位符（`engines/src/snapshot.ts`） |
| `eval` 结果 | 返回对象中命中敏感字段名（`token`/`password`/`api_key`/`authorization`…）的值被掩码 |
| URL | `redactUrl` 隐藏 query/hash 中的 `token`、`access_token`、`secret`、`auth` 等参数值及 `user:pass@` |
| 文本/日志 | `redactText` 隐藏 `Bearer xxx`、`Authorization: xxx`、`?token=xxx`、`password: xxx` 片段 |
| 事件流 | `session_log` 的 json 事件、`exportMarkdown` 的 payload 均经 `redactDeep` 深脱敏 |
| HTTP 响应 | `/tools/call` 返回的 `structured` 数据经 `redactDeep` 脱敏后再下发 |
| 调试/CI 报告 | `runDebugSession` / `runCiCheck` 生成的 markdown 对 URL、message、suggestion 做脱敏 |

> 说明：`sessionId`/`session` 会话标识本身**非敏感**，不会被脱敏（避免误伤可追踪性）。

**敏感字段清单**（`isSensitiveKey`）覆盖：`token`、`access_token`、`refresh_token`、
`secret`、`client_secret`、`password`、`passwd`、`pwd`、`api_key`、`auth`、
`authorization`、`cookie`、`set-cookie`、`sessionid`、`sid`、`key`、`private_key`、
`signature`、`credential`、`x-api-key`、`x-auth-token` 等。

---

## 2. HTTP 服务鉴权（防远程渗透/提权）

`forge-mcp --http` 会把浏览器控制能力暴露为 REST API，**默认仅允许本机回环访问**，
未授权的外部请求一律 `401`。需远程访问时必须显式配置。

### 配置环境变量

| 环境变量 | 说明 | 默认 |
| :--- | :--- | :--- |
| `FORGE_HTTP_TOKEN` | 逗号分隔的 Bearer Token。配置后启用鉴权，请求需带 `Authorization: Bearer <token>` | 空（不启用） |
| `FORGE_HTTP_ALLOWED_ORIGINS` | 逗号分隔的允许来源 Origin/Referer（`*` 表示任意） | 空 |
| `FORGE_HTTP_LOOPBACK_ONLY` | 是否仅允许本机回环访问 | `true` |

**安全规则**：
- 未配置 `FORGE_HTTP_TOKEN` 时，`loopbackOnly` 强制为 `true`，**拒绝一切非本机来源**；
- Token 校验使用 **SHA-256 + `crypto.timingSafeEqual` 恒定时间比较**，防时序攻击；
- 请求体大小上限 **1MB**（`413 Payload Too Large`），防超大 payload 拖垮服务；
- CORS：未配置 token/白名单时 `Access-Control-Allow-Origin` 为空（不开放跨域），
  配置后才按白名单开放。

### 生成 Token

```bash
node packages/mcp-server/dist/cli.js --gen-token
# 输出一个 64 位十六进制随机 Token，写入 FORGE_HTTP_TOKEN
```

---

## 3. `eval` 危险脚本拦截（防提权）

`eval` 工具允许注入 JS。框架通过 `guardJsScript` 拦截高危模式，命中即**拒绝执行**：

- `require('fs')` / `node:fs` / `readFile` / `writeFile` / `rmSync` —— 文件系统访问
- `child_process` / `execSync` / `spawnSync` / `process.exec` —— 子进程执行
- `process.env` / `__proto__` / `constructor('constructor')` —— 环境/原型链渗透
- `exploit` / `bypass security` / `certificate` —— 浏览器漏洞利用

拦截时会写入标准错误事件（`EVAL_BLOCKED`），并把原始脚本截断后记入日志（不落全文）。

---

## 4. Webhook SSRF 防护

`runDebugSession` 的自定义投递（`owner.channel = "webhook"`）在 `fetch(target)` 前校验目标，
统一走 `isPrivateOrLoopbackHost()`（`packages/mcp-server/src/security.ts`）：

- 仅允许 `http:` / `https:` 协议；
- 拒绝以下**内网/回环/链路本地/云元数据**目标，防内网探测与凭证窃取：
  - IPv4 回环 `127/8`；
  - 私有网段 `10/8`、`172.16/12`、`192.168/16`；
  - CGNAT `100.64/10`；
  - **链路本地/云元数据 `169.254/16`**（如 AWS `169.254.169.254`，可窃取 IAM 凭证）；
  - 组播/保留 `224/4`、`240/4`、`198.18/15`、`192.0.0/24`、`0.0.0.0`；
  - **IPv6 回环 `::1`（含带方括号 `[::1]` 写法）**、IPv4-mapped `::ffff:x.x.x.x`、
    ULA `fc00::/7`、链路本地 `fe80::/10` 及全零地址；
  - `localhost`、`*.local`（mDNS）域名。

> 覆盖真实渗透绕过点：`169.254.169.254` 云元数据、`[::1]` 带方括号 IPv6 回环
> （`new URL().hostname` 会保留方括号导致旧正则失配）、`::ffff:127.0.0.1` 映射回环等，
> 均会被统一拦截（详见 `security.test.ts` 的 SSRF 用例）。

---

## 5. 其他加固

- **`.gitignore`** 已排除 `.env`（令牌类环境变量文件）、运行期调试制品
  （`forge-debug-report.md`、截图、`forge-artifacts/`），避免敏感产物入库。
- **依赖安全**：`npm audit` 清零高危漏洞（见提交历史 `chore: 安全升级`）。
- **日志记录**：`safeArgs` 对 `value`/`script` 只记录长度，`url` 做脱敏，不落明文。

---

## 部署安全 Checklist

- [ ] HTTP 服务仅在**内网/受信网络**暴露；需公网访问时务必设置 `FORGE_HTTP_TOKEN`
      与 `FORGE_HTTP_ALLOWED_ORIGINS`；
- [ ] Token 通过环境变量/密钥管理注入，**不要写进代码仓库**；
- [ ] 涉及登录/敏感页面时，确认快照不会暴露口令（框架已对 `password` 等输入框脱敏）；
- [ ] CI 制品（截图/诊断报告）发布前确认不含敏感页面内容；
- [ ] 定期 `npm audit` 检查依赖漏洞。
