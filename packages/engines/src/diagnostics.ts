/**
 * Playwright 引擎的诊断采集器
 *
 * 通过 Playwright 的 CDP 能力 + 页面事件，采集：
 * - console 消息/错误
 * - 网络请求（含失败分析）
 * - 性能指标（navigation timing / LCP / 长任务）
 * - JS 未捕获异常
 */
import type { Page } from "playwright";
import type { DiagnosticRef } from "@openliulan/core";
import type { DiagnosticCollector, NetworkRecord, PerformanceMetrics } from "@openliulan/diagnosis";
import { analyzeNetwork, analyzePerformance } from "@openliulan/diagnosis";

export class ConsoleCollector implements DiagnosticCollector {
  readonly category = "console" as const;
  constructor(private page: Page, private buffer: DiagnosticRef[] = []) {}

  async collect(): Promise<DiagnosticRef[]> {
    const refs = [...this.buffer];
    this.buffer = [];
    return refs;
  }

  /** 由引擎在页面监听时调用 */
  push(text: string, level: string): void {
    const severity = level === "error" ? "error" : level === "warning" ? "warning" : "info";
    this.buffer.push({
      kind: "console",
      severity,
      message: text.slice(0, 500),
      timestamp: Date.now(),
    });
  }
}

export class JsExceptionCollector implements DiagnosticCollector {
  readonly category = "js-exception" as const;
  constructor(private page: Page, private buffer: DiagnosticRef[] = []) {}

  async collect(): Promise<DiagnosticRef[]> {
    const refs = [...this.buffer];
    this.buffer = [];
    return refs;
  }

  push(error: Error): void {
    this.buffer.push({
      kind: "js-exception",
      severity: "error",
      message: error.message.slice(0, 500),
      detail: { stack: error.stack?.slice(0, 1200) },
      timestamp: Date.now(),
    });
  }
}

export class NetworkCollector implements DiagnosticCollector {
  readonly category = "network" as const;
  constructor(private page: Page, private records: NetworkRecord[] = []) {}

  async collect(): Promise<DiagnosticRef[]> {
    const { refs } = analyzeNetwork(this.records);
    this.records = [];
    return refs;
  }

  /** 由引擎在请求完成时调用 */
  record(record: NetworkRecord): void {
    this.records.push(record);
  }
}

export class PerformanceCollector implements DiagnosticCollector {
  readonly category = "performance" as const;
  constructor(private page: Page) {}

  async collect(): Promise<DiagnosticRef[]> {
    try {
      const metrics = await this.page.evaluate((): PerformanceMetrics => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const paint = performance.getEntriesByType("paint") as PerformanceEntry[];
        const lcpEntry = performance
          .getEntriesByType("largest-contentful-paint")
          .pop() as PerformanceEntry | undefined;
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

        // 长任务：>50ms 视为阻塞
        const longTasks = (performance as any).getEntriesByType
          ? performance.getEntriesByType("longtask").length
          : 0;

        return {
          ttfb: nav ? nav.responseStart - nav.requestStart : 0,
          domContentLoaded: nav ? nav.domContentLoadedEventStart - nav.startTime : 0,
          loadEvent: nav ? nav.loadEventEnd - nav.startTime : 0,
          fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime,
          lcp: lcpEntry?.startTime,
          resources: {
            count: resources.length,
            totalBytes: resources.reduce((s, r) => s + (r.transferSize || 0), 0),
          },
          longTasks,
        };
      });
      const { refs } = analyzePerformance(metrics);
      return refs;
    } catch {
      return [];
    }
  }
}

/**
 * DOM 诊断采集器：检测页面渲染状态，补齐「白屏/未渲染/无交互」这类
 * 从 console/network 里看不到的 DOM 级问题（对应解决方案库的 blank-page 场景）。
 */
export class DomCollector implements DiagnosticCollector {
  readonly category = "dom" as const;
  constructor(private page: Page) {}

  async collect(): Promise<DiagnosticRef[]> {
    const refs: DiagnosticRef[] = [];
    try {
      const state = await this.page.evaluate(() => {
        const body = document.body;
        const hasBody = !!body && body.childElementCount > 0;
        // 可见且可交互元素数量（排除隐藏/无布局元素）
        const visible = Array.from(document.querySelectorAll("a,button,input,select,textarea,[role]"))
          .filter((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            const s = getComputedStyle(el);
            return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
          }).length;
        const root = document.getElementById("root") || document.getElementById("app");
        return {
          hasBody,
          visibleInteractive: visible,
          hasMount: root ? root.childElementCount > 0 : null,
          bodyTextLen: (document.body?.innerText || "").trim().length,
        };
      });

      // 白屏 / 未渲染：body 无子元素 或 挂载节点空 且 无可交互元素
      const blank = state.hasBody === false || (state.visibleInteractive === 0 && state.bodyTextLen === 0);
      if (blank) {
        refs.push({
          kind: "dom",
          severity: "error",
          message: `页面疑似空白/未渲染：body 子元素=${state.hasBody}，可见交互元素=${state.visibleInteractive}，正文=${state.bodyTextLen} 字符`,
          detail: { hasMount: state.hasMount },
          timestamp: Date.now(),
        });
      } else if (state.visibleInteractive === 0) {
        // 页面有内容但无可见可交互元素（可能交互被遮挡/需要登录等）
        refs.push({
          kind: "dom",
          severity: "warning",
          message: `页面无可见可交互元素（正文 ${state.bodyTextLen} 字符），可能需登录或元素被遮挡`,
          timestamp: Date.now(),
        });
      }
    } catch {
      // DOM 采集失败忽略（不阻断整体诊断）
    }
    return refs;
  }
}

/** 聚合所有采集器 */
export class PlaywrightDiagnostics {
  console: ConsoleCollector;
  jsExceptions: JsExceptionCollector;
  network: NetworkCollector;
  performance: PerformanceCollector;
  dom: DomCollector;

  constructor(private page: Page) {
    this.console = new ConsoleCollector(this.page);
    this.jsExceptions = new JsExceptionCollector(this.page);
    this.network = new NetworkCollector(this.page);
    this.performance = new PerformanceCollector(this.page);
    this.dom = new DomCollector(this.page);
    this.wire();
  }

  private wire(): void {
    this.page.on("console", (msg) => this.console.push(msg.text(), msg.type()));
    this.page.on("pageerror", (err) => this.jsExceptions.push(err));
    this.page.on("requestfailed", (req) => {
      this.network.record({
        url: req.url(),
        method: req.method(),
        status: 0,
        error: req.failure()?.errorText || "failed",
        durationMs: 0,
      });
    });
    this.page.on("response", (res) => {
      const req = res.request();
      this.network.record({
        url: req.url(),
        method: req.method(),
        status: res.status(),
        statusText: res.statusText(),
        mimeType: res.headers()["content-type"],
        durationMs: 0,
      });
    });
  }

  collectors(): DiagnosticCollector[] {
    return [this.console, this.jsExceptions, this.network, this.performance, this.dom];
  }
}
