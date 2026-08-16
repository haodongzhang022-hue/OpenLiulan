import { describe, it, expect } from "vitest";
import { buildKnowledgeContext, toPrComment } from "../src/adapters/cnb.js";
import { buildHarnessFunctionSchemas, toHarnessTools } from "../src/adapters/harness.js";
import { okResult, errResult } from "../src/tools.js";

describe("CNB 知识库增强", () => {
  it("把知识片段组装成可注入的上下文", () => {
    const ctx = buildKnowledgeContext([
      { title: "登录流程", snippet: "测试账号 admin / 内网域名约定", source: "docs/" },
    ]);
    expect(ctx).toContain("CNB 仓库知识库");
    expect(ctx).toContain("登录流程");
    expect(ctx).toContain("来源: docs/");
  });

  it("无知识时返回空字符串", () => {
    expect(buildKnowledgeContext([])).toBe("");
  });
});

describe("CNB CI 评论", () => {
  it("生成含通过/失败统计的 markdown", () => {
    const md = toPrComment({
      ok: true,
      passed: 2,
      failed: 0,
      steps: [
        { action: "observe", ok: true, summary: "快照 ok" },
        { action: "act", ok: true, summary: "点击 ok" },
      ],
      artifacts: ["forge-artifacts/step-1.png"],
      report: "# Forge CI 冒烟检查 ✅ 通过",
    });
    expect(md).toContain("Browser AI Forge");
    expect(md).toContain("✅ 通过");
  });
});

describe("harness 工具映射", () => {
  it("生成的 function schema 与工具集数量一致且为 OpenAI 兼容结构", () => {
    // 构造一个假的 ForgeMcp，避免依赖真实浏览器
    const fakeMcp: any = {
      tools: [
        {
          name: "observe",
          description: "观察页面",
          inputSchema: { type: "object", properties: { maxNodes: { type: "number" } } },
        },
      ],
      callTool: async () => okResult("ok"),
    };
    const schemas = buildHarnessFunctionSchemas(fakeMcp);
    expect(schemas[0]).toMatchObject({ type: "function", function: { name: "observe" } });
    const tools = toHarnessTools(fakeMcp);
    expect(tools[0].name).toBe("observe");
    expect(typeof tools[0].fn).toBe("function");
  });

  it("errResult 返回错误 ToolResult", () => {
    const r = errResult("未知工具");
    expect(r.ok).toBe(false);
    expect(r.isError).toBe(true);
  });
});
