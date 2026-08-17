import { describe, it, expect } from "vitest";
import {
  buildKnowledgeContext,
  toPrComment,
  parseDiagnosisText,
  buildSessionMarkdown,
  runDebugSession,
  runCiCheck,
} from "../src/adapters/cnb.js";
import {
  buildHarnessFunctionSchemas,
  toHarnessTools,
  runAgentLoop,
  extractFindings,
  buildSelfHealContext,
  buildDebugReport,
  type DebugReport,
  type DebugFinding,
  type AgentTurn,
  type DebugMode,
} from "../src/adapters/harness.js";
import { okResult, errResult, TOOLS } from "../src/tools.js";
import { SolutionRepository } from "../src/solutions.js";
import { createCnbHttpServer } from "../src/adapters/cnb.js";
import fs from "node:fs";
import http from "node:http";

/** 发送一个 JSON POST 请求到测试服务器 */
function postJson(port: number, path: string, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(buf || "{}") }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/** 获取一个随机空闲端口 */
async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as any).port;
      srv.close(() => resolve(port));
    });
  });
}

describe("CNB 知识库增强", () => {
  it("把知识片段组装成可注入的上下文", () => {
    const ctx = buildKnowledgeContext([
      { title: "登录流程", snippet: "测试账号 admin / 内网域名约定", source: "docs/" },
    ]);
    expect(ctx).toContain("CNB 仓库知识库");
    expect(ctx).toContain("登录流程");
    expect(ctx).toContain("来源: docs/");
  });

  it("无知识时返回空字符串", () => {
    expect(buildKnowledgeContext([])).toBe("");
  });
});

describe("CNB CI 冒烟 runCiCheck（nonFatal 默认语义 + 二次触发）", () => {
  function makeFailMcp(opts: { diagText?: string } = {}) {
    return {
      tools: [
        { name: "observe", description: "观察", inputSchema: {} },
        { name: "act", description: "动作", inputSchema: {} },
        { name: "diagnose", description: "诊断", inputSchema: {} },
      ],
      callTool: async (name: string, args: any) => {
        if (name === "diagnose")
          return okResult(opts.diagText ?? "# 诊断结果 (健康)\n未发现错误，页面运行正常。");
        if (name === "observe") return okResult("快照 ok");
        if (name === "act") {
          // 模拟真实浏览器报错：无法定位元素
          return errResult("✗ 动作执行失败: 无法定位元素：ref=- selector=- text=按钮XYZ semantic=-. 建议调用 observe() 获取最新快照后重试");
        }
        return okResult("ok");
      },
    } as any;
  }

  it("nonFatal 默认 true：步骤失败不终止，后续步骤继续执行", async () => {
    const mcp = makeFailMcp();
    const result = await runCiCheck(mcp, {
      steps: [
        { action: "act", args: { type: "assert" } }, // 失败，但 nonFatal 默认 true 应继续
        { action: "observe", args: {} }, // 应被执行
        { action: "act", args: { type: "assert" } }, // 失败（同类第 2 次）
      ],
    });
    // 两个 act 都执行了（第 2 个 observe 也执行）
    expect(result.steps.length).toBe(3);
    expect(result.steps.filter((s) => !s.ok).length).toBe(2);
  });

  it("同类错误第 2 次在 runCiCheck 中触发 dom:locator-failed 方案", async () => {
    const mcp = makeFailMcp();
    const result = await runCiCheck(mcp, {
      steps: [
        { action: "act", args: { type: "assert" } },
        { action: "act", args: { type: "assert" } },
      ],
    });
    const triggered = result.solutions?.filter((s) => s.triggered && s.fingerprint === "dom:locator-failed");
    expect(triggered?.length).toBe(1);
    expect(triggered![0].advice).toContain("方案推荐");
    expect(triggered![0].advice).toContain("元素定位/点击失败");
  });

  it("显式 nonFatal:false 时失败即终止", async () => {
    const mcp = makeFailMcp();
    const result = await runCiCheck(mcp, {
      steps: [
        { action: "act", args: { type: "assert" }, nonFatal: false },
        { action: "observe", args: {} },
      ],
    });
    // 第 1 步致命失败即终止，第 2 步不执行
    expect(result.steps.length).toBe(1);
  });

  it("提供 solutionRepoFile 且有沉淀方案时，报告注入已沉淀方案知识", async () => {
    const mcp = makeFailMcp();
    const repoFile = "./tmp-ci-repo-test.json";
    try { fs.unlinkSync(repoFile); } catch {}
    // 预置一条沉淀方案
    const seed = new SolutionRepository(repoFile);
    seed.addSolution({
      id: "dom-modal-overlay",
      fingerprint: "dom:modal-overlay",
      title: "弹窗遮挡导致点击失败",
      pattern: /遮罩|弹窗|overlay|遮挡/i,
      level: "guide",
      solution: "先关闭弹层/遮罩，再执行点击；或用 force:true 穿透。",
      source: "项目调试记录",
    });
    seed.persist();

    const result = await runCiCheck(mcp, {
      steps: [
        { action: "act", args: { type: "assert" } },
        { action: "act", args: { type: "assert" } },
      ],
      solutionRepoFile: repoFile,
    });
    expect(result.report).toContain("项目已沉淀方案");
    expect(result.report).toContain("弹窗遮挡导致点击失败");
    expect(result.report).toContain("沉淀 1 条");
    try { fs.unlinkSync(repoFile); } catch {}
  });
});

