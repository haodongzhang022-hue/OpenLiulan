# AI 协作：事件日志与消息传递协议

> 本框架面向「跟 IDE / 外部 AI 协作」的最后一公里能力。
> 它解决四个关键问题：**日志系统、图片传递、bug 报错原因与解释的传递、
> 以及确认功能可被 AI 作为用户清晰使用。**

---

## 为什么需要这一层

框架的核心是「让 AI 控制真实浏览器」。但外部 AI（deepseek harness、
cnb.cool CodeBuddy、Claude Desktop 等）需要的不只是"能调用工具"，
还需要**连贯地追踪"发生了什么、为什么失败、下一步怎么修"**。

过去这些信息散落在工具返回的文本里，外部 AI 得靠正则去"猜"。现在统一沉淀为
**结构化事件流（EventStream）**，并封装成 **AI 协作消息（AIMessage）**。

---

## 一、日志系统：SessionLogger（会话事件日志器）

所有值得外部 AI 知晓的信息——动作执行、诊断、错误、截图、日志——都汇入一条
**连贯的、带时间戳的事件流**。

### 事件结构

```ts
interface ForgeEvent {
  seq: number;            // 自增序号（保证时序）
  ts: number;             // 时间戳(ms)
  level: "debug"|"info"|"warning"|"error";
  category: "action"|"diagnose"|"error"|"screenshot"|"log"|"system"|"knowledge";
  message: string;        // 人类可读
  payload?: Record<string, unknown>;  // 结构化载荷
  sessionId?: string;
}
```

### 用法

```ts
import { ForgeMcp, SessionLogger } from "@browser-ai-forge/mcp-server";

const logger = new SessionLogger();          // 自动生成 sessionId
const unsub = logger.subscribe((e) => console.log(e.message));  // 实时订阅
const mcp = new ForgeMcp({ logger });        // 注入 ForgeMcp

// 之后所有 callTool 都会自动写入事件流：
await mcp.callTool("act", { type: "navigate", url: "https://example.com" });
await mcp.callTool("screenshot", { fullPage: true });

// 拉取事件流 / 导出
logger.toArray();          // 结构化事件数组
logger.exportMarkdown();   // 人类可读执行轨迹（供 PR/制品）
logger.toTimeline();       // 纯文本轨迹（供终端日志）
```

---

## 二、图片传递：ScreenshotEvent（图片事件）

截图不再只是"一次性的 base64 返回"，而是**作为图片事件进入事件流**，
供多模态 AI 在协作消息中直接消费：

```ts
// callTool("screenshot") 会自动写入 ScreenshotEvent
const img = logger.filter("screenshot").at(-1) as ScreenshotEvent;
img.image.dataUri;   // data:image/png;base64,...
img.image.caption;   // 截图说明
```

在 MCP 协议层，stdio 与 HTTP 的 `tools/call` 响应会把图片序列化为
标准的 MCP `image` content 块，多模态 AI 可直接看到截图：

```jsonc
{
  "content": [
    { "type": "text", "text": "已截图 (12KB)" },
    { "type": "image", "data": "<base64>", "mimeType": "image/png" }
  ]
}
```

---

## 三、Bug 报错原因与解释的传递：ForgeErrorEvent（标准错误事件）

这是「把 bug 完整交给外部 AI」的核心。动作失败/异常时，框架自动生成
**标准错误事件**，带可编程字段，让外部 AI 能直接拿到"报错原因 + 解释 + 建议"：

```ts
interface ForgeErrorEvent {
  category: "error";
  error: {
    code: string;          // 稳定错误码，如 ACTION_FAILED_CLICK
    reason: string;        // 根因分类，如 locator-not-found / timeout / network-failure
    raw: string;           // 原始错误信息
    explanation: string;   // 面向 AI 的「为什么失败」解释
    suggestion: string;    // 可行动的「怎么修」建议
    detail?: string;       // 堆栈 / 请求详情
    screenshotRef?: string;// 关联截图
    findings?: Array<{ category, severity, message, suggestion }>;  // 结构化诊断
  };
}
```

例如点击一个不存在的元素，外部 AI 会拿到：

```jsonc
{
  "code": "ACTION_FAILED_CLICK",
  "reason": "locator-not-found",
  "explanation": "页面中未找到目标元素。可能是元素未渲染、选择器变化、或页面还在加载。",
  "suggestion": "先 observe 查看当前 DOM，切换定位策略(ref→selector→text→semantic)，或 wait 元素就绪后重试。"
}
```

---

## 四、AI 协作消息协议：AIMessage（统一出口）

把事件流聚合成**外部 AI 可直接消费的一条消息**，同时携带文本、图片、错误、日志轨迹：

```ts
import { buildAIMessage, messageToContent } from "@browser-ai-forge/mcp-server";

const msg = buildAIMessage({
  ok: false,
  text: "点击按钮失败",
  events: logger.toArray(),
});
// msg.error    —— 标准错误（原因+解释+建议）
// msg.images   —— base64 图片数组（截图）
// msg.logs     —— 最近 20 条事件轨迹

const mcpContent = messageToContent(msg);  // 序列化为 MCP content（text + image）
```

---

## 五、对外暴露：`session_log` 工具

为了让外部 AI 在**运行中**也能拉取事件流（而不只是被动接收），新增了
`session_log` 工具：

| 参数 | 说明 |
| :--- | :--- |
| `format` | `markdown`（默认，人类可读轨迹）或 `json`（结构化事件） |
| `title` | markdown 报告标题（可选） |

```bash
# 通过 MCP 调用
{"name":"session_log","arguments":{"format":"json"}}
```

同时，**每次工具调用返回的 `structured` 里都会带上最新的事件流与 `sessionId`**，
让外部 AI 无论调用哪个工具，都能看到完整的执行上下文。

---

## 六、AI 作为用户时的清晰可用性

为保证「功能可被 AI 作为用户清晰使用」，本层做了三件事：

1. **结构化优于文本**：所有关键信息（错误原因、建议、日志、图片）都有可编程字段，
   外部 AI 无需解析散落文本。
2. **统一出口**：stdio、HTTP、harness 三种传输层都走同一套 `AIMessage` / 事件流，
   行为一致。
3. **可追踪**：`sessionId` 贯穿始终，`session_log` 随时可查，让 AI 能回放整个
   会话的"发生了什么、为什么、怎么修"。
