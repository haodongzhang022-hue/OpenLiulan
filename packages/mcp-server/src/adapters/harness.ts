/**
 * deepseek harness 适配（强化版）
 *
 * deepseek harness 是 deepseek 推出的 agent harness（工具调用环境），
 * 其核心优势在于：原生 function calling / tool_loop、多步规划与
 * 推理（thinking）能力、以及有状态会话。
 *
 * 适配策略（从「能用」升级为「强化」）：
 * 1. 轻量函数式接口：把 Forge MCP 工具映射为 harness 可调用的函数集合
 *    （供 harness 的 tool_loop 直接注册使用）。
 * 2. 原生 schema：输出 OpenAI 兼容的 function calling JSON Schema，
 *    注入 harness 的 tools / system prompt。
 * 3. **自愈 AgentLoop + 调试模式**：这是本框架相对「裸工具」的核心增强。
 *
 *    - **自带眼睛（全局视角）**：MCP 直接连接真实浏览器，能直接观察到
 *      DOM、控制台、网络、JS 异常等一手信息——不必像「开发 AI」那样
 *      隔着代码猜测。因此它的调试反馈是**可行动**的，不是猜测。
 *    - **双调试模式**：用户可指定 `mode`：
 *      - `"debug"`：由本 Agent 负责完整调试——自动诊断、生成修复建议、
 *        自愈重试、assert 自校验目标「真实达成」。
 *      - `"report"`：Agent 只负责**控制与观察**，把结构化的、可行动的
 *        调试报告反馈给开发 AI（CodeBuddy/cnb.cool），由开发 AI 决定修复。
 *        这是「控制与诊断分离」模式——最利于发挥开发 AI 的全局代码视角。
 *
 *    无论哪种模式，诊断信息都以**结构化、Token 高效、可行动**的形式
 *    输出，而不是一坨原始错误文本。这是「之前做不到的」。
 */
import type { ForgeMcp } from "../forge-mcp.js";
import type { ToolResult } from "../tools.js";
import { snapshotToPrompt } from "@openliulan/ai-layer";
import {
  RepeatErrorRegistry,
  matchSolution,
  renderAdvice,
  type SolutionMatch,
} from "../solutions.js";

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

/* =====================================================================
 * 调试模式 & 结构化调试报告
 * =================================================================== */

/**
 * AgentLoop 调试模式：
 * - "debug"：本 Agent 负责完整调试（自动诊断 → 自愈重试 → assert 自校验）
 * - "report"：Agent 只负责控制与观察，输出结构化调试报告供开发 AI 决策
 */
export type DebugMode = "debug" | "report";

/** 单条调试发现（结构化，供开发 AI 直接消费） */
export interface DebugFinding {
  category: "console" | "network" | "js-exception" | "performance" | "dom";
  severity: "error" | "warning" | "info";
  /** 人类可读信息 */
  message: string;
  /** 可行动的修复建议 */
  suggestion: string;
  /** 关联的堆栈 / URL / 请求详情（可选） */
  detail?: string;
}

/** 一次失败的诊断上下文（喂给 LLM 的自愈输入） */
export interface DiagnosisContext {
  /** 失败动作名 */
  action: string;
  /** 失败原始信息 */
  error: string;
  /** 结构化调试发现（供 debug 模式驱动自愈） */
  findings: DebugFinding[];
  /** 合并后的可行动诊断文本（喂给 LLM 决策） */
  feed: string;
}

/** 自愈诊断结果 */
export interface SelfHealDiagnosis {
  /** 是否有可用诊断发现 */
  hasFindings: boolean;
  /** 合并诊断文本 */
  text: string;
  /** 结构化发现（report 模式回传给开发 AI） */
  findings: DebugFinding[];
}

/** 调试报告（report 模式产物，供开发 AI 消费） */
export interface DebugReport {
  /** 目标描述 */
  goal: string;
  /** 会话 URL */
  url: string;
  /** 是否已达成 */
  ok: boolean;
  /** 结构化调试发现 */
  findings: DebugFinding[];
  /** 执行轨迹（actions 摘要） */
  timeline: Array<{ step: number; action: string; ok: boolean; summary: string }>;
  /** 观察到的最终快照片段（供开发 AI 理解当前 DOM 状态） */
  snapshotContext?: string;
  /** markdown 汇总（可回写 PR/制品） */
  markdown: string;
}

