/**
 * 底层浏览器引擎抽象接口
 *
 * 通过该接口解耦上层 AI 逻辑与底层实现（Playwright / CDP 双引擎）。
 * 这样可保留 Playwright MCP 的协议能力，同时引入 Chrome DevTools MCP 的 CDP 直连调试能力。
 */
import type { UnifiedAction, ActionResult } from "./actions.js";
import type { PageSnapshot, SnapshotOptions } from "./snapshot.js";
import type { DiagnosticRef } from "./actions.js";

/** 调试诊断采集结果（来自 diagnosis 中心） */
export interface DiagnosticReport {
  console: DiagnosticRef[];
  network: DiagnosticRef[];
  performance: DiagnosticRef[];
  jsExceptions: DiagnosticRef[];
}

/** 底层引擎统一接口 */
export interface BrowserEngine {
  /** 引擎名称 */
  readonly name: string;
  /** 初始化（连接浏览器/启动） */
  init(): Promise<void>;
  /** 关闭/断开 */
  close(): Promise<void>;
  /** 执行统一动作 */
  execute(action: UnifiedAction): Promise<ActionResult>;
  /** 生成页面快照 */
  snapshot(options?: SnapshotOptions): Promise<PageSnapshot>;
  /** 采集调试诊断数据 */
  diagnose(): Promise<DiagnosticReport>;
  /** 捕获控制台消息 */
  collectConsole(): Promise<DiagnosticRef[]>;
  /** 捕获网络请求/失败 */
  collectNetwork(): Promise<DiagnosticRef[]>;
  /** 注入并执行 JS（诊断/评估用） */
  evaluate(script: string): Promise<unknown>;
}

/** 引擎工厂：根据配置选择底层驱动 */
export type EngineFactory = () => BrowserEngine;
