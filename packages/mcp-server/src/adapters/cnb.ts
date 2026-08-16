/**
 * cnb.cool 适配（增强版）
 *
 * cnb.cool 是 CNB 开源平台。CodeBuddy 等 AI 助手可通过本适配器
 * 把 Forge 能力接入 cnb.cool 生态，实现「AI 辅助控制页面」。
 *
 * 适配策略（从「能用」升级为「增强」）：
 * 1. 传输层：MCP stdio 服务（供 cnb 的 MCP 客户端连接）+ HTTP 服务（webhook / 远程）。
 * 2. **CI/Pipeline 模式**（`--ci`）：这是相对「裸 HTTP」的核心增强。
 *    让 Forge 作为 `.cnb.yml` 里的一个 step 在 cnb 云端构建机中运行——
 *    启动 headless 浏览器 → 按断言脚本操作 → 把截图/诊断落盘为 CI 制品，
 *    实现「浏览器自动化冒烟测试/验收」直接内嵌进 cnb.cool 的 CI/CD。
 * 3. **知识库增强**：CNB 独有的「仓库知识库」能力——把仓库文档/知识片段
 *    注入到工具描述与诊断建议里，让 AI 决策天然带上项目语境（单靠裸工具
 *    做不到这一点）。
 * 4. **制品/反馈回写**：把运行结果（截图、诊断报告）写为 CI 制品或 PR 评论，
 *    形成「跑完即留痕」的闭环。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ForgeMcp } from "../forge-mcp.js";
import type { ToolResult } from "../tools.js";
import { RepeatErrorRegistry, matchSolution, SolutionRepository, type SolutionMatch } from "../solutions.js";

/**
 * 供 cnb 端封装为独立进程的 stdio MCP 服务入口。
 * 返回一个函数，读取 stdin 逐行（JSON-RPC over stdio 简化版）。
 */
export function createCnbStdioServer(mcp: ForgeMcp) {
  return function start() {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    process.stdin.on("data", async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          await handleMessage(mcp, msg);
        } catch (e) {
          // 忽略无法解析的行
        }
      }
    });
    process.stdin.on("end", async () => {
      await mcp.shutdown();
      process.exit(0);
    });
  };
}

async function handleMessage(mcp: ForgeMcp, msg: any) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "browser-ai-forge", version: "0.1.0" },
    });
    return;
  }
  if (method === "tools/list") {
    respond(id, { tools: mcp.tools });
    return;
  }
  if (method === "tools/call") {
    try {
      const result: ToolResult = await mcp.callTool(params.name, params.arguments || {});
      respond(id, {
        content: result.content,
        isError: result.isError,
        structured: result.structured,
      });
    } catch (e) {
      respond(id, { content: [{ type: "text", text: String(e) }], isError: true });
    }
    return;
  }
  if (method === "notifications/initialized") {
    return;
  }
  // 其他方法
  respond(id, { error: { code: -32601, message: `Method not found: ${method}` } });
}

function respond(id: any, result: any) {
  if (id === undefined || id === null) return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

/**
 * HTTP 服务：把 Forge 能力暴露为 REST API，供 cnb 的 webhook / 远程调用。
 * 返回 Node http server 实例。
 */
export function createCnbHttpServer(mcp: ForgeMcp, port = 8787) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", tools: mcp.tools.map((t) => t.name) }));
        return;
      }
      if (req.method === "POST" && req.url === "/tools/call") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const { name, arguments: args } = JSON.parse(body || "{}");
        const result = await mcp.callTool(name, args || {});
        res.writeHead(result.isError ? 500 : 200);
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(e) }));
    }
  });

  server.listen(port);
  return server;
}

/* ===================== CNB-native 增强 ===================== */

/** 一次 CNB CI 冒烟检查步骤 */
export interface CiCheckStep {
  /** 动作类型（与 MCP 工具对齐：navigate/click/fill/assert/screenshot 等） */
  action: string;
  /** 动作参数 */
  args: Record<string, unknown>;
  /** 该步骤失败是否允许继续（默认 true） */
  nonFatal?: boolean;
  /** 失败时是否采集诊断（默认 true） */
  diagnoseOnFail?: boolean;
}

