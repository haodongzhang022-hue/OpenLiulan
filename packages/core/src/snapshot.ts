/**
 * 页面快照模型 (Page Snapshot)
 *
 * 设计目标：在「信息完整度」与「Token 效率」之间取得最佳平衡（借鉴 Chrome DevTools MCP 的 5 星 Token 效率）。
 * 快照是 AI 理解页面的唯一依据，必须精简、语义化、可寻址。
 */
export interface SnapshotNode {
  /** 稳定引用 ID（供 click/fill 动作的 ref 使用，是精确定位的关键） */
  ref: string;
  /** 标签名（小写） */
  tag: string;
  /** 语义化描述（借鉴 Browser-Use：用可读文本描述元素） */
  text: string;
  /** 属性白名单（避免全量属性造成 Token 爆炸） */
  attributes: Record<string, string>;
  /** 关键可交互提示 */
  role?: string;
  /** 是否可交互（button/input/select/a 等） */
  interactive: boolean;
  /** 子节点（扁平化列表，带层级便于 LLM 理解） */
  children?: SnapshotNode[];
  /** 层级深度 */
  depth: number;
  /** 元素 CSS 选择器（精确操作锚点，借鉴 Stagehand 的强选择器） */
  selector?: string;
  /** 该节点是否被裁剪（用于调试诊断时扩展） */
  truncated?: boolean;
}

/** 快照配置：Token 预算控制 */
export interface SnapshotOptions {
  /** 最大节点数（超出的折叠），默认 200 */
  maxNodes?: number;
  /** 每节点最大文本长度 */
  maxTextLength?: number;
  /** 是否包含隐藏/不可见元素 */
  includeHidden?: boolean;
  /** 是否裁剪深层嵌套（如超长 script/style） */
  pruneDeep?: boolean;
  /** 是否生成可供精确操作的 CSS 选择器 */
  withSelectors?: boolean;
}

export interface PageSnapshot {
  /** 页面 URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 生成时间 */
  timestamp: string;
  /** 文档就绪状态 */
  readyState: string;
  /** Token 效率统计 */
  stats: {
    totalNodes: number;
    emittedNodes: number;
    truncatedNodes: number;
    approximateTokens: number;
  };
  /** 根节点 */
  root: SnapshotNode;
  /** 可交互元素快速索引（供 AI 直接挑选 ref） */
  interactive: Array<{
    ref: string;
    tag: string;
    text: string;
    role?: string;
    selector?: string;
  }>;
}
