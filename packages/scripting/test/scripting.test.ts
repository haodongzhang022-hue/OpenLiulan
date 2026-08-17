/**
 * @openliulan/scripting 6 星能力测试
 *
 * 验证：
 * 1. 重复操作缓存触发打包（第 2 次触发草稿，第 3 次命中回放）
 * 2. 脚本零 Token 回放（不经过 LLM，直接驱动动作）
 * 3. 轮询换检测（wait-for-change 变化触发）
 * 4. 脚本市场（按页分类、同页推荐）
 * 5. 语义持久化（JSON 落盘跨会话留存）
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { UnifiedAction } from "@openliulan/core";
import { ActionRecorder, ScriptPlayer, ChangeWatcher, ScriptMarket, JsonScriptStore, MemoryScriptStore } from "../src/index.js";

const clickLogin = (): UnifiedAction => ({
  type: "click",
  text: "登录",
  description: "点击登录按钮",
});
const fillUser = (): UnifiedAction => ({
  type: "fill",
  text: "用户名",
  value: "admin",
});
const url = "https://example.com/login?from=app";

describe("重复操作缓存触发打包", () => {
  let recorder: ActionRecorder;
  let drafts: unknown[];

  beforeEach(() => {
    drafts = [];
    recorder = new ActionRecorder({
      store: new MemoryScriptStore(),
      onScriptDraft: (n) => drafts.push(n),
    });
  });

  it("第 1 次不打扰，第 2 次触发打包草稿，第 3 次可命中回放", async () => {
    // 第 1 次
    expect(recorder.record(clickLogin(), url)).toBeNull();
    expect(drafts.length).toBe(0);

    // 第 2 次 → 触发脚本草稿
    const notice = recorder.record(clickLogin(), url);
    expect(notice).not.toBeNull();
    expect(drafts.length).toBe(1);
    expect(notice!.draft.name).toContain("登录");
    expect(notice!.message).toContain("零 Token 回放");

    // 用户确认打包
    await recorder.persistDraft(notice!);

    // 第 3 次 → 命中已入库脚本
    const hit = await recorder.match(clickLogin(), url);
    expect(hit).not.toBeUndefined();
    expect(hit!.id).toBe(notice!.draft.id);
  });

  it("不同页面不串号（按页面地址分类）", async () => {
    recorder.record(clickLogin(), "https://example.com/login");
    const notice = recorder.record(clickLogin(), "https://example.com/login");
    await recorder.persistDraft(notice!);
    // 另一页面同类操作不应命中
    const miss = await recorder.match(clickLogin(), "https://other.com/login");
    expect(miss).toBeUndefined();
  });

  it("同一页面不同锚点不串号", async () => {
    recorder.record(clickLogin(), url);
    const notice = recorder.record(clickLogin(), url);
    await recorder.persistDraft(notice!);
    // 不同目标（注册按钮）不应命中登录脚本
    const other = { type: "click", text: "注册" } as UnifiedAction;
    const miss = await recorder.match(other, url);
    expect(miss).toBeUndefined();
  });
});

describe("脚本零 Token 回放", () => {
  it("回放逐条执行并累计算节省 Token", async () => {
    const steps: UnifiedAction[] = [clickLogin(), fillUser()];
    const recorder = new ActionRecorder();
    let notice: any = null;
    recorder.record(steps[0], url);
    notice = recorder.record(steps[0], url)!;
    recorder.record(steps[1], url);
    // 第二个动作也记录进草稿需要合并；这里直接用 recorder 内部累积
    // 简化：直接构造脚本再回放
    const player = new ScriptPlayer();
    const script = {
      id: "script_test",
      name: "登录流程",
      signature: { pageKey: "example.com/login", actionTypes: ["click", "fill"], anchorText: "登录" },
      steps: [{ action: steps[0] }, { action: steps[1] }],
      sourceUrl: url,
      createdAt: Date.now(),
      replayCount: 0,
      savedTokens: 0,
    };
    let executed: string[] = [];
    const result = await player.play(script, async (a) => {
      executed.push(a.type);
      return { ok: true, summary: `${a.type} 成功` };
    });
    expect(result.ok).toBe(true);
    expect(executed).toEqual(["click", "fill"]);
    expect(script.replayCount).toBe(1);
    expect(script.savedTokens).toBeGreaterThan(0);
    expect(result.savedTokens).toBeGreaterThan(0);
  });

  it("中途失败则停止并报告失败步骤", async () => {
    const player = new ScriptPlayer();
    const script = {
      id: "script_fail",
      name: "会失败的流程",
      signature: { pageKey: "x", actionTypes: ["click"], anchorText: "登录" },
      steps: [{ action: clickLogin() }],
      sourceUrl: url,
      createdAt: Date.now(),
      replayCount: 0,
      savedTokens: 0,
    };
    const result = await player.play(script, async () => ({ ok: false, summary: "找不到元素" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("找不到元素");
  });
});

describe("轮询换检测（wait-for-change 零 Token 等待触发）", () => {
  it("检测到变化即返回，等待过程无 LLM 参与", async () => {
    const watcher = new ChangeWatcher({ timeoutMs: 5000, pollIntervalMs: 50 });
    let calls = 0;
    const result = await watcher.waitForSelector("#loaded", true, async () => {
      calls++;
      return calls >= 3; // 第三次探测触发
    });
    expect(result.ok).toBe(true);
    expect(result.note).toContain("零 Token 消耗");
    expect(calls).toBe(3);
  });

  it("超时未触发返回失败", async () => {
    const watcher = new ChangeWatcher({ timeoutMs: 200, pollIntervalMs: 50 });
    const result = await watcher.waitForText("永远不出现", true, async () => false);
    expect(result.ok).toBe(false);
    expect(result.note).toContain("超时");
  });
});

describe("脚本市场：按页面地址分类与同页推荐", () => {
  it("同页操作可被推荐，且按回放次数排序", async () => {
    const store = new MemoryScriptStore();
    const a = {
      id: "a", name: "登录", signature: { pageKey: "example.com/login", actionTypes: ["click"], anchorText: "登录" },
      steps: [], sourceUrl: url, createdAt: 1, replayCount: 3, savedTokens: 120,
    };
    const b = {
      id: "b", name: "退出", signature: { pageKey: "example.com/login", actionTypes: ["click"], anchorText: "退出" },
      steps: [], sourceUrl: url, createdAt: 2, replayCount: 1, savedTokens: 40,
    };
    await store.save(a as any);
    await store.save(b as any);
    const market = new ScriptMarket(store);
    const recs = await market.recommendForPage(url);
    expect(recs.length).toBe(2);
    expect(recs[0].script.id).toBe("a"); // 回放次数多 → 靠前
    // 其他页面不推荐
    const other = await market.recommendForPage("https://other.com/");
    expect(other.length).toBe(0);
  });
});

describe("语义持久化：JSON 落盘跨会话", () => {
  it("脚本落盘后可在新 store 实例中读取（跨会话留存）", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-script-"));
    const script = {
      id: "script_persist", name: "持久化脚本", signature: { pageKey: "example.com/p", actionTypes: ["click"], anchorText: "保存" },
      steps: [{ action: clickLogin() }], sourceUrl: url, createdAt: Date.now(), replayCount: 0, savedTokens: 0,
    };
    const s1 = new JsonScriptStore(dir);
    await s1.save(script as any);
    // 模拟新会话（新实例从磁盘重读）
    const s2 = new JsonScriptStore(dir);
    const got = await s2.get("script_persist");
    expect(got).toBeDefined();
    expect(got!.name).toBe("持久化脚本");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
