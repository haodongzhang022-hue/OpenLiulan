/**
 * 动作脚本化模型（6 星能力）
 *
 * 把一段「重复出现」的动作序列录制为可回放脚本：
 * - **录制**：把统一动作序列（UnifiedAction[]）固化为脚本，含页面 URL 上下文；
 * - **按页分类**：脚本以页面地址为命名空间分类存储，同页操作可被检索/推荐；
 * - **缓存触发**：同页同目标的操作序列出现 2 次后自动生成脚本草稿，下次直接回放；
 * - **零 Token 回放**：脚本回放不经过 LLM，直接驱动底层动作执行，重复操作零 Token 直达。
 *
 * 这相当于「AI 语义层」从『只有说法』升级为『有持久化、有脚本化』，
 * 也把「Token 效率」从『单次省』升级为『重复操作第二次起零消耗』。
 */
import type { UnifiedAction } from "@openliulan/core";

/** 脚本触发的语义签名：用于判断「同一页面上的同类操作」 */
export interface ScriptSignature {
  /** 页面 URL（归一化 host + path 前缀，忽略 query/hash 的易变部分） */
  pageKey: string;
  /** 动作类型序列指纹（如 click→fill→click） */
  actionTypes: string[];
  /** 首动作的语义目标文本（如点击的按钮文字），用于精确定位同一目标 */
  anchorText?: string;
}

/** 单条录制动作 */
export interface RecordedAction {
  action: UnifiedAction;
  /** 该动作执行结果的摘要（用于回放后校验/记录） */
  resultSummary?: string;
  /** 该动作耗时 ms */
  durationMs?: number;
}

/** 一条可回放脚本 */
export interface ActionScript {
  /** 脚本唯一 id */
  id: string;
  /** 脚本名称（由首个动作语义生成） */
  name: string;
  /** 语义签名（页面 + 动作序列 + 锚点） */
  signature: ScriptSignature;
  /** 录制到的动作序列 */
  steps: RecordedAction[];
  /** 用途/说明 */
  description?: string;
  /** 来源页面完整 URL（供展示） */
  sourceUrl: string;
  /** 创建时间 */
  createdAt: number;
  /** 最近回放次数 */
  replayCount: number;
  /** 最近回放时间 */
  lastReplayAt?: number;
  /** 回放累计节省的 Token 估算 */
  savedTokens: number;
}

/** 回放结果 */
export interface ScriptReplayResult {
  ok: boolean;
  scriptId: string;
  /** 成功回放的步骤数 */
  stepsDone: number;
  /** 每步结果摘要 */
  stepResults: string[];
  /** 本次回放估算节省的 Token */
  savedTokens: number;
  error?: string;
}

/** 脚本存储接口（可内存 / 落盘 / 云端） */
export interface ScriptStore {
  /** 保存（新建或更新）一个脚本 */
  save(script: ActionScript): Promise<void>;
  /** 按 id 取脚本 */
  get(id: string): Promise<ActionScript | undefined>;
  /** 按页面 key 列出该页所有脚本 */
  listByPage(pageKey: string): Promise<ActionScript[]>;
  /** 列出所有脚本（供脚本市场按页浏览/推荐） */
  listAll(): Promise<ActionScript[]>;
  /** 删除脚本 */
  remove(id: string): Promise<void>;
}