/**
 * 从 ToolResult 提取结构化调试发现。
 * Forge 的 act/observe/diagnose 结果里带 structured 数据或诊断引用，
 * 这里把它转成可行动、Token 高效的结构化发现。
 */
export function extractFindings(result: ToolResult): DebugFinding[] {
  const findings: DebugFinding[] = [];
  const text = (result.content?.[0]?.text ?? "").toString();

  // 从诊断文本中解析常见问题
  // 控制台错误
  const consoleRe = /控制台有 (\d+) 条错误/;
  const consoleMatch = text.match(consoleRe);
  if (consoleMatch) {
    findings.push({
      category: "console",
      severity: "error",
      message: `控制台有 ${consoleMatch[1]} 条 JS/资源错误`,
      suggestion: "检查对应 JS 异常堆栈与资源加载 URL，优先定位未捕获异常或 404/500 资源",
    });
  }

  // JS 异常
  if (/页面抛出了 JS 未捕获异常/.test(text)) {
    findings.push({
      category: "js-exception",
      severity: "error",
      message: "页面抛出了 JS 未捕获异常",
      suggestion: "展开异常堆栈（诊断报告 detail.stack），定位 throw / 未定义变量 / 异步未 catch 的位置",
    });
  }

  // 网络失败
  const netRe = /网络存在 (\d+) 个失败请求/;
  const netMatch = text.match(netRe);
  if (netMatch) {
    findings.push({
      category: "network",
      severity: "error",
      message: `网络存在 ${netMatch[1]} 个失败请求`,
      suggestion: "检查请求 URL 的 404/500 状态或 CORS/跨域阻断，核对接口路径与后端是否就绪",
    });
  }

  // 慢请求
  const slowRe = /存在 (\d+) 个慢请求/;
  const slowMatch = text.match(slowRe);
  if (slowMatch) {
    findings.push({
      category: "performance",
      severity: "warning",
      message: `存在 ${slowMatch[1]} 个慢请求(>3s)`,
      suggestion: "检查后端接口响应或资源加载，考虑缓存/CDN/减少请求体积",
    });
  }

  // TTFB 偏高
  const ttfbRe = /TTFB 偏高: (\d+)ms/;
  const ttfbMatch = text.match(ttfbRe);
  if (ttfbMatch) {
    findings.push({
      category: "performance",
      severity: "warning",
      message: `TTFB 偏高: ${ttfbMatch[1]}ms`,
      suggestion: "服务端响应慢，优先排查后端处理与网络链路",
    });
  }

  // 通用失败（action 级 error）
  if (!result.ok && result.isError) {
    findings.push({
      category: "dom",
      severity: "error",
      message: text.slice(0, 200),
      suggestion: "元素定位/动作执行失败，尝试切换定位策略（ref→selector→semantic）或等待元素就绪",
    });
  }

  return findings;
}

/**
 * 把诊断文本与发现组装成可行动的「自愈上下文」。
 * 让 LLM 看到的不再是「动作失败」，而是「为什么失败 + 建议 + 如何修」。
 */
