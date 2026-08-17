import { describe, it, expect } from "vitest";
import { VizPanel, createViz } from "@openliulan/viz";

describe("@openliulan/viz 条件触发式可视化面板", () => {
  it("默认关闭（off），不产生可视化", () => {
    const viz = new VizPanel();
    expect(viz.enabled).toBe(false);
    expect(viz.currentMode).toBe("off");
    expect(viz.render()).toContain("已关闭");
  });

  it("条件触发：用户声明需要调试时启用", () => {
    const viz = new VizPanel({ mode: "on-demand" });
    expect(viz.enabled).toBe(false);
    // 用户声明"想看到调试"
    viz.enable("user-requested-debugging");
    expect(viz.enabled).toBe(true);
    expect(viz.currentMode).toBe("on-demand");
  });

  it("always 模式始终启用", () => {
    const viz = new VizPanel({ mode: "always" });
    expect(viz.enabled).toBe(true);
    // 尝试 disable 不生效
    viz.disable();
    expect(viz.enabled).toBe(true);
  });

  it("记录动作事件并渲染可读轨迹", () => {
    const viz = new VizPanel({ mode: "always" });
    viz.record("action", "点击登录按钮", { payload: { selector: "#login" } });
    viz.record("diagnose", "页面无异常");
    const rendered = viz.render();
    expect(rendered).toContain("🎯");
    expect(rendered).toContain("点击登录按钮");
    expect(rendered).toContain("🔍");
    expect(rendered).toContain("页面无异常");
  });

  it("记录 AI 决策并附带解释（AI 伦理透明化）", () => {
    const viz = new VizPanel({ mode: "always" });
    viz.recordDecision("导航到 example.com", "因为目标数据在该页面", false);
    const rendered = viz.render();
    expect(rendered).toContain("🧠");
    expect(rendered).toContain("因为目标数据在该页面");
  });

  it("请求用户确认（AI 伦理回环）", () => {
    const viz = new VizPanel({ mode: "always" });
    viz.requestConfirmation("是否继续抓取下一页？", "页面可能有多页数据需要确认");
    expect(viz.hasPendingConfirmation).toBe(true);
    const rendered = viz.render();
    expect(rendered).toContain("🤝");
    expect(rendered).toContain("需要您的确认");
    expect(rendered).toContain("⏸️");

    // 用户确认后待决项清除
    viz.confirm();
    expect(viz.hasPendingConfirmation).toBe(false);
    expect(viz.render()).toContain("✅已确认");
  });

  it("JSON 导出结构完整", () => {
    const viz = new VizPanel({ mode: "always", format: "json" });
    viz.record("action", "测试事件", { payload: { key: "value" } });
    const events = viz.toJSON();
    expect(events).toHaveLength(1);
    expect(events[0].seq).toBe(1);
    expect(events[0].type).toBe("action");
    expect(events[0].payload).toEqual({ key: "value" });
  });

  it("事件数量上限控制", () => {
    const viz = new VizPanel({ mode: "always", maxEvents: 3 });
    for (let i = 0; i < 10; i++) {
      viz.record("system", `事件${i}`);
    }
    expect(viz.count).toBe(3);
    // 保留的是最新的 3 条
    expect(viz.events[0].message).toBe("事件7");
  });

  it("关闭后 render 显示提示", () => {
    const viz = new VizPanel();  // 默认 off
    viz.record("action", "这个不会被渲染");
    const rendered = viz.render();
    expect(rendered).toContain("已关闭");
  });

  it("createViz 工厂函数创建实例", () => {
    const viz = createViz({ mode: "always" });
    expect(viz).toBeInstanceOf(VizPanel);
    expect(viz.enabled).toBe(true);
  });

  it("disable 后不可用（非 always 模式）", () => {
    const viz = new VizPanel({ mode: "on-demand" });
    viz.enable();
    viz.disable();
    expect(viz.enabled).toBe(false);
    expect(viz.render()).toContain("已关闭");
  });
});
