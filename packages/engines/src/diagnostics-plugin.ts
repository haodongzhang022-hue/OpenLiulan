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
      const report = await this.diagnostics.diagnose();
      return {
        console: report.console || [],
        network: report.network || [],
        dom: report.dom || [],
        performance: report.performance || [],
        jsExceptions: report.jsExceptions || [],
        accessibility: report.accessibility || [],
      };
    } catch (err) {
      throw new Error(`诊断采集失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async collectConsole(): Promise<DiagnosticRef[]> {
    if (!this.diagnostics) {
      throw new Error("诊断采集插件未初始化");
    }

    return this.diagnostics.collectConsole();
  }

  async collectNetwork(): Promise<DiagnosticRef[]> {
    if (!this.diagnostics) {
      throw new Error("诊断采集插件未初始化");
    }

    return this.diagnostics.collectNetwork();
  }

  async cleanup?(): Promise<void> {
    if (this.diagnostics) {
      await this.diagnostics.cleanup?.();
    }
  }
}
