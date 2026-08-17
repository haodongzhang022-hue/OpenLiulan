/**
 * AI 协作消息协议（Message Protocol）
 *
 * 把「事件流」聚合成一条条**外部 AI 可直接消费的消息**。
 * 相比裸的 ToolResult，AI 协作消息能同时携带：
 * - text：人类可读、可行动的主文本
 * - images：base64 图片（截图等，供多模态 AI 看图）
 * - errors：标准化的错误（含原因 / 解释 / 建议 / 关联截图）
 * - logs：结构化事件轨迹（让 AI 追踪"发生了什么"）
 *
 * 这是「跟 IDE / 外部 AI 协作」的统一出口：MCP 工具返回、
 * stdio/HTTP 转发、harness 回调，都用这套消息结构。
 */
import type { ForgeAnyEvent, ForgeErrorEvent, ScreenshotEvent } from "./events.js";
import { redactText } from "./security.js";

/** 消息中的图片内容（多模态 AI 可直接用） */
export interface MessageImage {
  /** MIME 类型 */
  mimeType: string;
  /** base64 数据 */
  base64: string;
  /** 截图/图片说明 */
  caption?: string;
}

/** 消息中的错误内容（标准化的 bug 报错原因与解释） */
export interface MessageError {
  code: string;
  reason: string;
  explanation: string;
  suggestion: string;
  detail?: string;
  screenshotRef?: string;
}

/** 消息中的日志条目（事件轨迹的轻量摘要） */
export interface MessageLog {
  level: string;
  category: string;
  message: string;
  ts: number;
}

/** 统一 AI 协作消息 */
export interface AIMessage {
  /** 是否成功 */
  ok: boolean;
  /** 人类可读主文本 */
  text: string;
  /** 图片内容（可选） */
  images?: MessageImage[];
  /** 标准错误（可选） */
  error?: MessageError;
  /** 事件日志轨迹（可选） */
  logs?: MessageLog[];
  /** 原始结构化数据（可选，透传） */
  structured?: Record<string, unknown>;
}

/** 从事件流构建 AI 协作消息 */
export function buildAIMessage(opts: {
  ok: boolean;
  text: string;
  events?: ForgeAnyEvent[];
  structured?: Record<string, unknown>;
  includeScreenshots?: boolean;
  maxImages?: number;
}): AIMessage {
  const msg: AIMessage = { ok: opts.ok, text: opts.text, structured: opts.structured };
  const events = opts.events ?? [];

  // 错误：取最近一条 error 事件
  const errEvent = [...events].reverse().find((e) => e.category === "error") as
    | ForgeErrorEvent
    | undefined;
  if (errEvent) {
    msg.error = {
      code: errEvent.error.code,
      reason: errEvent.error.reason,
      explanation: errEvent.error.explanation,
      suggestion: errEvent.error.suggestion,
      detail: errEvent.error.detail,
      screenshotRef: errEvent.error.screenshotRef,
    };
  }

  // 图片：取最近的截图事件
  if (opts.includeScreenshots !== false) {
    const imgs = events
      .filter((e): e is ScreenshotEvent => e.category === "screenshot")
      .slice(-(opts.maxImages ?? 3))
      .map((e) => {
        const b64 = e.image.dataUri.replace(/^data:image\/png;base64,/, "");
        return {
          mimeType: "image/png",
          base64: b64,
          caption: e.image.caption,
        } satisfies MessageImage;
      });
    if (imgs.length) msg.images = imgs;
  }

  // 日志轨迹（最近 20 条事件摘要），message 做脱敏防令牌/敏感 URL 泄露
  if (events.length) {
    msg.logs = events.slice(-20).map((e) => ({
      level: e.level,
      category: e.category,
      message: redactText(e.message),
      ts: e.ts,
    }));
  }

  return msg;
}

/** 把 AI 协作消息序列化为 MCP content 数组（text + image） */
export function messageToContent(msg: AIMessage): Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> {
  const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];
  content.push({ type: "text", text: msg.text });
  if (msg.error) {
    content.push({
      type: "text",
      text: `\n[错误] ${msg.error.code} (${msg.error.reason})\n${msg.error.explanation}\n建议: ${msg.error.suggestion}`,
    });
  }
  for (const img of msg.images ?? []) {
    content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
  }
  return content;
}
