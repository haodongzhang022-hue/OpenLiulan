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
    if (!step.nonFatal && !s.ok) break; // 致命步骤失败即终止
  }

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  const ok = failed === 0;

  const report = [
    `# Forge CI 冒烟检查 ${ok ? "✅ 通过" : "❌ 存在失败"}`,
    `通过 ${passed} / 失败 ${failed}`,
    ...steps.map(
      (s) => `- [${s.ok ? "✓" : "✗"}] ${s.action}: ${s.summary}${s.diagnostics ? `\n  ${s.diagnostics}` : ""}`
    ),
  ].join("\n");

  if (cfg.persistArtifacts) {
    const reportFile = path.join(artifactDir, "report.md");
    fs.writeFileSync(reportFile, report);
    artifacts.push(reportFile);
  }

  return { ok, passed, failed, steps, artifacts, report };
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
