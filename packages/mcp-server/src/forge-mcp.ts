/**
 * ForgeMCP —— MCP 服务处理器（协议无关）
 *
 * 内部实现工具分发逻辑。上层可用不同的传输层（stdio/HTTP/SSE）包装，
 * 使其可接入 deepseek harness、cnb.cool、Claude Desktop 等任意 MCP 客户端。
 */
import { ForgeBrowser } from "@openliulan/core";
import { PlaywrightEngine } from "@openliulan/engines";
import { DiagnosisCenter } from "@openliulan/diagnosis";
import { compactSnapshot } from "@openliulan/token";
import { TOOLS, okResult, errResult, type ToolResult, type McpToolSchema } from "./tools.js";
import { SessionLogger } from "./logger.js";
import { buildAIMessage, messageToContent, type AIMessage } from "./message.js";
import type { ForgeAnyEvent } from "./events.js";
import { guardJsScript, redactUrl, redactDeep } from "./security.js";

export interface ForgeMcpOptions {
  /** 无头模式 */
  headless?: boolean;
  /** CDP 连接地址 */
  connectUrl?: string;
  /** 会话日志器（缺省自动创建） */
  logger?: SessionLogger;
  /** 事件流最大保留条数 */
  maxEvents?: number;
}

export class ForgeMcp {
  readonly tools: McpToolSchema[] = TOOLS;
  /** 会话事件日志器 —— 供外部 AI / IDE 订阅和拉取事件流 */
  readonly logger: SessionLogger;
  private browser?: ForgeBrowser;
  private diagnosis?: DiagnosisCenter;

