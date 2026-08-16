/**
 * 错误自动匹配解决方案引擎（Solution Matcher）
 *
 * 这是「cnb.cool 在线优势」的核心升级：当调试/CI 过程中出现问题时，
 * 把「问题情况」检索匹配到内置解决方案知识库（playbook），推荐一个方案：
 *
 * - **简单问题（level: "auto"）** → 直接标准化自动化，返回可直接落地的修复动作，
 *   反馈即结果，不劳烦人工。
 * - **复杂问题（level: "guide"）** → 识别问题类型后，推荐对应的模块 skill /
 *   开源项目 / 解决思路，把「没往这里想」的困境点破。
 *
 * 关键设计 —— **重复错误二次触发（repeat-trigger）**：
 * 为避免每次都打扰，同一类错误（用**错误指纹**归一化识别）**出现 2 次**才触发
 * 匹配机制 ——「不多余，也不困境」：
 * - 第 1 次：仅静默记录（计数），不主动弹出方案，避免噪音；
 * - 第 2 次：触发解决方案推荐（auto 直接执行 / guide 推荐思路）。
 *
 * 内置 playbook 覆盖常见的浏览器/前端调试问题（网络、控制台、JS 异常、DOM 定位、
 * 性能、跨域等），并与项目自身知识库（buildKnowledgeContext）互补。
 */

/** 问题严重级别 */
export type SolutionLevel = "auto" | "guide";

/** 一条内置解决方案 */
export interface SolutionEntry {
  /** 解决方案标识（用于去重 / 引用） */
  id: string;
  /** 匹配到的错误指纹 */
  fingerprint: string;
  /** 问题一句话描述 */
  title: string;
  /** 问题的正则匹配模式（对原始错误/诊断文本匹配） */
  pattern: RegExp;
  /** 方案级别：auto=标准化自动化直接执行；guide=推荐思路/skill/开源项目 */
  level: SolutionLevel;
  /** 解决方案正文（auto 时为可执行步骤，guide 时为思路/项目） */
  solution: string;
  /** 当 level=guide 时推荐的具体落地方式 */
  skill?: string;
  /** 当 level=guide 时推荐的模块 / 开源项目 */
  openSource?: string;
  /** 触发阈值：同指纹出现几次后推荐（默认 2） */
  triggerAfter?: number;
  /** 关键词：用于 fingerprint 判定之外的辅助匹配 */
  keywords?: string[];
}

/** 匹配结果 */
export interface SolutionMatch {
  /** 是否触发推荐 */
  triggered: boolean;
  /** 错误指纹 */
  fingerprint: string;
  /** 已出现次数 */
  occurrences: number;
  /** 命中的方案（triggered=true 时存在） */
  entry?: SolutionEntry;
  /** 命中的方案文本（供注入调试上下文 / 反馈） */
  advice?: string;
  /** 是否已尝试自动修复（auto 级别） */
  autoApplied?: boolean;
}

/* =====================================================================
 * 内置解决方案知识库（playbook）
 * =================================================================== */

/**
 * 内置 playbook：把常见前端/浏览器调试问题映射到解决方案。
 * 这是「不靠裸工具」的知识沉淀 —— 很多问题其实有成熟解，只是开发时没往这里想。
 */