describe("CNB CI 评论", () => {
  it("生成含通过/失败统计的 markdown", () => {
    const md = toPrComment({
      ok: true,
      passed: 2,
      failed: 0,
      steps: [
        { action: "observe", ok: true, summary: "快照 ok" },
        { action: "act", ok: true, summary: "点击 ok" },
      ],
      artifacts: ["forge-artifacts/step-1.png"],
      report: "# Forge CI 冒烟检查 ✅ 通过",
    });
    expect(md).toContain("OpenLiulan");
    expect(md).toContain("✅ 通过");
  });
});

describe("harness 工具映射", () => {
  it("生成的 function schema 与工具集数量一致且为 OpenAI 兼容结构", () => {
    const fakeMcp: any = {
      tools: [
        {
          name: "observe",
          description: "观察页面",
          inputSchema: { type: "object", properties: { maxNodes: { type: "number" } } },
        },
      ],
      callTool: async () => okResult("ok"),
    };
    const schemas = buildHarnessFunctionSchemas(fakeMcp);
    expect(schemas[0]).toMatchObject({ type: "function", function: { name: "observe" } });
    const tools = toHarnessTools(fakeMcp);
    expect(tools[0].name).toBe("observe");
    expect(typeof tools[0].fn).toBe("function");
  });

  it("errResult 返回错误 ToolResult", () => {
    const r = errResult("未知工具");
    expect(r.ok).toBe(false);
    expect(r.isError).toBe(true);
  });

  it("act 工具 schema 完整声明动作参数（IDE function calling 能力不被隐藏）", () => {
    const fakeMcp: any = {
      tools: TOOLS,
      callTool: async () => okResult("ok"),
    };
    const schemas = buildHarnessFunctionSchemas(fakeMcp);
    const actSchema = schemas.find((s: any) => s.function.name === "act");
    const props = actSchema.function.parameters.properties;
    // 动作细节参数必须完整暴露，供 IDE / harness 的 function calling 声明
    for (const p of ["fullPage", "deltaY", "delay", "waitUntil", "waitForNavigation", "url", "value", "key", "ms", "script", "mode", "expected", "ref", "selector", "text", "semantic"]) {
      expect(props[p], `act schema 应包含参数 ${p}`).toBeDefined();
    }
    // 工具列表完整
    expect(schemas.map((s: any) => s.function.name)).toEqual(["observe", "act", "diagnose", "eval", "screenshot", "session_log", "close"]);
  });
});

describe("结构化调试发现 extractFindings", () => {
  it("从诊断文本解析出控制台/JS/网络/性能发现", () => {
    const text = [
      "# 诊断结果 (存在问题)",
      "- [console/error] 控制台有 2 条错误",
      "建议: 控制台有 2 条错误，可能是 JS 异常或资源加载失败",
      "- [js-exception/error] 页面抛出了 JS 未捕获异常",
      "建议: 页面抛出了 JS 未捕获异常，检查对应堆栈",
      "- [network/error] 网络存在 3 个失败请求",
      "建议: 网络存在 3 个失败请求，可能是资源 404/500 或 CORS/跨域阻断",
      "- [network/warning] 存在 1 个慢请求(>3s)",
      "建议: 存在 1 个慢请求(>3s)，考虑检查后端接口或资源加载",
      "- [performance/warning] TTFB 偏高: 1500ms",
      "建议: TTFB > 1s，优先排查服务端响应与 CDN",
    ].join("\n");

    const findings = extractFindings({
      ok: false,
      content: [{ type: "text", text }],
      isError: true,
    });

    expect(findings.some((f) => f.category === "console" && f.severity === "error")).toBe(true);
    expect(findings.some((f) => f.category === "js-exception")).toBe(true);
    expect(findings.some((f) => f.category === "network" && f.severity === "error")).toBe(true);
    expect(findings.some((f) => f.category === "performance" && f.severity === "warning")).toBe(true);
  });

  it("成功结果无发现", () => {
    const findings = extractFindings(okResult("一切正常"));
    expect(findings.length).toBe(0);
  });
});

