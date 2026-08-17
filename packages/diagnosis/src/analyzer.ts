/**
 * 诊断分析器：把原始诊断数据加工成供 AI 决策的结论。
 * 借鉴 Chrome DevTools MCP「先给结论、再给细节」的思路，节省 Token。
 */
import type { DiagnosticRef } from "@openliulan/core";
import type { DiagnosisReport, DiagnosisSummary, NetworkRecord, PerformanceMetrics } from "./types.js";

/**
 * 网络失败分析：将网络记录转化为诊断引用
 */
export function analyzeNetwork(records: NetworkRecord[]): { refs: DiagnosticRef[]; suggestions: string[] } {
  const refs: DiagnosticRef[] = [];
  const suggestions: string[] = [];
  const failed = records.filter((r) => r.status >= 400 || r.error);
  const slow = records.filter((r) => r.durationMs > 3000);

  for (const r of failed) {
    refs.push({
      kind: "network",
      severity: r.status >= 500 ? "error" : "warning",
      message: `请求失败 ${r.method} ${r.url} (${r.status}${r.statusText ? " " + r.statusText : ""})${r.error ? " — " + r.error : ""}`,
      detail: { durationMs: r.durationMs, requestId: r.requestId },
      timestamp: Date.now(),
    });
  }
  for (const r of slow) {
    refs.push({
      kind: "network",
      severity: "warning",
      message: `慢请求 ${r.durationMs}ms ${r.method} ${r.url}`,
      detail: { status: r.status },
      timestamp: Date.now(),
    });
  }

  if (failed.length) suggestions.push(`网络存在 ${failed.length} 个失败请求，可能是资源 404/500 或 CORS/跨域阻断`);
  if (slow.length) suggestions.push(`存在 ${slow.length} 个慢请求(>3s)，考虑检查后端接口或资源加载`);
  return { refs, suggestions };
}

/**
 * 性能分析：将指标转化为诊断引用
 */
export function analyzePerformance(metrics: PerformanceMetrics): { refs: DiagnosticRef[]; suggestions: string[] } {
  const refs: DiagnosticRef[] = [];
  const suggestions: string[] = [];

  if (metrics.ttfb > 1000) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `TTFB 偏高: ${metrics.ttfb}ms（首字节响应慢，可能服务端慢或网络差）`,
      timestamp: Date.now(),
    });
    suggestions.push("TTFB > 1s，优先排查服务端响应与 CDN");
  }
  if (metrics.lcp && metrics.lcp > 2500) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `LCP 偏高: ${metrics.lcp}ms（最大内容绘制慢，影响首屏）`,
      timestamp: Date.now(),
    });
    suggestions.push("LCP > 2.5s，关注首屏图片/大资源加载");
  }
  if (metrics.longTasks > 3) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `主线程长任务 ${metrics.longTasks} 次（JS 可能阻塞渲染）`,
      timestamp: Date.now(),
    });
    suggestions.push("存在长任务阻塞主线程，检查同步脚本/密集计算");
  }
  if (metrics.resources.totalBytes > 5 * 1024 * 1024) {
    refs.push({
      kind: "performance",
      severity: "info",
      message: `页面资源总量较大: ${(metrics.resources.totalBytes / 1024 / 1024).toFixed(1)}MB`,
      timestamp: Date.now(),
    });
  }
  return { refs, suggestions };
}

/**
 * 汇总诊断报告，生成健康度与建议
 */
export function summarize(report: DiagnosisReport): DiagnosisSummary {
  const issues: DiagnosisSummary["issues"] = [];
  const suggestions: string[] = [];

  // 控制台错误
  const consoleErrors = report.console.filter((c) => c.severity === "error");
  for (const e of consoleErrors) {
    issues.push({ category: "console", severity: "error", message: e.message });
  }
  if (consoleErrors.length) suggestions.push(`控制台有 ${consoleErrors.length} 条错误，可能是 JS 异常或资源加载失败`);

  // JS 异常
  for (const e of report.jsExceptions) {
    issues.push({ category: "js-exception", severity: "error", message: e.message });
  }
  if (report.jsExceptions.length) suggestions.push("页面抛出了 JS 未捕获异常，检查对应堆栈");

  // 网络
  const netFailed = report.network.filter((n) => n.severity === "error");
  for (const n of netFailed) issues.push({ category: "network", severity: "error", message: n.message });
  const netWarn = report.network.filter((n) => n.severity === "warning");
  for (const n of netWarn) issues.push({ category: "network", severity: "warning", message: n.message });

  // DOM 检查（白屏/未渲染/无交互等，从 console/network 看不到的渲染级问题）
  for (const d of report.dom) {
    issues.push({ category: "dom", severity: d.severity === "error" ? "error" : "warning", message: d.message });
  }
  const domBlank = report.dom.filter((d) => d.severity === "error");
  if (domBlank.length) suggestions.push("页面疑似空白/未渲染，检查挂载节点与初始化脚本（可能 JS 报错阻断整树渲染）");

  // 性能
  for (const p of report.performance) {
    if (p.severity === "warning") issues.push({ category: "performance", severity: "warning", message: p.message });
  }

  // 去重建议
  const unique = [...new Set(suggestions)];
  return {
    healthy: issues.filter((i) => i.severity === "error").length === 0,
    issues: issues.slice(0, 15),
    suggestions: unique.slice(0, 8),
  };
}
