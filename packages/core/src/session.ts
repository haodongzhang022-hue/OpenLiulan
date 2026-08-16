/**
 * 状态机：跟踪 AI 在页面上的操作会话状态（借鉴 Stagehand 的 Act/Extract/Observe 生命周期）
 */
export type SessionPhase =
  | "idle"
  | "navigating"
  | "acting"
  | "observing"
  | "extracting"
  | "diagnosing"
  | "error"
  | "done";

export interface SessionState {
  phase: SessionPhase;
  /** 已执行的步数 */
  steps: number;
  /** 当前页面 URL */
  url?: string;
  /** 最近一次快照 */
  lastSnapshotRef?: string;
  /** 最近一次动作结果 */
  lastAction?: string;
  /** 会话开始时间 */
  startedAt: number;
  /** 错误信息（若处于 error 阶段） */
  error?: string;
}

export class SessionMachine {
  private state: SessionState;

  constructor() {
    this.state = {
      phase: "idle",
      steps: 0,
      startedAt: Date.now(),
    };
  }

  get snapshot(): Readonly<SessionState> {
    return this.state;
  }

  transition(next: SessionPhase, patch?: Partial<SessionState>) {
    this.state = {
      ...this.state,
      ...patch,
      phase: next,
    };
    if (next === "acting" || next === "navigating" || next === "observing" || next === "extracting") {
      this.state.steps += 1;
    }
  }

  setUrl(url: string) {
    this.state.url = url;
  }

  setError(error: string) {
    this.state.error = error;
    this.state.phase = "error";
  }

  /** 重置会话（供下一轮复用同一浏览器实例） */
  reset() {
    this.state = {
      phase: "idle",
      steps: 0,
      startedAt: Date.now(),
    };
  }
}
