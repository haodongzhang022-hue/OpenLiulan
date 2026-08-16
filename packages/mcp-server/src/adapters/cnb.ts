/**
 * cnb.cool 适配
 *
 * cnb.cool 是 CNB 开源平台。CodeBuddy 等 AI 助手可通过本适配器
 * 把 Forge 能力接入 cnb.cool 生态，实现「AI 辅助控制页面」。
 *
 * 适配方式：
 * 1. MCP stdio 服务（供 cnb 的 MCP 客户端连接）
 * 2. HTTP 服务（供 webhook / 远程调用）
 */
import http from "node:http";
import { ForgeMcp } from "../forge-mcp.js";
import type { ToolResult } from "../tools.js";

/**
 * 供 cnb 端封装为独立进程的 stdio MCP 服务入口。
 * 返回一个函数，读取 stdin 逐行（JSON-RPC over stdio 简化版）。
 */
export function createCnbStdioServer(mcp: ForgeMcp) {
  return function start() {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    process.stdin.on("data", async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          await handleMessage(mcp, msg);
        } catch (e) {
          // 忽略无法解析的行
        }
      }
    });
    process.stdin.on("end", async () => {
      await mcp.shutdown();
      process.exit(0);
    });
  };
}

async function handleMessage(mcp: ForgeMcp, msg: any) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "browser-ai-forge", version: "0.1.0" },
    });
    return;
  }
  if (method === "tools/list") {
    respond(id, { tools: mcp.tools });
    return;
  }
  if (method === "tools/call") {
    try {
      const result: ToolResult = await mcp.callTool(params.name, params.arguments || {});
      respond(id, {
        content: result.content,
        isError: result.isError,
        structured: result.structured,
      });
    } catch (e) {
      respond(id, { content: [{ type: "text", text: String(e) }], isError: true });
    }
    return;
  }
  if (method === "notifications/initialized") {
    return;
  }
  // 其他方法
  respond(id, { error: { code: -32601, message: `Method not found: ${method}` } });
}

function respond(id: any, result: any) {
  if (id === undefined || id === null) return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

/**
 * HTTP 服务：把 Forge 能力暴露为 REST API，供 cnb 的 webhook / 远程调用。
 * 返回 Node http server 实例。
 */
export function createCnbHttpServer(mcp: ForgeMcp, port = 8787) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", tools: mcp.tools.map((t) => t.name) }));
        return;
      }
      if (req.method === "POST" && req.url === "/tools/call") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const { name, arguments: args } = JSON.parse(body || "{}");
        const result = await mcp.callTool(name, args || {});
        res.writeHead(result.isError ? 500 : 200);
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(e) }));
    }
  });

  server.listen(port);
  return server;
}
