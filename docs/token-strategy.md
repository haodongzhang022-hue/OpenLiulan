# Token 高效策略

借鉴 **Chrome DevTools MCP** 的 5 星 Token 效率，Forge 在设计上把「信息完整度」与「Token 消耗」做最佳平衡。

## 核心策略

### 1. 快照裁剪（而非全量 DOM dump）

普通做法把整个 DOM 序列化给 LLM（动辄几万 token）。Forge 只输出：

- **可交互元素索引**（ref/tag/role/text）——AI 定位所需的最小信息
- 关键统计（标题、URL、节点数、Token 估算）

```
# 页面: Example Domain
URL: https://example.com
状态: complete | 节点数: 200 | 约 150 tokens
## 可交互元素 (1)
- r0 <a> "More information..."
```

### 2. 属性白名单

只保留 `id/class/name/type/value/href/placeholder/aria-label/role/data-testid` 等定位关键属性，裁剪掉 style、事件监听等无关信息。

### 3. 增量读取（按 ref 展开）

需要查看某元素内部详情时才展开：

```ts
import { expandNode } from "@browser-ai-forge/token";
const detail = expandNode(snapshot, "r12"); // 只展开 r12 节点子树
```

### 4. 控制台/网络只上报「异常」

动作后只采集**错误级**的控制台消息与网络失败，避免把海量正常日志喂给 LLM。

### 5. Token 估算透明

快照自带 `stats.approximateTokens`，AI 可感知每次 observe 的消耗，动态调整 `maxNodes/maxTextLength`。

## 建议参数

| 场景 | maxNodes | maxTextLength |
| :--- | :--- | :--- |
| 快速导航确认 | 80 | 40 |
| 常规操作（默认） | 200 | 80 |
| 复杂表单/长列表 | 400 | 100 |

## 与其他项目对比

| 项目 | Token 策略 | Forge 改进 |
| :--- | :--- | :--- |
| Browser-Use | 语义化但仍有 DOM 噪音 | 仅交互索引，更省 |
| Stagehand | 需选元素模型，偏重 | 增量读取，按需展开 |
| DevTools MCP | 精简 DOM 高效 | 继承并加语义化 + ref 寻址 |