/** CNB CI/Pipeline 冒烟检查配置 */
export interface CiCheckConfig {
  /** 步骤列表 */
  steps: CiCheckStep[];
  /** 制品输出目录（默认 ./forge-artifacts），落盘截图与诊断报告 */
  artifactDir?: string;
  /** 是否把截图等制品作为 CI artifact 保留 */
  persistArtifacts?: boolean;
  /**
   * 可成长解决方案库文件路径（可选）。
   * 提供后，CI 内错误匹配使用「内置 playbook + 该持久化库」的仓库进行匹配；
   * 未命中的新错误会被记录为候选，方案库可随 CI 沉淀/导出，实现在线库成长。
   */
  solutionRepoFile?: string;
}

/** 单步执行结果 */
export interface CiStepResult {
  action: string;
  ok: boolean;
  summary: string;
  diagnostics?: string;
}

/** CNB CI 检查汇总 */
export interface CiCheckResult {
  ok: boolean;
  passed: number;
  failed: number;
  steps: CiStepResult[];
  /** 生成的制品清单 */
  artifacts: string[];
  /** 聚合诊断文本（供 PR 评论 / 制品） */
  report: string;
  /** 错误自动匹配触发的解决方案（二次同类错误后） */
  solutions?: SolutionMatch[];
}

/**
 * CNB CI/Pipeline 冒烟检查执行器。
 *
 * 让 Forge 作为 `.cnb.yml` 里的一个 step 在 cnb 云端构建机中运行：
 * 按步骤驱动真实浏览器（headless），失败自动诊断，并把截图/诊断报告
 * 落盘为 CI 制品——这是「单靠 HTTP 接口做不到」的端到端验收能力。
 */
export async function runCiCheck(mcp: ForgeMcp, cfg: CiCheckConfig): Promise<CiCheckResult> {
  const artifactDir = cfg.artifactDir ?? "./forge-artifacts";
  const steps: CiStepResult[] = [];
  const artifacts: string[] = [];
  const solutions: SolutionMatch[] = [];
  // CI 内启用错误自动匹配解决方案（同指纹错误 2 次才推荐）
  // 若提供 solutionRepoFile，使用可成长的解决方案仓库（内置 + 沉淀库合并匹配）
  const registry = new RepeatErrorRegistry();
  const repo = cfg.solutionRepoFile ? new SolutionRepository(cfg.solutionRepoFile) : undefined;
  const useRepo = !!repo;

  if (cfg.persistArtifacts) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  for (const step of cfg.steps) {
    const result = await mcp.callTool(step.action, step.args);
    const s: CiStepResult = {
      action: step.action,
      ok: result.ok,
      summary: result.content?.[0]?.text ?? "",
    };

    // 失败即诊断，并把诊断文本与制品一起保留
    if (!result.ok && step.diagnoseOnFail !== false) {
      const diag = await mcp.callTool("diagnose", {});
      s.diagnostics = diag.content?.[0]?.text;
      // 错误自动匹配解决方案：同类问题第 2 次出现时推荐方案
      // 若配置了可成长方案库，用「内置 + 沉淀」仓库匹配并记录新错误候选
      const errorText = `${s.diagnostics ?? ""}\n${s.summary}`;
      const match = useRepo && repo
        ? repo.match(registry, errorText)
        : matchSolution(registry, errorText);
      if (match.triggered) {
        solutions.push(match);
        if (match.advice) s.diagnostics = `${s.diagnostics ?? ""}\n---\n${match.advice}`;
      }
    }

    // 截图类结果落盘为制品（CNB CI 可将其作为构建产物收集）
    if (step.action === "screenshot" && cfg.persistArtifacts && result.structured?.image) {
      const b64 = String(result.structured.image).replace(/^data:image\/png;base64,/, "");
      const file = path.join(artifactDir, `step-${steps.length + 1}.png`);
      fs.writeFileSync(file, Buffer.from(b64, "base64"));
      artifacts.push(file);
      s.summary += ` (制品: ${file})`;
    }

    steps.push(s);
    // 非致命步骤（nonFatal 默认 true，即默认允许继续）失败不终止，
    // 让后续步骤有机会继续（例如同类错误二次触发解决方案）。
    if (step.nonFatal === false && !s.ok) break; // 仅当显式 nonFatal:false 才致命失败即终止
  }

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  const ok = failed === 0;

  // 若使用可成长方案库，CI 结束后持久化沉淀的新错误候选（成长不丢失）
  if (useRepo && repo) {
    repo.persist();
  }

  const report = [
    `# Forge CI 冒烟检查 ${ok ? "✅ 通过" : "❌ 存在失败"}`,
    `通过 ${passed} / 失败 ${failed}`,
    ...(useRepo && repo
      ? [`**方案库**: 内置 8 条 + 沉淀 ${repo.customCount} 条（${repo.entries.length} 条）`]
      : []),
    ...steps.map(
      (s) => `- [${s.ok ? "✓" : "✗"}] ${s.action}: ${s.summary}${s.diagnostics ? `\n  ${s.diagnostics}` : ""}`
    ),
    // 错误自动匹配解决方案汇总（同类问题第 2 次触发）
    ...(solutions.length
      ? ["", `## 自动匹配的解决方案（${solutions.length} 条）`, ...solutions.map((m) => m.advice).filter(Boolean)]
      : []),
  ].join("\n");

  if (cfg.persistArtifacts) {
    const reportFile = path.join(artifactDir, "report.md");
    fs.writeFileSync(reportFile, report);
    artifacts.push(reportFile);
  }

  return { ok, passed, failed, steps, artifacts, report, solutions };
}

