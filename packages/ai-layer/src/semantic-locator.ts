/**
 * 语义定位器：把自然语言描述转成结构化的定位参数。
 * 借鉴 Stagehand 的 AI Locator 与 Browser-Use 的语义定位。
 */
import type { PageSnapshot } from "@browser-ai-forge/core";

export interface SemanticLocateResult {
  /** 命中的快照引用 */
  ref?: string;
  /** 命中的文本 */
  text?: string;
  /** CSS 选择器（若可用） */
  selector?: string;
  /** 命中分数 */
  score: number;
  /** 说明 */
  note: string;
}

const IGNORE_WORDS = new Set(["请", "点击", "输入", "选择", "找到", "那个", "这个", "的", "按钮", "链接", "the", "click", "button", "link", "please"]);

/** 从快照的可交互元素中，按语义相似度查找最佳目标 */
export function locateBySemantic(snapshot: PageSnapshot, semantic: string): SemanticLocateResult {
  const q = normalize(semantic);
  // 中文无空格分词：把 CJK 连续串拆成单个汉字参与匹配；英文/数字按空格分词
  const qTokens = tokenize(q);

  let best: SemanticLocateResult = { score: 0, note: "未找到匹配" };

  for (const el of snapshot.interactive) {
    const targetText = normalize(el.text);
    // 直接包含
    if (targetText && targetText.includes(q)) {
      const score = 100 + q.length;
      if (score > best.score) best = { ref: el.ref, text: el.text, selector: el.selector, score, note: "文本包含匹配" };
      continue;
    }
    // 词元重叠（英文按词、中文按字）
    const targetTokens = tokenize(targetText);
    const meaningfulQ = qTokens.filter(isMeaningful);
    const meaningfulTarget = targetTokens.filter(isMeaningful);
    if (!meaningfulTarget.length) continue;
    const overlap = meaningfulQ.filter((w) => meaningfulTarget.includes(w)).length;
    const score = Math.round((overlap / Math.max(meaningfulQ.length, 1)) * 100);
    if (score > 0 && score > best.score) {
      best = { ref: el.ref, text: el.text, selector: el.selector, score, note: "词元重叠匹配" };
    }
  }
  return best;
}

/** 分词：英文按空白切分，中文 CJK 按单个字符切分 */
function tokenize(s: string): string[] {
  const tokens: string[] = [];
  // 提取英文单词和数字
  for (const m of s.matchAll(/[a-z0-9]+/gi)) tokens.push(m[0]);
  // 提取连续 CJK 字符串，逐字拆分
  for (const m of s.matchAll(/[\u4e00-\u9fff]+/g)) {
    for (const ch of m[0]) tokens.push(ch);
  }
  return tokens;
}

/** 有意义词元：非忽略词，且（CJK 单字或长度>1 的英文/数字） */
function isMeaningful(w: string): boolean {
  if (IGNORE_WORDS.has(w)) return false;
  // CJK 单字（长度 1 且为汉字）保留
  if (/^[\u4e00-\u9fff]$/.test(w)) return true;
  return w.length > 1;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[，。！？、；：""''（）()]/g, " ").trim();
}

/** 辅助：构造带语义的 click 动作参数 */
export function semanticToLocateParams(result: SemanticLocateResult) {
  return {
    ref: result.ref,
    text: result.text,
    selector: result.selector,
  };
}