export function buildSelfHealContext(
  failedAction: string,
  rawError: string,
  diagText: string,
  findings: DebugFinding[]
): SelfHealDiagnosis {
  const lines: string[] = [];
  lines.push(`[动作失败] ${failedAction}`);
  lines.push(`错误: ${rawError.slice(0, 300)}`);

  if (findings.length) {
    lines.push(`\n[结构化诊断发现 ${findings.length} 条]`);
    for (const f of findings) {
      lines.push(`- [${f.category}/${f.severity}] ${f.message}`);
      lines.push(`  建议: ${f.suggestion}`);
    }
  }

  // 原始诊断摘要（补充细节，不重复）
  if (diagText && !diagText.includes("未发现错误")) {
    const detailLines = diagText.split("\n").slice(0, 15);
    lines.push(`\n[诊断摘要]`);
    lines.push(detailLines.join("\n"));
  }

  lines.push(`\n[自愈指令] 基于以上诊断，修正定位/策略后重试动作 "${failedAction}"，`
    + `若诊断已暴露根因则直接给出修复动作，不要再重复原失败动作。`);

  return {
    hasFindings: findings.length > 0,
    text: lines.join("\n"),
    findings,
  };
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
  /** 调试模式：debug=Agent 负责调试，report=只反馈结构化报告供开发 AI */
  mode?: DebugMode;
  /** 目标描述（report 模式用于生成报告标题/上下文） */
  goal?: string;
  /** 目标自校验断言（可选）。传入后 AgentLoop 会用其结果判断「真实达成」 */
  verify?: (turns: AgentTurn[], mcp: ForgeMcp) => Promise<boolean> | boolean;
  /** 每次动作后若自动观察，是否把快照注入历史供 LLM 决策 */
  observeInContext?: boolean;
  /** 知识库上下文（CNB 仓库知识，注入决策上下文） */
  knowledgeContext?: string;
  /**
   * 整环超时（毫秒，默认 120_000）。防止 Agent 陷入死循环/长时间卡死。
   * 超时后以 stopReason="timeout" 终止。
   */
  timeoutMs?: number;
  /**
   * 是否启用「错误自动匹配解决方案」引擎（默认 true）。
   * 启用后，同指纹错误出现 2 次会自动推荐方案（简单→auto 直接修，复杂→guide 推思路）。
   */
  enableSolutionMatcher?: boolean;
  /** 复用外部的重复错误注册表（多轮可共用）；缺省内部自建 */
  solutionRegistry?: RepeatErrorRegistry;
}

/** AgentLoop 单步记录 */
export interface AgentTurn {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  result: ToolResult;
  /** 是否为自愈重试 */
  retry?: boolean;
  /** 本步是否有诊断反馈 */
  diagnosis?: string;
}

/** AgentLoop 结束原因 */
export type StopReason =
  | "goal-achieved"
  | "max-steps"
  | "too-many-retries"
  | "timeout"
  | "report-handoff";

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
  /** 调试模式 */
  mode: DebugMode;
  /** 结束原因（工程可观测性）：明确为何退出，避免死循环无解释 */
  stopReason: StopReason;
  /** 结构化调试报告（report 模式 / 任何模式都会生成，供开发 AI 消费） */
  report?: DebugReport;
  /** 错误自动匹配触发的解决方案（二次同类错误后） */
  solutions?: SolutionMatch[];
}

/**
 * 从执行历史生成结构化调试报告（供开发 AI 决策）。
 */
export function buildDebugReport(
  goal: string,
  url: string,
  turns: AgentTurn[],
  ok: boolean,
  snapshotContext?: string
): DebugReport {
  const findings: DebugFinding[] = [];
  const timeline: DebugReport["timeline"] = [];

  for (const t of turns) {
    timeline.push({
      step: t.step,
      action: t.tool,
      ok: t.result.ok,
      summary: t.result.content?.[0]?.text?.slice(0, 200) ?? "",
    });
    if (!t.result.ok) {
      const f = extractFindings(t.result);
      findings.push(...f);
    }
    // 把自愈阶段采集的诊断文本也转成结构化发现（report 模式关键信息源）
    if (t.diagnosis && !t.result.ok) {
      const diagFindings = extractFindings({
        ok: false,
        content: [{ type: "text", text: t.diagnosis }],
        isError: true,
      });
      findings.push(...diagFindings);
    }
  }

  const markdown = [
    `# 调试报告`,
    `**目标**: ${goal}`,
    `**URL**: ${url}`,
    `**结果**: ${ok ? "✅ 达成" : "❌ 未达成"}`,
    `**执行步数**: ${turns.length} | **失败动作**: ${turns.filter((t) => !t.result.ok).length}`,
    "",
    `## 结构化发现 (${findings.length})`,
    ...(findings.length
      ? findings.map((f) => `- [${f.category}/${f.severity}] ${f.message}\n  > 建议: ${f.suggestion}`)
      : ["- 未发现明确问题"]),
    "",
    `## 执行轨迹`,
    ...timeline.map((t) => `- ${t.step}. \`${t.action}\` ${t.ok ? "✅" : "❌"} ${t.summary.slice(0, 120)}`),
    "",
    snapshotContext ? `\n## 最终快照\n\`\`\`\n${snapshotContext.slice(0, 1500)}\n\`\`\`` : "",
  ].join("\n");

  return { goal, url, ok, findings, timeline, snapshotContext, markdown };
}

