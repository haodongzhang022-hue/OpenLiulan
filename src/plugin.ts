/**
 * dsh-openliulan deepseek harness 进程内浏览器控制插件入口。
 *
 * 把 dsh-openliulan 的统一 AI 浏览器控制框架（ForgeMCP：observe / act /
 * diagnose / eval / screenshot / session_log / close）注册为 deepseek
 * harness 的原生工具，供 agent 的 tool_loop 直接调用，配合 harness 的
 * 原生 function calling / 多步规划 / 有状态会话能力。
 *
 * 该入口是「可安装插件包」的装配点：顶层包 package.json 声明
 * `dsh.bundle.patch` 指向 cordis.patch.yml，由 dsh 可在 profile 目录一条
 * 命令（`dsh plugin --profile web add ...`）安装。构建时用 esbuild 把所有
 * `@openliulan/*` 源码内联成自包含的 lib/index.js，只外置已发布的
 * `playwright`，因此不依赖任何未发布 npm 包即可被他人安装。
 *
 * @module @openliulan/dsh-openliulan
 */
import { ForgeMcp } from "@openliulan/mcp-server";
import type { Context } from "@deepseek-ai/cordis";

/** Cordis 插件名（用于 loader 诊断）。 */
export const name = "openliulan-browser";
/** 工具命名前缀，避免与 host 其它工具冲突。 */
const DEFAULT_PREFIX = "browser";

/** 进程内工具注册的最小 harness 契约（编译期仅作形状约束，运行期用宿主 ctx）。 */
interface HarnessToolRegistry {
  register(def: unknown): () => void;
}

/** 容错取值：把调用参数收敛为对象（模型可能输出裸值）。 */
function toRecord(args: unknown): Record<string, unknown> {
  return typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
}

/** 把 ForgeMCP 调用方返回值映射为 harness ContentBlock 文本。 */
function resultText(content: readonly { type?: string; text?: string }[] | undefined): string {
  if (!content || content.length === 0) return "(无输出)";
  return content.map((block) => block.text ?? "").join("\n");
}

/**
 * Cordis 插件入口：构造一个进程内的 ForgeMcp 实例，把其工具映射为
 * deepseek harness 的 ToolDefinition 并注册到 `ctx.tools`。
 *
 * 配置（可在 cordis.patch.yml 覆盖）：
 * - `headless`: 无头模式（默认 true）
 * - `connectUrl`: 可选，CDP 连接已启动的浏览器
 * - `prefix`: 工具命名前缀（默认 "browser"）
 * - `stealth`: 可选，防检测配置
 *
 * @param ctx - 插件上下文（宿主注入，含工具注册服务）。
 * @param config - 解析后的插件配置。
 */
export function apply(ctx: Context, config: Record<string, unknown> = {}): void {
  const prefix = typeof config.prefix === "string" && config.prefix ? config.prefix : DEFAULT_PREFIX;
  const mcp = new ForgeMcp({
    headless: config.headless === undefined ? true : Boolean(config.headless),
    connectUrl: typeof config.connectUrl === "string" ? config.connectUrl : undefined,
    stealth: (config.stealth as never) ?? undefined,
  });

  const tools = (ctx as unknown as { tools: HarnessToolRegistry }).tools;

  for (const tool of mcp.tools) {
    const parameters = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    const publicName = `${prefix}_${tool.name}`;
    ctx.effect(
      () =>
        tools.register({
          name: publicName,
          description: tool.description,
          parameters,
          output: {
            schema: {
              type: "object",
              properties: { content: { type: "array", items: {} } },
              required: ["content"],
              additionalProperties: false,
            },
            render(_args: unknown, value: unknown): unknown[] {
              const text = resultText(((value as { content?: { type?: string; text?: string }[] }) ?? {}).content ?? []);
              return [{ type: "text", text }];
            },
          },
          execute: async (args: unknown) => {
            const result = await mcp.callTool(tool.name, toRecord(args));
            const text = resultText(result.content);
            if (!result.ok) throw new Error(text);
            return { isError: false, value: { content: text }, content: [{ type: "text", text }] };
          },
        }),
      "openliulan.tool",
    );
  }
}
