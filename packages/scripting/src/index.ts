/**
 * @openliulan/scripting —— 动作脚本化 + 缓存触发回放（6 星能力）
 *
 * 把「AI 语义层」从『只有说法』升级为『有持久化、有脚本化』：
 * - 重复操作缓存触发打包（出现 2 次询问打包，下次直接触发）；
 * - 脚本零 Token 回放（第二次起重复操作不再走 LLM）；
 * - 轮询换检测（wait-for-change 变化触发，等待过程零 Token）；
 * - 脚本市场（按页面地址分类，同页操作可互相推荐）；
 * - 语义持久化（JSON 落盘，跨会话留存）。
 */
export * from "./script.js";
export * from "./signature.js";
export * from "./recorder.js";
export * from "./watcher.js";
export * from "./market.js";
export * from "./json-store.js";
