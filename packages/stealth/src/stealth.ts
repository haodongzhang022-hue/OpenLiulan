/**
 * @openliulan/stealth —— 防检测模块（Anti-Detection / Stealth）
 *
 * 目标用户：获取公开数据的用户（爬取/采集），避免被目标站点判定为爬虫而限速/封禁。
 *
 * 能力分层：
 * - **反指纹注入**（initScript）：隐藏 webdriver 标志、伪装插件/语言/权限等指纹；
 * - **启动参数**：附加 Chrome 启动参数（禁用自动化控制、禁用蓝牙/默认浏览器检查等）；
 * - **人类行为模拟**：鼠标移动轨迹、输入延迟、滚动随机化（让人工操作特征不可辨识）；
 * - **User-Agent 策略**：可配置真实浏览器 UA，自动轮换。
 *
 * 设计原则：
 * - 纯 JS 注入为主（不依赖 puppeteer-extra 等重型库），零外部依赖即可工作；
 * - 可选择性启用（stealth 默认关闭，仅在用户声明需要时开启，避免无谓侵入）；
 * - 与现有 PlaywrightEngine 无缝集成：通过 `initScript` 注入 + `launchOptions` 生效。
 */

/**
 * Stealth 配置项
 */
export interface StealthOptions {
  /** 是否启用 stealth（默认 false —— 仅在用户明确要求时开启） */
  enabled?: boolean;
  /** 反指纹注入级别：basic=隐藏 webdriver；full=完整反指纹（默认 basic） */
  level?: "basic" | "full";
  /** 用户代理（留空则不覆盖 UA，使用浏览器默认） */
  userAgent?: string;
  /** 人类行为模拟：输入延迟区间 [min, max] ms（默认 [30, 90]） */
  humanTypingDelay?: [number, number];
  /** 人类行为模拟：动作间随机间隔 [min, max] ms（默认 [200, 600]） */
  humanActionDelay?: [number, number];
  /** 鼠标移动是否模拟人类轨迹（默认 true） */
  humanMouseTrajectory?: boolean;
  /** 额外自定义启动参数 */
  extraArgs?: string[];
}

/** 默认配置 */
const DEFAULTS: Required<Pick<StealthOptions, "level" | "humanTypingDelay" | "humanActionDelay" | "humanMouseTrajectory">> & Pick<StealthOptions, "userAgent" | "extraArgs"> = {
  level: "basic",
  humanTypingDelay: [30, 90],
  humanActionDelay: [200, 600],
  humanMouseTrajectory: true,
  userAgent: undefined,
  extraArgs: [],
};

/**
 * StealthManager —— 防检测模块入口
 *
 * 提供：
 * - `buildLaunchOptions()`  → 浏览器启动参数（含反自动化 flags）
 * - `buildInitScript()`     → 反指纹注入脚本（在页面创建前注入）
 * - `humanize()`            → 人类行为模拟装饰器（用于动作执行）
 */
export class StealthManager {
  readonly options: Required<Omit<StealthOptions, "userAgent" | "extraArgs">> & Pick<StealthOptions, "userAgent" | "extraArgs">;

