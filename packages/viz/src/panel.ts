/**
 * @openliulan/viz —— 条件触发式可视化调试面板
 *
 * 设计原则（AI 伦理透明化）：
 * - **条件触发**：不是默认启用。仅当用户明确声明"想看到调试"、"想一起测试"、
 *   "想参与决策"时，才会启动可视化。避免无谓侵入用户工作流。
 * - **透明化**：把 AI 的执行决策（做了什么、为什么、下一步打算）可视化展示，
 *   让用户能理解、监督、干预 AI 行为——这是 AI 伦理的基础要求。
 * - **轻量无依赖**：输出为结构化 JSON/Markdown 可视化轨迹，可输出到终端、
 *   MCP 消息或 Web 面板，不强制引入重型前端框架。
 *
 * 触发机制：
 * ```
 * const viz = createViz({ mode: "on-demand" });  // 默认关闭
 * viz.enable("user-requested");                  // 用户声明需要调试时启用
 * ```
 */

/**
 * 可视化触发方式
 * - "off"          —— 完全关闭（默认）
 * - "on-demand"    —— 按需触发（用户声明时才启用）
 * - "always"       —— 始终启用（面向调试/教学场景）
 */
export type VizMode = "off" | "on-demand" | "always";

/** 可视化会话配置 */
export interface VizOptions {
  /** 触发模式（默认 off） */
  mode?: VizMode;
  /** 保留的最大事件数（默认 500） */
  maxEvents?: number;
  /** 输出格式偏好（默认 markdown，供终端/消息显示） */
  format?: "markdown" | "json";
}

/**
 * 可视化事件类型
 */
export type VizEventType =
  | "action"        // 动作执行
  | "diagnose"      // 诊断
  | "decision"      // AI 决策（计划/解释）
  | "error"         // 错误
  | "screenshot"    // 截图
  | "token"         // Token 消耗
  | "user-request"  // 用户请求/声明
  | "system";       // 系统事件

/** 可视化事件 */
export interface VizEvent {
  seq: number;
  ts: number;
  type: VizEventType;
  /** 人类可读描述 */
  message: string;
  /** 详细载荷 */
  payload?: Record<string, unknown>;
  /** AI 的解释（为什么做这个决策） */
  why?: string;
  /** 是否等待用户确认（AI 伦理：需要用户参与决策时标记） */
  needsConfirmation?: boolean;
}

/**
 * VizPanel —— 条件触发式可视化面板核心
 *
 * 负责：记录可视化事件、生成可读轨迹、支持用户确认回环。
 */
export class VizPanel {
  readonly events: VizEvent[] = [];
  private seq = 0;
  private mode: VizMode;
  private format: "markdown" | "json";
  private maxEvents: number;
  /** 是否已被用户触发启用（on-demand 模式下初始为 false） */
  private activated = false;

  constructor(options: VizOptions = {}) {
    this.mode = options.mode ?? "off";
    this.format = options.format ?? "markdown";
    this.maxEvents = options.maxEvents ?? 500;
    // always 模式默认激活；off/on-demand 默认未激活
    this.activated = this.mode === "always";
  }

  /** 当前是否处于启用状态 */
  get enabled(): boolean {
    return this.activated;
  }

  /** 当前模式 */
  get currentMode(): VizMode {
    return this.mode;
  }

  /**
   * 启用可视化（条件触发：由用户声明触发）
   * @param reason 触发原因（如 "user-requested-debugging"、"collaborative-testing"）
   */
  enable(reason = "user-requested"): void {
    if (this.mode === "always" && this.activated) return;
    this.mode = "on-demand";
    this.activated = true;
    this.addEvent("user-request", `可视化已启用（原因: ${reason}）`, { payload: { reason } });
  }

  /** 禁用可视化 */
  disable(): void {
    if (this.mode === "always") return;
    this.mode = "off";
    this.activated = false;
    this.addEvent("system", "可视化已关闭");
  }

  /** 记录事件 */
  record(
    type: VizEventType,
    message: string,
    opts?: {
      payload?: Record<string, unknown>;
      why?: string;
      needsConfirmation?: boolean;
    }
  ): VizEvent {
    return this.addEvent(type, message, opts);
  }

  /** 记录 AI 决策（可视化 AI 伦理的关键：让用户看到 AI 为什么这么决定） */
  recordDecision(message: string, why?: string, needsConfirmation = false): VizEvent {
    return this.addEvent("decision", message, { why, needsConfirmation });
  }

  /** 请求用户确认（AI 伦理回环：当 AI 不确定或需要用户参与时） */
  requestConfirmation(message: string, why?: string): VizEvent {
    return this.addEvent("user-request", `🤝 需要您确认: ${message}`, { why, needsConfirmation: true });
  }

  /** 生成可读的可视化轨迹 */
  render(): string {
    if (!this.activated || this.mode === "off") return "_可视化面板已关闭_（用户未请求调试参与）";
    if (this.format === "json") return JSON.stringify(this.events, null, 2);

    const lines = [`## 🎬 可视化调试面板（${this.mode === "always" ? "始终开启" : "按需开启"}）`];
    lines.push("");
    for (const ev of this.events) {
      const time = new Date(ev.ts).toLocaleTimeString();
      const icon = this.typeIcon(ev.type);
      lines.push(`\`${time}\` ${icon} **${ev.message}**`);
      if (ev.why) lines.push(`   > 为什么: ${ev.why}`);
      if (ev.needsConfirmation) lines.push(`   > ⏸️ **需要您的确认/决策**`);
    }
    if (this.events.length === 0) lines.push("_暂无事件_");
    return lines.join("\n");
  }

  /** 导出 JSON（供结构化消费） */
  toJSON(): VizEvent[] {
    return [...this.events];
  }

  /** 是否有需要用户确认的待决事项 */
  get hasPendingConfirmation(): boolean {
    return this.events.some((e) => e.needsConfirmation);
  }

  /** 确认当前待决事项（用户参与后标记已处理） */
  confirm(): void {
    const pending = this.events.filter((e) => e.needsConfirmation);
    for (const ev of pending) {
      ev.needsConfirmation = false;
      ev.message += " ✅已确认";
    }
  }

  /** 事件计数 */
  get count(): number {
    return this.events.length;
  }

  private addEvent(
    type: VizEventType,
    message: string,
    opts?: { payload?: Record<string, unknown>; why?: string; needsConfirmation?: boolean }
  ): VizEvent {
    const ev: VizEvent = {
      seq: ++this.seq,
      ts: Date.now(),
      type,
      message,
      payload: opts?.payload,
      why: opts?.why,
      needsConfirmation: opts?.needsConfirmation,
    };
    this.events.push(ev);
    if (this.events.length > this.maxEvents) this.events.shift();
    return ev;
  }

  private typeIcon(type: VizEventType): string {
    switch (type) {
      case "action": return "🎯";
      case "diagnose": return "🔍";
      case "decision": return "🧠";
      case "error": return "❌";
      case "screenshot": return "📸";
      case "token": return "⚡";
      case "user-request": return "🤝";
      case "system": return "⚙️";
    }
  }
}

/** 便捷工厂函数 */
export function createViz(options?: VizOptions): VizPanel {
  return new VizPanel(options);
}
