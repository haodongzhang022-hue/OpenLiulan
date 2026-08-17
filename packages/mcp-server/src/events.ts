/**
 * 统一事件日志协议（AI 协作消息传递的地基）
 *
 * 这是「跟 IDE / 外部 AI 协作」的最后一公里：
 * 框架内所有值得外部 AI 知晓的信息——动作执行、诊断、错误（含原因与解释）、
 * 截图/图片、普通日志——都统一沉淀为一条**结构化事件**，带有：
 * - 时间戳（可回放执行轨迹）
 * - 级别（error / warning / info / debug）
 * - 类别（action / diagnose / error / screenshot / log / system）
 * - 结构化 payload（机器可读，供 AI 精确消费）
 * - 人类可读 message（供 AI 直接理解）
 *
 * 外部 AI 无需再靠"解析散落文本"来拼凑发生了什么，
 * 而是拿到一条连贯、可行动的事件流（EventStream）。
 */

/** 事件级别 */
export type EventLevel = "debug" | "info" | "warning" | "error";

/** 事件类别 */
export type EventCategory =
  | "action" // 动作执行（navigate/click/fill/...）
  | "diagnose" // 诊断采集结果
  | "error" // 错误（含原因与解释）
  | "screenshot" // 图片/截图
  | "log" // 普通日志
  | "system" // 系统生命周期（start/shutdown/session）
  | "knowledge"; // 知识库/方案注入

/**
 * 统一事件（ErrorEvent 之外的通用事件）。
 * error 类别的错误请用 ForgeErrorEvent，携带标准化的报错原因与解释。
 */
export interface ForgeEvent {
  /** 自增序号（保证时序） */
  seq: number;
  /** 时间戳（ms） */
  ts: number;
  /** 级别 */
  level: EventLevel;
  /** 类别 */
  category: EventCategory;
  /** 人类可读描述（供 AI / 日志 / 界面直接展示） */
  message: string;
  /** 结构化载荷（机器可读，可携带 refs / counts / url 等） */
  payload?: Record<string, unknown>;
  /** 关联的会话 id */
  sessionId?: string;
}

/**
 * 标准错误事件 —— 把「bug 的报错原因与解释」结构化地交给外部 AI。
 *
 * 相比普通错误文本，它让外部 AI 能直接拿到可编程的字段：
 * - code：稳定错误码（如 ACTION_FAILED / JS_EXCEPTION / NETWORK_FAILURE）
 * - reason：根因分类（如 locator-not-found / network-4xx / js-uncaught）
 * - stack：原始堆栈 / 请求详情（可选）
 * - explanation：面向 AI 的「为什么失败 + 怎么修」解释
 * - suggestion：可行动的修复建议
 * - screenshotRef：关联截图（若同时采集了图片，让 AI 看图定位）
 * - diagnostics：关联的结构化诊断发现
 */
export interface ForgeErrorEvent extends ForgeEvent {
  category: "error";
  /** 错误事件详情 */
  error: {
    /** 稳定错误码 */
    code: string;
    /** 根因分类 */
    reason: string;
    /** 原始错误信息（裁剪） */
    raw: string;
    /** 面向 AI 的根因解释 */
    explanation: string;
    /** 可行动的修复建议 */
    suggestion: string;
    /** 关联堆栈 / 请求详情（可选） */
    detail?: string;
    /** 关联截图 ref（可选，配合 ScreenshotEvent） */
    screenshotRef?: string;
    /** 关联的结构化诊断发现（可选） */
    findings?: Array<{
      category: string;
      severity: string;
      message: string;
      suggestion?: string;
    }>;
  };
}

/** 截图 / 图片事件 */
export interface ScreenshotEvent extends ForgeEvent {
  category: "screenshot";
  /** 图片消息 */
  image: {
    /** 数据 URI（base64 PNG） */
    dataUri: string;
    /** base64 长度 */
    byteLength: number;
    /** 是否为整页截图 */
    fullPage: boolean;
    /** 截图说明 */
    caption?: string;
  };
}

/** 事件联合 */
export type ForgeAnyEvent = ForgeEvent | ForgeErrorEvent | ScreenshotEvent;

/** 事件日志回调（外部可订阅，实时推送给 AI / 落盘 / 上报） */
export type EventListener = (event: ForgeAnyEvent) => void;
