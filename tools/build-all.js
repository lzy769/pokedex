#!/usr/bin/env node
/* ----------------------------------------------------------------------------
 * tools/build-all.js —— 按正确顺序跑一遍全部生成脚本，然后跑两套校验
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/build-all.js              # 生成 + 校验
 *     node tools/build-all.js --check      # 只校验，不生成
 *     node tools/build-all.js --quick      # 生成 + 只跑 check-site（跳过 smoke）
 *
 * 为什么需要这个文件：生成脚本之间有顺序依赖，以前是靠人记，结果踩过坑——
 *   build-feed.js 会整份重写 changelog.html（连同它的 <head> 模板），
 *   如果它在 build-seo.js 之后跑，就会把 canonical / og:url / 绝对地址的
 *   og:image 全部冲掉，而且不会有任何报错。顺序写死在这里，就不会再错。
 *
 * 正确顺序与理由：
 *   0. normalize-eol.js 把文本文件行尾刷成 LF
 *                       —— 必须最先跑：缓存版本是按文件内容算的哈希，
 *                          带着 CRLF 算出来的版本在 CI（Linux 检出成 LF）上对不上
 *   1. build-feed.js    重写 changelog.html + feed.xml（会覆盖 head）
 *   2. build-seo.js     SEO/OG/canonical + sitemap.xml + robots.txt
 *                       —— 必须紧跟在 build-feed 后面，把上一步冲掉的补回来
 *   3. build-imgtags.js 图片 WebP + srcset 接线（按 image-report.json）
 *   4. build-pwa.js     manifest + sw.js + 给页面补 manifest/theme-color 引用
 *                       —— 放最后：它前面任何一个脚本重写了 <head>，
 *                          它都能把 PWA 那几个标签补回来
 * ------------------------------------------------------------------------- */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const QUICK = args.includes("--quick");

const STEPS = [
  { name: "统一行尾为 LF", file: "normalize-eol.js", skipWhenCheckOnly: true },
  { name: "更新日志 + RSS", file: "build-feed.js", skipWhenCheckOnly: true },
  { name: "SEO / sitemap / robots", file: "build-seo.js", skipWhenCheckOnly: true },
  { name: "图片 WebP + srcset 接线", file: "build-imgtags.js", skipWhenCheckOnly: true },
  { name: "PWA manifest + Service Worker", file: "build-pwa.js", skipWhenCheckOnly: true },
  { name: "站点静态自检", file: "check-site.js", gate: true },
  { name: "渲染冒烟测试", file: "smoke-render.js", gate: true, skip: QUICK },
];

let failed = 0;

for (const step of STEPS) {
  if (CHECK_ONLY && step.skipWhenCheckOnly) continue;
  if (step.skip) {
    console.log(`\n== 跳过：${step.name}（--quick）`);
    continue;
  }

  console.log(`\n${"=".repeat(66)}\n== ${step.name}  →  tools/${step.file}\n${"=".repeat(66)}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, step.file)], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (r.status !== 0) {
    failed++;
    console.error(`\n✗ ${step.file} 退出码 ${r.status}`);
    if (step.gate) break; // 校验挂了就没必要继续后面的
  }
}

if (failed) {
  console.error(`\n✗ 有 ${failed} 个步骤失败`);
  process.exit(1);
}
console.log("\n✓ 全部完成");
