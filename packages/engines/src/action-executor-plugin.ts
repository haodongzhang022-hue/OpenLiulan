/**
 * 动作执行插件 - 将 UnifiedAction 转换为具体的浏览器操作
 *
 * 这个模块从 PlaywrightEngine.execute() 中提取出来，
 * 包含了所有 14 种动作的具体实现逻辑。
 */

import type { Page } from "playwright";
import type { UnifiedAction, ActionResult } from "@openliulan/core";
import {
  type ActionExecutorPlugin,
  type EnginePluginContext,
  type LocatorPlugin,
  type DiagnosticsPlugin,
  type StealthPlugin,
} from "@openliulan/core";

export class PlaywrightActionExecutor implements ActionExecutorPlugin {
  readonly name = "playwright-action-executor";
  private locatorPlugin?: LocatorPlugin;
  private diagnosticsPlugin?: DiagnosticsPlugin;
  private stealthPlugin?: StealthPlugin;
  private page?: Page;

  canHandle(action: UnifiedAction): boolean {
    // 此插件处理所有类型的 UnifiedAction
    return true;
  }

  async initialize(ctx: EnginePluginContext): Promise<void> {
    this.page = ctx.page;
    // 获取其他插件的引用（它们由 PlaywrightEngine 负责初始化）
    // 这里通过 ctx 参数传递（或通过事件系统）
  }

  /**
   * 设置定位插件引用
   */
  setLocatorPlugin(plugin: LocatorPlugin): this {
    this.locatorPlugin = plugin;
    return this;
  }

  /**
   * 设置诊断插件引用
   */
  setDiagnosticsPlugin(plugin: DiagnosticsPlugin): this {
    this.diagnosticsPlugin = plugin;
    return this;
  }

  /**
   * 设置 Stealth 插件引用
   */
  setStealthPlugin(plugin: StealthPlugin): this {
    this.stealthPlugin = plugin;
    return this;
  }

