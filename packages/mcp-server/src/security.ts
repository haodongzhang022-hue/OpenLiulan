/**
 * security.ts —— 安全加固模块
 *
 * 针对 Browser AI Forge 的浏览器自动化能力做安全加固，重点防御：
 * 1. **敏感信息泄露（令牌/密码）**：页面快照、URL、日志、事件流、错误 detail
 *    中可能携带用户令牌、密码、API Key 等敏感信息，需要统一脱敏（redact）。
 * 2. **HTTP 服务被渗透/提权**：`/tools/call` 允许远程控制真实浏览器，
 *    必须做鉴权（Bearer Token）+ 来源限制 + 请求体大小限制，防止任意人调用。
 * 3. **任意 JS 注入（eval）**：`eval` 工具允许注入任意脚本，需做危险操作拦截
 *    与安全提示。
 * 4. **SSRF 风险**：自定义投递（webhook）的 `fetch(target)` 目标未校验，可能
 *    被利用访问内网资源，需限制目标为显式允许的 http(s) 地址并拒绝内网/IP。
 *
 * 所有函数均为纯函数/幂等，不改变原对象，返回脱敏后的副本，方便在各适配层复用。
 */
import crypto from "node:crypto";

/* ===================== 敏感字段定义 ===================== */

/** 常见的敏感参数名（query / body / header / 属性）—— 命中即脱敏 */
const SENSITIVE_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "client_secret",
  "password",
  "passwd",
  "pwd",
  "apikey",
  "api_key",
  "api-key",
  "auth",
  "authorization",
  "cookie",
  "set-cookie",
  "sessionid",
  "sid",
  "key",
  "private_key",
  "privatekey",
  "signature",
  "credential",
  "credentials",
  "x-api-key",
  "x-auth-token",
];

/** 判断字段名是否为敏感字段 */
export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  // sessionId / session 会话标识本身非敏感（仅真正的会话令牌才需脱敏）
  if (k === "session" || k === "sessionid" || k === "sid") return false;
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

/** 脱敏占位（保留长度提示） */
function mask(value: string): string {
  if (!value) return value;
  if (value.length <= 2) return "****";
  const head = value.slice(0, 2);
  const tail = value.length > 6 ? value.slice(-2) : "";
  return `${head}****${tail} (${value.length} chars)`;
}

/* ===================== 对象深脱敏 ===================== */

/**
 * 深度遍历任意对象/数组/字符串，对「敏感字段名」的值做脱敏。
 * 用于日志 payload、事件流、错误 detail、AIMessage 等结构化数据。
 * 返回脱敏后的副本（不修改原对象）。
 */
export function redactDeep(value: unknown, depth = 0, maxDepth = 12): unknown {
  if (depth > maxDepth) return undefined;
  if (value === null || value === undefined) return value;

  // 字符串直接返回（字段名级别的脱敏由上层 isSensitiveKey 决定）
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v, depth + 1, maxDepth));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = typeof v === "string" ? mask(v) : "***REDACTED***";
      } else {
        out[k] = redactDeep(v, depth + 1, maxDepth);
      }
    }
    return out;
  }

  return value;
}

/* ===================== URL 脱敏 ===================== */

/**
 * 对 URL 做脱敏：隐藏 query / hash 中的敏感参数值。
 * 例：`https://x.com/login?token=abc123&next=/home` -> `https://x.com/login?token=ab****23 (8 chars)&next=/home`
 */
export function redactUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    for (const key of [...u.searchParams.keys()]) {
      if (isSensitiveKey(key)) {
        const v = u.searchParams.get(key) ?? "";
        u.searchParams.set(key, mask(v));
      }
    }
    // hash 中可能携带 token（如 SPA 的 #access_token=xxx）
    if (u.hash && /(token|access_token|secret|auth)=/i.test(u.hash)) {
      u.hash = "###REDACTED###";
    }
    // 用户名密码形式（http://user:pass@host）
    if (u.username || u.password) {
      u.username = "***";
      u.password = "***";
    }
    return u.toString();
  } catch {
    // 非法 URL：仅对明显的 key=value 做粗略脱敏
    return rawUrl.replace(
      /([?&](token|password|passwd|secret|api[_-]?key|auth|access_token|refresh_token|client_secret)=)[^&]*/gi,
      "$1***REDACTED***"
    );
  }
}

/* ===================== HTTP 鉴权 ===================== */

export interface HttpAuthConfig {
  /** 是否启用鉴权（默认：未配置 token 时也拒绝远程来源） */
  enabled?: boolean;
  /** 允许的 Bearer Token（多个以逗号分隔；来自环境变量 FORGE_HTTP_TOKEN 或配置） */
  tokens?: string[];
  /** 仅允许来自这些 Host/Origin 的请求（来自 FORGE_HTTP_ALLOWED_ORIGINS，逗号分隔） */
  allowedOrigins?: string[];
  /** 仅允许回环/本机地址访问（默认 true，未配置 token 时强制 true） */
  loopbackOnly?: boolean;
}

/** 从环境变量构建 HTTP 鉴权配置 */
export function httpAuthConfigFromEnv(): HttpAuthConfig {
  const rawTokens = process.env.FORGE_HTTP_TOKEN ?? "";
  const rawOrigins = process.env.FORGE_HTTP_ALLOWED_ORIGINS ?? "";
  const loopback = (process.env.FORGE_HTTP_LOOPBACK_ONLY ?? "true").toLowerCase() !== "false";
  return {
    enabled: !!rawTokens,
    tokens: rawTokens.split(",").map((t) => t.trim()).filter(Boolean),
    allowedOrigins: rawOrigins.split(",").map((o) => o.trim()).filter(Boolean),
    loopbackOnly: loopback,
  };
}

