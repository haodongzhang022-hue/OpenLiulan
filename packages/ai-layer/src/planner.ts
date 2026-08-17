/**
 * AI 语义层：把 AI Agent 的自然语言意图解析为统一动作。
 *
 * 借鉴 Browser-Use 的 AI 适配能力，提供：
 * - LLM 后端抽象（可接入 deepseek / cnb.cool / openai 等）
 * - 意图 -> 动作的规划协议
 * - 语义定位（把语义描述转成动作的 semantic 字段）
 */
import type { UnifiedAction, PageSnapshot } from "@openliulan/core";

/** LLM 后端抽象：统一 AI 能力接入 */
export interface LlmBackend {
  readonly name: string;
  /**
   * 生成结构化 JSON 输出。
   * @param system  系统提示
   * @param messages 消息
   * @param schema  期望输出的 JSON 结构描述
   */
  completeJSON<T>(system: string, messages: Array<{ role: string; content: string }>, schema: string): Promise<T>;
}

/** 规划器：把用户的自然语言目标规划为一系列动作 */
export interface Planner {
  /** 名称 */
  readonly name: string;
  /** 根据目标与当前快照，规划下一步动作 */
  plan(snapshot: PageSnapshot, goal: string, history?: string[]): Promise<UnifiedAction>;
}

/** 动作历史条目 */
export interface ActionHistoryItem {
  index: number;
  action: UnifiedAction;
  result: string;
  diagnostics?: string;
}

/**
 * 把页面快照压缩为 LLM 友好、Token 高效的文本描述。
 * 只保留可交互元素与关键文本。
 */
export function snapshotToPrompt(snapshot: PageSnapshot): string {
  const lines: string[] = [];
  lines.push(`# 页面: ${snapshot.title}`);
  lines.push(`URL: ${snapshot.url}`);
  lines.push(`状态: ${snapshot.readyState} | 节点数: ${snapshot.stats.totalNodes} | 约 ${snapshot.stats.approximateTokens} tokens`);

  if (snapshot.interactive.length) {
    lines.push(`\n## 可交互元素 (${snapshot.interactive.length})`);
    for (const el of snapshot.interactive.slice(0, 60)) {
      lines.push(`- ref=${el.ref} <${el.tag}>${el.role ? ` role=${el.role}` : ""} "${el.text}"`);
    }
  } else {
    lines.push("\n## 页面正文片段");
    const walk = (n: any, depth: number): void => {
      if (!n || depth > 3) return;
      if (n.text) lines.push(`${"  ".repeat(depth)}- ${n.text.slice(0, 80)}`);
      (n.children || []).forEach((c: any) => walk(c, depth + 1));
    };
    walk(snapshot.root, 0);
  }
  return lines.join("\n");
}

/** 生成动作规划的系统提示词 */
export function buildPlannerSystemPrompt(supportedActions: string[]): string {
  return [
    "你是浏览器自动化规划器，根据用户目标与当前页面快照，输出下一步应执行的唯一动作。",
    "输出必须是合法 JSON，包含字段: { type, description, ...动作特有参数 }。",
    `支持的动作类型: ${supportedActions.join(", ")}`,
    "定位元素时优先使用快照中的 ref 字段；若没有 ref 可用语义描述 semantic 或文本 text。",
    "若页面已达成目标，输出 type=wait 且 description 说明已完成。",
    "只输出 JSON，不要附加任何说明。",
  ].join("\n");
}

/** 生成动作规划的用户提示词 */
export function buildPlannerUserPrompt(snapshot: PageSnapshot, goal: string, history?: string[]): string {
  const parts: string[] = [];
  parts.push(`## 用户目标\n${goal}`);
  parts.push(`\n## 当前页面快照\n${snapshotToPrompt(snapshot)}`);
  if (history && history.length) {
    parts.push(`\n## 最近动作历史（最后 5 条）`);
    parts.push(history.slice(-5).join("\n"));
  }
  return parts.join("\n");
}
