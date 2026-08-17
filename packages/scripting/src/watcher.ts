/**
 * 变化检测等待器（wait-for-change）——「轮询换检测」6 星能力
 *
 * 传统方案：AI 反复轮询页面状态（每次都要走 LLM，消耗 Token）。
 * 本模块：**在页面本地监听变化，变化发生后一次性返回**，等待过程不消耗任何 Token。
 *
 * 支持三种检测方式：
 * - `waitForSelector`：等待某个元素出现/消失（DOM 变化检测）；
 * - `waitForText`：等待页面出现/消失某段文本；
 * - `waitForColor`：图色识别——等待指定坐标出现/消失某颜色（对应「识别某处颜色、等待颜色然后触发」）。
 *
 * 这些检测都在浏览器/脚本层完成（事件驱动或本地轮询），**与 LLM 无关，零 Token 消耗**。
 */
/** 变化检测结果 */
export interface ChangeResult {
  ok: boolean;
  /** 检测到变化的时刻（ms） */
  detectedAt: number;
  /** 实际等待耗时 ms */
  waitedMs: number;
  /** 说明 */
  note: string;
}

/** 检测方式 */
export type WatchKind =
  | { kind: "selector"; selector: string; present: boolean }
  | { kind: "text"; text: string; present: boolean }
  | { kind: "color"; x: number; y: number; rgb: [number, number, number]; match: boolean };

/** 页面探测回调：由引擎提供，本地执行不经过 LLM */
export type ProbeFn = (watch: WatchKind) => Promise<boolean>;

/** 等待器选项 */
export interface WaitForChangeOptions {
  /** 最大等待 ms（默认 30s） */
  timeoutMs?: number;
  /** 本地探测间隔 ms（默认 300ms，发生在脚本层，不消耗 Token） */
  pollIntervalMs?: number;
}

/** 变化检测等待器：把「轮询换检测」封装为一次性的等待触发 */
export class ChangeWatcher {
  private opts: Required<WaitForChangeOptions>;

  constructor(opts: WaitForChangeOptions = {}) {
    this.opts = { timeoutMs: 30_000, pollIntervalMs: 300, ...opts };
  }

  /**
   * 等待一次变化发生（触发即返回）。
   * @param watch 要检测的变化
   * @param probe 本地探测函数（由引擎注入，不经过 LLM）
   */
  async waitForChange(watch: WatchKind, probe: ProbeFn): Promise<ChangeResult> {
    const t0 = Date.now();
    let detected = false;
    while (Date.now() - t0 < this.opts.timeoutMs) {
      detected = await probe(watch);
      if (detected) break;
      await sleep(this.opts.pollIntervalMs);
    }
    const waited = Date.now() - t0;
    if (!detected) {
      return { ok: false, detectedAt: Date.now(), waitedMs: waited, note: `超时未检测到变化（${this.opts.timeoutMs}ms）` };
    }
    return { ok: true, detectedAt: Date.now(), waitedMs: waited, note: `变化已触发（等待 ${waited}ms，零 Token 消耗）` };
  }

  /** 便捷：等待元素出现 */
  waitForSelector(selector: string, present = true, probe: ProbeFn): Promise<ChangeResult> {
    return this.waitForChange({ kind: "selector", selector, present }, probe);
  }

  /** 便捷：等待文本出现 */
  waitForText(text: string, present = true, probe: ProbeFn): Promise<ChangeResult> {
    return this.waitForChange({ kind: "text", text, present }, probe);
  }

  /** 便捷：等待指定坐标出现目标颜色（图色识别触发） */
  waitForColor(x: number, y: number, rgb: [number, number, number], match = true, probe: ProbeFn): Promise<ChangeResult> {
    return this.waitForChange({ kind: "color", x, y, rgb, match }, probe);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
