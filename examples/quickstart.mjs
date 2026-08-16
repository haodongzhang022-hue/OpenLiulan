/**
 * 快速上手示例：演示 Forge 的整合能力
 *
 * 运行前需安装浏览器: npx playwright install chromium
 * 运行: node examples/quickstart.mjs
 */
import { ForgeBrowser } from "@browser-ai-forge/core";
import { PlaywrightEngine } from "@browser-ai-forge/engines";
import { summarize } from "@browser-ai-forge/diagnosis";

async function main() {
  // 1. 创建引擎 + Forge 门面（整合核心）
  const engine = new PlaywrightEngine({ headless: true });
  const forge = new ForgeBrowser(engine, {
    autoDiagnoseOnError: true, // 动作失败自动诊断
  });

  try {
    await forge.start();

    // 2. 导航
    const nav = await forge.act({ type: "navigate", url: "https://example.com" });
    console.log("导航:", nav.summary);

    // 3. 观察页面（高效快照）
    const snap = await forge.observe();
    console.log(`快照: 标题="${snap.title}" 可交互元素=${snap.interactive.length} 约${snap.stats.approximateTokens}tokens`);
    console.log("可交互:", snap.interactive.slice(0, 5).map((e) => `${e.ref} <${e.tag}> "${e.text}"`).join("\n"));

    // 4. 提取内容
    const extract = await forge.act({
      type: "extract",
      selector: "h1",
      description: "提取页面主标题",
    });
    console.log("提取:", extract.data);

    // 5. 5 星诊断
    const report = await forge.captureDiagnostics();
    const summary = summarize(report);
    console.log(`诊断: ${summary.healthy ? "健康" : "存在问题"} | 问题数=${summary.issues.length}`);
    if (summary.suggestions.length) console.log("建议:", summary.suggestions);

    await forge.stop();
  } finally {
    await forge.stop();
  }
}

main().catch((e) => {
  console.error("出错:", e);
  process.exit(1);
});
