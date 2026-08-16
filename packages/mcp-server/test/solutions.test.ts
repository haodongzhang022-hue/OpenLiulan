import { describe, it, expect } from "vitest";
import {
  RepeatErrorRegistry,
  fingerprintError,
  lookupSolution,
  matchSolution,
  renderAdvice,
  augmentWithSolution,
  SOLUTION_PLAYBOOK,
} from "../src/solutions.js";

describe("错误指纹归一化 fingerprintError", () => {
  it("识别网络 404/500", () => {
    expect(fingerprintError("网络存在 2 个失败请求")).toBe("network:http-error");
    expect(fingerprintError("请求失败 GET https://x 404")).toBe("network:http-error");
  });

  it("识别 CORS 跨域", () => {
    expect(fingerprintError("Access-Control-Allow-Origin 缺失，跨域被阻断")).toBe("network:cors");
    expect(fingerprintError("跨域问题")).toBe("network:cors");
  });

  it("识别 JS 未捕获异常", () => {
    expect(fingerprintError("页面抛出了 JS 未捕获异常")).toBe("console:js-exception");
    expect(fingerprintError("Uncaught TypeError: x is not a function")).toBe("console:js-exception");
  });

  it("识别 DOM 定位失败", () => {
    expect(fingerprintError("未找到元素 ref=r3")).toBe("dom:locator-failed");
    expect(fingerprintError("element not found")).toBe("dom:locator-failed");
  });

  it("识别性能 TTFB / 慢请求", () => {
    expect(fingerprintError("TTFB 偏高: 1500ms")).toBe("performance:ttfb");
  });

  it("识别鉴权重定向", () => {
    expect(fingerprintError("401 未授权，跳转登录")).toBe("auth:redirect");
  });

  it("兜底为 generic", () => {
    expect(fingerprintError("完全未知的随机错误")).toBe("generic:action-failed");
  });
});

describe("解决方案查找 lookupSolution", () => {
  it("按 fingerprint 命中内置方案", () => {
    const e = lookupSolution("网络存在 1 个失败请求", "network:http-error");
    expect(e).toBeDefined();
    expect(e!.level).toBe("auto");
  });

  it("复杂问题（跨域）为 guide 级别，带推荐 skill / 开源项目", () => {
    const e = lookupSolution("CORS 跨域被阻断");
    expect(e).toBeDefined();
    expect(e!.id).toBe("net-cors");
    expect(e!.level).toBe("guide");
    expect(e!.skill).toBeDefined();
    expect(e!.openSource).toBeDefined();
  });

  it("playbook 覆盖常见问题类型", () => {
    const ids = SOLUTION_PLAYBOOK.map((s) => s.id);
    expect(ids).toContain("net-404-500");
    expect(ids).toContain("net-cors");
    expect(ids).toContain("console-js-exception");
    expect(ids).toContain("dom-locator-failed");
    expect(ids).toContain("perf-ttfb-slow");
    expect(ids).toContain("dom-ssr-hydration");
    expect(ids).toContain("login-auth-redirect");
    expect(ids).toContain("blank-white-page");
  });
});

describe("重复错误二次触发 RepeatErrorRegistry + matchSolution", () => {
  it("第 1 次同指纹错误不触发，第 2 次才触发推荐", () => {
    const reg = new RepeatErrorRegistry();
    // 第 1 次
    const first = matchSolution(reg, "网络存在 1 个失败请求 404");
    expect(first.triggered).toBe(false);
    expect(first.occurrences).toBe(1);
    // 第 2 次（同指纹）
    const second = matchSolution(reg, "请求失败 GET /api 404");
    expect(second.triggered).toBe(true);
    expect(second.occurrences).toBe(2);
    expect(second.entry).toBeDefined();
    expect(second.advice).toContain("方案推荐");
  });

  it("不同指纹互不影响，各自计数", () => {
    const reg = new RepeatErrorRegistry();
    matchSolution(reg, "网络存在 1 个失败请求"); // network:http-error 第1次
    const other = matchSolution(reg, "页面抛出了 JS 未捕获异常"); // js-exception 第1次
    expect(other.triggered).toBe(false);
    // 第2次网络错误触发
    const again = matchSolution(reg, "请求失败 500");
    expect(again.triggered).toBe(true);
  });

  it("auto 级别方案与 guide 级别方案分级正确", () => {
    const reg = new RepeatErrorRegistry();
    matchSolution(reg, "网络存在 1 个失败请求"); // 第1次
    const m = matchSolution(reg, "请求失败 404"); // 第2次
    expect(m.entry!.level).toBe("auto");
    // 复杂问题
    const reg2 = new RepeatErrorRegistry();
    matchSolution(reg2, "CORS 跨域"); // 第1次
    const m2 = matchSolution(reg2, "access-control 缺失"); // 第2次
    expect(m2.entry!.level).toBe("guide");
    expect(m2.advice).toContain("推荐 skill");
    expect(m2.advice).toContain("开源项目");
  });

  it("可自定义触发阈值", () => {
    const reg = new RepeatErrorRegistry(3);
    matchSolution(reg, "未找到元素 a");
    matchSolution(reg, "element not found");
    const m = matchSolution(reg, "定位失败");
    expect(m.triggered).toBe(true);
    expect(m.occurrences).toBe(3);
  });
});

describe("augmentWithSolution 注入", () => {
  it("未触发时不改变文本", () => {
    const reg = new RepeatErrorRegistry();
    const ctx = augmentWithSolution(reg, "# 诊断结果\n- 一条问题");
    expect(ctx).not.toContain("方案推荐");
  });

  it("触发后追加方案推荐", () => {
    const reg = new RepeatErrorRegistry();
    augmentWithSolution(reg, "网络存在 1 个失败请求");
    const ctx = augmentWithSolution(reg, "请求失败 404");
    expect(ctx).toContain("方案推荐");
    expect(ctx).toContain("404");
  });
});

describe("renderAdvice", () => {
  it("guide 级别渲染 skill 与开源项目", () => {
    const e = lookupSolution("CORS 跨域")!;
    const advice = renderAdvice(e);
    expect(advice).toContain("方案推荐");
    expect(advice).toContain(e.skill!);
    expect(advice).toContain(e.openSource!);
    expect(advice).toContain("思路");
  });
});