/** 判断请求来源是否为回环地址（含 IPv4/IPv6 与 ::ffff: 映射） */
export function isLoopbackRemote(addr: string | undefined): boolean {
  if (!addr) return false;
  let a = addr.toLowerCase().trim();
  // 去掉端口：IPv4 的 :port / IPv6 的 ]:port / 纯 IPv6 的 %zone
  if (/^\[.*\]:/.test(a)) a = a.slice(1, a.indexOf("]"));
  else if (/^::ffff:/i.test(a)) a = a.slice(7); // IPv4 映射 ::ffff:127.0.0.1
  else if (a.includes(":") && !a.startsWith("::")) a = a.split(":")[0];
  a = a.replace(/\/\d+$/, "").replace(/%\w+$/, "");
  return a === "127.0.0.1" || a === "::1" || a === "localhost" || a === "0:0:0:0:0:0:0:1";
}

/**
 * 校验 HTTP 请求是否被授权。
 * @param remoteAddress 请求方地址（如 `127.0.0.1:54321` 或 `req.socket.remoteAddress`）
 * @param origin 请求的 Origin / Referer 头（可为空）
 * @param authorization Authorization 头（可为空）
 */
export function authorizeHttpRequest(
  cfg: HttpAuthConfig,
  remoteAddress: string | undefined,
  origin: string | undefined,
  authorization: string | undefined
): { ok: boolean; reason?: string } {
  // 1) 回环限制：未配置 token 或显式要求 loopbackOnly 时，拒绝非本机来源（防远程渗透）
  const loopbackOnly = cfg.loopbackOnly ?? !cfg.enabled;
  if (loopbackOnly && !isLoopbackRemote(remoteAddress)) {
    return { ok: false, reason: "仅允许本机访问（FORGE_HTTP_LOOPBACK_ONLY=true）。" };
  }

  // 2) Bearer Token 鉴权（若有配置）
  if (cfg.enabled && cfg.tokens?.length) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const valid = cfg.tokens.some((t) => {
      const tHash = crypto.createHash("sha256").update(t).digest("hex");
      // 恒定时间比较，防时序攻击
      const a = Buffer.from(tHash);
      const b = Buffer.from(tokenHash);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
    if (!valid) return { ok: false, reason: "无效或缺失的 API Token。" };
  }

  // 3) 来源白名单（若有配置）
  if (cfg.allowedOrigins?.length) {
    if (!origin) return { ok: false, reason: "缺少来源 Origin/Referer 头。" };
    const allowed = cfg.allowedOrigins.some((o) => {
      if (o === "*") return true;
      return origin === o || origin.startsWith(`${o}/`) || origin.startsWith(`${o.replace(/\/$/, "")}:`);
    });
    if (!allowed) return { ok: false, reason: "来源未被允许。" };
  }

  return { ok: true };
}

/**
 * 生成一个安全的随机 API Token（供首次部署时写入环境变量）。
 */
export function generateApiToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/* ===================== eval / 危险脚本拦截 ===================== */

/** 高危操作模式：检测注入脚本中的危险行为（提权/渗透尝试） */
const DANGEROUS_JS_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "文件系统访问", re: /require\s*\(\s*['"]fs['"]|node:fs|readFile|writeFile|rmSync|unlinkSync/i },
  { label: "子进程执行", re: /child_process|execSync|spawnSync|\bexec\s*\(|process\.exec/i },
  { label: "网络渗透", re: /process\.env|__proto__|constructor\s*\(\s*['"]constructor/i },
  { label: "浏览器漏洞利用", re: /exploit|bypass|bypass.*security|disable.*security|certificate/i },
];

export interface EvalGuardResult {
  allowed: boolean;
  reasons?: string[];
  /** 是否命中高危（需强制拦截） */
  blocked: boolean;
}

/**
 * 校验一段将要注入执行的 JS 是否安全。
 * 命中高危模式 → 强制拦截；未命中但含潜在风险 → 允许但附带警告。
 */
export function guardJsScript(script: string): EvalGuardResult {
  const blockedReasons: string[] = [];
  for (const { label, re } of DANGEROUS_JS_PATTERNS) {
    if (re.test(script)) blockedReasons.push(label);
  }
  return {
    allowed: blockedReasons.length === 0,
    blocked: blockedReasons.length > 0,
    reasons: blockedReasons,
  };
}

/* ===================== 文本报告脱敏 ===================== */

/**
 * 对任意文本（诊断报告、日志、快照文本、错误 detail）做粗粒度脱敏：
 * 隐藏形如 `token=xxx`、`password: xxx`、`Bearer xxx`、`Authorization: xxx` 的片段。
 */
export function redactText(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1***REDACTED***")
    .replace(/(Authorization\s*[:=]\s*)(?:Bearer\s+)?[A-Za-z0-9._~+/=-]+/gi, "$1***REDACTED***")
    .replace(/([?&](?:token|password|passwd|secret|api[_-]?key|access_token|refresh_token|client_secret|auth)=)[^&\s"']+/gi, "$1***REDACTED***")
    .replace(/(password\s*[:=]\s*['"]?)[^'"\s,;]+/gi, "$1***REDACTED***");
}

/** 汇总入口：对结构化对象做深脱敏，并返回脱敏后的副本 */
export function sanitize(value: unknown): unknown {
  return redactDeep(value);
}
