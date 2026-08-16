/**
 * Forge MCP CLI 入口
 *
 * 用法：
 *   forge-mcp --stdio            # stdio MCP 服务（供 MCP 客户端）
 *   forge-mcp --http --port 8787 # HTTP 服务（供 cnb.cool / webhook）
 *   forge-mcp --connect <url>    # 连接已启动的浏览器（CDP）
 *   forge-mcp --ci-spec <json>   # CNB CI/Pipeline 冒烟检查（在云端构建机执行）
 */
import { ForgeMcp } from "./forge-mcp.js";
import { createCnbStdioServer, createCnbHttpServer, runCiCheck } from "./adapters/cnb.js";
import { buildHarnessFunctionSchemas } from "./adapters/harness.js";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const mcp = new ForgeMcp({
  headless: args.headless !== "false",
  connectUrl: args.connect,
});

if (args["harness-schema"]) {
  // 输出 deepseek harness 的 function calling schema
  console.log(JSON.stringify(buildHarnessFunctionSchemas(mcp), null, 2));
  process.exit(0);
}

if (args["ci-spec"]) {
  // CNB CI/Pipeline 冒烟检查：从 JSON 文件读取步骤并在云端构建机执行
  const specPath = args["ci-spec"];
  const cfg = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(specPath, "utf8")));
  const result = await runCiCheck(mcp, {
    steps: cfg.steps,
    artifactDir: cfg.artifactDir ?? "./forge-artifacts",
    persistArtifacts: cfg.persistArtifacts ?? true,
  });
  console.log(result.report);
  await mcp.shutdown();
  process.exit(result.ok ? 0 : 1);
}

if (args.http) {
  const port = Number(args.port || 8787);
  createCnbHttpServer(mcp, port);
  console.log(`Forge MCP HTTP 服务已启动: http://localhost:${port}  (health: /health)`);
  console.log(`POST /tools/call  body: {"name":"observe","arguments":{}}`);
} else {
  // 默认 stdio
  createCnbStdioServer(mcp)();
  console.error("Forge MCP stdio 服务已启动");
}
