/**
 * Stealth + Viz 集成示例
 *
 * 演示：
 * 1. 启用 Stealth 防检测（数据采集场景）
 * 2. 条件触发式可视化（用户声明需要调试时启用）
 *
 * 运行前需安装浏览器: npx playwright install chromium
 * 运行: node examples/stealth-viz.mjs
 */
import { ForgeBrowser } from "@openliulan/core";
import { PlaywrightEngine } from "@openliulan/engines";
import { createViz } from "@openliulan/viz";
import { createStealth } from "@openliulan/stealth";

async function main() {
  // ─── 1. 创建条件触发式可视化面板（默认关闭） ───
  const viz = createViz({ mode: "on-demand" });
  console.log("可视化初始状态:", viz.enabled ? "开启" : "关闭");

  // 用户声明需要调试 → 条件触发启用
  viz.enable("user-requested-debugging");
  console.log("可视化启用状态:", viz.enabled ? "开启" : "关闭");
  viz.recordDecision("开始数据采集会话", "用户需要从公开页面获取数据");

  // ─── 2. 创建启用 Stealth 的引擎 ───
  const stealth = createStealth({
    enabled: true,
    level: "full",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0",
  });
  console.log("Stealth 签名:", stealth.signature);
  console.log("Stealth 启动参数:", stealth.buildLaunchArgs().join(" "));

  const engine = new PlaywrightEngine({
    headless: true,
    stealth,
  });
  const forge = new ForgeBrowser(engine, { autoDiagnoseOnError: true });

  try {
    await forge.start();

    // ─── 3. 导航并记录 AI 决策 ───
    viz.recordDecision("导航到 example.com", "这是公开测试站点，数据采集起点");
    const nav = await forge.act({ type: "navigate", url: "https://example.com" });
    console.log("导航:", nav.summary);
    viz.record("action", `导航: ${nav.summary}`);

    // ─── 4. 提取数据 ───
    viz.recordDecision("提取页面主标题", "获取页面 h1 内容作为采集字段");
    const extract = await forge.act({
      type: "extract",
      selector: "h1",
      description: "提取页面主标题",
    });
    console.log("提取:", extract.data);
    viz.record("action", `提取: ${JSON.stringify(extract.data)}`);

    // ─── 5. 请求用户确认（AI 伦理回环） ───
    viz.requestConfirmation("是否继续采集更多页面？", "可能需要遍历多页才能拿到完整数据");
    console.log("\n有需要用户确认的待决事项:", viz.hasPendingConfirmation);
    viz.confirm(); // 用户确认

    // ─── 6. 输出完整可视化轨迹 ───
    console.log("\n" + viz.render());

    // ─── 7. 5 星诊断 ───
    const report = await forge.captureDiagnostics();
    viz.record("diagnose", `诊断完成: JS 异常 ${report.jsExceptions.length} 条, 控制台错误 ${report.console.length} 条`);

  } finally {
    await forge.stop();
    console.log("\nStealth + Viz 示例完成");
  }
}

main().catch((err) => {
  console.error("示例失败:", err);
  process.exit(1);
});