/**
 * 自愈 AgentLoop —— 把 deepseek harness 的原生规划能力
 * 与 Forge 的 5 星诊断能力闭环成「自动化排障代理」。
 *
 * 相比仅暴露裸工具的方案，这个循环能：
 * - 在动作失败时**主动采集诊断**并把「为什么失败 + 建议」喂回给 LLM，
 *   驱动其修正定位/策略（debug 模式）；
 * - 在 report 模式下，只**控制与观察**，把结构化调试报告回传给开发 AI，
 *   由开发 AI 结合代码全局视角做修复——「控制与诊断分离」；
 * - 通过可选 `verify` 断言自校验目标是否**真实达成**；
 * - 通过 `autoObserve` 让每步决策都基于最新、Token 高效、带 ref 的页面快照。
 */
export async function runAgentLoop(
  mcp: ForgeMcp,
  tools: HarnessTool[],
  opts: AgentLoopOptions
): Promise<AgentLoopResult> {
  const maxSteps = opts.maxSteps ?? 20;
  const maxRetries = opts.maxRetries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const mode: DebugMode = opts.mode ?? "debug";
  const goal = opts.goal ?? "";
  const turns: AgentTurn[] = [];
  let retries = 0;
  let usedDiagnosis = false;
  let lastSuccess: AgentTurn | undefined;
  let observedContext: string | undefined;
  let stopReason: StopReason = "max-steps";
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const started = Date.now();

  // 错误自动匹配解决方案引擎：同指纹错误出现 2 次才触发推荐（不多余也不困境）
  const enableSolutionMatcher = opts.enableSolutionMatcher ?? true;
  const solutionRegistry = opts.solutionRegistry ?? new RepeatErrorRegistry();
  const solutions: SolutionMatch[] = [];

  // 若提供了仓库知识库上下文，把它作为首条「项目语境」注入决策历史，
  // 让 LLM 的每一步决策都天然带上项目背景（URL 约定/测试账号/已知坑等）。
  if (opts.knowledgeContext) {
    turns.push({
      step: 0,
      tool: "system",
      args: {},
      result: { ok: true, content: [{ type: "text", text: opts.knowledgeContext }] },
    });
  }

  for (let step = 1; step <= maxSteps; step++) {
    // 整环超时：防止死循环
    if (Date.now() - started > timeoutMs) {
      stopReason = "timeout";
      break;
    }

    // 决策：让 deepseek harness 基于当前上下文选择下一步工具
    const decision = await opts.act(tools, turns);
    const tool = toolByName.get(decision.name);
    if (!tool) {
      turns.push({ step, tool: decision.name, args: decision.args, result: errTool("未知工具: " + decision.name) });
      continue;
    }

    let result = await tool.fn(decision.args);
    let retry = false;
    let diagnosisText: string | undefined;

    // 自愈闭环：若动作失败，采集诊断并把建议喂回给 LLM 让其修正后重试
    if (!result.ok && maxRetries > 0) {
      const diag = await mcp.callTool("diagnose", {});
      usedDiagnosis = true;
      const diagText = (diag.content?.[0]?.text ?? "").toString();
      const findings = extractFindings(result);
      const selfHeal = buildSelfHealContext(
        decision.name,
        result.content?.[0]?.text ?? result.isError ? "action failed" : "",
        diagText,
        findings
      );
      diagnosisText = selfHeal.text;

      // debug 模式：把诊断上下文注入 result，让 LLM 看到并驱动修正
      if (mode === "debug") {
        result = {
          ...result,
          content: [
            ...result.content,
            { type: "text", text: "\n[自愈诊断]\n" + selfHeal.text },
          ],
        };
      }
      // report 模式：保留诊断文本到 turn（用于生成报告），但不注入 result，
      // 让开发 AI 通过最终 report 拿到结构化的调试发现。

      // 错误自动匹配：同指纹错误第 2 次出现时推荐解决方案（auto 直接修 / guide 推思路）
      if (enableSolutionMatcher) {
        const match = matchSolution(
          solutionRegistry,
          `${diagText}\n${result.content?.[0]?.text ?? ""}`
        );
        if (match.triggered) {
          solutions.push(match);
          if (match.advice) {
            // 把推荐方案注入诊断上下文，让 LLM 拿到「没往这里想」的成熟解
            result = {
              ...result,
              content: [...result.content, { type: "text", text: "\n[解决方案推荐]\n" + match.advice }],
            };
          }
        }
      }
    }

    turns.push({ step, tool: decision.name, args: decision.args, result, retry, diagnosis: diagnosisText });
    if (result.ok) lastSuccess = turns[turns.length - 1];

    // autoObserve：让 Agent 拿到最新页面状态（注入决策上下文）
    if (opts.autoObserve && result.ok) {
      const snap = await mcp.callTool("observe", {
        maxNodes: opts.observeMaxNodes ?? 200,
        maxTextLength: opts.observeMaxTextLength ?? 80,
      });
      observedContext = (snap.content?.[0]?.text ?? "").toString();
      // 仅在 observeInContext 时把快照追加到最后 turn（供 LLM 决策历史）
      if (opts.observeInContext) {
        turns[turns.length - 1].result = {
          ...turns[turns.length - 1].result,
          content: [
            ...turns[turns.length - 1].result.content,
            { type: "text", text: "\n[当前页面快照]\n" + observedContext.slice(0, 800) },
          ],
        };
      }
    }

    // 达到目标或完成动作：Agent 通过 verify 自校验后返回
    // 注意：先 verify 再判断 close 退出，避免 close 抢先退出而未校验目标真实达成
    if (opts.verify && result.ok) {
      const verified = await opts.verify(turns, mcp);
      if (verified) {
        // 目标真实达成
        stopReason = "goal-achieved";
        break;
      }
      // verify 明确未达成：不以 close 抢占退出，继续让 LLM 推进（assert 自验收优先）
    } else if (result.ok && decision.name === "close") {
      stopReason = "goal-achieved";
      break;
    }

    // 失败重试计数 + 去重升级：
    // - 达到 maxRetries 即升级为「停止自动修复」（too-many-retries），避免死循环；
    // - report 模式只控制+反馈，失败即转交开发 AI（report-handoff），不自动修复。
    if (!result.ok) {
      retries++;
      if (mode === "report") {
        stopReason = "report-handoff";
        break;
      }
      if (retries > maxRetries) {
        stopReason = "too-many-retries";
        break;
      }
    }
  }

  // 自校验：用 verify（若有）判断真实达成；否则用「最近动作成功」判断
  // 若循环内已因 verify/close 达成而 break（stopReason=goal-achieved），则以之为准，避免重复 verify 产生不一致。
  let ok: boolean;
  if (stopReason === "goal-achieved") {
    ok = true;
  } else if (opts.verify) {
    try {
      ok = await opts.verify(turns, mcp);
    } catch {
      ok = false;
    }
  } else {
    ok = !!lastSuccess;
  }

  // 生成结构化调试报告
  const report = buildDebugReport(
    goal,
    observedContext?.match(/URL:\s*(\S+)/)?.[1] ?? "",
    turns,
    ok,
    observedContext
  );

  const reasonText =
    stopReason === "goal-achieved"
      ? "目标真实达成"
      : stopReason === "timeout"
        ? `整环超时(>${timeoutMs}ms)`
        : stopReason === "too-many-retries"
          ? "失败自愈重试次数已达上限"
          : stopReason === "report-handoff"
            ? "report 模式：已生成调试报告，交给开发 AI 决策"
            : `达到最大步数 ${maxSteps}`;

  const summary = ok
    ? `目标达成（${reasonText}，共 ${turns.length} 步）`
    : `未能达成目标（${reasonText}，执行 ${turns.length} 步，重试 ${retries} 次）`;

  return { ok, summary, turns, retries, usedDiagnosis, mode, stopReason, report, solutions };
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
