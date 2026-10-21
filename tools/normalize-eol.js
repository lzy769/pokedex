#!/usr/bin/env node
/* ----------------------------------------------------------------------------
 * tools/normalize-eol.js —— 把站点文本文件的行尾统一成 LF
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/normalize-eol.js            # 统一（只改需要改的）
 *     node tools/normalize-eol.js --dry-run   # 只看会改哪些，不写盘
 *
 * 为什么必须统一（这不是洁癖，是会真出问题的）：
 *   sw.js 的缓存版本 = 预缓存清单里每个文件「文件名 + 字节数 + 内容 sha256」的哈希。
 *   这个哈希必须跨机器一致，否则会出现这种情况：
 *     - 本地工作副本是 CRLF，算出版本 A，写进 sw.js
 *     - 推到 GitHub，Actions 在 Linux 上检出（eol=lf），内容变成 LF，算出版本 B
 *     - check-site.js 在 CI 里判定「sw.js 缓存版本过期」→ 发布被卡住
 *   而文件其实一模一样。把行尾统一成 LF，再配 .gitattributes（text=auto eol=lf），
 *   本地 / 索引 / CI 检出三处字节完全相同，哈希才会稳定。
 *
 * 只处理下面的文本扩展名，图片与音频一个字节都不碰。
 * ------------------------------------------------------------------------- */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APPLY = !process.argv.includes("--dry-run");

const TEXT_EXT = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt",
  ".webmanifest", ".yml", ".yaml", ".md", ".svg",
]);

// 不进的目录：临时 / 恢复 / 截图，以及 git 自己的
const SKIP_DIRS = new Set([".git", "node_modules", "_recover", "_shot", "_tmp"]);

const changed = [];
const clean = [];
let scanned = 0;

(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(abs);
      continue;
    }
    if (!st.isFile()) continue;
    if (!TEXT_EXT.has(path.extname(name).toLowerCase())) continue;
    scanned++;

    const buf = fs.readFileSync(abs);
    // 只把 CRLF 里的 \r 去掉；单独的 \r（老 Mac 行尾）不动，避免误伤
    const out = Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");

    if (out.length === buf.length && out.equals(buf)) {
      clean.push(rel);
      continue;
    }
    changed.push(`${rel}  ${buf.length} → ${out.length} 字节`);
    if (APPLY) fs.writeFileSync(abs, out);
  }
})(ROOT);

console.log(`${APPLY ? "已统一" : "[dry-run] 将统一"} ${changed.length} 个文件的行尾为 LF（扫描 ${scanned} 个文本文件，${clean.length} 个本来就是 LF）`);
if (changed.length) {
  changed.forEach((c) => console.log("  " + c));
} else {
  console.log("  没有需要改的");
}