/**
 * CNB 仓库知识库增强。
 *
 * CNB 独有的「仓库知识库」能力：把仓库文档/知识片段注入工具上下文，
 * 让 AI 决策天然带上项目语境（URL 约定、测试账号、页面结构等）。
 * 这里接收预先检索到的知识片段，并组装成一段可注入 system prompt 的上下文。
 */
export function buildKnowledgeContext(knowledge: Array<{ title: string; snippet: string; source?: string }>): string {
  if (!knowledge.length) return "";
  const lines = [
    "## CNB 仓库知识库（项目语境，请据此决策）",
    ...knowledge.map((k) => `- **${k.title}**${k.source ? `（来源: ${k.source}）` : ""}: ${k.snippet}`),
  ];
  return lines.join("\n");
}

/**
 * 生成 PR 评论 markdown（供回写 cnb.cool PR，留痕运行结果）。
 */
export function toPrComment(result: CiCheckResult): string {
  return [
    result.report,
    "",
    "---",
    `_由 Browser AI Forge 自动生成 | 制品 ${result.artifacts.length} 个 | 耗时见 CI 日志_`,
  ].join("\n");
}

/* ===================== CNB 调试会话（cnb.cool + harness + 自定义接口） ===================== */

/**
 * 调试反馈接口：把结构化的调试报告交给「谁」去解决。
 *
 * 允许用户选择调试的负责方：
 * - `"developer-ai"`：交给开发 AI（CodeBuddy/cnb.cool）结合代码全局视角修复。
 *   Agent 只负责控制与观察，反馈结构化调试发现（report 模式）。
 * - `"agent"`：由本 Agent 负责完整调试（debug 模式），自动诊断/自愈/自校验。
 * - 自定义：传入任意对象，将报告通过你的 channel 送达（webhook / PR 评论等）。
 */
export type DebugOwner =
  | "developer-ai"
  | "agent"
  | { channel: "pr-comment" | "webhook" | "file"; target?: string };

/** 调试会话配置 */
export interface DebugSessionConfig {
  /** 调试目标描述（如：'点击登录后页面报错，请排查'） */
  goal: string;
  /** 入口 URL */
  url: string;
  /** 调试负责方：交给开发 AI / 由本 Agent 调试 / 自定义投递 */
  owner?: DebugOwner;
  /** 结构化调试报告落盘路径（可选，供 CI 制品收集） */
  reportFile?: string;
  /** 是否截图留痕（report 模式默认 true） */
  screenshot?: boolean;
}

/**
 * CNB 调试会话执行器。
 *
 * 这是「cnb.cool + deepseek harness + 自定义接口」的编排入口：
 * 1. 启动 headless 浏览器（ForgeMcp）；
 * 2. 导航到目标 URL；
 * 3. 采集结构化调试报告（控制台/网络/JS 异常/DOM 状态/截图）；
 * 4. 按 owner 决定把报告投递给开发 AI（PR 评论/文件/控制台）。
 *
 * 核心价值：让「开发 AI」拿到的不再是猜测，而是**直接观察到的、可行动的**
 * 一手调试信息——因为浏览器就在眼前，能看到真实报错、网络、DOM。
 */
