/**
 * deepseek harness 接入示例
 *
 * 演示如何把 Forge MCP 工具接入 deepseek harness 的函数调用循环。
 * harness 端拿到 tools schema 后做 function calling，本示例展示注册方式。
 */
import { ForgeMcp } from "@browser-ai-forge/mcp-server";
import { buildHarnessFunctionSchemas, toHarnessTools } from "@browser-ai-forge/mcp-server";

export function createHarnessTools() {
  const mcp = new ForgeMcp({ headless: true });

  // 方式 A：deepseek 函数调用 schema（注入 system prompt / tools）
  const schemas = buildHarnessFunctionSchemas(mcp);

  // 方式 B：可直接调用的函数集合（harness tool_loop）
  const tools = toHarnessTools(mcp);

  return {
    mcp,
    schemas,
    tools,
    // harness 端通常在循环中按序调用：
    // const result = await tools.find(t => t.name === toolName).fn(args)
  };
}

// 示例：展示 schemas 结构
if (process.argv[1]?.endsWith("harness-example.mjs")) {
  const { mcp, schemas } = createHarnessTools();
  console.log(JSON.stringify(schemas.map((s) => s.function.name), null, 2));
  await mcp.shutdown();
}
