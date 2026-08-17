/**
 * AI 协作示例：演示事件日志 / 图片 / 错误传递 / 消息协议
 *
 * 展示如何通过 ForgeMcp 的会话事件流，把「动作轨迹 + 日志 + 截图 +
 * bug 报错原因与解释」统一传递给外部 AI。
 *
 * 运行前需安装浏览器: npx playwright install chromium
 * 运行: node examples/ai-collaboration.mjs
 */
import { ForgeMcp, buildAIMessage, messageToContent } from "@browser-ai-forge/mcp-server";

async function main() {
  const mcp = new ForgeMcp({ headless: true });

  // 订阅实时事件流（外部 AI / 日志系统可实时接收）
  mcp.logger.subscribe((e) => {
    console.log(`[event] ${new Date(e.ts).toISOString().slice(11, 19)} [${e.level}/${e.category}] ${e.message}`);
  });

  try {
    // 1. 导航
    await mcp.callTool("act", { type: "navigate", url: "https://example.com" });

    // 2. 观察
    await mcp.callTool("observe", {});

    // 3. 截图（会写入 ScreenshotEvent，供多模态 AI 消费）
    await mcp.callTool("screenshot", { caption: "首页截图" });

    // 4. 触发一次失败动作（演示标准错误事件传递：报错原因 + 解释 + 建议）
    const fail = await mcp.callTool("act", {
      type: "click",
      text: "这个元素肯定不存在_xyz",
    });
    console.log("\n=== 失败动作结果 ===");
    console.log(fail.content[0].text.slice(0, 200));

    // 5. 用 AIMessage 协议聚合：文本 + 图片 + 错误 + 日志，交给外部 AI
    console.log("\n=== AI 协作消息（AIMessage）===");
    const msg = buildAIMessage({
      ok: fail.ok,
      text: fail.content[0].text,
      events: mcp.logger.toArray(),
    });
    if (msg.error) {
      console.log(`错误码: ${msg.error.code}`);
      console.log(`根因: ${msg.error.reason}`);
      console.log(`原因: ${msg.error.explanation}`);
      console.log(`建议: ${msg.error.suggestion}`);
    }
    console.log(`图片数: ${msg.images?.length ?? 0} | 日志条目: ${msg.logs?.length ?? 0}`);

    // 6. 序列化为 MCP content（含 image 块），供 MCP 客户端转发
    const content = messageToContent(msg);
    console.log(`\n=== MCP content（${content.length} 块）===\n块类型: ${content.map((c) => c.type).join(", ")}`);

    // 7. 用 session_log 工具拉取事件流（外部 AI 运行时追踪）
    const log = await mcp.callTool("session_log", { format: "json" });
    const events = log.structured?.events;
    console.log(`\n=== session_log 事件流（${events.length} 条）===\n类别: ${[...new Set(events.map((e) => e.category))].join(", ")}`);

    await mcp.shutdown();
  } finally {
    await mcp.shutdown();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
