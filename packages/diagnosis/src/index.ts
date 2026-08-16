/**
 * DiagnosisCenter —— 诊断中心门面
 * 聚合各类采集器，产出统一诊断报告与 AI 可读摘要。
 */
import type { DiagnosticRef } from "@browser-ai-forge/core";
import type { DiagnosisReport, DiagnosisSummary, DiagnosticCollector } from "./types.js";
import { summarize } from "./analyzer.js";

export class DiagnosisCenter {
  private collectors: DiagnosticCollector[] = [];

  /** 注册采集器（底层引擎提供） */
  register(collector: DiagnosticCollector): this {
    this.collectors.push(collector);
    return this;
  }

  /** 运行一次完整诊断 */
  async run(): Promise<DiagnosisReport> {
    const report: DiagnosisReport = {
      console: [],
      network: [],
      dom: [],
      performance: [],
      jsExceptions: [],
      accessibility: [],
    };

    const tasks = this.collectors.map(async (c) => {
      const refs = await c.collect();
      return { category: c.category, refs };
    });

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "fulfilled") {
        (report as any)[r.value.category] = r.value.refs;
      }
      // 单个采集器失败不影响整体诊断
    }
    return report;
  }

  /** 获取 AI 可读摘要 */
  async summarize(): Promise<DiagnosisSummary> {
    const report = await this.run();
    return summarize(report);
  }

  /** 便捷：采集网络失败 */
  static flattenErrors(report: DiagnosisReport): DiagnosticRef[] {
    return [
      ...report.console.filter((c) => c.severity === "error"),
      ...report.network.filter((n) => n.severity === "error"),
      ...report.jsExceptions,
      ...report.performance.filter((p) => p.severity === "error"),
    ];
  }
}

export * from "./types.js";
export { analyzeNetwork, analyzePerformance, summarize } from "./analyzer.js";
