/**
 * 引擎插件系统
 *
 * 将 PlaywrightEngine 的职责分离为可插拔的插件，支持：
 * - 动作执行（ActionExecutorPlugin）
 * - 元素定位（LocatorPlugin）
 * - 页面快照（SnapshotPlugin）
 * - 诊断采集（DiagnosticsPlugin）
 *
 * 这样做的好处：
 * 1. 单一职责：每个插件只处理一个功能
 * 2. 可测试性：无需启动真实浏览器即可单元测试
 * 3. 可扩展性：新增驱动时可复用插件，或替换某个插件的实现
 * 4. 易于维护：修改某个功能时不影响其他代码
 */

import type { Page, Browser, BrowserContext, Locator } from "playwright";
import type { UnifiedAction, ActionResult } from "./actions.js";
import type { PageSnapshot, SnapshotOptions } from "./snapshot.js";
import type { DiagnosticRef } from "./actions.js";

/**
 * 插件运行上下文：提供对浏览器实例和工具函数的访问
 */
export interface EnginePluginContext {
  /** Playwright Page 实例 */
  page: Page;
  /** Playwright Browser 实例 */
  browser: Browser;
  /** Playwright BrowserContext 实例 */
  context: BrowserContext;
  /** 日志记录函数 */
  log(level: "debug" | "info" | "warn" | "error", message: string, data?: unknown): void;
}

/**
 * 基础插件接口
 * 所有引擎插件必须实现此接口
 */
export interface EnginePlugin {
  /** 插件名称 */
  readonly name: string;
  /** 插件初始化（在 PlaywrightEngine.init() 后调用） */
  initialize?(ctx: EnginePluginContext): Promise<void>;
  /** 插件清理（在 PlaywrightEngine.close() 前调用） */
  cleanup?(): Promise<void>;
}

/**
 * 动作执行插件接口
 * 负责将 UnifiedAction 转换为具体的浏览器操作
 */
export interface ActionExecutorPlugin extends EnginePlugin {
  /**
   * 检查此插件是否能处理该动作
   * @returns true 表示此插件可处理，false 表示需要其他插件处理
   */
  canHandle(action: UnifiedAction): boolean;

  /**
   * 执行动作
   * @returns 动作结果，若返回 null 表示此插件无法处理该动作
   */
  execute(action: UnifiedAction, ctx: EnginePluginContext): Promise<ActionResult | null>;
}

/**
 * 元素定位插件接口
 * 负责根据各种策略（ref/selector/text/semantic）定位页面元素
 */
export interface LocatorStrategy {
  /** 策略名称 */
  readonly name: string;
  /** 优先级（0-10，越高越优先） */
  readonly priority: number;

  /**
   * 检查此策略是否能处理该定位查询
   */
  canHandle(query: LocatorQuery): boolean;

  /**
   * 执行定位
   * @returns Playwright Locator 实例，若返回 null 则此策略无法定位
   */
  locate(query: LocatorQuery, ctx: EnginePluginContext): Promise<Locator | null>;
}

/** 定位查询 */
export interface LocatorQuery {
  /** 数据属性引用（最精确） */
  ref?: string;
  /** CSS 选择器 */
  selector?: string;
  /** 精确文本匹配 */
  text?: string;
  /** 语义描述（通过 AI 理解） */
  semantic?: string;
}

/**
 * 定位结果
 */
export interface LocatorResult {
  locator: Locator;
  strategy: string;
  anchorSelector?: string;
}

/**
 * 定位插件：组合多个定位策略，按优先级尝试
 */
export interface LocatorPlugin extends EnginePlugin {
  /**
   * 注册定位策略
   */
  registerStrategy(strategy: LocatorStrategy): this;

  /**
   * 执行定位：按优先级尝试各策略
   */
  locate(query: LocatorQuery): Promise<LocatorResult>;
}

/**
 * 快照生成插件接口
 * 负责捕获当前页面状态并生成 PageSnapshot
 */
export interface SnapshotPlugin extends EnginePlugin {
  /**
   * 生成页面快照
   */
  snapshot(options?: SnapshotOptions): Promise<PageSnapshot>;
}

/**
 * 诊断采集插件接口
 * 负责采集和分析页面的各种诊断信息
 */
export interface DiagnosticsPlugin extends EnginePlugin {
  /**
   * 采集诊断数据
   */
  diagnose(): Promise<{
    console: DiagnosticRef[];
    network: DiagnosticRef[];
    dom: DiagnosticRef[];
    performance: DiagnosticRef[];
    jsExceptions: DiagnosticRef[];
    accessibility: DiagnosticRef[];
  }>;

  /**
   * 采集控制台消息
   */
  collectConsole(): Promise<DiagnosticRef[]>;

  /**
   * 采集网络请求/失败
   */
  collectNetwork(): Promise<DiagnosticRef[]>;
}

/**
 * Stealth（防检测）插件接口
 * 负责反指纹、反爬虫检测等功能
 */
export interface StealthPlugin extends EnginePlugin {
  /**
   * 是否已启用
   */
  isEnabled(): boolean;

  /**
   * 获取浏览器启动参数
   */
  getLaunchArgs(): string[];

  /**
   * 获取初始化脚本（在页面加载前注入）
   */
  getInitScript(): string | null;

  /**
   * 获取页面初始化选项（如自定义 User-Agent）
   */
  getContextOptions(): Record<string, unknown>;
}

/**
 * 引擎插件管理器
 * 协调各个插件的初始化、执行和清理
 */
export class EnginePluginManager {
  private plugins: Map<string, EnginePlugin> = new Map();
  private ctx?: EnginePluginContext;

  /**
   * 注册插件
   */
  register(plugin: EnginePlugin): this {
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * 获取已注册的插件
   */
  get(name: string): EnginePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取特定类型的插件
   */
  getPlugins<T extends EnginePlugin>(type: new (...args: any[]) => T): T[] {
    const results: T[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin instanceof (type as any)) {
        results.push(plugin as T);
      }
    }
    return results;
  }

  /**
   * 初始化所有插件
   */
  async initialize(ctx: EnginePluginContext): Promise<void> {
    this.ctx = ctx;
    for (const plugin of this.plugins.values()) {
      if (plugin.initialize) {
        try {
          await plugin.initialize(ctx);
          ctx.log("debug", `插件已初始化: ${plugin.name}`);
        } catch (err) {
          ctx.log("error", `插件初始化失败: ${plugin.name}`, err);
          throw err;
        }
      }
    }
  }

  /**
   * 清理所有插件
   */
  async cleanup(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
          this.ctx?.log("debug", `插件已清理: ${plugin.name}`);
        } catch (err) {
          this.ctx?.log("warn", `插件清理失败: ${plugin.name}`, err);
        }
      }
    }
  }

  /**
   * 获取运行上下文
   */
  getContext(): EnginePluginContext {
    if (!this.ctx) {
      throw new Error("插件管理器未初始化");
    }
    return this.ctx;
  }
}