export const SOLUTION_PLAYBOOK: SolutionEntry[] = [
  {
    id: "net-404-500",
    fingerprint: "network:http-error",
    title: "资源/接口请求失败（404/500）",
    pattern: /(?:网络存在 \d+ 个失败请求|请求失败|status (?:404|500)|404|500)/i,
    level: "auto",
    solution:
      "标准化校验：① 逐个核对失败 URL 的路径与后端是否就绪；② 若是前端静态资源，检查打包路径 base 是否正确（Vite base / webpack publicPath）；③ 若是接口，检查服务端是否已启动、路由是否注册。",
    triggerAfter: 2,
    keywords: ["404", "500", "失败请求", "请求失败"],
  },
  {
    id: "net-cors",
    fingerprint: "network:cors",
    title: "跨域（CORS）被阻断",
    pattern: /(?:cors|跨域|access-control|no 'access-control-allow-origin')/i,
    level: "guide",
    solution:
      "CORS 是常见坑：前端直连不同源后端会被浏览器拦截。推荐方案：使用本地代理/反向代理（vite dev server proxy / nginx）把跨域变同源；后端加 CORS 头（Access-Control-Allow-Origin）。",
    skill: "cnb-pipeline",
    openSource: "vite-proxy / nginx / http-proxy-middleware",
    triggerAfter: 2,
    keywords: ["cors", "跨域", "access-control"],
  },
  {
    id: "console-js-exception",
    fingerprint: "console:js-exception",
    title: "控制台 JS 未捕获异常",
    pattern: /(?:页面抛出了 JS 未捕获异常|未捕获的|uncaught|TypeError|ReferenceError)/i,
    level: "auto",
    solution:
      "标准化排障：① 展开异常堆栈定位 throw / 未定义变量 / 异步未 catch；② 用 eval 在页面注入检查关键变量/对象是否存在；③ 优先修复最上层未捕获异常（通常由它引发连带报错）。",
    triggerAfter: 2,
    keywords: ["js 异常", "未捕获", "uncaught", "typeerror"],
  },
  {
    id: "dom-locator-failed",
    fingerprint: "dom:locator-failed",
    title: "元素定位/点击失败",
    pattern: /(?:未找到元素|定位失败|not found|no element|element not found|找不到)/i,
    level: "auto",
    solution:
      "标准化重试：① 改用更稳定的定位策略（ref→selector→semantic 逐级降级）；② 元素可能在异步渲染后出现，先 wait 再操作；③ 若弹窗/iframe 遮挡，先切换 frame 或关闭弹层。",
    triggerAfter: 2,
    keywords: ["未找到元素", "定位失败", "element not found"],
  },
  {
    id: "perf-ttfb-slow",
    fingerprint: "performance:ttfb",
    title: "接口响应慢（TTFB 偏高）",
    pattern: /(?:TTFB 偏高|TTFB.*ms|慢请求)/i,
    level: "guide",
    solution:
      "性能瓶颈常见解：① 优先排查服务端处理（数据库查询、同步逻辑）与网络链路；② 加缓存（CDN / 服务端缓存 / HTTP 缓存）；③ 合并请求、压缩体积。可用 Performance 面板/诊断报告的 TTFB 拆分定位是网络还是服务端慢。",
    skill: "cnb-pipeline",
    openSource: "redis-cache / nginx-cache / vite-bundle-analyzer",
    triggerAfter: 2,
    keywords: ["ttfb", "慢请求", "性能"],
  },
  {
    id: "dom-ssr-hydration",
    fingerprint: "dom:hydration-mismatch",
    title: "SSR 水合不一致（hydration mismatch）",
    pattern: /(?:hydration|水合|server-rendered content|did not match)/i,
    level: "guide",
    solution:
      "SSR 水合不一致是常见坑（服务端渲染 DOM 与客户端首次渲染不一致）。推荐思路：① 避免在渲染期间依赖浏览器独有 API（window/document）；② 用 suppressHydrationWarning 或客户端才渲染的组件隔离差异；③ 排查 date/random/locale 等非确定性输出。",
    skill: "cnb-docs",
    openSource: "react-dom hydration / next.js / nuxt",
    triggerAfter: 2,
    keywords: ["hydration", "水合", "did not match"],
  },
  {
    id: "login-auth-redirect",
    fingerprint: "auth:redirect",
    title: "登录/鉴权跳转导致目标页不可达",
    pattern: /(?:登录|redirect|重定向|401|403|需要登录|未授权)/i,
    level: "guide",
    solution:
      "登录态/鉴权拦截是高频原因：目标页常被重定向到登录页。推荐思路：① 用项目知识库（buildKnowledgeContext）注入测试账号/内网域名约定；② 先走登录流程再导航目标页；③ 检查是否因 Cookie/token 缺失被 401/403 拦截。",
    skill: "cnb-repo-knowledge-base",
    openSource: "playwright storageState / auth fixture",
    triggerAfter: 2,
    keywords: ["登录", "鉴权", "401", "403", "重定向"],
  },
  {
    id: "blank-white-page",
    fingerprint: "dom:blank-page",
    title: "页面空白/未渲染",
    pattern: /(?:空白|白屏|blank|nothing|空页面|未渲染)/i,
    level: "auto",
    solution:
      "标准化排查白屏：① 看控制台是否 JS 报错导致整树未渲染（常见于未 catch 的初始化异常）；② 检查资源是否被拦截（CSP/加载失败）；③ 确认挂载节点是否存在、框架是否正常 bootstrap。",
    triggerAfter: 2,
    keywords: ["白屏", "空白", "blank"],
  },
];

/* =====================================================================
 * 错误指纹（fingerprint）归一化
 * =================================================================== */

/**
 * 从错误文本 / 诊断摘要归一化为稳定的错误指纹。
 * 指纹用于「同类错误识别」和「二次触发去重」。
 */
export function fingerprintError(text: string): string {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  // 网络错误（先判 CORS/跨域，再判 HTTP 错误；注意把 TTFB/慢请求提前，避免 "1500ms" 里的 500 误判为 HTTP 错误）
  if (/cors|access-control|跨域/.test(t)) return "network:cors";
  // 性能：TTFB / 慢请求（优先于 HTTP 错误判定，因为数值里可能含 500/404 数字）
  if (/ttfb|慢请求/.test(t)) return "performance:ttfb";
  // 网络 HTTP 错误（仅当明确出现失败语义或状态码，避免误判数值）
  if (/失败请求|请求失败|request failed|status\s*[:\s]*(?:404|500)/.test(t)) return "network:http-error";
  if (/\b(?:404|500)\b/.test(t) && !/\d{4,}/.test(t)) return "network:http-error";
  // JS 异常
  if (/uncaught|未捕获|typeerror|referenceerror|js 异常/.test(t)) return "console:js-exception";
  // DOM 定位
  if (/未找到元素|定位失败|element not found|no element|not found/.test(t)) return "dom:locator-failed";
  // 鉴权
  if (/401|403|登录|鉴权|未授权|redirect|重定向/.test(t)) return "auth:redirect";
  // 水合
  if (/hydration|水合|did not match/.test(t)) return "dom:hydration-mismatch";
  // 白屏
  if (/白屏|空白|blank|未渲染/.test(t)) return "dom:blank-page";
  // 通用失败（兜底，降低误报：这类不强触发）
  return "generic:action-failed";
}

