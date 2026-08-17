/**
 * CNB 调试会话示例 —— 让开发 AI 拿到「直接观察到的、可行动的」调试信息
 *
 * 核心思想：
 *  - Forge MCP 直接连接真实浏览器（自带眼睛），能看到 DOM/控制台/网络/JS 异常
 *  - 而「开发 AI」之前只能隔着代码猜测问题。
 *  - 通过 runDebugSession 把一手调试信息结构化，交给开发 AI（CodeBuddy/cnb.cool）
 *    结合代码全局视角修复，或由 Agent 自己负责完整调试。
 *
 * 运行前需安装浏览器: npx playwright install chromium
 * 运行: node examples/debug-session.mjs
 */
import { ForgeMcp, runDebugSession } from "@openliulan/mcp-server";

async function main() {
  const mcp = new ForgeMcp({ headless: true });

  try {
    // 交给开发 AI 决策：Agent 只负责控制 + 观察 + 反馈结构化调试发现
    const report = await runDebugSession(mcp, {
      goal: "排查 example.com 页面是否正常渲染",
      url: "https://example.com",
      owner: "developer-ai", // 交给开发 AI（CodeBuddy/cnb.cool）修复
      reportFile: "./forge-debug-report.md",
      screenshot: true,
    });

    console.log("=== 调试会话结果 ===");
    console.log(`目标: ${report.goal}`);
    console.log(`结果: ${report.ok ? "✅ 健康" : "❌ 存在错误"}`);
    console.log(`结构化发现 ${report.findings.length} 条:`);
    for (const f of report.findings) {
      console.log(`  [${f.category}/${f.severity}] ${f.message}`);
      console.log(`    → 建议: ${f.suggestion}`);
    }
    console.log("\n=== markdown 报告（可回写 PR/Issue）===");
    console.log(report.markdown);

    await mcp.shutdown();
  } finally {
    await mcp.shutdown();
  }
}

main().catch((e) => {
  console.error("出错:", e);
  process.exit(1);
});
