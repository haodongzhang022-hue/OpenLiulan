/**
 * 定位插件 - 多策略元素定位
 *
 * 从 ElementLocator 中提取出来，支持：
 * - Ref 定位（数据属性引用）
 * - CSS 选择器定位
 * - 文本定位
 * - 语义定位（与 ai-layer 集成）
 *
 * 通过插件系统，用户可以添加新的定位策略（如 OCR、图色等）而无需修改核心代码。
 */

import type { Page, Locator } from "playwright";
import type {
  LocatorStrategy,
  LocatorQuery,
  LocatorResult,
  LocatorPlugin,
  EnginePluginContext,
  EnginePlugin,
} from "@openliulan/core";

/** 内置 ref 定位策略 */
export class RefLocatorStrategy implements LocatorStrategy {
  readonly name = "ref";
  readonly priority = 10; // 最高优先级

  canHandle(query: LocatorQuery): boolean {
    return !!query.ref;
  }

  async locate(query: LocatorQuery, ctx: any): Promise<Locator | null> {
    if (!query.ref || !ctx.page) return null;
    const locator = this.locateByRef(query.ref, ctx.page);
    if ((await locator.count()) > 0) {
      return locator.first();
    }
    return null;
  }

  private locateByRef(ref: string, page: Page): Locator {
    // 使用 data-forge-ref 属性定位
    return page.locator(`[data-forge-ref="${ref}"]`);
  }
}

/** 内置 CSS 选择器定位策略 */
export class SelectorLocatorStrategy implements LocatorStrategy {
  readonly name = "selector";
  readonly priority = 9;

  canHandle(query: LocatorQuery): boolean {
    return !!query.selector;
  }

  async locate(query: LocatorQuery, ctx: any): Promise<Locator | null> {
    if (!query.selector || !ctx.page) return null;
    const locator = ctx.page.locator(query.selector);
    if ((await locator.count()) > 0) {
      return locator.first();
    }
    return null;
  }
}

/** 内置文本定位策略 */
export class TextLocatorStrategy implements LocatorStrategy {
  readonly name = "text";
  readonly priority = 8;

  canHandle(query: LocatorQuery): boolean {
    return !!query.text;
  }

  async locate(query: LocatorQuery, ctx: any): Promise<Locator | null> {
    if (!query.text || !ctx.page) return null;

    // 精确文本匹配：先在交互元素中查找
    const interactiveSelector =
      "a[href], button, input:not([type='hidden']), select, textarea, [role='button'], [role='link'], [contenteditable='true'], label";
    const locator = ctx.page
      .locator(interactiveSelector)
      .filter({ hasText: new RegExp(`^${query.text}$`) });

    if ((await locator.count()) > 0) {
      return locator.first();
    }

    // 降级：模糊匹配
    const fuzzyLocator = ctx.page.locator(interactiveSelector).filter({ hasText: query.text });
    if ((await fuzzyLocator.count()) > 0) {
      return fuzzyLocator.first();
    }

    return null;
  }
}

/** 内置语义定位策略（需要通过 setSemanticResolver 设置） */
export class SemanticLocatorStrategy implements LocatorStrategy {
  readonly name = "semantic";
  readonly priority = 7;
  private resolver?: (semantic: string) => Promise<{ ref?: string; text?: string; selector?: string } | null>;

  canHandle(query: LocatorQuery): boolean {
    return !!query.semantic && !!this.resolver;
  }

  setResolver(fn: (semantic: string) => Promise<{ ref?: string; text?: string; selector?: string } | null>): this {
    this.resolver = fn;
    return this;
  }

  async locate(query: LocatorQuery, ctx: any): Promise<Locator | null> {
    if (!query.semantic || !this.resolver || !ctx.page) return null;

    const resolved = await this.resolver(query.semantic);
    if (!resolved) return null;

    // 递归尝试用解析出的参数定位
    const tryQuery: LocatorQuery = {
      ref: resolved.ref,
      text: resolved.text,
      selector: resolved.selector,
    };

    // 优先尝试 ref，再尝试 text，最后尝试 selector
    if (tryQuery.ref) {
      const refLoc = ctx.page.locator(`[data-forge-ref="${tryQuery.ref}"]`);
      if ((await refLoc.count()) > 0) {
        return refLoc.first();
      }
    }

    if (tryQuery.text) {
      const textLoc = ctx.page
        .locator(
          "a[href], button, input:not([type='hidden']), select, textarea, [role='button'], [role='link'], [contenteditable='true'], label"
        )
        .filter({ hasText: tryQuery.text });
      if ((await textLoc.count()) > 0) {
        return textLoc.first();
      }
    }

    if (tryQuery.selector) {
      const selectorLoc = ctx.page.locator(tryQuery.selector);
      if ((await selectorLoc.count()) > 0) {
        return selectorLoc.first();
      }
    }

    return null;
  }
}

