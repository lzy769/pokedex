/* ============================================================================
 * PWA 公共逻辑：预缓存清单与缓存版本
 * ----------------------------------------------------------------------------
 * build-pwa.js 用它生成 sw.js，check-site.js 用它复核 sw.js 有没有过期。
 * 两边共用同一份实现，避免「改了清单规则但只改了一边」这种最难查的问题。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");

/** 需要预缓存的文件（相对站点根目录的 POSIX 路径，已排序去重） */
function listAssets() {
  const out = [];
  fs.readdirSync(ROOT, { withFileTypes: true }).forEach((d) => {
    if (!d.isFile()) return;
    if (/\.(html|css|svg|png|webp|webmanifest|xml|txt)$/i.test(d.name)) out.push(d.name);
  });

  const dataDir = path.join(ROOT, "data");
  if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir).forEach((f) => {
      if (f.endsWith(".js") && f !== "traffic.js") out.push("data/" + f);
    });
  }

  ["ui.js", "intro.js"].forEach((f) => {
    if (fs.existsSync(path.join(ROOT, f))) out.push(f);
  });

  // bgm.mp3 刻意不在清单里：5 MB 的音频会让首次安装变慢，改用运行时缓存
  return [...new Set(out)].sort();
}

/**
 * 缓存版本 =（文件名 + 内容摘要）的 sha256 前 10 位。
 *
 * 必须按「文件内容」而不是「修改时间」算：mtime 会随 clone / checkout /
 * 换机器而变化，而 CI（GitHub Actions 的 Pages 部署）就是这样检出仓库的。
 * 用 mtime 会导致 check-site.js 在 CI 上误判 sw.js「过期」并把发布卡住 ——
 * 明明文件一模一样。内容摘要则跨机器稳定。
 */
function computeVersion(assets) {
  const list = assets || listAssets();
  const h = crypto.createHash("sha256");
  list.forEach((rel) => {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    h.update(rel + ":" + buf.length + ":");
    h.update(crypto.createHash("sha256").update(buf).digest("hex"));
    h.update("\n");
  });
  return h.digest("hex").slice(0, 10);
}

module.exports = { ROOT, listAssets, computeVersion };
