/**
 * ForgeMCP —— MCP 服务处理器（协议无关）
 *
 * 内部实现工具分发逻辑。上层可用不同的传输层（stdio/HTTP/SSE）包装，
 * 使其可接入 deepseek harness、cnb.cool、Claude Desktop 等任意 MCP 客户端。
 */
import { ForgeBrowser } from "@browser-ai-forge/core";
import { PlaywrightEngine } from "@browser-ai-forge/engines";
import { DiagnosisCenter } from "@browser-ai-forge/diagnosis";
import { compactSnapshot } from "@browser-ai-forge/token";
import { TOOLS, okResult, errResult, type ToolResult, type McpToolSchema } from "./tools.js";

export interface ForgeMcpOptions {
  /** 无头模式 */
  headless?: boolean;
  /** CDP 连接地址 */
  connectUrl?: string;
}

export class ForgeMcp {
  readonly tools: McpToolSchema[] = TOOLS;
  private browser?: ForgeBrowser;
  private diagnosis?: DiagnosisCenter;

  constructor(private opts: ForgeMcpOptions = {}) {}

  /** 生命周期：确保浏览器已就绪 */
  private async ensureBrowser(): Promise<ForgeBrowser> {
    if (!this.browser) {
      const engine = new PlaywrightEngine({ headless: this.opts.headless ?? true, connectUrl: this.opts.connectUrl });
      this.browser = new ForgeBrowser(engine);
      await this.browser.start();
    }
    return this.browser;
  }

  /** 核心：分发工具调用 */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (name) {
        case "observe": {
          const b = await this.ensureBrowser();
          const snap = await b.observe({ maxNodes: (args.maxNodes as number) ?? 200, maxTextLength: (args.maxTextLength as number) ?? 80 });
          return okResult(compactSnapshot(snap), { url: snap.url, title: snap.title, stats: snap.stats });
        }

        case "act": {
          const b = await this.ensureBrowser();
          const action = this.normalizeAction(args);
          const result = await b.act(action as any);
          const lines = [`动作: ${result.type}`];
          if (result.ok) {
            lines.push(`✓ ${result.summary}`);
            if (result.diagnostics?.length) {
              lines.push(`⚠ 动作后检测到 ${result.diagnostics.length} 条页面异常:`);
              for (const d of result.diagnostics.slice(0, 5)) lines.push(`  - [${d.kind}] ${d.message}`);
            }
          } else {
            lines.push(`✗ ${result.summary}`);
          }
          lines.push(`耗时 ${result.durationMs}ms`);
          return result.ok ? okResult(lines.join("\n"), { data: result.data }) : errResult(lines.join("\n"));
        }

        case "diagnose": {
          const b = await this.ensureBrowser();
          const report = await b.captureDiagnostics();
          // 用 diagnosis 中心生成摘要（core 与 diagnosis 的报告类型已对齐，无需强转）
          const { summarize } = await import("@browser-ai-forge/diagnosis");
          const summary = summarize(report);
          const lines = [`# 诊断结果 (${summary.healthy ? "健康" : "存在问题"})`];
          if (summary.issues.length === 0) {
            lines.push("未发现错误，页面运行正常。");
          }
          for (const issue of summary.issues) {
            lines.push(`- [${issue.category}/${issue.severity}] ${issue.message}`);
          }
          if (summary.suggestions.length) {
            lines.push(`\n## 建议`);
            summary.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
          }
          return okResult(lines.join("\n"), {
            issues: summary.issues,
            console: report.console.length,
            network: report.network.length,
            dom: report.dom.length,
            jsExceptions: report.jsExceptions.length,
          });
        }

        case "eval": {
          const b = await this.ensureBrowser();
          const result = await b.eval(String(args.script));
          return okResult(`执行结果: ${JSON.stringify(result)?.slice(0, 2000)}`, { result });
        }

        case "screenshot": {
          const b = await this.ensureBrowser();
          const result = await b.act({ type: "screenshot", fullPage: !!args.fullPage } as any);
          const base64 = (result.data as any)?.base64;
          return okResult(result.summary, { image: `data:image/png;base64,${base64}` });
        }

        case "close": {
          if (this.browser) {
            await this.browser.stop();
            this.browser = undefined;
          }
          return okResult("浏览器已关闭");
        }

        default:
          return errResult(`未知工具: ${name}。可用工具: ${TOOLS.map((t) => t.name).join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errResult(`工具执行失败: ${msg}`);
    }
  }

  /** 把扁平参数规整为统一动作 */
  private normalizeAction(args: Record<string, unknown>): Record<string, unknown> {
    const type = String(args.type);
    const base = { type, description: args.description as string | undefined };
    // 只携带定位相关字段（避免把 undefined 塞入）
    const loc: Record<string, unknown> = {};
    if (args.ref) loc.ref = args.ref;
    if (args.selector) loc.selector = args.selector;
    if (args.text) loc.text = args.text;
    if (args.semantic) loc.semantic = args.semantic;

    const rest: Record<string, unknown> = {};
    for (const k of ["url", "value", "key", "ms", "script", "mode", "expected", "fullPage", "deltaY", "delay", "waitUntil"]) {
      if (args[k] !== undefined) rest[k] = args[k];
    }
    return { ...base, ...loc, ...rest };
  }

  /** 关闭（供传输层退出时调用） */
  async shutdown(): Promise<void> {
    if (this.browser) await this.browser.stop();
  }
}
