/**
 * PlaywrightEngine —— 底层驱动实现
 *
 * 同时提供：
 * - 统一动作执行（精确操作）
 * - 高效快照
 * - 5 星诊断采集（通过 CDP/事件）
 */
import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { BrowserEngine, DiagnosticReport, UnifiedAction, ActionResult, PageSnapshot, SnapshotOptions } from "@browser-ai-forge/core";
import { locateBySemantic } from "@browser-ai-forge/ai-layer";
import { ElementLocator } from "./locator.js";
import { SnapshotBuilder } from "./snapshot.js";
import { PlaywrightDiagnostics } from "./diagnostics.js";

export interface PlaywrightEngineOptions {
  headless?: boolean;
  /** 连接到已启动的浏览器（CDP，借鉴 DevTools MCP 直连能力） */
  connectUrl?: string;
  /** 浏览器可执行路径 */
  executablePath?: string;
  /** 视口 */
  viewport?: { width: number; height: number };
}

export class PlaywrightEngine implements BrowserEngine {
  readonly name = "playwright+cdp";
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private locator?: ElementLocator;
  private snapshotBuilder?: SnapshotBuilder;
  private diagnostics?: PlaywrightDiagnostics;
  private options: PlaywrightEngineOptions;

  constructor(options: PlaywrightEngineOptions = {}) {
    this.options = { headless: true, viewport: { width: 1280, height: 800 }, ...options };
  }

