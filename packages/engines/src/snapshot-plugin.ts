/**
 * 快照插件 - 页面快照生成
 *
 * 包装现有的 SnapshotBuilder 逻辑，实现 SnapshotPlugin 接口。
 * 这样做的好处是：
 * - 快照生成逻辑与引擎核心解耦
 * - 支持替换快照生成实现（如支持更多浏览器）
 * - 便于添加快照预处理、缓存等功能
 */

import type { Page } from "playwright";
import type { PageSnapshot, SnapshotOptions } from "@openliulan/core";
import type { SnapshotPlugin, EnginePluginContext } from "@openliulan/core";
import { SnapshotBuilder } from "./snapshot.js";

/**
 * Playwright 快照插件
 *
 * 包装 SnapshotBuilder 的功能
 */
export class PlaywrightSnapshotPlugin implements SnapshotPlugin {
  readonly name = "playwright-snapshot";
  private builder?: SnapshotBuilder;
  private page?: Page;

  async initialize(ctx: EnginePluginContext): Promise<void> {
    this.page = ctx.page;
    this.builder = new SnapshotBuilder(this.page);
    ctx.log("debug", "快照插件已初始化");
  }

  async snapshot(options?: SnapshotOptions): Promise<PageSnapshot> {
    if (!this.builder) {
      throw new Error("快照插件未初始化");
    }

    try {
      const snapshot = await this.builder.build(options);
      return snapshot;
    } catch (err) {
      throw new Error(`快照生成失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async cleanup?(): Promise<void> {
    // 清理资源
  }
}
