import { describe, it, expect } from "vitest";
import { ForgeMcp } from "../src/forge-mcp.js";
import { SessionLogger } from "../src/logger.js";

describe("ForgeMcp AI 协作集成", () => {
  it("session_log 工具返回事件流（markdown）", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    // 预先写入几条事件，模拟执行轨迹
    mcp.logger.log({ category: "system", message: "会话启动" });
    mcp.logger.log({ category: "action", message: "navigate 成功" });
    const res = await mcp.callTool("session_log", {});
    expect(res.ok).toBe(true);
    expect(res.content[0].text).toContain("navigate 成功");
    // structured 中带事件
    expect((res.structured as any)?.eventCount).toBeGreaterThanOrEqual(2);
  });

  it("session_log 支持 json 格式返回结构化事件", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    mcp.logger.error({
      message: "失败",
      code: "ACTION_FAILED_CLICK",
      reason: "locator-not-found",
      raw: "未找到",
      explanation: "元素未渲染",
      suggestion: "切换定位",
    });
    const res = await mcp.callTool("session_log", { format: "json" });
    const events = (res.structured as any)?.events;
    expect(Array.isArray(events)).toBe(true);
    expect(events[0].category).toBe("error");
    expect(events[0].error.code).toBe("ACTION_FAILED_CLICK");
  });

  it("每个工具调用的返回结果都附带事件流与 sessionId", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    const res = await mcp.callTool("session_log", {});
    expect((res.structured as any)?.sessionId).toBeTruthy();
    expect(Array.isArray((res.structured as any)?.events)).toBe(true);
  });

  it("未知工具返回错误且附带事件流", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    const res = await mcp.callTool("not_a_real_tool", {});
    expect(res.ok).toBe(false);
    expect(res.isError).toBe(true);
    expect((res.structured as any)?.sessionId).toBeTruthy();
  });

  it("mapErrorReason 识别中文'无法定位元素'为 locator-not-found（与 fingerprintError 对齐）", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    const map = (mcp as any).mapErrorReason.bind(mcp);
    // 真实引擎 locator.ts 抛出的错误信息以"无法定位元素"开头
    expect(map("动作执行失败: 无法定位元素：ref=- selector=- text=按钮XYZ semantic=-. 建议调用 observe() 获取最新快照后重试")).toBe("locator-not-found");
    expect(map("动作执行失败: 未找到元素 r3")).toBe("locator-not-found");
    expect(map("断言失败：未找到目标元素")).toBe("locator-not-found");
    expect(map("操作超时，元素未就绪")).toBe("timeout");
    expect(map("请求失败 GET /api 404")).toBe("network-failure");
  });

  it("buildExplanation 对无法定位元素给出可行动解释与建议", async () => {
    const mcp = new ForgeMcp({ logger: new SessionLogger() });
    const m = mcp as any;
    const expl = m.buildExplanation("动作执行失败: 无法定位元素：text=按钮XYZ");
    expect(expl).toContain("页面中未找到目标元素");
    expect(m.buildSuggestion("无法定位元素：text=按钮XYZ")).toContain("切换定位策略");
  });
});
