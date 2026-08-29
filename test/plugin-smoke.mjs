/**
 * 离目录冒烟自检：加载自包含插件包 lib/index.js，用假 ctx 验证
 * ForgeMcp 工具被正确映射为 harness 工具并注册（browser_ 前缀）。
 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const mod = await import('../lib/index.js');
if (typeof mod.apply !== 'function') throw new Error('lib/index.js 未导出 apply');
if (mod.name !== 'openliulan-browser') throw new Error('插件 name 不匹配: ' + mod.name);

const registered = [];
const ctx = {
  tools: {
    register(def) {
      registered.push(def);
      return () => { const i = registered.indexOf(def); if (i >= 0) registered.splice(i, 1); };
    },
  },
  effect(fn) { return fn(); },
};

mod.apply(ctx, { prefix: 'browser' });

const expected = ['observe', 'act', 'diagnose', 'eval', 'screenshot', 'session_log', 'close', 'stealth_status'];
const names = registered.map((d) => d.name).sort();
const want = expected.map((n) => 'browser_' + n).sort();
for (const n of want) if (!names.includes(n)) throw new Error('缺少工具: ' + n);
if (names.length !== want.length) throw new Error('工具数不符: ' + names.join(','));

for (const d of registered) {
  if (typeof d.execute !== 'function') throw new Error(d.name + ' 缺 execute');
  if (!d.output || typeof d.output.render !== 'function') throw new Error(d.name + ' 缺 output.render');
}

console.log('SMOKE_OK pkg=' + pkg.name + '@' + pkg.version + ' tools=' + registered.length + ' dshBundlePatch=' + JSON.stringify(pkg.dsh?.bundle?.patch));