describe("自愈上下文 buildSelfHealContext", () => {
  it("生成可行动的诊断 feed（含原因 + 建议）", () => {
    const ctx = buildSelfHealContext(
      "click",
      "未找到元素 ref=r3",
      "# 诊断结果 (存在问题)\n- [console/error] 控制台有 1 条错误",
      [
        {
          category: "console",
          severity: "error",
          message: "控制台有 1 条错误",
          suggestion: "检查 JS 异常堆栈与资源加载",
        },
      ]
    );
    expect(ctx.hasFindings).toBe(true);
    expect(ctx.text).toContain("动作失败");
    expect(ctx.text).toContain("click");
    expect(ctx.text).toContain("建议: 检查 JS 异常堆栈与资源加载");
    expect(ctx.text).toContain("自愈指令");
  });
});

describe("runAgentLoop 调试模式", () => {
  // 构造一个假 ForgeMcp（不依赖真实浏览器）
  function makeFakeMcp(opts: { diagText?: string } = {}) {
    return {
      tools: [
        {
          name: "observe",
          description: "观察",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "act",
          description: "动作",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "diagnose",
          description: "诊断",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "close",
          description: "关闭",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      callTool: async (name: string, args: any) => {
        if (name === "diagnose") {
          return okResult(opts.diagText ?? "# 诊断结果 (健康)\n未发现错误，页面运行正常。");
        }
        if (name === "observe") {
          return okResult("# 页面: Test\nURL: http://example.com\n## 可交互元素\n- ref=r1 <button> \"Go\"");
        }
        if (name === "act") {
          // 模拟第一次点击失败，重试成功
          return errResult("动作失败: 未找到元素");
        }
        if (name === "close") {
          return okResult("浏览器已关闭");
        }
        return okResult("ok");
      },
    } as any;
  }

  it("debug 模式：失败后自动诊断并把建议注入 result", async () => {
    const mcp = makeFakeMcp({
      diagText: "# 诊断结果 (存在问题)\n- [console/error] 控制台有 2 条错误\n## 建议\n1. 检查 JS 异常堆栈",
    });
    const tools = toHarnessTools(mcp);

    const result = await runAgentLoop(mcp, tools, {
      mode: "debug" as DebugMode,
      goal: "测试点击",
      // 模拟：第一步失败（会触发诊断），第二步 close
      act: async (tools, history) => {
        if (history.length === 0) return { name: "act", args: { type: "click" } };
        return { name: "close", args: {} };
      },
      maxRetries: 1,
      autoObserve: false,
    });

    expect(result.usedDiagnosis).toBe(true);
    expect(result.turns.length).toBeGreaterThanOrEqual(2);
    // 第一个 act 失败后，result 被注入了自愈诊断文本
    const firstTurn = result.turns[0];
    expect(firstTurn.result.ok).toBe(false);
    const content = firstTurn.result.content.map((c) => c.text).join("\n");
    expect(content).toContain("自愈诊断");
    expect(content).toContain("控制台有 2 条错误");
    // debug 模式生成 report
    expect(result.report).toBeDefined();
    expect(result.report!.findings.length).toBeGreaterThan(0);
  });

  it("report 模式：不注入诊断到 result，但生成结构化报告", async () => {
    const mcp = makeFakeMcp({
      diagText: "# 诊断结果 (存在问题)\n- [network/error] 网络存在 3 个失败请求",
    });
    const tools = toHarnessTools(mcp);

    const result = await runAgentLoop(mcp, tools, {
      mode: "report" as DebugMode,
      goal: "测试仅反馈",
      act: async (tools, history) => {
        if (history.length === 0) return { name: "act", args: { type: "click" } };
        return { name: "close", args: {} };
      },
      maxRetries: 1,
      autoObserve: false,
    });

    expect(result.mode).toBe("report");
    // report 模式：result 不注入诊断文本
    const firstTurn = result.turns[0];
    const content = firstTurn.result.content.map((c) => c.text).join("\n");
    expect(content).not.toContain("自愈诊断");
    // 但 report.findings 结构化保存了诊断发现
    expect(result.report).toBeDefined();
    expect(result.report!.findings.some((f) => f.category === "network")).toBe(true);
    expect(result.report!.markdown).toContain("调试报告");
  });

  it("verify 自校验：验证目标真实达成", async () => {
    let verifyCalls = 0;
    const mcp = makeFakeMcp();
    const tools = toHarnessTools(mcp);

    const result = await runAgentLoop(mcp, tools, {
      mode: "debug",
      goal: "验证目标",
      act: async () => ({ name: "close", args: {} }),
      verify: async (turns, mcp) => {
        verifyCalls++;
        // 模拟：第二次调用 verify 时目标真实达成
        return verifyCalls >= 2;
      },
      autoObserve: false,
    });

    expect(result.ok).toBe(true);
    expect(verifyCalls).toBeGreaterThanOrEqual(2);
  });

  it("错误自动匹配：同类错误二次触发后返回解决方案", async () => {
    // 两次 act 都失败且都是网络错误 → 第 2 次触发解决方案推荐
    let actCalls = 0;
    const mcp = makeFakeMcp({ diagText: "# 诊断结果 (存在问题)\n- [network/error] 网络存在 1 个失败请求" });
    const tools = toHarnessTools(mcp);

    const result = await runAgentLoop(mcp, tools, {
      mode: "debug",
      goal: "触发方案推荐",
      act: async (tools, history) => {
        actCalls++;
        if (actCalls <= 2) return { name: "act", args: { type: "click" } }; // 两次失败
        return { name: "close", args: {} };
      },
      maxRetries: 5,
      autoObserve: false,
    });

    // 同类网络错误出现 2 次后，应触发解决方案
    expect(result.solutions).toBeDefined();
    const matched = result.solutions!.filter((s) => s.triggered);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0].entry).toBeDefined();
    // 第 2 次失败的动作里应注入方案推荐文本
    const secondTurn = result.turns.find((t) => t.tool === "act" && t.result.content.some((c) => c.text.includes("解决方案推荐")));
    expect(secondTurn).toBeDefined();
  });
});

