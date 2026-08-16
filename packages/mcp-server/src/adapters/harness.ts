/**
 * deepseek harness 适配
 *
 * deepseek harness 是 deepseek 推出的 agent harness（工具调用环境）。
 * 本适配器把 Forge 的 MCP 工具映射为 harness 可调用的函数集合。
 *
 * 适配策略：harness 通常通过 JSON 工具函数调用，因此这里提供一个
 * 轻量的函数式接口，供 harness 的 tool_loop 直接注册使用。
 */
import type { ForgeMcp } from "../forge-mcp.js";
import type { ToolResult } from "../tools.js";

export interface HarnessTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** 调用函数 */
  fn: (args: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * 把 ForgeMcp 转成 deepseek harness 可用的工具列表。
 * harness 端把这些工具注入 system prompt，并做 function calling。
 */
export function toHarnessTools(mcp: ForgeMcp): HarnessTool[] {
  return mcp.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: (t.inputSchema.properties || {}) as Record<string, unknown>,
    fn: (args) => mcp.callTool(t.name, args),
  }));
}

/**
 * 生成 harness 使用的工具声明（用于注入 system prompt / function calling schema）。
 * deepseek 使用 OpenAI 兼容的 function calling JSON Schema。
 */
export function buildHarnessFunctionSchemas(mcp: ForgeMcp) {
  return mcp.tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/** 简易 tool_loop 运行器：给定目标，依次执行（配合 harness 的规划） */
export async function runHarnessLoop(
  mcp: ForgeMcp,
  fn: (toolName: string, args: Record<string, unknown>) => Promise<string>
): Promise<void> {
  // 预留：harness 端通常自行管理循环，这里仅提供工具注册。
  // 通过 toHarnessTools / buildHarnessFunctionSchemas 接入。
  void mcp;
  void fn;
}