  constructor(private opts: ForgeMcpOptions = {}) {
    this.logger = opts.logger ?? new SessionLogger({ maxEvents: opts.maxEvents });
  }

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
    const t0 = Date.now();
    try {
      // 记录工具调用开始（system 事件，供外部 AI 追踪）
      this.logger.log({ level: "debug", category: "system", message: `调用工具 ${name}`, payload: { args: this.safeArgs(args) } });

      let result: ToolResult;
      switch (name) {
        case "observe": {
          const b = await this.ensureBrowser();
          const snap = await b.observe({ maxNodes: (args.maxNodes as number) ?? 200, maxTextLength: (args.maxTextLength as number) ?? 80 });
          result = okResult(compactSnapshot(snap), { url: snap.url, title: snap.title, stats: snap.stats });
          this.logger.log({ category: "action", message: `observe ${snap.url} (${snap.stats?.emittedNodes ?? 0} 可交互节点)` });
          break;
        }

        case "act": {
          const b = await this.ensureBrowser();
          const action = this.normalizeAction(args);
          const actResult = await b.act(action as any);
          const lines = [`动作: ${actResult.type}`];
          if (actResult.ok) {
            lines.push(`✓ ${actResult.summary}`);
            if (actResult.diagnostics?.length) {
              lines.push(`⚠ 动作后检测到 ${actResult.diagnostics.length} 条页面异常:`);
              for (const d of actResult.diagnostics.slice(0, 5)) lines.push(`  - [${d.kind}] ${d.message}`);
            }
          } else {
            lines.push(`✗ ${actResult.summary}`);
          }
          lines.push(`耗时 ${actResult.durationMs}ms`);
          result = actResult.ok ? okResult(lines.join("\n"), { data: actResult.data }) : errResult(lines.join("\n"));

          // 动作事件：成功/失败都沉淀为结构化事件（供外部 AI 追踪执行轨迹）
          if (actResult.ok) {
            this.logger.action(`动作 ${actResult.type} 成功: ${actResult.summary}`, { type: actResult.type, durationMs: actResult.durationMs });
            if (actResult.diagnostics?.length) {
              this.logger.diagnose(`动作后检测到 ${actResult.diagnostics.length} 条页面异常`, {
                items: actResult.diagnostics.slice(0, 5).map((d) => ({ kind: d.kind, message: d.message })),
              });
            }
          } else {
            // 标准错误事件：带报错原因与解释，交给外部 AI
            this.logger.error({
              message: `动作 ${actResult.type} 失败: ${actResult.summary}`,
              code: this.mapErrorCode(actResult.type),
              reason: this.mapErrorReason(actResult.summary, actResult.diagnostics),
              raw: actResult.summary,
              explanation: this.buildExplanation(actResult.summary, actResult.diagnostics),
              suggestion: this.buildSuggestion(actResult.summary),
              detail: actResult.error,
              findings: (actResult.diagnostics ?? []).slice(0, 5).map((d) => ({
                category: d.kind,
                severity: d.severity,
                message: d.message,
              })),
            });
          }
          break;
        }

        case "diagnose": {
          const b = await this.ensureBrowser();
          const report = await b.captureDiagnostics();
          // 用 diagnosis 中心生成摘要（core 与 diagnosis 的报告类型已对齐，无需强转）
          const { summarize } = await import("@openliulan/diagnosis");
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
          result = okResult(lines.join("\n"), {
            issues: summary.issues,
            console: report.console.length,
            network: report.network.length,
            dom: report.dom.length,
            jsExceptions: report.jsExceptions.length,
          });
          this.logger.diagnose(`诊断完成: ${summary.healthy ? "健康" : `${summary.issues.length} 条问题`}`, {
            healthy: summary.healthy,
            issues: summary.issues.length,
            suggestions: summary.suggestions.length,
          });
          break;
        }

        case "eval": {
          const b = await this.ensureBrowser();
          const script = String(args.script);
          // 安全加固：拦截高危注入脚本（文件系统/子进程/渗透尝试），防提权
          const guard = guardJsScript(script);
          if (guard.blocked) {
            result = errResult(
              `eval 被安全拦截：脚本命中高危操作 [${(guard.reasons ?? []).join(", ")}]。` +
                `\n为防提权/渗透，禁止通过 eval 注入文件系统访问、子进程执行或系统级操作。`
            );
            this.logger.error({
              message: `eval 被安全拦截: ${guard.reasons?.join(", ")}`,
              code: "EVAL_BLOCKED",
              reason: "dangerous-script",
              raw: script.slice(0, 300),
              explanation: "检测到高危注入脚本，为防提权/渗透已拒绝执行。",
              suggestion: "移除文件系统/子进程/系统级访问代码，仅保留页面内的 DOM/JS 诊断。",
            });
            break;
          }
          const evalResult = await b.eval(script);
          // 对结果做脱敏，避免 eval 返回的敏感值（如 token/password）外泄
          const sanitizedResult = redactDeep(evalResult);
          result = okResult(`执行结果: ${JSON.stringify(sanitizedResult)?.slice(0, 2000)}`, { result: sanitizedResult });
          this.logger.log({ category: "action", message: "eval 执行" });
          break;
        }

        case "screenshot": {
          const b = await this.ensureBrowser();
          const shot = await b.act({ type: "screenshot", fullPage: !!args.fullPage } as any);
          const base64 = (shot.data as any)?.base64;
          const dataUri = `data:image/png;base64,${base64}`;
          result = okResult(shot.summary, { image: dataUri });
          // 截图事件：把图片纳入事件流，供外部多模态 AI 消费
          this.logger.screenshot({
            dataUri,
            fullPage: !!args.fullPage,
            caption: args.caption ? String(args.caption) : shot.summary,
          });
          break;
        }

        case "session_log": {
          // 让外部 AI 拉取会话事件流（这是 AI 协作的"追踪能力"）
          const events = this.logger.toArray();
          const format = String(args.format ?? "markdown");
          if (format === "json") {
            // 对事件流做深脱敏，防止 payload 携带的令牌/密码外泄
            result = okResult(`共 ${events.length} 条事件`, { events: redactDeep(events) });
          } else {
            const md = this.logger.exportMarkdown({ title: args.title ? String(args.title) : undefined });
            result = okResult(md, { eventCount: events.length });
          }
          break;
        }

        case "close": {
          if (this.browser) {
            await this.browser.stop();
            this.browser = undefined;
          }
          result = okResult("浏览器已关闭");
          this.logger.system("浏览器已关闭");
          break;
        }

        default:
          result = errResult(`未知工具: ${name}。可用工具: ${TOOLS.map((t) => t.name).join(", ")}`);
      }

      // 把本次调用的最新事件注入返回结果，让外部 AI 拿到"发生了什么 + 为什么 + 图 + 日志"
      result = this.attachEvents(result, name);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 异常也沉淀为标准错误事件，带原因与解释
      this.logger.error({
        message: `工具 ${name} 执行异常: ${msg}`,
        code: "TOOL_EXCEPTION",
        reason: "uncaught-exception",
        raw: msg,
        explanation: `工具 ${name} 在执行时抛出未捕获异常。`, 
        suggestion: "检查参数是否合法、浏览器是否可用、网络是否连通；可先 observe 确认页面状态。",
        detail: err instanceof Error && err.stack ? err.stack.slice(0, 500) : undefined,
      });
      const result = this.attachEvents(errResult(`工具执行失败: ${msg}`), name);
      return result;
    }
  }

  /** 把最近事件附加到 ToolResult.structured，供外部 AI 消费事件流 */
  private attachEvents(result: ToolResult, _name: string): ToolResult {
    if (!result.structured) result.structured = {};
    const events = this.logger.toArray().slice(-30);
    (result.structured as Record<string, unknown>).events = events;
    (result.structured as Record<string, unknown>).sessionId = this.logger.sessionId;
    return result;
  }

  /** 隐藏敏感参数（避免把 value/script/url 中的敏感信息全文塞入日志） */
  private safeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (k === "value" || k === "script") safe[k] = typeof v === "string" ? `<${v.length} chars>` : v;
      else if (k === "url" && typeof v === "string") safe[k] = redactUrl(v);
      else if (k === "expected" && typeof v === "string") safe[k] = v.length > 60 ? `${v.slice(0, 60)}...` : v;
      else safe[k] = v;
    }
    return safe;
  }

  /** 动作类型 -> 稳定错误码 */
  private mapErrorCode(type: string): string {
    return `ACTION_FAILED_${type.toUpperCase()}`;
  }

  /** 从摘要/诊断推断根因分类 */
  private mapErrorReason(summary: string, diagnostics?: Array<{ kind?: string; message: string }>): string {
    const s = summary.toLowerCase();
    if (s.includes("timeout") || s.includes("超时")) return "timeout";
    if (s.includes("404") || s.includes("500") || s.includes("network") || s.includes("网络")) return "network-failure";
    if (s.includes("not found") || s.includes("找不到") || s.includes("无法定位") || s.includes("未找到") || s.includes("locator")) return "locator-not-found";
    if (diagnostics?.some((d) => d.kind === "js-exception")) return "js-exception";
    if (diagnostics?.some((d) => d.kind === "dom")) return "dom-unrendered";
    return "action-failed";
  }

  /** 面向 AI 的根因解释 */
  private buildExplanation(summary: string, diagnostics?: Array<{ kind?: string; message: string }>): string {
    const reason = this.mapErrorReason(summary, diagnostics);
    const extras = (diagnostics ?? []).slice(0, 3).map((d) => d.message).join("; ");
    switch (reason) {
      case "locator-not-found":
        return `页面中未找到目标元素。${extras ? `诊断提示: ${extras}` : "可能是元素未渲染、选择器变化、或页面还在加载。"}`;
      case "timeout":
        return `操作超时，元素或导航在限定时间内未就绪。${extras ? `诊断提示: ${extras}` : ""}`;
      case "network-failure":
        return `网络请求失败或目标不可达。${extras ? `诊断提示: ${extras}` : ""}`;
      case "js-exception":
        return `页面抛出了 JS 未捕获异常，可能阻断交互。${extras ? `诊断提示: ${extras}` : ""}`;
      case "dom-unrendered":
        return `页面 DOM 未正常渲染（白屏/未挂载），初始化 JS 可能出错。`;
      default:
        return `动作执行失败: ${summary.slice(0, 200)}`;
    }
  }

  /** 可行动的修复建议 */
  private buildSuggestion(summary: string): string {
    const reason = this.mapErrorReason(summary);
    switch (reason) {
      case "locator-not-found":
        return "先 observe 查看当前 DOM，切换定位策略(ref→selector→text→semantic)，或 wait 元素就绪后重试。";
      case "timeout":
        return "检查页面加载/网络，可延长 wait 或改用 waitUntil 策略；若元素是异步渲染，先等其出现。";
      case "network-failure":
        return "核对 URL/接口路径、CORS 与后端状态；必要时用 diagnose 查看网络失败详情。";
      case "js-exception":
        return "用 diagnose 展开异常堆栈，定位 throw/未定义/异步未 catch，修复后重试。";
      case "dom-unrendered":
        return "检查初始化 JS 是否抛错导致整树未渲染；用 diagnose 的 dom 维度定位白屏根因。";
      default:
        return "用 diagnose 采集完整诊断，结合日志事件定位根因后修正动作。";
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
    for (const k of ["url", "value", "key", "ms", "script", "mode", "expected", "fullPage", "deltaY", "delay", "waitUntil", "waitForNavigation"]) {
      if (args[k] !== undefined) rest[k] = args[k];
    }
    return { ...base, ...loc, ...rest };
  }

  /** 关闭（供传输层退出时调用） */
  async shutdown(): Promise<void> {
    if (this.browser) await this.browser.stop();
  }
}