/* =====================================================================
 * 重复错误注册表（二次触发）
 * =================================================================== */

/**
 * 重复错误注册表：记录每个错误指纹的出现次数。
 * 只有当某指纹出现次数达到 `triggerAfter`（默认 2）时才触发解决方案推荐，
 * 实现「不多余，也不困境」——第 1 次静默，第 2 次才给出有价值的方案。
 */
export class RepeatErrorRegistry {
  private counts = new Map<string, number>();
  /** 自定义触发阈值（默认 2） */
  private threshold: number;

  constructor(threshold = 2) {
    this.threshold = threshold;
  }

  /** 记录一次错误，返回是否达到触发阈值 */
  record(text: string): { fingerprint: string; occurrences: number; triggered: boolean } {
    const fp = fingerprintError(text);
    const occurrences = (this.counts.get(fp) ?? 0) + 1;
    this.counts.set(fp, occurrences);
    return { fingerprint: fp, occurrences, triggered: occurrences >= this.threshold };
  }

  /** 查询某指纹当前次数（不改变计数） */
  peek(text: string): { fingerprint: string; occurrences: number } {
    const fp = fingerprintError(text);
    return { fingerprint: fp, occurrences: this.counts.get(fp) ?? 0 };
  }

  /** 重置（新一轮调试开始时可调用） */
  reset(): void {
    this.counts.clear();
  }
}

/* =====================================================================
 * 解决方案匹配
 * =================================================================== */

/**
 * 在 playbook 中查找与错误文本匹配的方案条目。
 * 优先精确匹配 fingerprint，其次用 pattern/keywords 兜底。
 */
export function lookupSolution(text: string, fingerprint?: string): SolutionEntry | undefined {
  const fp = fingerprint ?? fingerprintError(text);
  const t = text.toLowerCase();

  // 1. fingerprint 精确命中
  const byFp = SOLUTION_PLAYBOOK.find((s) => s.fingerprint === fp);
  if (byFp) return byFp;

  // 2. 正则 pattern 命中
  const byPattern = SOLUTION_PLAYBOOK.find((s) => s.pattern.test(text));
  if (byPattern) return byPattern;

  // 3. 关键词兜底
  const byKeyword = SOLUTION_PLAYBOOK.find(
    (s) => s.keywords && s.keywords.some((k) => t.includes(k.toLowerCase()))
  );
  return byKeyword;
}

/**
 * 核心匹配入口：
 * 给定一次错误文本，结合重复注册表做「二次触发」判定，
 * 命中则返回解决方案（含 auto/guide 分级与可执行建议）。
 */
export function matchSolution(registry: RepeatErrorRegistry, errorText: string): SolutionMatch {
  const { fingerprint, occurrences, triggered } = registry.record(errorText);
  if (!triggered) {
    return { triggered: false, fingerprint, occurrences };
  }
  const entry = lookupSolution(errorText, fingerprint);
  if (!entry) {
    return { triggered: true, fingerprint, occurrences };
  }
  return {
    triggered: true,
    fingerprint,
    occurrences,
    entry,
    advice: renderAdvice(entry),
  };
}

/** 渲染解决方案文本 */
export function renderAdvice(entry: SolutionEntry): string {
  const head = `[已第 2 次遇到同类问题｜方案推荐] ${entry.title}（级别: ${entry.level === "auto" ? "自动修复" : "思路引导"}）`;
  const lines = [head, `> ${entry.solution}`];
  if (entry.level === "guide") {
    if (entry.skill) lines.push(`> 推荐 skill：${entry.skill}`);
    if (entry.openSource) lines.push(`> 推荐方案/开源项目：${entry.openSource}`);
    lines.push("> 思路：先定位根因，再按上述项目/技能落地，可显著减少重复造轮子。");
  }
  return lines.join("\n");
}

/** 默认注册表实例（供无状态调用复用，可按会话 reset） */
export const defaultRegistry = new RepeatErrorRegistry();

/**
 * 便捷函数：把解决方案注入到一条调试上下文里。
 * 若已触发（第 2 次同类错误），返回附带方案的上下文；否则返回原文本。
 */
export function augmentWithSolution(registry: RepeatErrorRegistry, contextText: string): string {
  const match = matchSolution(registry, contextText);
  if (match.triggered && match.advice) {
    return `${contextText}\n\n---\n${match.advice}`;
  }
  return contextText;
}
