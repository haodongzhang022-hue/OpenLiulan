/**
 * JSON 落盘脚本存储 —— 语义持久化（跨会话）
 *
 * 把脚本以 JSON 文件持久化到磁盘，实现「语义的持久化」：
 * 今天录制的脚本，下次会话仍可直接回放，不依赖本次运行的 LLM 记忆。
 * 这也支撑「脚本市场」：沉淀在磁盘上的脚本可被其他会话/用户复用。
 */
import fs from "node:fs";
import path from "node:path";
import type { ActionScript, ScriptStore } from "./script.js";

/** JSON 落盘脚本存储 */
export class JsonScriptStore implements ScriptStore {
  private dir: string;
  private cache = new Map<string, ActionScript>();

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.loadAll();
  }

  async save(s: ActionScript): Promise<void> {
    const file = path.join(this.dir, `${s.id}.json`);
    fs.writeFileSync(file, JSON.stringify(s, null, 2), "utf-8");
    this.cache.set(s.id, s);
  }

  async get(id: string): Promise<ActionScript | undefined> {
    return this.cache.get(id);
  }

  async listByPage(pageKey: string): Promise<ActionScript[]> {
    return [...this.cache.values()].filter((s) => s.signature.pageKey === pageKey);
  }

  async listAll(): Promise<ActionScript[]> {
    return [...this.cache.values()];
  }

  async remove(id: string): Promise<void> {
    const file = path.join(this.dir, `${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this.cache.delete(id);
  }

  private loadAll(): void {
    if (!fs.existsSync(this.dir)) return;
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(this.dir, f), "utf-8");
        const s = JSON.parse(raw) as ActionScript;
        this.cache.set(s.id, s);
      } catch {
        // 跳过损坏文件
      }
    }
  }
}
