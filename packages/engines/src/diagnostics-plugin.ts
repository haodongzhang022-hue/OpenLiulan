/**
 * 诊断采集插件 - 5星诊断信息采集
 *
 * 包装 PlaywrightDiagnostics 的功能，实现诊断采集的可插拔设计。
 * 支持：
 * - 控制台消息采集
 * - 网络请求/失败采集
 * - JS 异常采集
 * - 性能指标采集
 * - ARIA/无障碍诊断
 */

import type { Page } from "playwright";
import type { DiagnosticRef } from "@openliulan/core";
import type { DiagnosticsPlugin, EnginePluginContext } from "@openliulan/core";
import { PlaywrightDiagnostics } from "./diagnostics.js";

/**
 * Playwright 诊断采集插件
 *
 * 包装 PlaywrightDiagnostics 的功能
 */
export class PlaywrightDiagnosticsPlugin implements DiagnosticsPlugin {
  readonly name = "playwright-diagnostics";
  private diagnostics?: PlaywrightDiagnostics;
  private page?: Page;

  async initialize(ctx: EnginePluginContext): Promise<void> {
    this.page = ctx.page;
    this.diagnostics = new PlaywrightDiagnostics(this.page);
    ctx.log("debug", "诊断采集插件已初始化");
  }

  async diagnose(): Promise<{
    console: DiagnosticRef[];
    network: DiagnosticRef[];
    dom: DiagnosticRef[];
    performance: DiagnosticRef[];
    jsExceptions: DiagnosticRef[];
    accessibility: DiagnosticRef[];
  }> {
    if (!this.diagnostics) {
      throw new Error("诊断采集插件未初始化");
    }

    try {
      // 收集所有采集器的数据
      const collectors = this.diagnostics.collectors();
      const consoleDiags: DiagnosticRef[] = [];
      const networkDiags: DiagnosticRef[] = [];
      const domDiags: DiagnosticRef[] = [];
      const performanceDiags: DiagnosticRef[] = [];
      const jsExceptionDiags: DiagnosticRef[] = [];

      for (const collector of collectors) {
        const refs = await collector.collect();
        // 根据采集器名称分类
        for (const ref of refs) {
          switch (ref.kind) {
            case "console":
              consoleDiags.push(ref);
              break;
            case "network":
              networkDiags.push(ref);
              break;
            case "dom":
              domDiags.push(ref);
              break;
            case "performance":
              performanceDiags.push(ref);
              break;
            case "js-exception":
              jsExceptionDiags.push(ref);
              break;
          }
        }
      }

      return {
        console: consoleDiags,
        network: networkDiags,
        dom: domDiags,
        performance: performanceDiags,
        jsExceptions: jsExceptionDiags,
        accessibility: [],
      };
    } catch (err) {
      throw new Error(`诊断采集失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async collectConsole(): Promise<DiagnosticRef[]> {
    if (!this.diagnostics) {
      throw new Error("诊断采集插件未初始化");
    }

    return this.diagnostics.console.collect();
  }

  async collectNetwork(): Promise<DiagnosticRef[]> {
    if (!this.diagnostics) {
      throw new Error("诊断采集插件未初始化");
    }

    return this.diagnostics.network.collect();
  }

  async cleanup?(): Promise<void> {
    // 清理资源（如果需要）
    this.diagnostics = undefined;
  }
}
