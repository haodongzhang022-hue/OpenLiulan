# Stealth 防检测模块

> `@openliulan/stealth` —— 保护数据采集用户避免被目标站点判定为爬虫而限速/封禁。

## 为什么需要

部分用户通过 dsh-OpenLiulan 获取公开数据（爬取/采集），可能会被目标站点识别为自动化爬虫，
从而遭遇 **限速（rate limiting）**、**验证码（CAPTCHA）**、甚至 **IP 封禁（ban）**。
Stealth 模块通过多层反检测技术，让自动化浏览器看起来更像真实用户操作。

## 核心能力

| 能力 | 说明 | 级别 |
| :--- | :--- | :--- |
| **反指纹注入** | 隐藏 `navigator.webdriver` 标志、伪装 plugins/languages/permissions | basic |
| **自动化控制隐藏** | 浏览器启动参数禁用 `--disable-blink-features=AutomationControlled` 等 | basic |
| **User-Agent 策略** | 自定义真实浏览器 UA | basic |
| **人类行为模拟** | 鼠标轨迹（贝塞尔曲线）、输入随机延迟、动作间随机间隔 | basic |
| **完整指纹伪装** | WebGL 渲染器、DeviceMemory、HardwareConcurrency、Screen、Touch 等 | full |

## 快速使用

```ts
import { PlaywrightEngine } from "@openliulan/engines";

// 启用 basic 级别防检测
const engine = new PlaywrightEngine({
  headless: true,
  stealth: {
    enabled: true,
    level: "basic",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0",
  },
});
await engine.init();
```

### 完整指纹伪装（full 级别）

```ts
const engine = new PlaywrightEngine({
  headless: true,
  stealth: {
    enabled: true,
    level: "full",  // 启用 WebGL 伪装、屏幕参数、内存等完整反指纹
  },
});
```

### 通过 MCP CLI 启用

```bash
forge-mcp --stdio --stealth true --stealth-level full
```

## 设计原则

1. **默认关闭**：Stealth 只在用户明确需要时开启，不默认侵入正常浏览行为。
2. **零外部依赖**：纯 JS 注入 + 浏览器启动参数实现，不依赖 puppeteer-extra 等重型库。
3. **可选择性**：用户可以选择 basic（隐藏 webdriver 等基础检测）或 full（完整指纹伪装）。
4. **无缝集成**：通过 `PlaywrightEngine` 的 `stealth` 选项即可启用，不需要额外学习成本。

## 与 MCP 集成

`@openliulan/mcp-server` 新增 `stealth_status` 工具，可查询当前防检测模块状态：

```bash
{"name":"stealth_status","arguments":{}}
```

返回：是否启用、级别、User-Agent 策略等信息。

## 测试

```bash
npx vitest run packages/stealth/test/stealth.test.ts
```

12 项测试覆盖：默认关闭、启动参数注入、反指纹脚本生成（basic/full）、
人类行为模拟（延迟/轨迹）、自定义 UA、工厂函数等。
