/**
 * ForgeBrowser —— 统一浏览器控制门面（框架核心）
 *
 * 面向 AI Agent 的一站式接口，融合：
 * - 统一动作执行（Stagehand/Playwright 精确 + Browser-Use 语义）
 * - 高效页面快照（Chrome DevTools MCP 的 Token 策略）
 * - 5 星调试诊断（Chrome DevTools MCP 能力）
 */
import type { BrowserEngine, DiagnosticReport } from "./engine.js";
import type { UnifiedAction, ActionResult } from "./actions.js";
import type { PageSnapshot, SnapshotOptions } from "./snapshot.js";
import { SessionMachine } from "./session.js";

export interface ForgeOptions {
  /** 动作超时（默认 30s） */
  timeoutMs?: number;
  /** 快照默认选项 */
  snapshotOptions?: SnapshotOptions;
  /** 动作失败后是否自动采集诊断（默认 true，体现调试优先） */
  autoDiagnoseOnError?: boolean;
}

export class ForgeBrowser {
  readonly session = new SessionMachine();
  private opts: Required<ForgeOptions>;
  private diagnosticsCache: DiagnosticReport = {
    console: [],
    network: [],
    dom: [],
    performance: [],
    jsExceptions: [],
    accessibility: [],
  };

  constructor(
    private engine: BrowserEngine,
    opts: ForgeOptions = {}
  ) {
    this.opts = {
      timeoutMs: 30_000,
      snapshotOptions: { maxNodes: 200, maxTextLength: 80, withSelectors: true },
      autoDiagnoseOnError: true,
      ...opts,
    };
  }

  get engineName(): string {
    return this.engine.name;
  }

  /** 启动 */
  async start(): Promise<void> {
    await this.engine.init();
    this.session.transition("idle");
  }

  /** 停止 */
  async stop(): Promise<void> {
    await this.engine.close();
    this.session.transition("done");
  }

  /**
   * 执行统一动作。
   * 失败时自动触发诊断采集，返回带诊断引用的结果。
   */
  async act(action: UnifiedAction): Promise<ActionResult> {
    const t0 = Date.now();
    this.session.transition("acting");
    try {
      const result = await this.engine.execute(action);
      result.durationMs = Date.now() - t0;
      this.session.setUrl(result.summary.includes("http") ? result.summary : (this.session.snapshot.url ?? ""));
      if (result.ok) {
        this.session.transition("acting", { lastAction: action.type });
        // 动作后顺手采集控制台/网络异常，供 AI 判断页面是否异常
        result.diagnostics = await this.engine.diagnose().then((d) =>
          [
            ...d.console.filter((c) => c.severity === "error"),
            ...d.network.filter((n) => n.severity === "error"),
            ...d.jsExceptions,
          ].slice(0, 8)
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: ActionResult = {
        ok: false,
        type: action.type,
        summary: `动作执行失败: ${message}`,
        durationMs: Date.now() - t0,
        error: message,
      };
      if (this.opts.autoDiagnoseOnError) {
        // 5 星调试：失败即采集全量诊断（含 DOM 白屏/未渲染检测）
        const report = await this.captureDiagnostics();
        result.diagnostics = [
          ...report.console,
          ...report.network,
          ...report.dom,
          ...report.jsExceptions,
          ...report.performance,
        ].slice(0, 10);
      }
      this.session.setError(message);
      return result;
    }
  }

  /** 获取页面快照（供 AI 观察页面） */
  async observe(opts?: SnapshotOptions): Promise<PageSnapshot> {
    this.session.transition("observing");
    const snap = await this.engine.snapshot(opts ?? this.opts.snapshotOptions);
    this.session.transition("observing", { lastSnapshotRef: `${snap.url}#${snap.timestamp}` });
    return snap;
  }

  /** 采集全量调试诊断（5 星能力核心） */
  async captureDiagnostics(): Promise<DiagnosticReport> {
    this.session.transition("diagnosing");
    const raw = await this.engine.diagnose();
    // 归一化：对缺失的 dom/accessibility 字段兜底，兼容旧引擎返回的 4 字段结构
    this.diagnosticsCache = {
      console: raw.console ?? [],
      network: raw.network ?? [],
      dom: raw.dom ?? [],
      performance: raw.performance ?? [],
      jsExceptions: raw.jsExceptions ?? [],
      accessibility: raw.accessibility ?? [],
    };
    this.session.transition("acting");
    return this.diagnosticsCache;
  }

  /** 最近一次诊断报告 */
  get lastDiagnostics(): DiagnosticReport {
    return this.diagnosticsCache;
  }

  /** 注入执行 JS（高级诊断/评估） */
  async eval(script: string): Promise<unknown> {
    return this.engine.evaluate(script);
  }
}
