import { describe, it, expect } from "vitest";
import { SessionLogger } from "../src/logger.js";
import { buildAIMessage, messageToContent } from "../src/message.js";
import type { ForgeErrorEvent, ScreenshotEvent } from "../src/events.js";

describe("SessionLogger 会话事件日志器", () => {
  it("记录通用日志事件，带时间戳与递增序号", () => {
    const l = new SessionLogger();
    const e1 = l.log({ message: "第一条" });
    const e2 = l.log({ message: "第二条", category: "action" });
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e2.category).toBe("action");
    expect(e2.level).toBe("info");
    expect(typeof e1.ts).toBe("number");
    expect(l.toArray()).toHaveLength(2);
  });

  it("记录标准错误事件，携带报错原因与解释", () => {
    const l = new SessionLogger();
    const err = l.error({
      message: "动作 click 失败",
      code: "ACTION_FAILED_CLICK",
      reason: "locator-not-found",
      raw: "无法定位元素",
      explanation: "页面中未找到目标元素。",
      suggestion: "先 observe 查看当前 DOM。",
    });
    expect(err.category).toBe("error");
    const ev = err as ForgeErrorEvent;
    expect(ev.error.code).toBe("ACTION_FAILED_CLICK");
    expect(ev.error.reason).toBe("locator-not-found");
    expect(ev.error.suggestion).toContain("observe");
  });

  it("记录截图事件，携带 base64 图片", () => {
    const l = new SessionLogger();
    const shot = l.screenshot({ dataUri: "data:image/png;base64,AAAABBBB", caption: "首页截图" });
    expect(shot.category).toBe("screenshot");
    const s = shot as ScreenshotEvent;
    expect(s.image.dataUri).toContain("base64,");
    expect(s.image.byteLength).toBe(8);
    expect(s.image.fullPage).toBe(false);
  });

  it("支持订阅实时事件并可取消", () => {
    const l = new SessionLogger();
    const received: string[] = [];
    const unsub = l.subscribe((e) => received.push(e.message));
    l.log({ message: "事件A" });
    expect(received).toEqual(["事件A"]);
    unsub();
    l.log({ message: "事件B" });
    expect(received).toEqual(["事件A"]);
  });

  it("导出 markdown 执行轨迹，含错误码与建议", () => {
    const l = new SessionLogger();
    l.log({ category: "system", message: "会话启动" });
    l.log({ category: "action", message: "navigate 成功" });
    l.error({
      message: "动作 fill 失败",
      code: "ACTION_FAILED_FILL",
      reason: "timeout",
      raw: "超时",
      explanation: "操作超时",
      suggestion: "延长 wait",
    });
    l.screenshot({ dataUri: "data:image/png;base64,AAA", caption: "截图" });
    const md = l.exportMarkdown();
    expect(md).toContain("会话事件日志");
    expect(md).toContain("ACTION_FAILED_FILL");
    expect(md).toContain("延长 wait");
    expect(md).toContain("screenshot");
  });

  it("按类别过滤事件", () => {
    const l = new SessionLogger();
    l.log({ category: "action", message: "a1" });
    l.log({ category: "diagnose", message: "d1" });
    l.log({ category: "action", message: "a2" });
    expect(l.filter("action")).toHaveLength(2);
    expect(l.filter(["diagnose"])).toHaveLength(1);
  });
});

describe("AIMessage 消息协议", () => {
  it("把事件流聚合成 AI 协作消息（含错误+图片+日志）", () => {
    const l = new SessionLogger();
    l.log({ category: "system", message: "启动" });
    l.error({
      message: "动作失败",
      code: "ACTION_FAILED_CLICK",
      reason: "locator-not-found",
      raw: "未找到",
      explanation: "元素未渲染",
      suggestion: "切换定位策略",
    });
    l.screenshot({ dataUri: "data:image/png;base64,QQ==", caption: "截图" });
    const msg = buildAIMessage({ ok: false, text: "执行失败", events: l.toArray() });
    expect(msg.ok).toBe(false);
    expect(msg.error?.code).toBe("ACTION_FAILED_CLICK");
    expect(msg.error?.suggestion).toContain("定位");
    expect(msg.images).toHaveLength(1);
    expect(msg.images?.[0].mimeType).toBe("image/png");
    expect(msg.logs).toBeDefined();
    expect(msg.logs!.length).toBeGreaterThanOrEqual(3);
  });

  it("messageToContent 序列化为 MCP content 数组（text+image）", () => {
    const l = new SessionLogger();
    l.error({
      message: "失败",
      code: "ERR",
      reason: "network-failure",
      raw: "404",
      explanation: "资源 404",
      suggestion: "核对路径",
    });
    l.screenshot({ dataUri: "data:image/png;base64,AAA=", caption: "图" });
    const msg = buildAIMessage({ ok: false, text: "有问题", events: l.toArray() });
    const content = messageToContent(msg);
    expect(content[0]).toMatchObject({ type: "text", text: "有问题" });
    const imgContent = content.find((c) => c.type === "image");
    expect(imgContent).toBeDefined();
    expect((imgContent as any).mimeType).toBe("image/png");
  });

  it("无事件时返回基础消息", () => {
    const msg = buildAIMessage({ ok: true, text: "成功" });
    expect(msg.ok).toBe(true);
    expect(msg.error).toBeUndefined();
    expect(msg.images).toBeUndefined();
  });
});