  async init(): Promise<void> {
    if (this.options.connectUrl) {
      // CDP 直连（借鉴 Chrome DevTools MCP 的能力）
      this.browser = await chromium.connectOverCDP(this.options.connectUrl);
    } else {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        executablePath: this.options.executablePath,
      });
    }
    this.context = this.browser.contexts()[0] || (await this.browser.newContext({ viewport: this.options.viewport }));
    this.page = this.context.pages()[0] || (await this.context.newPage());
    this.diagnostics = new PlaywrightDiagnostics(this.page);
    this.snapshotBuilder = new SnapshotBuilder(this.page);
    this.locator = new ElementLocator(this.page, {
      // 语义定位链路：aria/placeholder 兜底失败后，基于快照做中文分词+语义相似度匹配
      resolve: async (semantic) => {
        const snap = await this.snapshotBuilder!.build({ maxNodes: 200, maxTextLength: 80 });
        const hit = locateBySemantic(snap, semantic);
        if (hit && (hit.ref || hit.selector)) {
          return { ref: hit.ref, text: hit.text, selector: hit.selector };
        }
        return null;
      },
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }

  async execute(action: UnifiedAction): Promise<ActionResult> {
    if (!this.page) throw new Error("引擎未初始化，请先调用 init()");
    const t0 = Date.now();

    switch (action.type) {
      case "navigate": {
        await this.page.goto(action.url, { waitUntil: action.waitUntil ?? "networkidle", timeout: 30_000 });
        this.diagnostics?.network.record({
          url: action.url,
          method: "NAV",
          status: 200,
          durationMs: Date.now() - t0,
        });
        return { ok: true, type: "navigate", summary: `已导航到 ${action.url}`, durationMs: Date.now() - t0 };
      }

      case "click": {
        const { locator, strategy, anchorSelector } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic,
        });
        await locator.click({
          button: action.button,
          clickCount: action.clickCount,
          force: action.force,
          timeout: 15_000,
        });
        return {
          ok: true,
          type: "click",
          summary: `已点击（策略=${strategy} 锚点=${anchorSelector}）`,
          durationMs: Date.now() - t0,
        };
      }

      case "fill": {
        const { locator, strategy } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic,
        });
        await locator.fill(action.value);
        return {
          ok: true,
          type: "fill",
          summary: `已填入内容（策略=${strategy}）`,
          durationMs: Date.now() - t0,
        };
      }

      case "type": {
        const { locator, strategy } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
        });
        await locator.click();
        await this.page.keyboard.type(action.value, { delay: action.delay });
        return {
          ok: true,
          type: "type",
          summary: `已逐键输入（策略=${strategy}）`,
          durationMs: Date.now() - t0,
        };
      }

      case "select": {
        const { locator, strategy } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
        });
        await locator.selectOption(action.value);
        return {
          ok: true,
          type: "select",
          summary: `已选择选项（策略=${strategy}）`,
          durationMs: Date.now() - t0,
        };
      }

      case "extract": {
        const { locator } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic,
        });
        const data = await locator.evaluate((el) => {
          const clone = el.cloneNode(true) as HTMLElement;
          const text = (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
          return { text: text.slice(0, 2000) };
        });
        return { ok: true, type: "extract", summary: "提取完成", data, durationMs: Date.now() - t0 };
      }

      case "assert": {
        const { locator } = await this.locator!.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic,
        });
        const count = await locator.count();
        if (count === 0) {
          return { ok: false, type: "assert", summary: `断言失败：未找到目标元素`, durationMs: Date.now() - t0 };
        }
        const el = locator.first();
        const visible = await el.isVisible().catch(() => false);
        const text = (await el.innerText().catch(() => "")) || "";
        let pass = true;
        let detail = "";
        switch (action.mode) {
          case "visible":
            pass = visible;
            detail = `可见=${visible}`;
            break;
          case "exists":
            pass = true;
            break;
          case "hidden":
            pass = !visible;
            break;
          case "text-contains":
            pass = action.expected ? text.includes(action.expected) : false;
            detail = `文本包含'${action.expected}'=${pass} 实际='${text.slice(0, 50)}'`;
            break;
          case "enabled":
            pass = await el.isEnabled().catch(() => false);
            break;
          default:
            pass = visible;
        }
        return {
          ok: pass,
          type: "assert",
          summary: `断言${pass ? "通过" : "失败"}: ${action.mode} ${detail}`,
          durationMs: Date.now() - t0,
        };
      }

      case "screenshot": {
        const buf = action.fullPage
          ? await this.page.screenshot({ fullPage: true, clip: action.clip })
          : await this.page.screenshot({ clip: action.clip });
        const base64 = buf.toString("base64");
        return {
          ok: true,
          type: "screenshot",
          summary: `已截图 (${(base64.length * 0.75) / 1024}KB, ${base64.length} b64)`,
          data: { base64 },
          durationMs: Date.now() - t0,
        };
      }

      case "hover": {
        const { locator } = await this.locator!.locate({ ref: action.ref, selector: action.selector });
        await locator.hover();
        return { ok: true, type: "hover", summary: "已悬停", durationMs: Date.now() - t0 };
      }

      case "scroll": {
        await this.page.mouse.wheel(0, (action as any).deltaY ?? 600);
        return { ok: true, type: "scroll", summary: "已滚动", durationMs: Date.now() - t0 };
      }

      case "wait": {
        await this.page.waitForTimeout((action as any).ms ?? 1000);
        return { ok: true, type: "wait", summary: "已等待", durationMs: Date.now() - t0 };
      }

      case "evaluate": {
        const result = await this.page.evaluate((action as any).script as string);
        return { ok: true, type: "evaluate", summary: "JS 执行完成", data: result, durationMs: Date.now() - t0 };
      }

      case "press": {
        await this.page.keyboard.press((action as any).key ?? "Enter");
        return { ok: true, type: "press", summary: `已按键 ${(action as any).key}`, durationMs: Date.now() - t0 };
      }

      default: {
        const a = action as any;
        return { ok: false, type: a.type, summary: `不支持的 action: ${a.type}`, durationMs: Date.now() - t0 };
      }
    }
  }

  async snapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    return this.snapshotBuilder!.build(options);
  }

  async diagnose(): Promise<DiagnosticReport> {
    const collectors = this.diagnostics!.collectors();
    const collected = await Promise.all(
      collectors.map(async (c) => ({ category: c.category, refs: await c.collect() }))
    );
    const byCat = (cat: string) =>
      collected.find((c) => c.category === cat)?.refs ?? [];
    return {
      console: byCat("console"),
      network: byCat("network"),
      dom: byCat("dom"),
      performance: byCat("performance"),
      jsExceptions: byCat("js-exception"),
      accessibility: byCat("accessibility"),
    };
  }

  async collectConsole() {
    return this.diagnostics!.console.collect();
  }

  async collectNetwork() {
    return this.diagnostics!.network.collect();
  }

  async evaluate(script: string): Promise<unknown> {
    return this.page!.evaluate(script);
  }
}