  constructor(options: StealthOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      level: options.level ?? DEFAULTS.level,
      userAgent: options.userAgent ?? DEFAULTS.userAgent,
      humanTypingDelay: options.humanTypingDelay ?? DEFAULTS.humanTypingDelay,
      humanActionDelay: options.humanActionDelay ?? DEFAULTS.humanActionDelay,
      humanMouseTrajectory: options.humanMouseTrajectory ?? DEFAULTS.humanMouseTrajectory,
      extraArgs: options.extraArgs ?? DEFAULTS.extraArgs,
    };
  }

  /** 是否启用 */
  get isEnabled(): boolean {
    return this.options.enabled;
  }

  /** 浏览器启动参数（仅当启用时返回，否则返回空数组，保持默认干净） */
  buildLaunchArgs(): string[] {
    if (!this.options.enabled) return [];
    const args = [
      // 禁用自动化控制标志（这是最重要的反检测点）
      "--disable-blink-features=AutomationControlled",
      "--disable-blink-features=AutomationControlled,IdleDetection",
      // 移除自动化相关的默认行为
      "--disable-automation",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-extensions-except=/dev/null",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--disable-client-side-phishing-detection",
      // 禁用无头模式特有的可检测特征
      "--disable-infobars",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-position=0,0",
      "--lang=en-US,en",
    ];
    if (this.options.extraArgs?.length) args.push(...this.options.extraArgs);
    return args;
  }

  /**
   * 反指纹注入脚本 —— 在页面上下文中执行，用于伪装浏览器指纹。
   * 返回的脚本会在每个新页面创建时注入。
   */
  buildInitScript(): string {
    if (!this.options.enabled) return "";
    return `(() => {
  // ─── 1. 隐藏 navigator.webdriver（最经典的检测点） ───
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // ─── 2. 伪装 plugins（真实浏览器通常有 PDF 查看器等插件） ───
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const pluginList = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ];
      const result = { length: pluginList.length, item: (i) => pluginList[i], namedItem: (n) => pluginList.find(p => p.name === n) || null };
      for (const p of pluginList) result[p.name] = p;
      return result;
    }
  });

  // ─── 3. 伪装 languages（与真实 Chrome 对齐） ───
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'zh-CN'] });

  // ─── 4. 隐藏 AutomationControlled 痕迹 ───
  if (window.chrome) {
    // 确保 chrome.runtime 存在（真实浏览器中该对象存在）
    if (!window.chrome.runtime) {
      Object.defineProperty(window.chrome, 'runtime', { value: {} });
    }
  }

  // ─── 5. 修改 permissions 报告（避免返回 denied 被识别） ───
  const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) => (
      parameters && parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );
  }

  // ─── 6. 全级 stealth：更多指纹伪装 ───
  ${this.options.level === "full" ? `
  // 伪装 console.debug 不产生唯一调用栈
  // 伪装 window.outerWidth/outerHeight（headless 浏览器窗口尺寸差异）
  Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth || 1920 });
  Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight || 1080 });

  // 伪装 screen 参数
  Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
  Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });

  // 伪装置触摸支持（避免 headless 检测到无触摸能力）
  if (!('ontouchstart' in window)) {
    Object.defineProperty(window, 'ontouchstart', { value: null });
  }

  // 伪装 DeviceMemory 和 HardwareConcurrency
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

  // 伪装 WebGL 渲染器（避免暴露 SwiftShader 等无头渲染器）
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Google Inc. (NVIDIA)';
      if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return getParameter.call(this, parameter);
    };
  } catch (e) {}
  ` : ""}
})();`;
  }

  /**
   * 人类行为模拟 —— 生成随机的人类化动作间隔。
   * 调用方在动作之间使用该间隔，模拟人的操作节奏。
   */
  humanDelay(): number {
    if (!this.options.enabled) return 0;
    const [min, max] = this.options.humanActionDelay!;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** 人类打字延迟（type 动作时逐键之间的随机间隔） */
  humanTypingDelayMs(): number {
    if (!this.options.enabled) return 0;
    const [min, max] = this.options.humanTypingDelay!;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 生成人类化的鼠标移动路径（贝塞尔曲线插值）。
   * 返回一组 [[x,y], ...] 坐标序列，供调用方依次移动鼠标。
   */
  humanMousePath(from: { x: number; y: number }, to: { x: number; y: number }, steps = 12): Array<[number, number]> {
    if (!this.options.enabled || !this.options.humanMouseTrajectory) {
      return [[to.x, to.y]];
    }
    const path: Array<[number, number]> = [];
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      // 简单二次贝塞尔，加入随机扰动模拟真实手部运动
      const controlX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 40;
      const controlY = Math.min(from.y, to.y) - Math.random() * 30;
      const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * controlX + t ** 2 * to.x;
      const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * controlY + t ** 2 * to.y;
      path.push([Math.round(x), Math.round(y)]);
    }
    return path;
  }

  /** 生成唯一签名标识（用于标记 stealth 开启状态） */
  get signature(): string {
    if (!this.options.enabled) return "stealth-off";
    return `stealth:${this.options.level}:ua=${this.options.userAgent ? "custom" : "default"}`;
  }
}

/** 便捷函数：创建 stealth 管理器 */
export function createStealth(options?: StealthOptions): StealthManager {
  return new StealthManager(options);
}
