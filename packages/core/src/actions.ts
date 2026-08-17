/**
 * 统一动作模型 (Unified Action Model)
 *
 * 融合四个项目的动作语义，抽象成一套 AI 可直接使用的规范动作。
 * - 语义命名（供 AI 理解，借鉴 Browser-Use）
 * - 精确参数（供底层精确执行，借鉴 Stagehand/Playwright）
 */
import { z } from "zod";

/** 基础动作定义 */
export const BaseActionSchema = z.object({
  /** 动作类型 */
  type: z.enum([
    "navigate",
    "click",
    "fill",
    "type",
    "select",
    "hover",
    "scroll",
    "press",
    "wait",
    "screenshot",
    "evaluate",
    "assert",
    "extract",
    "snapshot",
  ]),
  /** 动作用途描述（供 AI / 日志 / 回放） */
  description: z.string().optional(),
  /** 语义目标（自然语言，供 AI 层解析） */
  intent: z.string().optional(),
  /** 是否等待动作稳定后再返回 */
  waitUntilStable: z.boolean().default(true),
});

/** 导航动作 */
export const NavigateActionSchema = BaseActionSchema.extend({
  type: z.literal("navigate"),
  url: z.string().url(),
  /** 等待网络空闲 */
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle", "commit"])
    .default("networkidle"),
});

/** 点击动作：支持多种定位策略 */
export const ClickActionSchema = BaseActionSchema.extend({
  type: z.literal("click"),
  // 定位方式（按优先级尝试）
  selector: z.string().optional(),
  // 语义目标文本（借鉴 Browser-Use，用文本定位）
  text: z.string().optional(),
  // AI 从快照中返回的 ref（高效精确定位，借鉴 Stagehand XPath / AI locator）
  ref: z.string().optional(),
  // AI 返回的语义定位描述
  semantic: z.string().optional(),
  /** 点击按钮 */
  button: z.enum(["left", "right", "middle"]).default("left"),
  /** 点击次数 */
  clickCount: z.number().int().min(1).max(3).default(1),
  /** 强制忽略可操作性检查 */
  force: z.boolean().default(false),
  /** 点击后是否等待页面导航稳定（点击链接触发跳转时，等待新页面加载完成再返回）。
   *  默认 true，确保 AI 点击跳转后读到的是稳定后的页面，而非旧页面。 */
  waitForNavigation: z.boolean().default(true),
});

/** 输入动作 */
export const FillActionSchema = BaseActionSchema.extend({
  type: z.literal("fill"),
  selector: z.string().optional(),
  text: z.string().optional(),
  ref: z.string().optional(),
  semantic: z.string().optional(),
  value: z.string(),
  /** 输入模式：fill 即时填充 / type 逐键模拟 */
});

/** 提取动作 */
export const ExtractActionSchema = BaseActionSchema.extend({
  type: z.literal("extract"),
  selector: z.string().optional(),
  text: z.string().optional(),
  ref: z.string().optional(),
  semantic: z.string().optional(),
  /** 结构化提取的 schema 描述 */
  schema: z.record(z.string(), z.any()).optional(),
});

/** 断言动作 */
export const AssertActionSchema = BaseActionSchema.extend({
  type: z.literal("assert"),
  selector: z.string().optional(),
  text: z.string().optional(),
  ref: z.string().optional(),
  semantic: z.string().optional(),
  /** 断言方式 */
  mode: z
    .enum(["visible", "exists", "hidden", "text-contains", "value-equals", "enabled"])
    .default("visible"),
  expected: z.string().optional(),
});

/** 截图动作 */
export const ScreenshotActionSchema = BaseActionSchema.extend({
  type: z.literal("screenshot"),
  fullPage: z.boolean().default(false),
  /** 截图区域（可选，用于调试定位） */
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

/** 悬停动作 */
export const HoverActionSchema = BaseActionSchema.extend({
  type: z.literal("hover"),
  selector: z.string().optional(),
  text: z.string().optional(),
  ref: z.string().optional(),
  semantic: z.string().optional(),
});

/** 滚动动作 */
export const ScrollActionSchema = BaseActionSchema.extend({
  type: z.literal("scroll"),
  deltaX: z.number().default(0),
  deltaY: z.number().default(600),
});

/** 等待动作 */
export const WaitActionSchema = BaseActionSchema.extend({
  type: z.literal("wait"),
  ms: z.number().int().min(0).default(1000),
});

/** JS 执行动作（高级诊断） */
export const EvaluateActionSchema = BaseActionSchema.extend({
  type: z.literal("evaluate"),
  script: z.string(),
});

/** 按键动作 */
export const PressActionSchema = BaseActionSchema.extend({
  type: z.literal("press"),
  key: z.string(),
});

/** 逐键输入动作 */
export const TypeActionSchema = BaseActionSchema.extend({
  type: z.literal("type"),
  selector: z.string().optional(),
  text: z.string().optional(),
  ref: z.string().optional(),
  value: z.string(),
  delay: z.number().int().min(0).default(0),
});

/** 下拉选择动作 */
export const SelectActionSchema = BaseActionSchema.extend({
  type: z.literal("select"),
  selector: z.string().optional(),
  ref: z.string().optional(),
  value: z.string(),
});

/** 统一动作联合 */
export const UnifiedActionSchema = z.discriminatedUnion("type", [
  NavigateActionSchema,
  ClickActionSchema,
  FillActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  HoverActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  EvaluateActionSchema,
  PressActionSchema,
  ExtractActionSchema,
  AssertActionSchema,
  ScreenshotActionSchema,
]);

export type UnifiedAction = z.infer<typeof UnifiedActionSchema>;
export type ActionType = UnifiedAction["type"];

/** 动作执行结果 */
export interface ActionResult {
  ok: boolean;
  type: ActionType;
  /** 人类可读的结果（供 AI / 日志） */
  summary: string;
  /** 结构化数据（提取/快照用） */
  data?: unknown;
  /** 调试诊断信息（链接到 diagnosis 中心） */
  diagnostics?: DiagnosticRef[];
  /** 耗时 */
  durationMs: number;
  /** 出错时的错误信息 */
  error?: string;
  /** 执行后的页面快照引用 */
  snapshotRef?: string;
}

/** 诊断引用：把结果关联到 5 星调试诊断中心 */
export interface DiagnosticRef {
  kind: "console" | "network" | "dom" | "performance" | "js-exception" | "accessibility";
  severity: "info" | "warning" | "error";
  message: string;
  /** 可展开的详情（如 stack、requestId） */
  detail?: unknown;
  /** 时间戳 */
  timestamp: number;
}
