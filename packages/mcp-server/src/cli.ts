/**
 * Forge MCP CLI 入口
 *
 * 用法：
 *   forge-mcp --stdio            # stdio MCP 服务（供 MCP 客户端）
 *   forge-mcp --http --port 8787 # HTTP 服务（供 cnb.cool / webhook）
 *   forge-mcp --connect <url>    # 连接已启动的浏览器（CDP）
 *   forge-mcp --stealth true     # 启用防检测（Stealth）模式
 *   forge-mcp --stealth-level full  # 防检测级别（basic/full）
 *   forge-mcp --stealth-ua <ua>  # 自定义 User-Agent
 *   forge-mcp --ci-spec <json>   # CNB CI/Pipeline 冒烟检查（在云端构建机执行）
 */
import { ForgeMcp } from "./forge-mcp.js";
import { createCnbStdioServer, createCnbHttpServer, runCiCheck, runDebugSession } from "./adapters/cnb.js";
import { buildHarnessFunctionSchemas } from "./adapters/harness.js";
import { httpAuthConfigFromEnv, generateApiToken } from "./security.js";

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
  stealth: {
    enabled: args.stealth === "true" || args.stealth === "1",
    level: (args["stealth-level"] as any) ?? "basic",
    userAgent: args["stealth-ua"],
  },
});

if (args["harness-schema"]) {
  // 输出 deepseek harness 的 function calling schema
  console.log(JSON.stringify(buildHarnessFunctionSchemas(mcp), null, 2));
  process.exit(0);
}

if (args["debug-session"]) {
  // CNB 调试会话：从 JSON 文件读取配置，采集结构化调试报告
  // 用法: forge-mcp --debug-session ./debug-session.json [--solution-repo ./solutions-repo.json]
  // debug-session.json: { "goal": "...", "url": "...", "owner": "developer-ai", "reportFile": "...", "screenshot": true }
  const specPath = args["debug-session"];
  const fs = await import("node:fs");
  const cfg = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const report = await runDebugSession(mcp, {
    goal: cfg.goal ?? "浏览器调试会话",
    url: cfg.url,
    owner: cfg.owner ?? "developer-ai",
    reportFile: cfg.reportFile ?? "./forge-debug-report.md",
    screenshot: cfg.screenshot ?? true,
    solutionRepoFile: args["solution-repo"] ?? cfg.solutionRepoFile,
  });
  await mcp.shutdown();
  process.exit(report.ok ? 0 : 1);
}

if (args["ci-spec"]) {
  // CNB CI/Pipeline 冒烟检查：从 JSON 文件读取步骤并在云端构建机执行
  // 用法: forge-mcp --ci-spec ./ci-spec.json [--solution-repo ./solutions-repo.json]
  //   --solution-repo 提供后，启用可成长方案库：错误匹配用内置+沉淀库，未命中新错误记候选，报告注入已沉淀方案
  const specPath = args["ci-spec"];
  const cfg = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(specPath, "utf8")));
  const result = await runCiCheck(mcp, {
    steps: cfg.steps,
    artifactDir: cfg.artifactDir ?? "./forge-artifacts",
    persistArtifacts: cfg.persistArtifacts ?? true,
    solutionRepoFile: args["solution-repo"] ?? cfg.solutionRepoFile,
  });
  console.log(result.report);
  await mcp.shutdown();
  process.exit(result.ok ? 0 : 1);
}

if (args["gen-token"]) {
  // 生成一个安全的 API Token，供 FORGE_HTTP_TOKEN 使用
  console.log(generateApiToken());
  process.exit(0);
}

if (args.http) {
  const port = Number(args.port || 8787);
  const auth = httpAuthConfigFromEnv();
  createCnbHttpServer(mcp, port, auth);
  console.log(`Forge MCP HTTP 服务已启动: http://localhost:${port}  (health: /health)`);
  console.log(`POST /tools/call  body: {"name":"observe","arguments":{}}`);
  if (auth.enabled) {
    console.log(`[安全] 已启用 Bearer Token 鉴权（FORGE_HTTP_TOKEN），需带 Authorization: Bearer <token> 访问。`);
  } else {
    console.log(`[安全] 未配置 FORGE_HTTP_TOKEN，默认仅允许本机回环访问（FORGE_HTTP_LOOPBACK_ONLY=true）。`);
    console.log(`      如需远程访问请设置环境变量 FORGE_HTTP_TOKEN 与 FORGE_HTTP_ALLOWED_ORIGINS。`);
  }
} else {
  // 默认 stdio
  createCnbStdioServer(mcp)();
  console.error("Forge MCP stdio 服务已启动");
}
