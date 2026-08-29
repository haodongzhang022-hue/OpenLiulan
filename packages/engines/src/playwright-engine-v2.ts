/**
 * PlaywrightEngine V2 —— 使用插件系统的重构版本
 *
 * 相比原来的 PlaywrightEngine，这个版本：
 * - 将职责分离为可插拔的插件
 * - 实现了真正的 EnginePluginManager
 * - 支持加载自定义插件
 * - 核心代码更精简、易于维护
 *
 * 迁移说明：
 * PlaywrightEngine 最终会被 PlaywrightEngineV2 替代。
 * 目前两个类共存，用于渐进式迁移。
 */

import { chromium, type Browser, type Page, type BrowserContext, type BrowserContextOptions } from "playwright";
import type {
  BrowserEngine,
  DiagnosticReport,
  UnifiedAction,
  ActionResult,
  PageSnapshot,
  SnapshotOptions,
  DiagnosticRef,
  EnginePluginContext,
  EnginePluginManager as PluginManager,
} from "@openliulan/core";
import { EnginePluginManager } from "@openliulan/core";
import { StealthManager, type StealthOptions } from "@openliulan/stealth";
import { PlaywrightActionExecutor } from "./action-executor-plugin.js";
import { PlaywrightLocatorPlugin } from "./locator-plugin.js";
import { PlaywrightSnapshotPlugin } from "./snapshot-plugin.js";
import { PlaywrightDiagnosticsPlugin } from "./diagnostics-plugin.js";

export interface PlaywrightEngineV2Options {
  headless?: boolean;
  connectUrl?: string;
  executablePath?: string;
  viewport?: { width: number; height: number };
  stealth?: StealthOptions | StealthManager;
  /** 是否启用插件系统（默认 true） */
  enablePlugins?: boolean;
}

/**
 * PlaywrightEngine V2 - 插件化版本
 *
 * 实现 BrowserEngine 接口，内部使用 EnginePluginManager 来协调各个插件。
 */
export class PlaywrightEngineV2 implements BrowserEngine {
  readonly name = "playwright+cdp";

  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private options: PlaywrightEngineV2Options;
  private stealth?: StealthManager;
  private pluginManager: PluginManager;
  private ctx?: EnginePluginContext;

  // 缓存对各个插件的引用（便于快速访问）
  private actionExecutor?: PlaywrightActionExecutor;
  private locatorPlugin?: PlaywrightLocatorPlugin;
  private snapshotPlugin?: PlaywrightSnapshotPlugin;
  private diagnosticsPlugin?: PlaywrightDiagnosticsPlugin;

  constructor(options: PlaywrightEngineV2Options = {}) {
    this.options = {
      headless: true,
      viewport: { width: 1280, height: 800 },
      enablePlugins: true,
      ...options,
    };

    // 初始化插件管理器
    this.pluginManager = new EnginePluginManager();

    // 处理 stealth 配置
    if (this.options.stealth instanceof StealthManager) {
      this.stealth = this.options.stealth;
    } else if (this.options.stealth) {
      this.stealth = new StealthManager(this.options.stealth);
    }
  }