export async function runDebugSession(mcp: ForgeMcp, cfg: DebugSessionConfig): Promise<DebugReport> {
  const owner = cfg.owner ?? "developer-ai";

  // 1. 导航到目标
  const nav = await mcp.callTool("act", { type: "navigate", url: cfg.url });
  const navResult = nav.content?.[0]?.text ?? "";

  // 2. 观察快照（获取 DOM 上下文）
  const observe = await mcp.callTool("observe", { maxNodes: 200, maxTextLength: 80 });
  const snapshotContext = observe.content?.[0]?.text ?? "";

  // 3. 采集 5 星诊断
  const diag = await mcp.callTool("diagnose", {});
  const diagText = (diag.content?.[0]?.text ?? "").toString();

  // 4. 可选截图留痕
  let screenshotB64: string | undefined;
  if (cfg.screenshot) {
    const shot = await mcp.callTool("screenshot", { fullPage: false });
    screenshotB64 = (shot.structured?.image as string)?.replace(/^data:image\/png;base64,/, "");
  }

  // 5. 结构化调试发现（把诊断文本转成可行动发现）
  const findings = parseDiagnosisText(diagText);
  if (!navResult.includes("已导航到") || !observe.ok) {
    findings.unshift({
      category: "dom",
      severity: "error",
      message: navResult || "导航/观察失败",
      suggestion: "检查 URL 是否可访问、是否有重定向或需要登录、网络是否可用",
    });
  }

  // 6. 生成报告
  const ok = findings.filter((f) => f.severity === "error").length === 0;
  const report: DebugReport = {
    goal: cfg.goal,
    url: cfg.url,
    ok,
    findings,
    timeline: [
      { step: 1, action: "navigate", ok: nav.ok, summary: navResult.slice(0, 200) },
      { step: 2, action: "observe", ok: observe.ok, summary: `快照: ${snapshotContext.slice(0, 120)}` },
      { step: 3, action: "diagnose", ok: diag.ok, summary: diagText.slice(0, 200) },
      ...(screenshotB64 ? [{ step: 4, action: "screenshot", ok: true, summary: "截图已采集" }] : []),
    ],
    snapshotContext: snapshotContext.slice(0, 1500),
    markdown: buildSessionMarkdown(cfg, ok, findings, snapshotContext, screenshotB64),
  };

  // 7. 按 owner 投递
  if (owner === "developer-ai") {
    // 交给开发 AI：报告以 markdown 形式输出，供 CodeBuddy 在 PR/Issue 中消费
    await deliverToDeveloperAI(cfg, report, screenshotB64);
  } else if (owner === "agent") {
    // 本 Agent 负责调试：调用 runAgentLoop（debug 模式）自动排障
    // 这里通过抛出 report，让上层 harness 决定是否继续自愈
    report.markdown += "\n\n> 提示：owner=agent，可继续调用 runAgentLoop 进行自愈排障。";
  } else if (owner.channel) {
    // 自定义投递：PR 评论 / 文件 / webhook
    await deliverCustom(owner, report, screenshotB64);
  }

  return report;
}

/** 解析诊断文本为结构化发现 */
export function parseDiagnosisText(diagText: string): DebugFinding[] {
  const findings: DebugFinding[] = [];
  if (!diagText || diagText.includes("未发现错误")) return findings;

  const consoleRe = /控制台有 (\d+) 条错误/;
  const m = diagText.match(consoleRe);
  if (m) {
    findings.push({
      category: "console",
      severity: "error",
      message: `控制台有 ${m[1]} 条错误`,
      suggestion: "检查 JS 异常堆栈与资源加载，定位未捕获异常或 404/500 资源",
    });
  }
  if (/页面抛出了 JS 未捕获异常/.test(diagText)) {
    findings.push({
      category: "js-exception",
      severity: "error",
      message: "页面抛出了 JS 未捕获异常",
      suggestion: "展开异常堆栈，定位 throw / 未定义变量 / 异步未 catch 的位置",
    });
  }
  const netRe = /网络存在 (\d+) 个失败请求/;
  const nm = diagText.match(netRe);
  if (nm) {
    findings.push({
      category: "network",
      severity: "error",
      message: `网络存在 ${nm[1]} 个失败请求`,
      suggestion: "检查请求 URL 的 404/500 或 CORS 跨域，核对接口路径与后端",
    });
  }
  const slowRe = /存在 (\d+) 个慢请求/;
  const sm = diagText.match(slowRe);
  if (sm) {
    findings.push({
      category: "performance",
      severity: "warning",
      message: `存在 ${sm[1]} 个慢请求(>3s)`,
      suggestion: "检查后端接口响应或资源加载，考虑缓存/CDN",
    });
  }
  const ttfbRe = /TTFB 偏高: (\d+)ms/;
  const tm = diagText.match(ttfbRe);
  if (tm) {
    findings.push({
      category: "performance",
      severity: "warning",
      message: `TTFB 偏高: ${tm[1]}ms`,
      suggestion: "服务端响应慢，排查后端处理与网络链路",
    });
  }
  return findings;
}

