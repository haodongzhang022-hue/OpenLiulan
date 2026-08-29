/**
 * 构建「可安装 DSH 插件包」的自包含单文件 lib/index.js。
 *
 * 用 esbuild 把 src/plugin.ts 及其内部依赖（@openliulan/* 全部源码）内联为
 * 一个 ESM 文件，只外置已发布的 playwright，从而产出一个不依赖任何未发布
 * npm 包、可被 `dsh plugin --profile web add ...` 一条命令安装的插件包。
 *
 * 说明：这里的 resolve 插件把所有 `@openliulan/<pkg>` 重定向到对应包的
 * 源码入口 src/index.ts（而非可能未构建的 main 字段），实现真正的进程内
 * 内联。`packages` 不设 external，否则内部包会被当外部依赖原样导出。
 */
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const INTERNAL = ['mcp-server', 'core', 'engines', 'diagnosis', 'token', 'ai-layer', 'stealth'];

/** 把 @openliulan/<pkg> 解析到源码入口，保证被打包内联。 */
const resolveOpenliulan = {
  name: 'resolve-openliulan',
  setup(build) {
    build.onResolve({ filter: /^@openliulan\// }, (args) => {
      const name = args.path.replace(/^@openliulan\//, '');
      if (!INTERNAL.includes(name)) return; // 走默认解析
      return { path: resolve(root, `packages/${name}/src/index.ts`) };
    });
  },
};

await build({
  entryPoints: [resolve(root, 'src/plugin.ts')],
  outfile: resolve(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
  sourcemap: 'inline',
  plugins: [resolveOpenliulan],
  external: ['playwright', 'playwright-core'],
});

console.log('built lib/index.js');