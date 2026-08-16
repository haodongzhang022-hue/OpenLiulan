/**
 * Token 高效提取策略
 *
 * 借鉴 Chrome DevTools MCP 的 5 星 Token 效率：
 * 1. DOM 按需裁剪（只读需要的信息）
 * 2. 增量读取（先摘要，按 ref 展开）
 * 3. 结构化压缩输出
 */
import type { PageSnapshot, SnapshotNode } from "@browser-ai-forge/core";

/** Token 估算：粗略 4 字符/token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** 快照的最小化文本表示（供 LLM） */
export function compactSnapshot(snapshot: PageSnapshot, maxInteractive = 40): string {
  const parts: string[] = [];
  parts.push(`[${snapshot.title}] ${snapshot.url}`);
  const rows = snapshot.interactive.slice(0, maxInteractive).map(
    (el) => `${el.ref}:${el.tag}${el.role ? "[" + el.role + "]" : ""}:"${el.text.slice(0, 60)}"`
  );
  parts.push(rows.join("\n"));
  return parts.join("\n");
}

/** 单个节点压缩为一行 */
export function nodeToLine(node: SnapshotNode): string {
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `${node.ref} <${node.tag}${attrs ? " " + attrs : ""}> "${node.text}"`;
}

/**
 * 增量读取：给定目标 ref，返回该节点及其一级子树的紧凑文本。
 * 用于 AI 需要查看某元素内部详情时才展开，避免全量加载。
 */
export function expandNode(snapshot: PageSnapshot, ref: string, depth = 1): string {
  const found = findNode(snapshot.root, ref);
  if (!found) return `未找到 ref=${ref}`;
  return renderNode(found, 0, depth);
}

function findNode(node: SnapshotNode | undefined, ref: string): SnapshotNode | undefined {
  if (!node) return undefined;
  if (node.ref === ref) return node;
  for (const c of node.children || []) {
    const hit = findNode(c, ref);
    if (hit) return hit;
  }
  return undefined;
}

function renderNode(node: SnapshotNode, depth: number, maxDepth: number): string {
  const indent = "  ".repeat(depth);
  let out = indent + nodeToLine(node);
  if (depth < maxDepth && node.children?.length) {
    for (const c of node.children) {
      out += "\n" + renderNode(c, depth + 1, maxDepth);
    }
  }
  return out;
}

/**
 * 从快照中提取「当前视口内」的关键元素（用于聚焦，减少 Token）。
 * 借助根节点遍历保留每个交互元素。
 */
export function keyElements(snapshot: PageSnapshot, limit = 30): Array<{ ref: string; tag: string; text: string }> {
  return snapshot.interactive.slice(0, limit);
}