describe("runAgentLoop 工程加固（超时 / 去重升级 / stopReason）", () => {
  function makeFakeMcp(opts: { actOk?: boolean } = {}) {
    return {
      tools: [
        { name: "observe", description: "观察", inputSchema: { type: "object", properties: {} } },
        { name: "act", description: "动作", inputSchema: { type: "object", properties: {} } },
        { name: "diagnose", description: "诊断", inputSchema: { type: "object", properties: {} } },
        { name: "close", description: "关闭", inputSchema: { type: "object", properties: {} } },
      ],
      callTool: async (name: string) => {
        if (name === "diagnose")
          return okResult("# 诊断结果 (存在问题)\n- [console/error] 控制台有 2 条错误\n1. 检查 JS 异常堆栈");
        if (name === "observe") return okResult("# 页面: Test\nURL: http://example.com\n- ref=r1 <button> \"Go\"");
        if (name === "act") return opts.actOk === false ? errResult("动作失败: 元素不可交互") : okResult("动作成功");
        if (name === "close") return okResult("closed");
        return okResult("ok");
      },
    } as any;
  }

  it("达到目标返回 stopReason=goal-achieved", async () => {
    const mcp = makeFakeMcp({ actOk: true });
    const tools = toHarnessTools(mcp);
    const result = await runAgentLoop(mcp, tools, {
      mode: "debug",
      goal: "g",
      act: async () => ({ name: "close", args: {} }),
      autoObserve: false,
    });
    expect(result.stopReason).toBe("goal-achieved");
    expect(result.ok).toBe(true);
  });

  it("连续失败达到 maxRetries 升级为 stopReason=too-many-retries（避免死循环）", async () => {
    const mcp = makeFakeMcp({ actOk: false }); // act 持续失败
    const tools = toHarnessTools(mcp);
    const result = await runAgentLoop(mcp, tools, {
      mode: "debug",
      goal: "g",
      act: async () => ({ name: "act", args: { type: "click" } }),
      maxRetries: 1,
      autoObserve: false,
    });
    expect(result.stopReason).toBe("too-many-retries");
    expect(result.ok).toBe(false);
  });

  it("report 模式失败即转交：stopReason=report-handoff，不自动修复", async () => {
    const mcp = makeFakeMcp({ actOk: false });
    const tools = toHarnessTools(mcp);
    const result = await runAgentLoop(mcp, tools, {
      mode: "report" as DebugMode,
      goal: "g",
      act: async () => ({ name: "act", args: { type: "click" } }),
      autoObserve: false,
    });
    expect(result.stopReason).toBe("report-handoff");
    expect(result.report).toBeDefined();
  });

  it("整环超时：stopReason=timeout", async () => {
    const mcp = makeFakeMcp({ actOk: true });
    const tools = toHarnessTools(mcp);
    // 用极小的 timeout，每次 act 决策被延迟，循环顶部累计触发超时
    const result = await runAgentLoop(mcp, tools, {
      mode: "debug",
      goal: "g",
      act: async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { name: "act", args: { type: "click" } }; // 非 close，避免抢占退出
      },
      timeoutMs: 10,
      autoObserve: false,
    });
    expect(result.stopReason).toBe("timeout");
  });
});

