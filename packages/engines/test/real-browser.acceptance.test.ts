/**
 * 真实浏览器验收测试（端到端功能性验证，非 mock）
 *
 * ⚠️ 本测试不使用 mock，而是真正启动 headless Chromium 并驱动框架的
 * PlaywrightEngine/ForgeBrowser 真实代码路径控制真实网页。
 * 目的：防止「假装测试」——编码/单测无法发现真实浏览器中的运行期缺陷
 * （如 page.evaluate 浏览器上下文闭包引用缺失、DOM 观察失效等），
 * 这些只能通过真实控制网页 + 断言真实 DOM 状态来拦截。
 *
 * 依赖：需要安装 Playwright 浏览器（`npx playwright install chromium`）。
 * 这是 CI 中强制执行的真实网页验收，必须真实通过。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PlaywrightEngine } from "@browser-ai-forge/engines";
import { ForgeBrowser } from "@browser-ai-forge/core";

let engine: PlaywrightEngine;
let forge: ForgeBrowser;

beforeAll(async () => {
  engine = new PlaywrightEngine({ headless: true });
  forge = new ForgeBrowser(engine, { autoDiagnoseOnError: true });
  await forge.start();
});

afterAll(async () => {
  await forge.stop();
});

describe("真实浏览器验收：框架真实代码路径（观察/提取/点击/诊断）", () => {
  it("真实导航 + 框架 observe 观察真实 DOM", async () => {
    await forge.act({ type: "navigate", url: "https://example.com" });
    const snap = await forge.observe({ maxNodes: 50, maxTextLength: 40 });
    // 真实 DOM 中必然存在 h1（页面主标题）
    expect(snap.title).toBe("Example Domain");
    expect(snap.interactive.length).toBeGreaterThan(0);
  });

  it("框架 extract 提取真实页面主标题", async () => {
    const result = await forge.act({ type: "extract", selector: "h1", description: "提取主标题" });
    expect(result.ok).toBe(true);
    expect((result.data as any)?.text).toBe("Example Domain");
  });

  it("框架点击页面链接并真实跳转（对齐用户行为）", async () => {
    await forge.act({ type: "navigate", url: "https://example.com" });
    const click = await forge.act({ type: "click", text: "Learn more" });
    expect(click.ok).toBe(true);
    // 点击触发导航，等待新页面加载后观察 URL
    // 真实网络跳转（example.com → iana.org）在 CI 环境可能较慢，预留足够超时预算
    await new Promise((r) => setTimeout(r, 2500));
    const snap = await forge.observe({ maxNodes: 20 });
    expect(snap.url).toMatch(/iana\.org/);
  }, 20_000);

  it("框架 5 星诊断采集真实控制台/网络/JS 异常", async () => {
    await forge.act({ type: "navigate", url: "https://example.com" });
    const report = await forge.captureDiagnostics();
    // 健康页面不应有 JS 异常
    expect(report.jsExceptions).toHaveLength(0);
    // 报告结构完整
    expect(Array.isArray(report.console)).toBe(true);
    expect(Array.isArray(report.network)).toBe(true);
  });
});
