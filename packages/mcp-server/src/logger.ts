/**
 * SessionLogger —— 会话事件日志器
 *
 * 维护一条**连贯的事件流**，让外部 AI / IDE 能：
 * - 订阅实时事件（EventEmitter 式推送）
 * - 拉取历史事件快照（`toArray` / `exportMarkdown`）
 * - 生成人类可读的执行轨迹（回放动作 + 诊断 + 错误 + 截图）
 *
 * 这是「跟 IDE / 外部 AI 协作」的消息总线：框架所有动作、诊断、错误、
 * 截图、日志都汇入这里，再由适配层（stdio/HTTP/harness/CLI）转发给外部 AI。
 */
import type {
  EventLevel,
  EventCategory,
  ForgeEvent,
  ForgeErrorEvent,
  ScreenshotEvent,
  ForgeAnyEvent,
  EventListener,
} from "./events.js";

export interface SessionLoggerOptions {
  /** 会话 id（缺省自动生成） */
  sessionId?: string;
  /** 事件流最大保留条数（防内存无限增长，缺省 2000） */
  maxEvents?: number;
  /** 是否启用日志（debug 级别仍记录，只是级别字段为 debug） */
  enabled?: boolean;
}

/** 日志入口参数（message + 可选 payload） */
export interface LogEntry {
  level?: EventLevel;
  category?: EventCategory;
  message: string;
  payload?: Record<string, unknown>;
}

export class SessionLogger {
  readonly sessionId: string;
  private events: ForgeAnyEvent[] = [];
  private listeners = new Set<EventListener>();
  private seq = 0;
  private maxEvents: number;
  private enabled: boolean;

  constructor(opts: SessionLoggerOptions = {}) {
    this.sessionId = opts.sessionId ?? `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.maxEvents = opts.maxEvents ?? 2000;
    this.enabled = opts.enabled ?? true;
  }

  /** 订阅实时事件，返回取消订阅函数 */
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 记录一条通用日志事件 */
  log(entry: LogEntry): ForgeEvent {
    const event: ForgeEvent = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: entry.level ?? "info",
      category: entry.category ?? "log",
      message: entry.message,
      payload: entry.payload,
      sessionId: this.sessionId,
    };
    return this.emit(event);
  }

  /** 记录一条标准错误事件（带报错原因与解释，交给外部 AI） */
  error(err: Omit<ForgeErrorEvent["error"], never> & {
    message: string;
    level?: EventLevel;
    payload?: Record<string, unknown>;
  }): ForgeErrorEvent {
    const { message, level, payload, ...error } = err;
    const event: ForgeErrorEvent = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: level ?? "error",
      category: "error",
      message,
      error,
      payload,
      sessionId: this.sessionId,
    };
    return this.emit(event);
  }

  /** 记录一条截图/图片事件 */
  screenshot(img: {
    dataUri: string;
    fullPage?: boolean;
    caption?: string;
  }): ScreenshotEvent {
    const byteLength = img.dataUri.replace(/^data:image\/png;base64,/, "").length;
    const event: ScreenshotEvent = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: "info",
      category: "screenshot",
      message: img.caption ?? `截图已采集 (${(byteLength * 0.75) / 1024}KB)`,
      image: {
        dataUri: img.dataUri,
        byteLength,
        fullPage: img.fullPage ?? false,
        caption: img.caption,
      },
      sessionId: this.sessionId,
    };
    return this.emit(event);
  }

  /** 记录系统生命周期事件 */
  system(message: string, payload?: Record<string, unknown>): ForgeEvent {
    return this.log({ level: "info", category: "system", message, payload });
  }

  /** 记录一次动作执行事件 */
  action(message: string, payload?: Record<string, unknown>): ForgeEvent {
    return this.log({ level: "info", category: "action", message, payload });
  }

  /** 记录一次诊断事件 */
  diagnose(message: string, payload?: Record<string, unknown>): ForgeEvent {
    return this.log({ level: "info", category: "diagnose", message, payload });
  }

  /** 获取全部历史事件（快照） */
  toArray(): ForgeAnyEvent[] {
    return this.events.slice();
  }

  /** 按类别过滤事件 */
  filter(category: EventCategory | EventCategory[]): ForgeAnyEvent[] {
    const cats = Array.isArray(category) ? category : [category];
    return this.events.filter((e) => cats.includes(e.category));
  }

  /** 清空事件流 */
  clear(): void {
    this.events = [];
    this.seq = 0;
  }

  /** 导出为 markdown（供外部 AI / PR 评论 / 制品消费） */
  exportMarkdown(opts: { title?: string; includeScreenshots?: boolean } = {}): string {
    const lines: string[] = [];
    lines.push(`# ${opts.title ?? "Forge 会话事件日志"}`);
    lines.push(`**Session**: ${this.sessionId} | **事件数**: ${this.events.length}`);
    lines.push("");
    for (const e of this.events) {
      const t = new Date(e.ts).toISOString().replace("T", " ").slice(0, 19);
      const tag = `[${e.level.toUpperCase()}/${e.category}]`;
      if (e.category === "error") {
        const err = (e as ForgeErrorEvent).error;
        lines.push(`- \`${t}\` **${tag}** ${e.message}`);
        lines.push(`  - 错误码: \`${err.code}\` | 根因: ${err.reason}`);
        if (err.explanation) lines.push(`  - 原因: ${err.explanation}`);
        if (err.suggestion) lines.push(`  - 建议: ${err.suggestion}`);
      } else if (e.category === "screenshot") {
        const img = (e as ScreenshotEvent).image;
        lines.push(`- \`${t}\` **${tag}** ${e.message}`);
        if (opts.includeScreenshots) {
          lines.push(`  - ![截图](./forge-event-${e.seq}.png)`);
        }
      } else {
        lines.push(`- \`${t}\` **${tag}** ${e.message}`);
      }
      if (e.payload && Object.keys(e.payload).length) {
        const p = JSON.stringify(e.payload);
        if (p.length <= 400) lines.push(`  - payload: \`${p}\``);
      }
    }
    return lines.join("\n");
  }

  /** 生成纯文本执行轨迹（供日志/终端） */
  toTimeline(): string {
    return this.events
      .map((e) => {
        const t = new Date(e.ts).toISOString().replace("T", " ").slice(11, 19);
        return `${t} [${e.level}] ${e.category}: ${e.message}`;
      })
      .join("\n");
  }

  private nextSeq(): number {
    return ++this.seq;
  }

  private emit<T extends ForgeAnyEvent>(event: T): T {
    if (!this.enabled) return event;
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(this.events.length - this.maxEvents);
    }
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // 单个监听器异常不影响事件流
      }
    }
    return event;
  }
}
