#!/usr/bin/env node
/* ----------------------------------------------------------------------------
 * tools/publish-site.js
 * ----------------------------------------------------------------------------
 * 把 my-site/ 的内容同步到一个「本地镜像目录」_publish/，
 * 那个目录才是要推到「只放网站」公开仓库里的东西 —— 因为它是仓库根目录 = 站点根目录，
 * 线上 URL 才干净：https://<user>.github.io/<repo>/
 *
 * 用法：
 *   node tools/publish-site.js             # 同步（会覆盖 _publish/ 里被托管的文件）
 *   node tools/publish-site.js --dry-run   # 只看会发生什么，不写盘
 *
 * 三条设计：
 *   1. 只同步文件，不碰 git。_publish/.git 永远不动，init / commit / push 由人来敲
 *      （见脚本末尾打印的命令）。
 *   2. 镜像式：_publish 里被托管范围之内、而 my-site 里已经没有的文件会被删掉，
 *      避免线上留着上一版的死文件。删除范围严格限制在 _publish/ 之内。
 *   3. 发布版的差异只有三处搬迁（下面 RELOCATE）：
 *        tools/ci/checks.yml         → .github/workflows/checks.yml
 *        tools/ci/traffic.yml        → .github/workflows/traffic.yml
 *        tools/ci/collect-traffic.js → .github/scripts/collect-traffic.js
 *        tools/ci/README.publish.md  → README.md
 *      这几个工作流文件在开发仓库里故意不放 .github/ —— 放了 GitHub 会拿它们
 *      当这个开发仓库的工作流来跑。它们只在发布仓库里才是真工作流。
 * ------------------------------------------------------------------------- */
"use strict";

const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, ".."); // my-site/
const DEST = path.resolve(__dirname, "../../_publish"); // <开发仓库根>/_publish/
const APPLY = !process.argv.includes("--dry-run");

// 开发仓库里是 tools/ci/xxx，发布仓库里换成这个位置
const RELOCATE = new Map([
  ["tools/ci/checks.yml", ".github/workflows/checks.yml"],
  ["tools/ci/traffic.yml", ".github/workflows/traffic.yml"],
  ["tools/ci/collect-traffic.js", ".github/scripts/collect-traffic.js"],
  ["tools/ci/README.publish.md", "README.md"],
]);

// 不该发布出去的东西
const SKIP_DIRS = new Set([".git", "node_modules", "_recover", "_shot", "_tmp"]);
const SKIP_FILE = /(^\.dsh-ops-update-.*\.lock$)|(\.blend1$)|(^\.DS_Store$)/;

function bail(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

if (path.basename(DEST) !== "_publish") bail("目标目录不像 _publish，拒绝运行：" + DEST);
if (!fs.existsSync(SRC)) bail("源目录不存在：" + SRC);

/** 递归收集源文件 → Map<相对 DEST 的 posix 路径, 绝对源路径> */
function collect() {
  const out = new Map();
  const seenCi = new Set();

  (function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = path.relative(SRC, abs).split(path.sep).join("/");
      const st = fs.statSync(abs);

      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        // tools/ci 整目录只通过 RELOCATE 出去，不原样发布
        if (rel === "tools/ci") {
          for (const f of fs.readdirSync(abs)) {
            if (f.endsWith(".lock")) continue;
            const key = "tools/ci/" + f;
            if (!RELOCATE.has(key)) bail("tools/ci/ 里有没登记搬迁规则的文件：" + key + "（请加进 RELOCATE）");
            seenCi.add(key);
          }
          continue;
        }
        walk(abs);
        continue;
      }

      if (!st.isFile()) continue;
      if (SKIP_FILE.test(name)) continue;
      out.set(rel, abs);
    }
  })(SRC);

  // 反向检查：RELOCATE 里写了但源文件不存在
  for (const key of RELOCATE.keys()) {
    if (!seenCi.has(key)) bail("RELOCATE 里登记了但源文件不存在：" + key);
  }
  for (const [key, destRel] of RELOCATE) {
    if (out.has(destRel)) bail("搬迁目标和已有文件撞名：" + key + " → " + destRel);
    out.set(destRel, path.join(SRC, key));
  }
  return out;
}

/** 递归收集 _publish 里现有的文件（跳过 .git） */
function existing() {
  const out = [];
  if (!fs.existsSync(DEST)) return out;
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = path.relative(DEST, abs).split(path.sep).join("/");
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(abs);
      } else if (st.isFile()) {
        out.push(rel);
      }
    }
  })(DEST);
  return out;
}

const want = collect();
const have = existing();
const same = (a, b) => {
  const x = fs.readFileSync(a);
  const y = fs.readFileSync(b);
  return x.length === y.length && x.equals(y);
};

const added = [];
const updated = [];
let unchanged = 0;
let bytes = 0;

for (const [rel, abs] of want) {
  const to = path.join(DEST, rel);
  bytes += fs.statSync(abs).size;
  if (!fs.existsSync(to)) added.push(rel);
  else if (same(abs, to)) unchanged++;
  else updated.push(rel);
  if (APPLY) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(abs, to);
  }
}

const stale = have.filter((rel) => !want.has(rel));
if (APPLY) {
  for (const rel of stale) fs.rmSync(path.join(DEST, rel), { force: true });
  // 清掉因删除而空掉的目录（只删 _publish 内、且不含 .git 的空目录）
  (function prune(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) {
        prune(abs);
        if (fs.readdirSync(abs).length === 0) fs.rmSync(abs, { recursive: true, force: true });
      }
    }
  })(DEST);
}

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log((APPLY ? "已同步" : "[dry-run] 将同步") + " → " + DEST);
console.log("  文件总数 " + want.size + "（新增 " + added.length + " / 更新 " + updated.length + " / 未变 " + unchanged + "）");
console.log("  站点体积 " + kb(bytes) + "（" + bytes + " 字节）");
if (added.length) console.log("  新增：" + added.join("、"));
if (updated.length) console.log("  更新：" + updated.join("、"));
if (stale.length) console.log((APPLY ? "  已删除过期文件：" : "  将删除过期文件：") + stale.join("、"));

console.log(`
下一步（在开发仓库根目录执行）：
  cd _publish
  git add -A
  git commit -m "站点：<描述>"
  git push origin main
`);
