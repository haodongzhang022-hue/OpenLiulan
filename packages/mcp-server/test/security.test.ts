import { describe, it, expect } from "vitest";
import {
  redactDeep,
  redactUrl,
  redactText,
  isSensitiveKey,
  isLoopbackRemote,
  authorizeHttpRequest,
  guardJsScript,
  httpAuthConfigFromEnv,
  type HttpAuthConfig,
} from "../src/security.js";

describe("security / isSensitiveKey", () => {
  it("识别敏感字段名", () => {
    expect(isSensitiveKey("token")).toBe(true);
    expect(isSensitiveKey("access_token")).toBe(true);
    expect(isSensitiveKey("password")).toBe(true);
    expect(isSensitiveKey("Authorization")).toBe(true);
    expect(isSensitiveKey("api_key")).toBe(true);
  });
  it("会话标识不算敏感", () => {
    expect(isSensitiveKey("sessionId")).toBe(false);
    expect(isSensitiveKey("session")).toBe(false);
  });
});

describe("security / redactDeep", () => {
  it("对敏感字段的值做掩码", () => {
    const out = redactDeep({ token: "abc123456", name: "bob", nested: { apiKey: "secretxyz" } });
    expect(out.name).toBe("bob");
    expect(out.token).toContain("****");
    expect(out.token).not.toBe("abc123456");
    expect(out.nested.apiKey).toContain("****");
  });
  it("不修改原对象", () => {
    const input: any = { password: "p@ss" };
    const out = redactDeep(input);
    expect(input.password).toBe("p@ss");
    expect(out.password).not.toBe("p@ss");
  });
});

describe("security / redactUrl", () => {
  it("隐藏 URL 查询参数中的 token", () => {
    const out = redactUrl("https://x.com/login?token=abc123def&next=/home");
    expect(out).toContain("****");
    expect(out).not.toContain("abc123def");
    expect(out).toContain("next"); // 非敏感参数保留
  });
  it("隐藏 hash 中的 access_token", () => {
    const out = redactUrl("https://x.com/callback#access_token=abc123def");
    expect(out).toContain("REDACTED");
    expect(out).not.toContain("abc123def");
  });
  it("隐藏 user:pass", () => {
    const out = redactUrl("https://user:secretpw@host.com/path");
    expect(out).not.toContain("secretpw");
  });
  it("普通 URL 保持不变", () => {
    expect(redactUrl("https://example.com/page")).toBe("https://example.com/page");
  });
});

describe("security / redactText", () => {
  it("隐藏 Bearer token", () => {
    const out = redactText("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.xxx");
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9.xxx");
    expect(out).toContain("REDACTED");
  });
  it("隐藏 query 参数 token", () => {
    expect(redactText("去访问 https://a.com?token=abc123def 看看")).not.toContain("abc123def");
  });
  it("隐藏 password 键值", () => {
    expect(redactText('password: "hunter2"')).not.toContain("hunter2");
  });
});

describe("security / isLoopbackRemote", () => {
  it("识别 IPv4/IPv6 回环", () => {
    expect(isLoopbackRemote("127.0.0.1")).toBe(true);
    expect(isLoopbackRemote("::1")).toBe(true);
    expect(isLoopbackRemote("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackRemote("127.0.0.1:54321")).toBe(true);
    expect(isLoopbackRemote("localhost")).toBe(true);
  });
  it("拒绝外部地址", () => {
    expect(isLoopbackRemote("192.168.1.1")).toBe(false);
    expect(isLoopbackRemote("10.0.0.1:80")).toBe(false);
    expect(isLoopbackRemote("8.8.8.8")).toBe(false);
  });
});

describe("security / authorizeHttpRequest", () => {
  const base: HttpAuthConfig = { loopbackOnly: false };

  it("无鉴权时允许回环", () => {
    expect(authorizeHttpRequest(base, "127.0.0.1", undefined, undefined).ok).toBe(true);
  });
  it("loopbackOnly 拒绝外部地址", () => {
    const cfg = { loopbackOnly: true };
    expect(authorizeHttpRequest(cfg, "8.8.8.8", undefined, undefined).ok).toBe(false);
    expect(authorizeHttpRequest(cfg, "127.0.0.1", undefined, undefined).ok).toBe(true);
  });
  it("Bearer token 鉴权（正确/错误）", () => {
    const cfg = { enabled: true, tokens: ["secret-token"] };
    expect(authorizeHttpRequest(cfg, "8.8.8.8", undefined, "Bearer secret-token").ok).toBe(true);
    expect(authorizeHttpRequest(cfg, "8.8.8.8", undefined, "Bearer wrong").ok).toBe(false);
    expect(authorizeHttpRequest(cfg, "8.8.8.8", undefined, undefined).ok).toBe(false);
  });
  it("来源白名单校验", () => {
    const cfg = { enabled: false, loopbackOnly: false, allowedOrigins: ["https://app.cnb.cool"] };
    expect(authorizeHttpRequest(cfg, "1.2.3.4", "https://app.cnb.cool", undefined).ok).toBe(true);
    expect(authorizeHttpRequest(cfg, "1.2.3.4", "https://evil.com", undefined).ok).toBe(false);
    expect(authorizeHttpRequest(cfg, "1.2.3.4", undefined, undefined).ok).toBe(false);
  });
});

describe("security / guardJsScript", () => {
  it("允许普通 DOM 脚本", () => {
    expect(guardJsScript("document.querySelector('h1').textContent").blocked).toBe(false);
  });
  it("拦截文件系统访问", () => {
    const r = guardJsScript("require('fs').readFileSync('/etc/passwd')");
    expect(r.blocked).toBe(true);
    expect(r.allowed).toBe(false);
  });
  it("拦截子进程执行", () => {
    expect(guardJsScript("child_process.execSync('whoami')").blocked).toBe(true);
  });
  it("拦截渗透尝试", () => {
    expect(guardJsScript("fetch('http://internal').then(r=>r.text())").blocked).toBe(false); // 无高危模式
    expect(guardJsScript("process.env").blocked).toBe(true);
  });
});

describe("security / httpAuthConfigFromEnv", () => {
  it("读取环境变量默认值", () => {
    const cfg = httpAuthConfigFromEnv();
    expect(cfg.loopbackOnly).toBe(true);
    expect(cfg.enabled).toBe(false);
  });
});