/**
 * 定位插件实现
 * 将多个定位策略组合成一个插件，按优先级顺序尝试各策略
 */
export class PlaywrightLocatorPlugin implements LocatorPlugin {
  readonly name = "playwright-locator";
  private strategies: Map<string, LocatorStrategy> = new Map();
  private ctx?: EnginePluginContext;
  private sortedStrategies: LocatorStrategy[] = [];

  async initialize(ctx: EnginePluginContext): Promise<void> {
    this.ctx = ctx;

    // 注册默认策略
    const refStrategy = new RefLocatorStrategy();
    const selectorStrategy = new SelectorLocatorStrategy();
    const textStrategy = new TextLocatorStrategy();
    const semanticStrategy = new SemanticLocatorStrategy();

    // 设置语义解析器（由 PlaywrightEngine 注入）
    semanticStrategy.setResolver(async (semantic: string) => {
      // TODO: 从 ai-layer 获取 locateBySemantic
      return null;
    });

    this.registerStrategy(refStrategy);
    this.registerStrategy(selectorStrategy);
    this.registerStrategy(textStrategy);
    this.registerStrategy(semanticStrategy);

    this.sortedStrategies = Array.from(this.strategies.values()).sort((a, b) => b.priority - a.priority);
  }

  registerStrategy(strategy: LocatorStrategy): this {
    this.strategies.set(strategy.name, strategy);
    // 重新排序
    this.sortedStrategies = Array.from(this.strategies.values()).sort((a, b) => b.priority - a.priority);
    return this;
  }

  async locate(query: LocatorQuery): Promise<LocatorResult> {
    if (!this.ctx) {
      throw new Error("定位插件未初始化");
    }

    // 按优先级尝试各策略
    for (const strategy of this.sortedStrategies) {
      if (!strategy.canHandle(query)) continue;

      try {
        const locator = await strategy.locate(query, this.ctx);
        if (locator) {
          const anchorSelector = await this.toCss(locator);
          return {
            locator,
            strategy: strategy.name,
            anchorSelector,
          };
        }
      } catch (err) {
        this.ctx.log("debug", `策略 ${strategy.name} 定位失败`, err);
        // 继续尝试下一个策略
      }
    }

    // 所有策略都失败了
    const hints = [];
    if (query.ref) hints.push(`ref="${query.ref}"`);
    if (query.selector) hints.push(`selector="${query.selector}"`);
    if (query.text) hints.push(`text="${query.text}"`);
    if (query.semantic) hints.push(`semantic="${query.semantic}"`);

    throw new Error(
      `未能定位元素 (${hints.join(", ")}) - 尝试了 ${this.sortedStrategies.length} 个策略，均未成功`
    );
  }

  /**
   * 将 Locator 转换为 CSS 选择器
   */
  private async toCss(locator: Locator): Promise<string> {
    try {
      const selector = await locator.evaluate((el: Element) => {
        // 生成稳定的 CSS 选择器
        const path: string[] = [];
        let current: Element | null = el;

        while (current && current.nodeType === 1) {
          let selector = current.nodeName.toLowerCase();

          if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break;
          }

          const parentElement: Element | null = current.parentElement;
          if (parentElement) {
            const siblings: Element[] = Array.from(parentElement.children).filter((s: Element) => {
              return s.nodeName === current!.nodeName;
            });
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              selector += `:nth-of-type(${index})`;
            }
          }

          path.unshift(selector);
          current = parentElement;
        }

        return path.join(" > ");
      });

      return selector;
    } catch {
      return "[data-locator-unknown]";
    }
  }

  async cleanup?(): Promise<void> {
    // 清理资源
  }
}
