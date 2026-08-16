import { describe, it, expect } from "vitest";
import { compactSnapshot, expandNode, estimateTokens, keyElements } from "@browser-ai-forge/token";
import type { PageSnapshot } from "@browser-ai-forge/core";

const mockSnapshot: PageSnapshot = {
  url: "https://example.com",
  title: "Test Page",
  timestamp: "t",
  readyState: "complete",
  stats: { totalNodes: 10, emittedNodes: 8, truncatedNodes: 0, approximateTokens: 40 },
  root: {
    ref: "r0",
    tag: "body",
    text: "",
    attributes: {},
    interactive: false,
    depth: 0,
    children: [
      { ref: "r1", tag: "a", text: "About Us", attributes: { href: "/about" }, interactive: true, depth: 1, selector: "a[data-forge-ref=r1]" },
      { ref: "r2", tag: "button", text: "Submit", attributes: {}, interactive: true, depth: 1, selector: "button" },
    ],
  },
  interactive: [
    { ref: "r1", tag: "a", text: "About Us", selector: "a[data-forge-ref=r1]" },
    { ref: "r2", tag: "button", text: "Submit", selector: "button" },
  ],
};

describe("Token 高效策略", () => {
  it("compactSnapshot 只输出交互索引", () => {
    const out = compactSnapshot(mockSnapshot);
    expect(out).toContain("r1:a");
    expect(out).toContain("r2:button");
    expect(out).toContain("Test Page");
  });

  it("estimateTokens 估算", () => {
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("expandNode 增量展开", () => {
    const detail = expandNode(mockSnapshot, "r0", 2);
    expect(detail).toContain("<body>");
    expect(detail).toContain("About Us");
  });

  it("keyElements 取交互元素", () => {
    const keys = keyElements(mockSnapshot, 10);
    expect(keys).toHaveLength(2);
  });
});
