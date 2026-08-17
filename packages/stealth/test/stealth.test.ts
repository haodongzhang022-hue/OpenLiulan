import { describe, it, expect } from "vitest";
import { StealthManager, createStealth } from "@openliulan/stealth";

describe("@openliulan/stealth 防检测模块", () => {
  it("默认关闭（enabled=false），不注入启动参数和脚本", () => {
    const stealth = new StealthManager();
    expect(stealth.isEnabled).toBe(false);
    expect(stealth.buildLaunchArgs()).toHaveLength(0);
    expect(stealth.buildInitScript()).toBe("");
    expect(stealth.signature).toBe("stealth-off");
  });

  it("启用后注入反自动化启动参数", () => {
    const stealth = new StealthManager({ enabled: true });
    const args = stealth.buildLaunchArgs();
    expect(args).toContain("--disable-blink-features=AutomationControlled");
    expect(args).toContain("--disable-automation");
    expect(args).toContain("--no-first-run");
  });

  it("启用后注入反指纹脚本（basic 级别）", () => {
    const stealth = new StealthManager({ enabled: true, level: "basic" });
    const script = stealth.buildInitScript();
    expect(script).toContain("navigator.webdriver");
    expect(script).toContain("navigator, 'plugins'");
    expect(script).toContain("navigator, 'languages'");
    // basic 不包含 full 级别的 WebGL 伪装
    expect(script).not.toContain("WebGLRenderingContext");
  });

  it("full 级别包含 WebGL 伪装和更多指纹", () => {
    const stealth = new StealthManager({ enabled: true, level: "full" });
    const script = stealth.buildInitScript();
    expect(script).toContain("WebGLRenderingContext");
    expect(script).toContain("deviceMemory");
    expect(script).toContain("hardwareConcurrency");
    expect(script).toContain("colorDepth");
  });

  it("自定义 UA 生效", () => {
    const stealth = new StealthManager({
      enabled: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0",
    });
    expect(stealth.signature).toContain("ua=custom");
  });

  it("人类行为模拟：延迟落在配置区间内", () => {
    const stealth = new StealthManager({ enabled: true, humanActionDelay: [500, 800] });
    for (let i = 0; i < 20; i++) {
      const delay = stealth.humanDelay();
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(800);
    }
  });

  it("人类行为模拟：打字延迟落在配置区间内", () => {
    const stealth = new StealthManager({ enabled: true, humanTypingDelay: [10, 50] });
    for (let i = 0; i < 20; i++) {
      const delay = stealth.humanTypingDelayMs();
      expect(delay).toBeGreaterThanOrEqual(10);
      expect(delay).toBeLessThanOrEqual(50);
    }
  });

  it("禁用时 humanDelay 返回 0", () => {
    const stealth = new StealthManager();
    expect(stealth.humanDelay()).toBe(0);
    expect(stealth.humanTypingDelayMs()).toBe(0);
  });

  it("人类鼠标路径：生成从起点到终点的轨迹", () => {
    const stealth = new StealthManager({ enabled: true, humanMouseTrajectory: true });
    const path = stealth.humanMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 10);
    expect(path.length).toBe(10);
    const last = path[path.length - 1];
    expect(last[0]).toBe(100);
    expect(last[1]).toBe(100);
  });

  it("禁用鼠标轨迹时直接跳到目标点", () => {
    const stealth = new StealthManager({ enabled: true, humanMouseTrajectory: false });
    const path = stealth.humanMousePath({ x: 0, y: 0 }, { x: 50, y: 50 }, 10);
    expect(path).toEqual([[50, 50]]);
  });

  it("自定义额外启动参数被合并", () => {
    const stealth = new StealthManager({ enabled: true, extraArgs: ["--my-custom-flag"] });
    const args = stealth.buildLaunchArgs();
    expect(args).toContain("--my-custom-flag");
  });

  it("createStealth 工厂函数创建实例", () => {
    const stealth = createStealth({ enabled: true, level: "full" });
    expect(stealth).toBeInstanceOf(StealthManager);
    expect(stealth.isEnabled).toBe(true);
    expect(stealth.options.level).toBe("full");
  });
});
