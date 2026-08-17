/**
 * 动作录制器 + 重复操作缓存触发引擎（6 星能力）
 *
 * 核心逻辑：把「重复出现的操作」沉淀为可回放脚本，下次直接触发，不再走 LLM。
 *
 * ## 缓存触发机制（对应「触发 2 次之后打包成脚本，下次直接触发」）
 * - 对同一页面 + 同一动作序列 + 同一锚点目标的操作进行指纹归一化；
 * - **第 1 次**：静默记录该操作指纹（不打扰），仅计数；
 * - **第 2 次**：生成「脚本草稿」并回调询问是否落库；
 * - **第 3 次起**：命中已入库脚本，直接返回脚本，下次可零 Token 回放。
 *
 * ## 语义持久化
 * 脚本以 JSON 落盘（ScriptStore），跨会话留存，语义从「一次性说法」升级为「可复用资产」。
 */
import type { UnifiedAction } from "@openliulan/core";
import type { ActionScript, ScriptSignature, ScriptStore, ScriptReplayResult, RecordedAction } from "./script.js";
import { normalizePageKey, signatureOf, fingerprintOf, actionTypeSequence, estimateStepsTokens } from "./signature.js";

/** 重复操作上报信息（供上层询问用户是否打包脚本） */
export interface RepeatOperationNotice {
  fingerprint: string;
  /** 该操作已出现的次数 */
  occurrences: number;
  /** 建议的脚本草稿（可直接 save） */
  draft: ActionScript;
  /** 说明文案 */
  message: string;
}

/** 录制器选项 */
export interface ActionRecorderOptions {
  /** 是否启用重复操作缓存触发（默认 true） */
  enableRepeatTrigger?: boolean;
  /** 触发打包的重复次数阈值（默认 2：出现 2 次询问打包） */
  triggerAfter?: number;
  /** 脚本存储（默认内存存储） */
  store?: ScriptStore;
  /** 生成脚本名/描述的回调（可自定义语义） */
  onScriptDraft?: (notice: RepeatOperationNotice) => void;
}

/** 录制器：累积动作 → 识别重复 → 打包脚本 → 命中回放 */
export class ActionRecorder {
  private opts: Required<Pick<ActionRecorderOptions, "enableRepeatTrigger" | "triggerAfter">> & ActionRecorderOptions;
  private counts = new Map<string, number>();
  private pendingSteps = new Map<string, RecordedAction[]>();
  readonly store: ScriptStore;

  constructor(opts: ActionRecorderOptions = {}) {
    this.opts = {
      enableRepeatTrigger: true,
      triggerAfter: 2,
      ...opts,
    };
    this.store = opts.store ?? new MemoryScriptStore();
  }

  /**
   * 记录一次动作执行。当重复达到阈值时，触发脚本草稿回调。
   * @param action 已执行的动作
   * @param url 当前页面 URL
   * @param resultSummary 动作结果摘要
   */
  record(action: UnifiedAction, url: string, resultSummary?: string): RepeatOperationNotice | null {
    if (!this.opts.enableRepeatTrigger) return null;
    const sig = signatureOf(action, url);
    const fp = fingerprintOf(sig);
    const count = (this.counts.get(fp) ?? 0) + 1;
    this.counts.set(fp, count);

    const steps = this.pendingSteps.get(fp) ?? [];
    steps.push({ action, resultSummary });
    this.pendingSteps.set(fp, steps);

    // 达到阈值 → 生成脚本草稿并回调
    if (count === this.opts.triggerAfter) {
      const draft = this.buildDraft(sig, steps, url);
      const notice: RepeatOperationNotice = {
        fingerprint: fp,
        occurrences: count,
        draft,
        message: `检测到「${draft.name}」已重复 ${count} 次，是否将该操作打包为脚本，下次直接触发（零 Token 回放）？`,
      };
      if (this.opts.onScriptDraft) this.opts.onScriptDraft(notice);
      return notice;
    }
    return null;
  }

  /**
   * 尝试命中已有脚本：同一页面同一序列同一锚点的操作，直接返回脚本供回放。
   * @returns 命中脚本或 undefined
   */
  async match(action: UnifiedAction, url: string): Promise<ActionScript | undefined> {
    if (!this.opts.enableRepeatTrigger) return undefined;
    const sig = signatureOf(action, url);
    const fp = fingerprintOf(sig);
    // 若该指纹已入库，返回脚本
    const all = await this.store.listAll();
    return all.find((s) => s.id === fp);
  }

  /** 把当前累积的重复操作固化为脚本（当用户确认打包时调用） */
  async persistDraft(notice: RepeatOperationNotice): Promise<ActionScript> {
    await this.store.save(notice.draft);
    return notice.draft;
  }

  /** 构建脚本草稿 */
  private buildDraft(sig: ScriptSignature, steps: RecordedAction[], url: string): ActionScript {
    const name = this.describe(sig);
    return {
      id: fingerprintOf(sig),
      name,
      signature: sig,
      steps,
      sourceUrl: url,
      createdAt: Date.now(),
      replayCount: 0,
      savedTokens: 0,
      description: `由重复操作自动录制：「${name}」。下次在同一页面执行同类操作时可直接回放，不消耗 Token。`,
    };
  }

  /** 生成人类可读的脚本名 */
  private describe(sig: ScriptSignature): string {
    const anchor = sig.anchorText ? `「${sig.anchorText}」` : "";
    const seq = sig.actionTypes.join("→");
    return `${anchor}${seq}`.trim();
  }
}

/** 脚本回放器：把脚本步骤逐条驱动执行（不经过 LLM，零 Token） */
export class ScriptPlayer {
  /**
   * 回放脚本。
   * @param script 要回放的脚本
   * @param execute 底层动作执行器（返回结果摘要与 ok）
   */
  async play(
    script: ActionScript,
    execute: (action: UnifiedAction, stepIndex: number) => Promise<{ ok: boolean; summary: string }>
  ): Promise<ScriptReplayResult> {
    const saved = estimateStepsTokens(script.steps);
    const stepResults: string[] = [];
    let stepsDone = 0;
    try {
      for (let i = 0; i < script.steps.length; i++) {
        const r = await execute(script.steps[i].action, i);
        stepResults.push(r.summary);
        if (!r.ok) {
          return {
            ok: false,
            scriptId: script.id,
            stepsDone,
            stepResults,
            savedTokens: 0,
            error: `脚本第 ${i + 1} 步执行失败：${r.summary}`,
          };
        }
        stepsDone++;
      }
      script.replayCount += 1;
      script.lastReplayAt = Date.now();
      script.savedTokens += saved;
      return { ok: true, scriptId: script.id, stepsDone, stepResults, savedTokens: saved };
    } catch (err) {
      return {
        ok: false,
        scriptId: script.id,
        stepsDone,
        stepResults,
        savedTokens: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/** 内存脚本存储（默认；可用 JSON 落盘实现替代） */
export class MemoryScriptStore implements ScriptStore {
  private map = new Map<string, ActionScript>();
  async save(s: ActionScript): Promise<void> {
    this.map.set(s.id, s);
  }
  async get(id: string): Promise<ActionScript | undefined> {
    return this.map.get(id);
  }
  async listByPage(pageKey: string): Promise<ActionScript[]> {
    return [...this.map.values()].filter((s) => s.signature.pageKey === pageKey);
  }
  async listAll(): Promise<ActionScript[]> {
    return [...this.map.values()];
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
}

export { normalizePageKey, signatureOf, fingerprintOf, actionTypeSequence };