describe("CNB 调试会话 parseDiagnosisText", () => {
  it("解析诊断文本为结构化发现", () => {
    const diagText = [
      "# 诊断结果 (存在问题)",
      "- [console/error] 控制台有 1 条错误",
      "建议: 控制台有 1 条错误",
      "- [network/error] 网络存在 2 个失败请求",
      "建议: 网络存在 2 个失败请求",
    ].join("\n");
    const findings = parseDiagnosisText(diagText);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.category === "console")).toBe(true);
    expect(findings.some((f) => f.category === "network")).toBe(true);
  });

  it("无错误时返回空数组", () => {
    expect(parseDiagnosisText("# 诊断结果 (健康)\n未发现错误，页面运行正常。")).toEqual([]);
  });
});

describe("buildSessionMarkdown", () => {
  it("生成包含目标/URL/发现/快照的 markdown", () => {
    const md = buildSessionMarkdown(
      { goal: "排查登录页报错", url: "http://example.com/login" },
      false,
      [
        {
          category: "js-exception",
          severity: "error",
          message: "页面抛出了 JS 未捕获异常",
          suggestion: "检查异常堆栈",
        },
      ],
      "[登录页] http://example.com/login\n- ref=r1 <input>"
    );
    expect(md).toContain("排查登录页报错");
    expect(md).toContain("js-exception");
    expect(md).toContain("❌");
    expect(md).toContain("页面快照");
  });

  it("健康页面生成 ✅", () => {
    const md = buildSessionMarkdown(
      { goal: "检查首页", url: "http://example.com" },
      true,
      [],
      "[首页] http://example.com"
    );
    expect(md).toContain("✅");
    expect(md).toContain("未发现明确问题");
  });
});

describe("HTTP 服务 /tools/call 截图序列化（与 stdio 一致）", () => {
  it("截图结果序列化为标准 MCP image content 块（供多模态 AI 消费）", async () => {
    // 构造一个假 mcp：callTool 返回带截图 base64 与事件流的 ToolResult
    const fakeMcp: any = {
      tools: [
        { name: "screenshot", description: "截图", inputSchema: { type: "object", properties: {} } },
      ],
      callTool: async (name: string) => {
        if (name === "screenshot") {
          return okResult("已截图 (12KB)", {
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            events: [
              {
                seq: 1, ts: Date.now(), level: "info", category: "screenshot",
                message: "首页截图", image: { dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", byteLength: 100, fullPage: true, caption: "首页截图" },
              },
            ],
            sessionId: "sess_test",
          });
        }
        return okResult("ok");
      },
    };

    const port = await freePort();
    const server = createCnbHttpServer(fakeMcp, port);
    try {
      const res = await postJson(port, "/tools/call", { name: "screenshot", arguments: { fullPage: true } });
      expect(res.status).toBe(200);
      // 标准 MCP content 含 text + image 两个块
      const content = res.body.content;
      expect(content.some((c: any) => c.type === "image" && c.data === "iVBORw0KGgoAAAANSUhEUg==" && c.mimeType === "image/png")).toBe(true);
      expect(content.some((c: any) => c.type === "text")).toBe(true);
      // 结构化数据保留（供非多模态客户端用）
      expect(res.body.structured?.sessionId).toBe("sess_test");
    } finally {
      server.close();
    }
  });

  it("文本工具（observe）保持文本响应", async () => {
    const fakeMcp: any = {
      tools: [{ name: "observe", description: "观察", inputSchema: { type: "object", properties: {} } }],
      callTool: async () => okResult("# 页面: Test\n- ref=r1 <button> \"Go\""),
    };
    const port = await freePort();
    const server = createCnbHttpServer(fakeMcp, port);
    try {
      const res = await postJson(port, "/tools/call", { name: "observe", arguments: {} });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.content.some((c: any) => c.type === "text" && c.text.includes("Test"))).toBe(true);
    } finally {
      server.close();
    }
  });
});
