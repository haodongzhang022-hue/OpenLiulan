/**
 * 错误自动匹配解决方案示例
 *
 * 演示「cnb.cool 在线优势」的升级能力：当调试/CI 中出现问题时，
 * 自动检索匹配内置解决方案知识库并推荐方案——
 * - 简单问题（auto）→ 直接标准化自动化，反馈即结果；
 * - 复杂问题（guide）→ 推荐模块 skill / 开源项目 / 解决思路。
 * - 二次触发：同一类错误出现 2 次才推荐，避免每次打扰。
 *
 * 运行: node examples/solution-match.mjs
 */
import {
  RepeatErrorRegistry,
  matchSolution,
  fingerprintError,
  lookupSolution,
  SOLUTION_PLAYBOOK,
} from "@browser-ai-forge/mcp-server";

const registry = new RepeatErrorRegistry(); // 默认阈值 2

function simulateError(text) {
  const fp = fingerprintError(text);
  const m = matchSolution(registry, text);
  const line = `\n[错误] ${text}\n  指纹=${fp} | 第${m.occurrences}次 | 触发推荐=${m.triggered}`;
  if (m.triggered && m.advice) {
    return line + `\n  >>> ${m.advice.split("\n").join("\n      ")}`;
  }
  return line + (m.triggered ? "\n  (未命中内置方案)" : "");
}

console.log("===== 场景 1：网络 404（auto 简单问题，二次触发） =====");
console.log(simulateError("网络存在 1 个失败请求 404"));
console.log(simulateError("请求失败 GET /api/users 404")); // 第 2 次 → 触发

console.log("\n===== 场景 2：CORS 跨域（guide 复杂问题，推荐 skill/开源项目） =====");
const reg2 = new RepeatErrorRegistry();
console.log(simulateError("Access-Control-Allow-Origin 缺失"));
console.log(simulateError("跨域请求被浏览器拦截")); // 第 2 次 → 触发

console.log("\n===== 场景 3：JS 未捕获异常（auto） =====");
console.log(simulateError("页面抛出了 JS 未捕获异常"));
console.log(simulateError("Uncaught TypeError: x is not a function")); // 第 2 次 → 触发

console.log("\n===== 内置 playbook 一览 =====");
for (const s of SOLUTION_PLAYBOOK) {
  console.log(`- [${s.level}] ${s.fingerprint} | ${s.title}`);
}
console.log(`\n共 ${SOLUTION_PLAYBOOK.length} 条内置解决方案`);
