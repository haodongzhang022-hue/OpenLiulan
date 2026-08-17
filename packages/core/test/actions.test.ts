import { describe, it, expect } from "vitest";
import { UnifiedActionSchema } from "@openliulan/core";

describe("统一动作模型", () => {
  it("校验合法的 navigate 动作", () => {
    const action = UnifiedActionSchema.parse({ type: "navigate", url: "https://example.com" });
    expect(action.type).toBe("navigate");
    expect(action.waitUntil).toBe("networkidle");
  });

  it("校验 click 动作的 ref 精确定位", () => {
    const action = UnifiedActionSchema.parse({ type: "click", ref: "r3", description: "点击登录" });
    expect(action.ref).toBe("r3");
    expect(action.button).toBe("left");
  });

  it("拒绝未知动作类型", () => {
    expect(() => UnifiedActionSchema.parse({ type: "explode" })).toThrow();
  });

  it("校验 fill 动作", () => {
    const action = UnifiedActionSchema.parse({ type: "fill", selector: "#email", value: "a@b.com" });
    expect(action.value).toBe("a@b.com");
  });
});
