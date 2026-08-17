import { describe, it, expect } from "vitest";
import { locateBySemantic, snapshotToPrompt, buildPlannerSystemPrompt } from "@openliulan/ai-layer";
import type { PageSnapshot } from "@openliulan/core";

const snap: PageSnapshot = {
  url: "https://example.com",
  title: "登录页",
  timestamp: "t",
  readyState: "complete",
  stats: { totalNodes: 5, emittedNodes: 5, truncatedNodes: 0, approximateTokens: 20 },
  root: { ref: "r0", tag: "body", text: "", attributes: {}, interactive: false, depth: 0 },
  interactive: [
    { ref: "r1", tag: "input", text: "邮箱", selector: "input[name=email]" },
    { ref: "r2", tag: "button", text: "登录", selector: "button" },
  ],
};

describe("语义定位", () => {
  it("文本包含匹配", () => {
    const res = locateBySemantic(snap, "登录");
    expect(res.ref).toBe("r2");
    expect(res.score).toBeGreaterThan(0);
  });

  it("词元重叠匹配", () => {
    const res = locateBySemantic(snap, "邮箱输入");
    expect(res.ref).toBe("r1");
  });

  it("无匹配返回空", () => {
    const res = locateBySemantic(snap, "完全不存在的东西xyz");
    expect(res.ref).toBeUndefined();
  });
});

describe("Prompt 构建", () => {
  it("snapshotToPrompt 输出交互索引", () => {
    const prompt = snapshotToPrompt(snap);
    expect(prompt).toContain("r1");
    expect(prompt).toContain("登录页");
  });

  it("buildPlannerSystemPrompt 说明支持动作", () => {
    const prompt = buildPlannerSystemPrompt(["click", "fill"]);
    expect(prompt).toContain("click");
  });
});
