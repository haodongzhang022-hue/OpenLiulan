/**
 * 元素定位器：多策略定位
 *
 * 借鉴：
 * - Stagehand：CSS 选择器、XPath、AI Locator、文本定位
 * - Browser-Use：语义/文本定位
 * - DevTools MCP：通过 ref 精确寻址
 *
 * 定位优先级：ref（快照引用） > selector > text > semantic > intent
 */
import type { Page } from "playwright";

export interface LocateOptions {
  /** 快照引用 */
  ref?: string;
  /** CSS 选择器 */
  selector?: string;
  /** 精确文本 */
  text?: string;
  /** 语义描述（自然语言，最终回退到 AI 解析） */
  semantic?: string;
  /** 超时 */
  timeoutMs?: number;
}

/** 定位结果：返回可操作的 locator 与其描述 */
export interface Located {
  locator: import("playwright").Locator;
  /** 定位方式说明（供日志/诊断） */
  strategy: "ref" | "selector" | "text" | "semantic";
  /** 用于精确锚定的唯一 CSS 选择器（供后续诊断/重试） */
  anchorSelector: string;
}

/**
 * 语义解析器回调：把自然语言语义描述解析为可定位参数。
 * 由引擎在初始化时注入（通常基于 ai-layer 的语义定位器，结合快照做
 * 中文分词/语义相似度匹配），从而打通「AI 语义层 → 引擎精确定位」的链路。
 * 返回 null 表示未命中。
 */
export interface SemanticResolver {
  resolve(semantic: string): Promise<{ ref?: string; text?: string; selector?: string } | null>;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "label",
].join(", ");

export class ElementLocator {
  constructor(private page: Page, private semanticResolver?: SemanticResolver) {}

  /**
   * 根据动作参数定位元素，多策略依次回退。
   * 找不到时抛出带诊断提示的错误。
   */
  async locate(opts: LocateOptions): Promise<Located> {
    const { ref, selector, text, semantic } = opts;

    // 1) ref 定位（最高效、最精确，来自快照交互索引）
    if (ref) {
      const byRef = this.locateByRef(ref);
      if ((await byRef.count())) {
        return { locator: byRef.first(), strategy: "ref", anchorSelector: await this.toCss(byRef.first()) };
      }
    }

    // 2) CSS 选择器
    if (selector) {
      const loc = this.page.locator(selector);
      if ((await loc.count())) {
        return { locator: loc.first(), strategy: "selector", anchorSelector: selector };
      }
    }

    // 3) 精确文本（可交互元素内）
    if (text) {
      const byText = this.locateByText(text);
      if ((await byText.count())) {
        return {
          locator: byText.first(),
          strategy: "text",
          anchorSelector: await this.toCss(byText.first()),
        };
      }
    }

    // 4) 语义回退：尝试 role/name 组合，再用 ai-layer 语义定位器（中文分词/语义相似度）
    if (semantic) {
      const bySemantic = this.locateBySemantic(semantic);
      if ((await bySemantic.count())) {
        return {
          locator: bySemantic.first(),
          strategy: "semantic",
          anchorSelector: await this.toCss(bySemantic.first()),
        };
      }
      // aria/placeholder/title 未命中 → 交给语义定位器（基于快照做语义相似度匹配）
      if (this.semanticResolver) {
        const resolved = await this.semanticResolver.resolve(semantic);
        if (resolved?.ref || resolved?.selector || resolved?.text) {
          const byResolved = resolved.selector
            ? this.page.locator(resolved.selector)
            : resolved.text
              ? this.locateByText(resolved.text)
              : this.locateByRef(resolved.ref!);
          if ((await byResolved.count())) {
            return {
              locator: byResolved.first(),
              strategy: "semantic",
              anchorSelector: resolved.selector || (await this.toCss(byResolved.first())),
            };
          }
        }
      }
    }

    throw new Error(
      `无法定位元素：ref=${ref ?? "-"} selector=${selector ?? "-"} text=${text ?? "-"} semantic=${semantic ?? "-"}. ` +
        `建议调用 observe() 获取最新快照后重试，或使用 diagnose() 检查 DOM 状态。`
    );
  }

  /** 通过快照 ref 定位：ref 内嵌了选择器信息（data-forge-ref） */
  private locateByRef(ref: string): import("playwright").Locator {
    // 优先精确匹配 data-forge-ref 属性，若未命中则用模糊匹配
    return this.page.locator(`[data-forge-ref="${ref}"], [data-forge-ref*="${ref}"]`);
  }

  /** 文本定位：在可交互元素内查找包含指定文本者 */
  private locateByText(text: string): import("playwright").Locator {
    return this.page.locator(INTERACTIVE_SELECTOR).filter({ hasText: text });
  }

  /** 语义定位：尝试 aria-label / placeholder / title */
  private locateBySemantic(semantic: string): import("playwright").Locator {
    return this.page
      .locator(`${INTERACTIVE_SELECTOR}[aria-label*="${semantic}"], ${INTERACTIVE_SELECTOR}[placeholder*="${semantic}"], ${INTERACTIVE_SELECTOR}[title*="${semantic}"]`)
      .first();
  }

  /** 将 locator 转成唯一 CSS 选择器（用于诊断锚定） */
  private async toCss(loc: import("playwright").Locator): Promise<string> {
    try {
      return (await loc.evaluate((el: Element) => {
        const parts: string[] = [];
        let cur: Element | null = el;
        while (cur && cur.nodeType === 1 && parts.length < 5) {
          let seg = cur.tagName.toLowerCase();
          if (cur.id) {
            seg += `#${cur.id}`;
            parts.unshift(seg);
            break;
          }
          if (cur.classList.length) {
            seg += "." + Array.from(cur.classList).slice(0, 2).join(".");
          }
          parts.unshift(seg);
          cur = cur.parentElement;
        }
        return parts.join(" > ");
      })) as string;
    } catch {
      return "";
    }
  }
}
