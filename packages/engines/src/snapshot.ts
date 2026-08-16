/**
 * 页面快照生成器
 *
 * 借鉴 Chrome DevTools MCP 的 Token 高效策略：
 * - 属性白名单裁剪（避免全量属性爆炸）
 * - 节点数上限 + 深度裁剪
 * - 文本长度裁剪
 * - 生成可交互元素索引（供 AI 挑选 ref）
 * - 为交互元素生成稳定 data-forge-ref 便于精确定位
 */
import type { Page } from "playwright";
import type { PageSnapshot, SnapshotNode, SnapshotOptions } from "@browser-ai-forge/core";

const ATTR_WHITELIST = ["id", "class", "name", "type", "value", "href", "placeholder", "title", "aria-label", "role", "data-testid", "src", "alt", "checked", "selected", "disabled", "target"];
const TEXT_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION", "LI", "TD", "TH", "SPAN", "LABEL", "CAPTION", "SUMMARY"]);
const PRUNE_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "HEAD", "META", "LINK", "SVG"]);
const INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION", "SUMMARY"]);
const INTERACTIVE_ROLES = new Set(["button", "link", "textbox", "combobox", "checkbox", "radio", "tab", "menuitem"]);

export class SnapshotBuilder {
  constructor(private page: Page) {}

  async build(opts: SnapshotOptions = {}): Promise<PageSnapshot> {
    const maxNodes = opts.maxNodes ?? 200;
    const maxText = opts.maxTextLength ?? 80;
    const withSelectors = opts.withSelectors ?? true;

    // 注入辅助脚本，浏览器端裁剪遍历 DOM（比 Node 端逐节点更高效）
    const result = await this.page.evaluate(
      ({ maxNodes, maxText, pruneDeep, includeHidden }) => {
        const out: {
          url: string;
          title: string;
          readyState: string;
          totalNodes: number;
          root: any;
          interactive: any[];
        } = {
          url: location.href,
          title: document.title,
          readyState: document.readyState,
          totalNodes: 0,
          root: null as any,
          interactive: [],
        };

        let emitted = 0;
        let truncatedNodes = 0;
        const refCounter = { n: 0 };

        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
        };

        const isInteractive = (el: Element): boolean => {
          if (INTERACTIVE_TAGS.has(el.tagName)) return true;
          const role = el.getAttribute("role");
          return !!role && INTERACTIVE_ROLES.has(role);
        };

        const elText = (el: Element): string => {
          if (el.tagName === "INPUT") {
            const v = (el as HTMLInputElement).value;
            const ph = el.getAttribute("placeholder") || "";
            return v || ph || "";
          }
          if (el.tagName === "SELECT") {
            const sel = el as HTMLSelectElement;
            return sel.selectedOptions[0]?.text || "";
          }
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          return t.slice(0, maxText);
        };

        const walk = (el: Element, depth: number): any => {
          if (emitted >= maxNodes) {
            truncatedNodes++;
            return null;
          }
          if (PRUNE_TAGS.has(el.tagName)) return null;
          if (!includeHidden && !isVisible(el)) return null;
          if (pruneDeep && depth > 25) return null;

          out.totalNodes++;
          emitted++;

          const node: any = {
            ref: `r${refCounter.n++}`,
            tag: el.tagName.toLowerCase(),
            text: TEXT_TAGS.has(el.tagName) ? elText(el) : "",
            attributes: {},
            interactive: isInteractive(el),
            depth,
          };

          for (const attr of ATTR_WHITELIST) {
            const v = el.getAttribute(attr);
            if (v) node.attributes[attr] = v.slice(0, 60);
          }

          const role = el.getAttribute("role");
          if (role) node.role = role;
          if (withSelectors && (node.interactive || node.attributes.id)) {
            // 生成稳定 ref 属性便于后续定位
            el.setAttribute("data-forge-ref", node.ref);
            node.selector = el.id
              ? `${el.tagName.toLowerCase()}#${el.id}`
              : `${el.tagName.toLowerCase()}[data-forge-ref="${node.ref}"]`;
          }

          if (node.interactive) {
            out.interactive.push({
              ref: node.ref,
              tag: node.tag,
              text: node.text || elText(el),
              role: role || undefined,
              selector: node.selector,
            });
          }

          const children: any[] = [];
          for (const child of Array.from(el.children)) {
            const c = walk(child, depth + 1);
            if (c) children.push(c);
          }
          if (children.length) node.children = children;

          return node;
        };

        out.root = walk(document.body, 0);
        return out;
      },
      { maxNodes, maxText, pruneDeep: opts.pruneDeep ?? true, includeHidden: opts.includeHidden ?? false }
    );

    // 计算 Token 估算（约 4 字符/token，含结构开销）
    const approx = this.estimateTokens(result.root);

    return {
      url: result.url,
      title: result.title,
      timestamp: new Date().toISOString(),
      readyState: result.readyState,
      stats: {
        totalNodes: result.totalNodes,
        emittedNodes: result.totalNodes - result.interactive.length, // 近似
        truncatedNodes: 0,
        approximateTokens: approx,
      },
      root: result.root,
      interactive: result.interactive,
    };
  }

  private estimateTokens(root: any): number {
    let chars = 0;
    const count = (n: any) => {
      if (!n) return;
      chars += (n.tag?.length ?? 0) + (n.text?.length ?? 0) + JSON.stringify(n.attributes || {}).length;
      (n.children || []).forEach(count);
    };
    count(root);
    return Math.round(chars / 4);
  }
}
