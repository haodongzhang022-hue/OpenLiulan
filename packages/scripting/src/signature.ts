/**
 * 脚本签名与指纹工具
 *
 * 用于把「动作 + 页面 URL」归一化为可比较的语义指纹：
 * - **页面归一化**：只取 host + path（去掉 query/hash），避免同一页面因参数不同被当成不同目标；
 * - **动作类型序列**：如 click→fill→click，判断操作模式是否一致；
 * - **锚点文本**：取首动作的语义目标（text/ref/semantic），精确定位「同一目标」；
 * - **指纹**：由页面 key + 动作序列 + 锚点文本计算，作为脚本 id 与重复识别依据。
 */
import type { UnifiedAction } from "@openliulan/core";
import type { ScriptSignature } from "./script.js";

/** 提取动作的语义目标文本（用于锚点） */
export function anchorTextOf(action: UnifiedAction): string | undefined {
  const a = action as UnifiedAction & { text?: string; ref?: string; semantic?: string; url?: string };
  switch (action.type) {
    case "click":
    case "fill":
    case "hover":
    case "assert":
    case "extract":
    case "select":
      return a.text ?? a.ref ?? a.semantic;
    case "type":
      return a.ref ?? a.text ?? a.semantic;
    case "navigate":
      return a.url;
    default:
      return undefined;
  }
}

/** 归一化页面 key：只保留 host + path 前缀（忽略 query/hash 及尾部斜杠） */
export function normalizePageKey(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    // 归一化尾部斜杠，但保留根路径
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.host}${path || "/"}`;
  } catch {
    return url;
  }
}

/** 动作类型序列 */
export function actionTypeSequence(actions: UnifiedAction[]): string[] {
  return actions.map((a) => a.type);
}

/** 由动作与 URL 构造语义签名 */
export function signatureOf(action: UnifiedAction, url: string): ScriptSignature {
  return {
    pageKey: normalizePageKey(url),
    actionTypes: [action.type],
    anchorText: anchorTextOf(action),
  };
}

/** 计算指纹（同时作为脚本 id） */
export function fingerprintOf(sig: ScriptSignature): string {
  const base = [sig.pageKey, ...sig.actionTypes, sig.anchorText ?? ""].join("|");
  // 简单确定性哈希（FNV-1a 32 位）
  let hash = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `script_${(hash >>> 0).toString(36)}_${sig.actionTypes.join("")}_${sig.anchorText ? sig.anchorText.slice(0, 12) : "nav"}`;
}

/** 估算脚本所有步骤的总 Token（粗略 4 字符/token） */
export function estimateStepsTokens(steps: { action: UnifiedAction }[]): number {
  let total = 0;
  for (const s of steps) {
    const raw = JSON.stringify(s.action);
    total += Math.ceil(raw.length / 4);
  }
  return total;
}
