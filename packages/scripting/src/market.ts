/**
 * 脚本市场（Script Market）—— 6 星能力
 *
 * 允许复用他人已沉淀的有效脚本，以**页面地址分类**组织：
 * - 按页面 key 聚合，同页面的操作可被互相推荐；
 * - 提供「推荐同页脚本」能力：当前正在浏览某页面时，给出该页已沉淀的可用脚本；
 * - 脚本附带回放次数与节省 Token，越常用越靠前（可信度排序）。
 */
import type { ActionScript, ScriptStore } from "./script.js";
import { normalizePageKey } from "./signature.js";

/** 市场条目：脚本 + 该页内排名 */
export interface MarketEntry {
  script: ActionScript;
  /** 该脚本在所属页内的推荐分 */
  score: number;
}

/** 脚本市场：基于 ScriptStore 的按页浏览/推荐 */
export class ScriptMarket {
  constructor(private store: ScriptStore) {}

  /** 列出当前页面的所有可用脚本（同页操作互相推荐，按回放次数/节省 Token 排序） */
  async recommendForPage(url: string): Promise<MarketEntry[]> {
    const key = normalizePageKey(url);
    const pageScripts = await this.store.listByPage(key);
    return pageScripts
      .map((s) => ({ script: s, score: this.scoreOf(s) }))
      .sort((a, b) => b.score - a.score);
  }

  /** 浏览市场：按页面地址分组的全部脚本 */
  async browse(): Promise<Map<string, ActionScript[]>> {
    const all = await this.store.listAll();
    const byPage = new Map<string, ActionScript[]>();
    for (const s of all) {
      const list = byPage.get(s.signature.pageKey) ?? [];
      list.push(s);
      byPage.set(s.signature.pageKey, list);
    }
    return byPage;
  }

  /** 按语义关键字检索脚本 */
  async search(keyword: string): Promise<ActionScript[]> {
    const all = await this.store.listAll();
    const kw = keyword.toLowerCase();
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.description ?? "").toLowerCase().includes(kw) ||
        s.signature.anchorText?.toLowerCase().includes(kw)
    );
  }

  /** 推荐分：回放次数权重 + 节省 Token 权重 */
  private scoreOf(s: ActionScript): number {
    return s.replayCount * 10 + Math.min(s.savedTokens, 1000) / 10;
  }
}
