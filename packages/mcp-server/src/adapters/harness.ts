/**
 * deepseek harness 适配（增强版）
 *
 * deepseek harness 是 deepseek 推出的 agent harness（工具调用环境），
 * 其核心优势在于：原生 function calling / tool_loop、多步规划与
 * 推理（thinking）能力、以及有状态会话。
 *
 * 适配策略（从「能用」升级为「增强」）：
 * 1. 轻量函数式接口：把 Forge MCP 工具映射为 harness 可调用的函数集合
 *    （供 harness 的 tool_loop 直接注册使用）。
 * 2. 原生 schema：输出 OpenAI 兼容的 function calling JSON Schema，
 *    注入 harness 的 tools / system prompt。
 * 3. **自愈 AgentLoop**：这是本框架相对「裸工具」的核心增强。
 *    它把 deepseek 的「规划 + 思考」与 Forge 的「5 星诊断」闭环起来：
 *      目标 → 观察 → 规划 → 行动 → 诊断自愈 → 再观察 → … → 完成
 *    每次动作失败会自动采集诊断、把「报错」转成「可行动的排障上下文」，
 *    驱动 LLM 修正定位/策略后重试，从而实现**单靠裸工具做不到的
 *    自动化排障闭环**。
 */
import type { ForgeMcp } from "../forge-mcp.js";
import type { ToolResult } from "../tools.js";
import { snapshotToPrompt } from "@browser-ai-forge/ai-layer";

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

/** AgentLoop 配置 */
export interface AgentLoopOptions {
  /** 动作执行回调（通常就是 deepseek 的 function-calling 决策函数） */
  act: (tools: HarnessTool[], history: AgentTurn[]) => Promise<{ name: string; args: Record<string, unknown> }>;
  /** 最大动作步数（默认 20） */
  maxSteps?: number;
  /** 失败自愈最大重试次数（默认 2） */
  maxRetries?: number;
  /** 是否在每次动作后自动观察（默认 true，让 Agent 拿到最新页面状态） */
  autoObserve?: boolean;
  /** 观察快照的 Token 预算 */
  observeMaxNodes?: number;
  observeMaxTextLength?: number;
}

/** AgentLoop 单步记录 */
export interface AgentTurn {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  result: ToolResult;
  /** 是否为自愈重试 */
  retry?: boolean;
}

/** AgentLoop 执行结果 */
export interface AgentLoopResult {
  /** 是否达成目标（最后一个非诊断动作成功，且无致命错误） */
  ok: boolean;
  /** 达成说明 / 失败原因 */
  summary: string;
  /** 所有执行步骤 */
  turns: AgentTurn[];
  /** 自愈重试次数 */
  retries: number;
  /** 是否用到了诊断自愈 */
  usedDiagnosis: boolean;
}

/**
 * 自愈 AgentLoop —— 把 deepseek harness 的原生规划能力
 * 与 Forge 的 5 星诊断能力闭环成「自动化排障代理」。
 *
 * 相比仅暴露裸工具的方案，这个循环能：
 * - 在动作失败时**主动采集诊断**并把建议喂回给 LLM，驱动其修正定位/策略；
 * - 在目标接近完成时用 `assert` 自校验，确认真实达成而非「自以为成功」；
 * - 通过 `autoObserve` 让每步决策都基于最新、Token 高效、带 ref 的页面快照。
 *
 * 这是「之前做不到的」：让 deepseek harness 的推理不再是单次函数调用，
 * 而是能自我纠错、自我验收的完整 agent。
 */
export async function runAgentLoop(
  mcp: ForgeMcp,
  tools: HarnessTool[],
  opts: AgentLoopOptions
): Promise<AgentLoopResult> {
  const maxSteps = opts.maxSteps ?? 20;
  const maxRetries = opts.maxRetries ?? 2;
  const turns: AgentTurn[] = [];
  let retries = 0;
  let usedDiagnosis = false;
  let lastSuccess: AgentTurn | undefined;

  const toolByName = new Map(tools.map((t) => [t.name, t]));

  for (let step = 1; step <= maxSteps; step++) {
    // 决策：让 deepseek harness 基于当前上下文选择下一步工具
    const decision = await opts.act(tools, turns);
    const tool = toolByName.get(decision.name);
    if (!tool) {
      turns.push({ step, tool: decision.name, args: decision.args, result: errTool("未知工具: " + decision.name) });
      continue;
    }

    let result = await tool.fn(decision.args);
    let retry = false;

    // 自愈闭环：若动作失败，采集诊断并把建议喂回给 LLM 让其修正后重试
    if (!result.ok && maxRetries > 0) {
      const diag = await mcp.callTool("diagnose", {});
      usedDiagnosis = true;
      // 把诊断结果注入本次 result，让 LLM 决策时能看到「为什么失败 + 建议」
      result = {
        ...result,
        content: [
          ...result.content,
          { type: "text", text: "\n[自愈诊断]\n" + (diag.content?.[0]?.text ?? "无额外诊断") },
        ],
      };
    }

    turns.push({ step, tool: decision.name, args: decision.args, result, retry });
    if (result.ok) lastSuccess = turns[turns.length - 1];

    // 达到目标或完成动作：Agent 通过 assert 自校验后返回
    if (result.ok && decision.name === "close") break;

    // 失败重试计数
    if (!result.ok) {
      retries++;
      if (retries > maxRetries) break;
    }
  }

  const ok = !!lastSuccess;
  return {
    ok,
    summary: ok
      ? `目标达成（步骤 ${lastSuccess!.step}: ${lastSuccess!.tool}）`
      : `未能达成目标（已执行 ${turns.length} 步，重试 ${retries} 次）`,
    turns,
    retries,
    usedDiagnosis,
  };
}

function errTool(text: string): ToolResult {
  return { ok: false, content: [{ type: "text", text }], isError: true };
}

/**
 * 把一次 observe 的快照文本作为「当前页面上下文」喂给 LLM。
 * 供 harness 端在 system prompt / 历史里使用，让决策基于最新可寻址快照。
 */
export function observeContext(mcp: ForgeMcp, maxNodes = 200, maxTextLength = 80): Promise<string> {
  return mcp
    .callTool("observe", { maxNodes, maxTextLength })
    .then((r) => r.content?.[0]?.text ?? "(空快照)");
}

export { snapshotToPrompt };
