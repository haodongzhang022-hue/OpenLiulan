# 架构设计

Browser AI Forge 整合了 **Browser-Use / Stagehand / Chrome DevTools MCP / Playwright MCP** 四大项目，形成「**一个门面、双引擎、五层能力**」的架构。

## 分层架构

```
┌─────────────────────────────────────────────────────┐
│                     AI Agent / LLM                    │
│        (deepseek harness / cnb.cool CodeBuddy)        │
└──────────────────────┬──────────────────────────────┘
                       │ MCP / function calling
┌──────────────────────▼──────────────────────────────┐
│  packages/mcp-server  —— 统一 MCP 服务 + 增强双适配器         │
│    · deepseek harness 适配（函数 schema + 自愈 AgentLoop）     │
│    · cnb.cool 适配（stdio / HTTP / CI-Pipeline / 知识库注入）   │
└──────────────────────┬──────────────────────────────┘
┌──────────────────────▼──────────────────────────────┐
│  packages/ai-layer    —— AI 语义层（Browser-Use 能力）│
│    · 自然语言 -> 动作规划                             │
│    · 语义定位                                         │
└──────────────────────┬──────────────────────────────┘
┌──────────────────────▼──────────────────────────────┐
│  packages/core        —— 核心调度门面 ForgeBrowser    │
│    · 统一动作模型 UnifiedAction                       │
│    · 页面快照模型 Snapshot                            │
│    · 会话状态机                                       │
└───────┬─────────────────────────────┬───────────────┘
        │                             │
┌───────▼──────────────┐   ┌──────────▼───────────────┐
│ packages/token       │   │ packages/diagnosis        │
│ Token 高效策略        │   │ 5 星调试诊断中心           │
│  · DOM 裁剪           │   │  · 控制台/网络/性能/JS异常 │
│  · 增量读取           │   │  · 健康度摘要与建议        │
└───────┬──────────────┘   └──────────┬───────────────┘
        └──────────────┬──────────────┘
┌──────────────────────▼──────────────────────────────┐
│  packages/engines     —— 底层驱动适配                │
│    · Playwright 引擎（精确操作）                     │
│    · CDP 直连（DevTools MCP 能力）                  │
│    · 多策略定位器（ref/selector/text/semantic）      │
│    · 快照生成器 + 诊断采集器                         │
└─────────────────────────────────────────────────────┘
```

## 各项目优势的落地映射

| 原项目 | 核心能力 | 在本框架中的落地 |
| :--- | :--- | :--- |
| **Browser-Use** | AI 适配（语义动作） | `ai-layer` 语义规划器、`semantic` 定位、动作 `description/intent` |
| **Stagehand** | 操作精确性 | `locator` 多策略强定位、ref 精确定位、稳定性重试 |
| **Chrome DevTools MCP** | 调试诊断 5 星 + Token 5 星 | `diagnosis` 中心、`token` 策略、`engines` 的诊断采集器 |
| **Playwright MCP** | 底层协议 | `engines/playwright-engine` 驱动 + CDP 直连 |

## 关键设计决策

1. **统一动作模型（UnifiedAction）**：把四个项目各自的动作语义抽象为 13 种规范动作，AI 只需学会一套，底层可切换引擎。
2. **ref 精确定位**：快照生成时给每个可交互元素打上 `data-forge-ref`，AI 用 ref 定位最精确、最省 Token（借鉴 DevTools MCP 的高效寻址）。
3. **失败即诊断**：动作失败自动触发 5 星诊断采集，把「报错」升级为「可诊断的上下文」，极大提升 AI 排障效率。
4. **Token 预算控制**：快照按 `maxNodes/maxTextLength` 裁剪，只保留可交互索引；需要详情时按 ref 增量展开。
5. **协议无关的 MCP 内核**：`ForgeMcp` 与传输层解耦，同一套逻辑可同时服务 deepseek harness（函数调用）与 cnb.cool（stdio/HTTP）。
6. **适配即增强（而非仅能用）**：
   - deepseek harness：不止映射函数 schema，更提供**自愈 AgentLoop**，把 deepseek 的多步规划/思考与 Forge 的 5 星诊断闭环成自动化排障代理（失败自动诊断 → LLM 修正 → 重试；`assert` 自验收）。
   - cnb.cool：不止提供 stdio/HTTP，更落地 **CI/Pipeline 冒烟检查**（在云端构建机启动真实浏览器验收并把截图/诊断落盘为制品）与**仓库知识库注入**（让 AI 决策带上项目语境），实现单靠裸接口做不到的端到端验收。

## 引擎选型建议

| 场景 | 推荐 | 说明 |
| :--- | :--- | :--- |
| 日常自动化 | Playwright 启动 | 简单、稳定、headless 默认 |
| 调试已开页面 | CDP 直连 `connectUrl` | 借鉴 DevTools MCP，连接真实浏览器调试 |
| 高精度操作 | 快照 ref 定位 | Stagehand 式精确点击 |
