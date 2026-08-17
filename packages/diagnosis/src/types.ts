/**
 * 调试诊断中心 —— 5 星能力
 *
 * 借鉴 Chrome DevTools MCP 的诊断能力，为 AI 提供全链路页面诊断：
 * 1. DOM 检查与定位
 * 2. 控制台消息/错误
 * 3. 网络请求与失败分析
 * 4. 性能指标
 * 5. JS 异常与堆栈
 */
import type { DiagnosticRef } from "@openliulan/core";

export type DiagnosticCategory = "console" | "network" | "dom" | "performance" | "js-exception" | "accessibility";

/** 采集器统一接口：底层引擎实现具体的 CDP/Playwright 采集逻辑 */
export interface DiagnosticCollector {
  readonly category: DiagnosticCategory;
  collect(): Promise<DiagnosticRef[]>;
}

/** 网络请求记录（用于分析加载失败/慢请求） */
export interface NetworkRecord {
  url: string;
  method: string;
  status: number;
  statusText?: string;
  mimeType?: string;
  durationMs: number;
  /** 请求失败/被阻断原因 */
  error?: string;
  requestId?: string;
}

/** DOM 检查结果 */
export interface DomInspection {
  /** 检查的目标描述 */
  target: string;
  /** 元素 outline（标签、id、class、关键属性） */
  outline: string;
  /** 元素可见性 / 位置 */
  box: { x: number; y: number; width: number; height: number } | null;
  /** 无障碍/ARIA 信息 */
  accessible: {
    role?: string;
    name?: string;
    disabled?: boolean;
  };
  /** 相关计算样式（裁剪为关键项） */
  computedStyle: Record<string, string>;
  /** 后代/祖先概览 */
  context: {
    ancestors: string[];
    descendantsCount: number;
  };
}

/** 性能指标 */
export interface PerformanceMetrics {
  /** navigation timing */
  ttfb: number;
  domContentLoaded: number;
  loadEvent: number;
  /** Largest Contentful Paint */
  lcp?: number;
  /** First Contentful Paint */
  fcp?: number;
  /** 资源数量与体积 */
  resources: { count: number; totalBytes: number };
  /** 长任务（阻塞主线程）次数 */
  longTasks: number;
  /** 内存（近似） */
  jsHeapUsed?: number;
}

/** 诊断报告聚合 */
export interface DiagnosisReport {
  console: DiagnosticRef[];
  network: DiagnosticRef[];
  dom: DiagnosticRef[];
  performance: DiagnosticRef[];
  jsExceptions: DiagnosticRef[];
  accessibility: DiagnosticRef[];
}

/** 诊断摘要：给 AI 的一句话结论 */
export interface DiagnosisSummary {
  /** 页面是否健康 */
  healthy: boolean;
  /** 关键问题列表（按严重度排序） */
  issues: Array<{
    category: DiagnosticCategory;
    severity: "error" | "warning";
    message: string;
  }>;
  /** 建议（供 AI 决策下一步） */
  suggestions: string[];
}