/** 生成会话 markdown 报告 */
export function buildSessionMarkdown(
  cfg: DebugSessionConfig,
  ok: boolean,
  findings: DebugFinding[],
  snapshotContext: string,
  screenshotB64?: string
): string {
  const lines = [
    `# Forge 调试会话报告`,
    `**目标**: ${cfg.goal}`,
    `**URL**: ${cfg.url}`,
    `**结果**: ${ok ? "✅ 页面健康" : "❌ 存在错误，建议修复"}`,
    "",
    `## 结构化发现 (${findings.length})`,
    ...(findings.length
      ? findings.map((f) => `- [${f.category}/${f.severity}] ${f.message}\n  > 建议: ${f.suggestion}`)
      : ["- 未发现明确问题，页面运行正常"]),
    "",
    `## 页面快照`,
    "```",
    snapshotContext.slice(0, 1000),
    "```",
  ];
  if (screenshotB64) {
    lines.push("", "![页面截图](./forge-debug-screenshot.png)");
  }
  lines.push("", "---", "_由 Browser AI Forge 调试会话生成_", `_Owner: ${cfg.owner ?? "developer-ai"}_`);
  return lines.join("\n");
}

/** 交给开发 AI：把报告写为文件 / 控制台输出（供 cnb.cool CodeBuddy 消费） */
async function deliverToDeveloperAI(cfg: DebugSessionConfig, report: DebugReport, screenshotB64?: string): Promise<void> {
  const file = cfg.reportFile ?? "./forge-debug-report.md";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, report.markdown);
  if (screenshotB64 && cfg.reportFile) {
    const png = path.join(path.dirname(file), "forge-debug-screenshot.png");
    fs.writeFileSync(png, Buffer.from(screenshotB64, "base64"));
  }
  // 控制台输出 markdown，供上层 harness / cnb 捕获
  process.stdout.write(report.markdown + "\n");
}

/** 自定义投递：PR 评论 / 文件 / webhook */
async function deliverCustom(owner: { channel: string; target?: string }, report: DebugReport, screenshotB64?: string): Promise<void> {
  const { channel, target } = owner as { channel: string; target?: string };
  if (channel === "pr-comment") {
    // 生成可粘贴到 cnb.cool PR 的评论文本（通过 cnb CLI 或外部调用）
    process.stdout.write("\n---\nPR_COMMENT_START\n" + report.markdown + "\nPR_COMMENT_END\n");
  } else if (channel === "file") {
    const file = target ?? "./forge-debug-report.md";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, report.markdown);
    if (screenshotB64) {
      const png = target ? path.join(path.dirname(target), "forge-debug-screenshot.png") : "./forge-debug-screenshot.png";
      fs.writeFileSync(png, Buffer.from(screenshotB64, "base64"));
    }
  } else if (channel === "webhook") {
    // 简化：POST 到 target URL（需外部实现真实 webhook）
    if (target) {
      try {
        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: report.markdown, findings: report.findings }),
        });
        process.stdout.write(`webhook 已投递: ${res.status}\n`);
      } catch (e) {
        process.stderr.write(`webhook 投递失败: ${String(e)}\n`);
      }
    }
  }
}

/** DebugReport 类型（从 harness 导入） */
type DebugReport = {
  goal: string;
  url: string;
  ok: boolean;
  findings: DebugFinding[];
  timeline: Array<{ step: number; action: string; ok: boolean; summary: string }>;
  snapshotContext?: string;
  markdown: string;
};

type DebugFinding = {
  category: "console" | "network" | "js-exception" | "performance" | "dom";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string;
  detail?: string;
};