  async execute(action: UnifiedAction, ctx: EnginePluginContext): Promise<ActionResult | null> {
    if (!this.page) {
      return { ok: false, type: action.type, summary: "页面未初始化", durationMs: 0 };
    }

    const t0 = Date.now();

    try {
      switch (action.type) {
        case "navigate":
          return await this.handleNavigate(action, t0);
        case "click":
          return await this.handleClick(action, t0);
        case "fill":
          return await this.handleFill(action, t0);
        case "type":
          return await this.handleType(action, t0);
        case "select":
          return await this.handleSelect(action, t0);
        case "hover":
          return await this.handleHover(action, t0);
        case "scroll":
          return await this.handleScroll(action, t0);
        case "press":
          return await this.handlePress(action, t0);
        case "wait":
          return await this.handleWait(action, t0);
        case "screenshot":
          return await this.handleScreenshot(action, t0);
        case "evaluate":
          return await this.handleEvaluate(action, t0);
        case "assert":
          return await this.handleAssert(action, t0);
        case "extract":
          return await this.handleExtract(action, t0);
        default: {
          // 此行不应被触发（TypeScript 会检查 switch 的穷尽性）
          // 这是一个安全网络，以防 UnifiedAction 类型在不更新此处的情况下被扩展
          const _exhaustive: never = action;
          throw new Error(`未处理的动作类型: ${(_exhaustive as any).type}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        type: action.type,
        summary: `动作执行失败: ${message}`,
        durationMs: Date.now() - t0,
      };
    }
  }

  private async handleNavigate(action: any, t0: number): Promise<ActionResult> {
    if (!action.url) throw new Error("navigate 动作缺少 url 参数");
    await this.page!.goto(action.url, {
      waitUntil: action.waitUntil ?? "networkidle",
      timeout: 30_000,
    });
    return {
      ok: true,
      type: "navigate",
      summary: `已导航到 ${action.url}`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleClick(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");

    const { locator, strategy, anchorSelector } = await this.locatorPlugin.locate({
      ref: action.ref,
      selector: action.selector,
      text: action.text,
      semantic: action.semantic,
    });

    const waitForNavigation = action.waitForNavigation ?? true;
    const isLink = await locator
      .evaluate((el: Element) => el.tagName.toLowerCase() === "a" && !!(el as any).getAttribute("href"))
      .catch(() => false);

    const navPromise =
      waitForNavigation && isLink
        ? this.page!.waitForNavigation({ waitUntil: "load", timeout: 15_000 }).catch(() => null)
        : null;

    await locator.click({
      button: action.button ?? "left",
      clickCount: action.clickCount ?? 1,
      force: action.force ?? false,
      timeout: 15_000,
    });

    if (navPromise) await navPromise;

    return {
      ok: true,
      type: "click",
      summary: `已点击（策略=${strategy} 锚点=${anchorSelector ?? ""}${navPromise ? ",已等待导航稳定" : ""}）`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleFill(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");
    if (action.value === undefined || action.value === null) throw new Error("fill 动作缺少 value 参数");

    const { locator, strategy } = await this.locatorPlugin.locate({
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

  private async handleType(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");
    if (action.value === undefined || action.value === null) throw new Error("type 动作缺少 value 参数");

    const { locator, strategy } = await this.locatorPlugin.locate({
      ref: action.ref,
      selector: action.selector,
      text: action.text,
      semantic: action.semantic,
    });

    await locator.click();

    // stealth 模式下使用人类化延迟
    const delay = action.delay ?? (this.stealthPlugin?.isEnabled() ? this.getHumanTypingDelay() : undefined);
    await this.page!.keyboard.type(action.value, { delay: delay ?? 0 });

    return {
      ok: true,
      type: "type",
      summary: `已逐键输入（策略=${strategy}${this.stealthPlugin?.isEnabled() ? ",stealth延迟" : ""}）`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleSelect(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");
    if (action.value === undefined || action.value === null) throw new Error("select 动作缺少 value 参数");

    const { locator, strategy } = await this.locatorPlugin.locate({
      ref: action.ref,
      selector: action.selector,
      text: action.text,
    });

    await locator.selectOption(action.value);

    return {
      ok: true,
      type: "select",
      summary: `已选择选项（策略=${strategy}）`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleHover(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");

    const { locator, strategy } = await this.locatorPlugin.locate({
      ref: action.ref,
      selector: action.selector,
      text: action.text,
      semantic: action.semantic,
    });

    await locator.hover();

    return {
      ok: true,
      type: "hover",
      summary: `已悬停（策略=${strategy}）`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleScroll(action: any, t0: number): Promise<ActionResult> {
    const deltaY = action.deltaY ?? 0;
    await this.page!.evaluate((delta: number) => window.scrollBy(0, delta), deltaY);

    return {
      ok: true,
      type: "scroll",
      summary: `已滚动 ${deltaY}px`,
      durationMs: Date.now() - t0,
    };
  }

  private async handlePress(action: any, t0: number): Promise<ActionResult> {
    if (!action.key) throw new Error("press 动作缺少 key 参数");

    await this.page!.keyboard.press(action.key);

    return {
      ok: true,
      type: "press",
      summary: `已按下键 ${action.key}`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleWait(action: any, t0: number): Promise<ActionResult> {
    const ms = action.ms ?? 1000;
    await new Promise((r) => setTimeout(r, ms));

    return {
      ok: true,
      type: "wait",
      summary: `已等待 ${ms}ms`,
      durationMs: Date.now() - t0,
    };
  }

  private async handleScreenshot(action: any, t0: number): Promise<ActionResult> {
    const fullPage = action.fullPage ?? false;
    const buffer = await this.page!.screenshot({ fullPage });
    const base64 = buffer.toString("base64");

    return {
      ok: true,
      type: "screenshot",
      summary: `已截图（${fullPage ? "整页" : "视口"}）`,
      data: { imageBase64: base64 },
      durationMs: Date.now() - t0,
    };
  }

  private async handleEvaluate(action: any, t0: number): Promise<ActionResult> {
    if (!action.script) throw new Error("evaluate 动作缺少 script 参数");

    const result = await this.page!.evaluate((script: string) => {
      // 注意：这里 script 在浏览器上下文中执行
      return eval(script); // eslint-disable-line no-eval
    }, action.script);

    return {
      ok: true,
      type: "evaluate",
      summary: "已执行脚本",
      data: { result },
      durationMs: Date.now() - t0,
    };
  }

  private async handleAssert(action: any, t0: number): Promise<ActionResult> {
    if (!action.script) throw new Error("assert 动作缺少 script 参数");

    const isTrue = await this.page!.evaluate((script: string) => {
      // eslint-disable-line no-eval
      return eval(script);
    }, action.script);

    if (!isTrue) {
      return {
        ok: false,
        type: "assert",
        summary: `断言失败: ${action.script}`,
        durationMs: Date.now() - t0,
      };
    }

    return {
      ok: true,
      type: "assert",
      summary: "断言通过",
      durationMs: Date.now() - t0,
    };
  }

  private async handleExtract(action: any, t0: number): Promise<ActionResult> {
    if (!this.locatorPlugin) throw new Error("定位插件未初始化");

    const { locator } = await this.locatorPlugin.locate({
      ref: action.ref,
      selector: action.selector,
      text: action.text,
      semantic: action.semantic,
    });

    const data = await locator.evaluate((el: Element) => {
      const clone = el.cloneNode(true) as HTMLElement;
      const text = (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
      return { text: text.slice(0, 2000) };
    });

    return {
      ok: true,
      type: "extract",
      summary: "已提取数据",
      data,
      durationMs: Date.now() - t0,
    };
  }

  /**
   * 获取人类化的输入延迟
   */
  private getHumanTypingDelay(): number {
    // 模拟人类输入的随机延迟 [30, 90] ms
    return Math.random() * 60 + 30;
  }
}