  /** 获取插件管理器（用于添加自定义插件） */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  async init(): Promise<void> {
    // 启动浏览器
    const launchArgs = this.stealth?.buildLaunchArgs() ?? [];
    if (this.options.connectUrl) {
      this.browser = await chromium.connectOverCDP(this.options.connectUrl);
    } else {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        executablePath: this.options.executablePath,
        args: launchArgs.length ? launchArgs : undefined,
      });
    }

    // 创建上下文
    const ctxOptions: Partial<BrowserContextOptions> = { viewport: this.options.viewport };
    if (this.stealth?.isEnabled && this.stealth.options.userAgent) {
      ctxOptions.userAgent = this.stealth.options.userAgent;
    }
    this.context = this.browser.contexts()[0] || (await this.browser.newContext(ctxOptions as BrowserContextOptions));
    
    // 在创建上下文后注入 initScript（BrowserContextOptions 不支持 initScript）
    if (this.stealth?.isEnabled) {
      const initScript = this.stealth.buildInitScript();
      if (initScript) {
        await this.context.addInitScript(initScript);
      }
    }
    
    this.page = this.context.pages()[0] || (await this.context.newPage());

    // 创建插件上下文
    this.ctx = {
      page: this.page,
      browser: this.browser,
      context: this.context,
      log: (level, message, data) => {
        // 简单的日志实现，可根据需要扩展
        if (level === "error") {
          console.error(`[${this.name}] ${message}`, data);
        } else if (level === "warn") {
          console.warn(`[${this.name}] ${message}`, data);
        } else {
          console.log(`[${this.name}] ${message}`, data);
        }
      },
    };

    // 注册和初始化插件
    if (this.options.enablePlugins) {
      await this.initializePlugins();
    }
  }

  private async initializePlugins(): Promise<void> {
    if (!this.ctx) throw new Error("插件上下文未创建");

    // 第一阶段：创建并注册所有插件
    this.actionExecutor = new PlaywrightActionExecutor();
    this.locatorPlugin = new PlaywrightLocatorPlugin();
    this.snapshotPlugin = new PlaywrightSnapshotPlugin();
    this.diagnosticsPlugin = new PlaywrightDiagnosticsPlugin();

    this.pluginManager.register(this.actionExecutor);
    this.pluginManager.register(this.locatorPlugin);
    this.pluginManager.register(this.snapshotPlugin);
    this.pluginManager.register(this.diagnosticsPlugin);

    // 第二阶段：在 initialize() 之前配置插件间依赖
    // 这样可以确保如果 initialize() 中需要访问依赖插件，它们已经被注入
    this.actionExecutor.setLocatorPlugin(this.locatorPlugin);
    this.actionExecutor.setDiagnosticsPlugin(this.diagnosticsPlugin);
    if (this.stealth?.isEnabled) {
      // TODO: 设置 stealth 插件
    }

    // 第三阶段：初始化所有插件
    await this.pluginManager.initialize(this.ctx);
  }

  async close(): Promise<void> {
    // 清理插件
    if (this.options.enablePlugins) {
      await this.pluginManager.cleanup();
    }

    // 关闭浏览器
    await this.browser?.close();
  }

  async execute(action: UnifiedAction): Promise<ActionResult> {
    if (!this.actionExecutor || !this.ctx) {
      throw new Error("动作执行插件未初始化");
    }

    try {
      const result = await this.actionExecutor.execute(action, this.ctx);
      if (result) return result;

      // 如果返回 null，表示插件无法处理
      throw new Error(`插件无法处理动作类型: ${action.type}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        type: action.type,
        summary: `执行失败: ${message}`,
        durationMs: 0,
      };
    }
  }

  async snapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    if (!this.snapshotPlugin) {
      throw new Error("快照插件未初始化");
    }

    return this.snapshotPlugin.snapshot(options);
  }

  async diagnose(): Promise<DiagnosticReport> {
    if (!this.diagnosticsPlugin) {
      throw new Error("诊断插件未初始化");
    }

    return this.diagnosticsPlugin.diagnose();
  }

  async collectConsole(): Promise<DiagnosticRef[]> {
    if (!this.diagnosticsPlugin) {
      throw new Error("诊断插件未初始化");
    }

    return this.diagnosticsPlugin.collectConsole();
  }

  async collectNetwork(): Promise<DiagnosticRef[]> {
    if (!this.diagnosticsPlugin) {
      throw new Error("诊断插件未初始化");
    }

    return this.diagnosticsPlugin.collectNetwork();
  }

  async evaluate(script: string): Promise<unknown> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return this.page.evaluate((code: string) => {
      // eslint-disable-line no-eval
      return eval(code);
    }, script);
  }

  /** Stealth 状态（用于兼容性） */
  get stealthEnabled(): boolean {
    return this.stealth?.isEnabled ?? false;
  }
}

// 导出 V2 作为默认版本（向后兼容通过导出别名）
export { PlaywrightEngineV2 as PlaywrightEngineRefactored };
