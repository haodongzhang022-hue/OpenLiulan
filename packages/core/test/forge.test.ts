import { describe, it, expect, vi } from "vitest";
import { ForgeBrowser, type BrowserEngine, type UnifiedAction, type ActionResult, type PageSnapshot } from "@browser-ai-forge/core";

/** 模拟引擎：验证 ForgeBrowser 编排逻辑（无需真实浏览器） */
function createMockEngine() {
  const diagnose = vi.fn().mockResolvedValue({
    console: [],
    network: [{ kind: "network", severity: "error", message: "GET 404", timestamp: 0 }],
    performance: [],
    jsExceptions: [],
  });
  const execute = vi.fn().mockImplementation(async (action: UnifiedAction): Promise<ActionResult> => {
    if (action.type === "click") {
      throw new Error("未找到元素");
    }
    return { ok: true, type: action.type, summary: "ok", durationMs: 5 };
  });
  const engine: BrowserEngine = {
    name: "mock",
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    execute,
    snapshot: vi.fn().mockResolvedValue({
      url: "https://example.com", title: "Mock", timestamp: "t", readyState: "complete",
      stats: { totalNodes: 1, emittedNodes: 1, truncatedNodes: 0, approximateTokens: 1 },
      root: { ref: "r0", tag: "body", text: "", attributes: {}, interactive: false, depth: 0 },
      interactive: [],
    } satisfies PageSnapshot),
    diagnose,
    collectConsole: vi.fn().mockResolvedValue([]),
    collectNetwork: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue(null),
  };
  return { engine, execute, diagnose };
}

describe("ForgeBrowser 编排", () => {
  it("启动与快照观察", async () => {
    const { engine } = createMockEngine();
    const forge = new ForgeBrowser(engine);
    await forge.start();
    const snap = await forge.observe();
    expect(snap.title).toBe("Mock");
    expect(forge.engineName).toBe("mock");
    await forge.stop();
  });

  it("动作失败自动采集诊断", async () => {
    const { engine, execute, diagnose } = createMockEngine();
    const forge = new ForgeBrowser(engine, { autoDiagnoseOnError: true });
    await forge.start();
    const result = await forge.act({ type: "click", ref: "r1" });
    expect(result.ok).toBe(false);
    // 失败后自动诊断，并把网络错误带进结果
    expect(diagnose).toHaveBeenCalled();
    expect(result.diagnostics?.some((d) => d.kind === "network")).toBe(true);
    await forge.stop();
  });

  it("成功动作后附带页面异常诊断", async () => {
    const { engine, diagnose } = createMockEngine();
    const forge = new ForgeBrowser(engine);
    await forge.start();
    const result = await forge.act({ type: "navigate", url: "https://example.com" });
    expect(result.ok).toBe(true);
    // navigate 成功，但仍采集了网络错误
    expect(result.diagnostics?.some((d) => d.kind === "network")).toBe(true);
    await forge.stop();
  });
});
