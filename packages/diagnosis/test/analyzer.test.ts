import { describe, it, expect } from "vitest";
import { analyzeNetwork, analyzePerformance, summarize } from "@browser-ai-forge/diagnosis";

describe("网络诊断分析", () => {
  it("识别失败请求为错误级", () => {
    const { refs } = analyzeNetwork([
      { url: "https://a.com/x.js", method: "GET", status: 404, durationMs: 10 },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].severity).toBe("warning");
    expect(refs[0].message).toContain("404");
  });

  it("识别 500 为错误级", () => {
    const { refs } = analyzeNetwork([
      { url: "https://a.com/api", method: "POST", status: 500, durationMs: 20 },
    ]);
    expect(refs[0].severity).toBe("error");
  });

  it("识别慢请求", () => {
    const { refs } = analyzeNetwork([
      { url: "https://a.com/slow", method: "GET", status: 200, durationMs: 4000 },
    ]);
    expect(refs.some((r) => r.message.includes("慢请求"))).toBe(true);
  });
});

describe("性能诊断分析", () => {
  it("识别高 TTFB", () => {
    const { refs } = analyzePerformance({
      ttfb: 2000, domContentLoaded: 100, loadEvent: 200,
      resources: { count: 5, totalBytes: 1024 }, longTasks: 0,
    });
    expect(refs.some((r) => r.message.includes("TTFB"))).toBe(true);
  });

  it("识别长任务", () => {
    const { refs } = analyzePerformance({
      ttfb: 100, domContentLoaded: 100, loadEvent: 200,
      resources: { count: 5, totalBytes: 1024 }, longTasks: 8,
    });
    expect(refs.some((r) => r.message.includes("长任务"))).toBe(true);
  });
});

describe("诊断摘要", () => {
  it("健康页面无建议", () => {
    const summary = summarize({
      console: [], network: [], dom: [], performance: [], jsExceptions: [], accessibility: [],
    });
    expect(summary.healthy).toBe(true);
    expect(summary.issues).toHaveLength(0);
  });

  it("有 JS 异常时给出建议", () => {
    const summary = summarize({
      console: [],
      network: [],
      dom: [],
      performance: [],
      jsExceptions: [{ kind: "js-exception", severity: "error", message: "TypeError", timestamp: 0 }],
      accessibility: [],
    });
    expect(summary.healthy).toBe(false);
    expect(summary.issues[0].category).toBe("js-exception");
    expect(summary.suggestions.length).toBeGreaterThan(0);
  });
});
