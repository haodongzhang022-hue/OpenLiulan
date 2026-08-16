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
  SolutionRepository,
  exportSolutionRepoMarkdown,
} from "@browser-ai-forge/mcp-server";

function simulateError(registry, text) {
  const fp = fingerprintError(text);
  const m = matchSolution(registry, text);
  const line = `\n[错误] ${text}\n  指纹=${fp} | 第${m.occurrences}次 | 触发推荐=${m.triggered}`;
  if (m.triggered && m.advice) {
    return line + `\n  >>> ${m.advice.split("\n").join("\n      ")}`;
  }
  return line + (m.triggered ? "\n  (未命中内置方案)" : "");
}

console.log("===== 场景 1：网络 404（auto 简单问题，二次触发） =====");
const reg1 = new RepeatErrorRegistry();
console.log(simulateError(reg1, "网络存在 1 个失败请求 404"));
console.log(simulateError(reg1, "请求失败 GET /api/users 404")); // 第 2 次 → 触发

console.log("\n===== 场景 2：CORS 跨域（guide 复杂问题，推荐 skill/开源项目） =====");
const reg2 = new RepeatErrorRegistry();
console.log(simulateError(reg2, "Access-Control-Allow-Origin 缺失"));
console.log(simulateError(reg2, "跨域请求被浏览器拦截")); // 第 2 次 → 触发

console.log("\n===== 场景 3：JS 未捕获异常（auto） =====");
const reg3 = new RepeatErrorRegistry();
console.log(simulateError(reg3, "页面抛出了 JS 未捕获异常"));
console.log(simulateError(reg3, "Uncaught TypeError: x is not a function")); // 第 2 次 → 触发

console.log("\n===== 内置 playbook 一览 =====");
for (const s of SOLUTION_PLAYBOOK) {
  console.log(`- [${s.level}] ${s.fingerprint} | ${s.title}`);
}
console.log(`\n共 ${SOLUTION_PLAYBOOK.length} 条内置解决方案`);

// ===== 场景 4：可成长的在线解决方案库（不依赖检索，越用越大） =====
console.log("\n===== 场景 4：可成长方案库（在线库积累，系统持续成长） =====");
const repo = new SolutionRepository("./solutions-repo.json"); // 持久化库文件
const repoReg = new RepeatErrorRegistry();
function repoSimulateError(text) {
  const fp = fingerprintError(text);
  const m = repo.match(repoReg, text);
  const line = `\n[错误] ${text}\n  指纹=${fp} | 第${m.occurrences}次 | 触发推荐=${m.triggered}`;
  if (m.triggered && m.advice) {
    return line + `\n  >>> ${m.advice.split("\n").join("\n      ")}`;
  }
  return line + (m.triggered ? "\n  (未命中方案 → 记为待沉淀候选)" : "");
}

// 一个内置库未覆盖的新错误（如后端 429 限流）
console.log(repoSimulateError("后端返回 429 too many requests"));
console.log(repoSimulateError("接口限流 429 请稍后重试")); // 内置未命中 → 记为待沉淀候选
console.log("未命中的新错误候选:", repo.unknownErrors);

// 解决后沉淀进库（系统成长）
repo.addSolution({
  id: "api-rate-limit",
  fingerprint: "api:rate-limit",
  title: "后端接口限流（429）",
  pattern: /429|rate.?limit|限流|too many requests/i,
  level: "guide",
  solution: "后端限流常见解：① 加指数退避重试；② 减少并发/批量请求；③ 检查是否有短时间高频轮询。",
  skill: "cnb-pipeline",
  openSource: "p-limit / async-retry",
});
console.log("沉淀后自定义库规模:", repo.customCount, "→ 方案库已写入", repo.persist());

// 方案库导出（可作为在线库提交/制品/文档）
console.log("\n方案库导出预览（前 4 行）:");
console.log(exportSolutionRepoMarkdown(repo, { title: "项目解决方案库" }).split("\n").slice(0, 4).join("\n"));
console.log(`方案库共 ${repo.entries.length} 条（内置 ${SOLUTION_PLAYBOOK.length} + 沉淀 ${repo.customCount}）`);
