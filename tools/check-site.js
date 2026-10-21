/* ============================================================================
 * 老可梦图鉴 · 站点自检
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/check-site.js
 * 任何一项失败都会以退出码 1 结束，方便以后接进 GitHub Actions 或本地钩子。
 *
 * 检查内容：
 *   1. data/entries.js 的数据完整性（id 连续、编号格式、分类合法、图片存在）
 *   2. 每个 HTML：lang / viewport / title、本地链接与图片是否真实存在、脚本引入顺序
 *   3. 渲染钩子是否齐全（works 页、图鉴页、索引页、详情页各需要什么 data-* 属性）
 *   4. 是否还有残留的硬编码档案数据（works*.html 的卡片、view.html 的 database）
 *   5. JS 语法（node --check）、CSS 括号是否配平
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

let errors = 0;
let warns = 0;
const group = (t) => console.log("\n" + t);
const pass = (m) => console.log("  [ok]   " + m);
const fail = (m) => { console.log("  [FAIL] " + m); errors++; };
const warn = (m) => { console.log("  [warn] " + m); warns++; };

/**
 * 大小写敏感的「文件是否存在」。
 * Windows 上 existsSync 不区分大小写，所以 src="Gallery1.webp" 在本机永远通过，
 * 但 GitHub Pages 跑在 Linux 上，会把这种引用变成 404。这个站点是要发布到
 * Pages 的，所以必须按目录实际列出的名字逐个字符比对。
 */
const dirCache = new Map();
function existsExact(rel) {
  const norm = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  const dir = path.posix.dirname(norm);
  const base = path.posix.basename(norm);
  if (!dirCache.has(dir)) {
    const abs = path.join(ROOT, dir === "." ? "" : dir);
    let names = [];
    try { names = fs.readdirSync(abs); } catch (e) { names = null; }
    dirCache.set(dir, names);
  }
  const names = dirCache.get(dir);
  return Array.isArray(names) && names.includes(base);
}

/* ---------- 1. 数据 ---------- */
group("1. 数据源 data/entries.js");

global.window = {};
try {
  require(path.join(ROOT, "data/entries.js"));
} catch (e) {
  fail("加载失败：" + e.message);
}

const P = global.window.POKEDEX;
let entries = [];
let cats = [];

if (!P) {
  fail("没有挂到 window.POKEDEX 上");
} else {
  entries = P.entries;
  cats = P.categories;
  pass(`加载成功：${entries.length} 条档案 / ${cats.length} 个分类`);

  if (entries.length !== 11) fail(`档案数量应为 11，实际 ${entries.length}`);
  else pass("档案数量 11");

  // id 必须是 1..N 连续，且 code 与 id 对应
  const ids = entries.map((e) => e.id).sort((a, b) => a - b);
  const expect = entries.map((_, i) => i + 1);
  if (JSON.stringify(ids) !== JSON.stringify(expect)) fail("id 不是从 1 开始的连续整数：" + ids.join(","));
  else pass("id 连续：" + ids.join(","));

  const codeBad = entries.filter((e) => e.code !== "#" + String(e.id).padStart(3, "0"));
  if (codeBad.length) fail("编号与 id 不匹配：" + codeBad.map((e) => `${e.id}→${e.code}`).join(", "));
  else pass("编号格式 #001..#011 全部匹配");

  const catKeys = cats.map((c) => c.key);
  const badCat = entries.filter((e) => !catKeys.includes(e.cat));
  if (badCat.length) fail("分类不合法：" + badCat.map((e) => `${e.name}(${e.cat})`).join(", "));
  else pass("分类合法：" + catKeys.join(" / "));

  const emptyCat = cats.filter((c) => !entries.some((e) => e.cat === c.key));
  if (emptyCat.length) fail("空分类：" + emptyCat.map((c) => c.name).join(", "));
  else pass("每个分类都有档案：" + cats.map((c) => `${c.name}=${entries.filter((e) => e.cat === c.key).length}`).join(" "));

  const missingImg = entries.filter((e) => !exists(e.img));
  if (missingImg.length) fail("图片不存在：" + missingImg.map((e) => e.img).join(", "));
  else pass("11 张封面图全部存在");

  const dupName = entries.map((e) => e.name).filter((n, i, a) => a.indexOf(n) !== i);
  if (dupName.length) fail("档案名重复：" + [...new Set(dupName)].join(", "));
  else pass("档案名无重复");

  const noCover = cats.filter((c) => !exists(c.cover));
  if (noCover.length) fail("分类封面不存在：" + noCover.map((c) => c.cover).join(", "));
  else pass("分类封面全部存在");

  const badPage = cats.filter((c) => !exists(c.page));
  if (badPage.length) fail("分类跳转页不存在：" + badPage.map((c) => c.page).join(", "));
  else pass("分类跳转页全部存在");
}

/* ---------- 2. HTML ---------- */
group("2. HTML 页面");

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
pass("共 " + htmlFiles.length + " 个页面");

const RENDER_HOOKS = {
  "works1.html": { attrs: ["data-dossier-grid", "data-dossier-filter"], cat: "ancient" },
  "works2.html": { attrs: ["data-dossier-grid", "data-dossier-filter"], cat: "unknown" },
  "works3.html": { attrs: ["data-dossier-grid", "data-dossier-filter"], cat: "hope" },
  "works.html": { attrs: ["data-category-list", "data-tag-results"] },
  "sitemap.html": { attrs: ["data-entry-index", "data-tag-index"] },
  "timeline.html": { attrs: ["data-timeline"] },
  "view.html": { attrs: ["data-entry-nav", "data-back-category"] },
  "404.html": { attrs: ["data-lost-suggest"] },
};

// view.html 里由 data/render.js 填内容的容器；少一个就会有一块永远空着
const DETAIL_CONTAINERS = [
  "monsterCrumb", "monsterName", "monsterImg", "monsterLead", "monsterMeta", "monsterDesc",
  "docItem", "docClass", "docSector", "docRecovery",
  "monsterContainment", "monsterAddenda", "monsterPhotos", "monsterTags", "monsterRelated",
];

htmlFiles.forEach((file) => {
  const html = read(file);
  const tag = "  " + file + ": ";

  if (!html.includes('lang="zh-CN"')) fail(tag + "缺少 lang=\"zh-CN\"");
  if (!/name="viewport"/.test(html)) fail(tag + "缺少 viewport meta");
  if (!/<title>[^<]+<\/title>/.test(html)) fail(tag + "缺少 <title>");
  if (html.includes("<<p") || html.includes("<<div")) fail(tag + "存在 << 拼写错误");

  // 本地链接 / 图片是否存在
  const re = /(?:href|src)\s*=\s*"([^"]+)"/g;
  let m;
  const broken = [];
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!raw) continue;
    if (/^(https?:|\/\/|mailto:|tel:|javascript:|data:|#)/i.test(raw)) continue;
    const target = raw.split("#")[0].split("?")[0];
    if (!target) continue;
    if (!exists(decodeURI(target))) broken.push(raw);
  }
  if (broken.length) fail(tag + "链接/资源不存在：" + broken.join(", "));

  // 静态 <img> 必须已经接到 WebP，不能还引用母本 jpg/png
  const staticImgs = html.match(/<img\b[^>]*>/g) || [];
  const staleImg = staticImgs.filter((t) => /src\s*=\s*"[^"]+\.(?:jpe?g|png)"/i.test(t));
  if (staleImg.length) fail(tag + `静态 <img> 仍引用 jpg/png：${staleImg.join(" ")}`);
  const noDim = staticImgs.filter((t) => !/width\s*=\s*"\d+"/.test(t) && !/src\s*=\s*""/.test(t));
  if (noDim.length) fail(tag + `静态 <img> 缺 width/height（会跳版）：${noDim.join(" ")}`);

  // 渲染钩子
  const hook = RENDER_HOOKS[file];
  if (hook) {
    hook.attrs.forEach((attr) => {
      if (!html.includes(attr)) fail(tag + "缺少渲染钩子 " + attr);
      else pass(file + " 有 " + attr);
    });
    if (hook.cat) {
      const found = (html.match(/data-category="([^"]+)"/) || [])[1];
      if (found !== hook.cat) fail(tag + `data-category 应为 ${hook.cat}，实际 ${found}`);
    }
  }

  // 详情页的每个内容容器都得在 HTML 里
  if (file === "view.html") {
    const miss = DETAIL_CONTAINERS.filter((id) => !new RegExp('id="' + id + '"').test(html));
    if (miss.length) fail(tag + "缺少详情页容器：" + miss.join(", "));
    else pass("view.html 的 " + DETAIL_CONTAINERS.length + " 个内容容器齐全");
  }

  // 脚本引入：需要数据的页面才引入 entries/render；一旦引入 render 就必须先有 entries
  const iE = html.indexOf('src="data/entries.js"');
  const iR = html.indexOf('src="data/render.js"');
  const iU = html.indexOf('src="ui.js"');
  const iI = html.indexOf('src="data/img-info.js"');
  if (iR >= 0 && iE < 0) fail(tag + "引入了 render.js 却没有 entries.js");
  if (iR >= 0 && iE > iR) fail(tag + "entries.js 必须写在 render.js 之前");
  // img-info.js 提供 width/height/srcset，必须排在 render.js 之前，否则首屏会跳版
  if (iR >= 0 && iI < 0) fail(tag + "引入了 render.js 却没有 data/img-info.js");
  if (iR >= 0 && iI > iR) fail(tag + "img-info.js 必须写在 render.js 之前，否则图片拿不到宽高");
  if (hook && iR < 0) fail(tag + "有渲染钩子却没有引入 render.js");
  if (hook && iU >= 0 && iR >= 0 && iU < iR) fail(tag + "ui.js 必须在 render.js 之后，否则灯箱绑不到动态生成的卡片");

  // 搜索框搜的是 window.POKEDEX 里的档案，没有 entries.js 就只能搜到页面标题。
  // （index.html 与 changelog.html 曾经踩过这个坑：有搜索框、没数据。）
  if (/id="globalSearch"/.test(html) && iE < 0) fail(tag + "有全站搜索框却没有引入 entries.js，搜不到任何档案");

  // 访问计数块要有数据脚本，否则 [data-traffic] 永远空着
  if (/data-traffic/.test(html)) {
    if (html.indexOf('src="data/traffic.js"') < 0) fail(tag + "有 data-traffic 却没引入 data/traffic.js");
    if (iR < 0) fail(tag + "有 data-traffic 却没引入 render.js，计数块不会被填充");
  }

  // SEO 与图标：build-seo.js 的产物，缺了就等于没做
  if (!/name="description"/.test(html)) fail(tag + "缺少 meta description");
  if (!/property="og:image"/.test(html)) fail(tag + "缺少 og:image");
  if (!/rel="icon"/.test(html)) fail(tag + "缺少 favicon 引用");
});

/* ---------- 2.5 图片接线 ---------- */
group("2.5 图片接线（WebP / srcset）");

let IMG = null;
try {
  require(path.join(ROOT, "data/img-info.js"));
  IMG = global.window.IMG_INFO;
} catch (e) {
  fail("data/img-info.js 加载失败：" + e.message);
}

if (IMG) {
  const keys = Object.keys(IMG);
  pass(`img-info.js 收录 ${keys.length} 张图的接线信息`);

  // 所有被引用的图片都要有接线条目，否则 render.js 只能退回原图
  const referenced = new Set();
  entries.forEach((e) => {
    referenced.add(e.img);
    (e.photos || []).forEach((p) => referenced.add(p.src));
  });
  cats.forEach((c) => referenced.add(c.cover));
  const noInfo = [...referenced].filter((s) => !IMG[s]);
  if (noInfo.length) fail("这些图片没有 WebP 接线信息：" + noInfo.join(", "));
  else pass(`${referenced.size} 张被引用的图片全部有接线信息`);

  // 接线条目本身要自洽：full 必须是存在的 webp；有 small 就必须存在
  const badFull = [];
  const badSmall = [];
  const notWebp = [];
  keys.forEach((k) => {
    const v = IMG[k];
    if (!/\.webp$/.test(v.full || "")) notWebp.push(k);
    if (!v.full || !exists(v.full)) badFull.push(k);
    if (v.small && !exists(v.small)) badSmall.push(k);
    if (!v.w || !v.h) badFull.push(k + "(缺宽高)");
  });
  if (notWebp.length) fail("接线目标不是 .webp：" + notWebp.join(", "));
  else pass("全部接线目标都是 WebP");
  if (badFull.length) fail("WebP 文件缺失或缺宽高：" + badFull.join(", "));
  else pass("WebP 文件与宽高齐全");
  if (badSmall.length) fail("srcset 小图缺失：" + badSmall.join(", "));
  else pass(`${keys.filter((k) => IMG[k].small).length} 张带 -800 小图，文件都在`);

  // 体积：从 image-report.json 读真实字节，避免以后加了新图却忘了压
  if (exists("tools/image-report.json")) {
    try {
      const rep = JSON.parse(read("tools/image-report.json"));
      const srcB = rep.totalSrcBytes || 0;
      const webpB = rep.totalWebpBytes || 0;
      if (srcB && webpB) {
        const saved = (100 - (webpB / srcB) * 100).toFixed(1);
        pass(`图片总体积 ${(srcB / 1024).toFixed(0)} KB → ${(webpB / 1024).toFixed(0)} KB（省 ${saved}%）`);
        if (saved < 40) warn("图片压缩收益低于 40%，可能有新图没压");
      }
      // 报告里的每张图都应已经接线，否则说明报告过期了
      const repKeys = (rep.images || []).map((r) => r.src);
      const notWired = repKeys.filter((s) => !IMG[s]);
      if (notWired.length) fail("image-report 里的图没有接进 img-info.js：" + notWired.join(", "));
      else pass(`${repKeys.length} 张压缩报告与 img-info.js 一一对应`);
    } catch (e) {
      fail("tools/image-report.json 解析失败：" + e.message);
    }
  } else {
    warn("缺少 tools/image-report.json，无法核对压缩收益");
  }
  if (!exists("og-cover.png")) fail("缺少 og-cover.png（社交分享封面）");
  else pass("og-cover.png 存在");
}

/* ---------- 2.7 PWA ---------- */
group("2.7 PWA（manifest / Service Worker / 离线）");

let PWA = null;
try {
  PWA = require(path.join(ROOT, "tools/pwa-lib.js"));
} catch (e) {
  fail("tools/pwa-lib.js 加载失败：" + e.message);
}

if (PWA) {
  ["icon-192.png", "icon-512.png", "manifest.webmanifest", "sw.js"].forEach((f) => {
    if (exists(f)) pass(f + " 存在");
    else fail("缺少 " + f + "（跑一次 node tools/build-pwa.js）");
  });

  // 图标必须是真 PNG（头 8 字节），不能是改了名的别的格式
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  ["icon-192.png", "icon-512.png"].forEach((f) => {
    if (!exists(f)) return;
    const head = fs.readFileSync(path.join(ROOT, f)).slice(0, 8);
    if (!head.equals(PNG_MAGIC)) fail(f + " 不是合法 PNG");
  });

  // manifest 必须能被 JSON.parse，且 start_url / icons 指向真实文件
  if (exists("manifest.webmanifest")) {
    try {
      const mf = JSON.parse(read("manifest.webmanifest"));
      if (!mf.name || !mf.start_url || mf.display !== "standalone") {
        fail("manifest 缺 name / start_url / display:standalone");
      } else pass(`manifest 合法：${mf.short_name} · ${mf.display}`);
      const badIcon = (mf.icons || []).filter((i) => !exists(i.src));
      if (badIcon.length) fail("manifest 图标文件不存在：" + badIcon.map((i) => i.src).join(", "));
      else pass(`${(mf.icons || []).length} 个 manifest 图标都存在`);
      if (!(mf.icons || []).some((i) => i.purpose === "maskable")) {
        warn("manifest 没有 maskable 图标，安卓桌面图标会被裁成圆角正方形");
      }
      if (!/^#/.test(mf.theme_color || "")) fail("manifest 缺 theme_color");
    } catch (e) {
      fail("manifest.webmanifest 解析失败：" + e.message);
    }
  }

  // sw.js 里写死的缓存版本必须和「当前文件的现状」算出来的一致，
  // 否则说明加了文件却没重跑 build-pwa.js —— 用户会一直看到旧页面。
  if (exists("sw.js")) {
    const sw = read("sw.js");
    const want = PWA.computeVersion(PWA.listAssets());
    const got = (sw.match(/pokedex-([0-9a-f]{10})/) || [])[1];
    if (!got) fail("sw.js 里没有 pokedex-xxxx 缓存名（不是 build-pwa.js 生成的？）");
    else if (got !== want) fail(`sw.js 缓存版本过期：写的是 ${got}，当前应为 ${want}（重跑 node tools/build-pwa.js）`);
    else pass("sw.js 缓存版本与当前文件状态一致：" + got);

    if (!/mode === "navigate"/.test(sw)) warn("sw.js 没有区分页面导航请求，可能给用户返回缓存的旧页面");
    if (!/skipWaiting/.test(sw) || !/clients\.claim/.test(sw)) warn("sw.js 没做 skipWaiting + clients.claim，更新要等下次访问才生效");
    // 只检查 PRECACHE 数组本身：sw.js 的注释里也会提到 bgm.mp3（解释为什么排除它），
    // 全文件搜会误报。
    const precacheSrc = (sw.match(/const PRECACHE = (\[[\s\S]*?\]);/) || [])[1] || "";
    if (/bgm\.mp3/.test(precacheSrc)) warn("sw.js 预缓存里带着 bgm.mp3，首次安装会多下 5 MB");
    if (/\.mp4/.test(precacheSrc)) warn("sw.js 预缓存里带着 mp4，视频不该进预缓存");
    if (!precacheSrc) warn("没能在 sw.js 里定位到 PRECACHE 数组");

    // 预缓存清单要和 pwa-lib 一致：漏掉新页面就等于离线时打不开
    const listed = (sw.match(/"([^"]+\.(?:html|css|js|png|svg|webp|webmanifest|xml|txt))"/g) || [])
      .map((s) => s.replace(/"/g, ""));
    const miss = PWA.listAssets().filter((a) => listed.indexOf(a) < 0);
    if (miss.length) fail("sw.js 预缓存清单漏了：" + miss.join(", "));
    else pass(`sw.js 预缓存清单覆盖全部 ${PWA.listAssets().length} 个文件`);
  }

  // 每个页面都要接线 manifest 与 theme-color
  const noManifest = htmlFiles.filter((f) => !/rel="manifest"/.test(read(f)));
  if (noManifest.length) fail("这些页面没有引 manifest：" + noManifest.join(", "));
  else pass(`${htmlFiles.length} 个页面都引了 manifest`);
  const noTheme = htmlFiles.filter((f) => !/name="theme-color"/.test(read(f)));
  if (noTheme.length) fail("这些页面没有 theme-color：" + noTheme.join(", "));
  else pass("全部页面都有 theme-color");

  if (exists("ui.js")) {
    if (!/serviceWorker\.register\("sw\.js"\)/.test(read("ui.js"))) fail("ui.js 没有注册 service worker");
    else pass("ui.js 注册了 sw.js");
    if (!/https\?:/.test(read("ui.js"))) warn("ui.js 注册 SW 前没判协议，file:// 下会报错");
  }
}

/* ---------- 2.8 发布到 Linux Pages 的大小写安全 ---------- */
// 站点最终要发布到 GitHub Pages（Linux）。Windows 上文件系统不区分大小写，
// 所以「引用写错大小写」在本机一切正常、上线就 404。这里逐个字符核对。
group("2.8 大小写安全（GitHub Pages 跑在 Linux 上）");

{
  const refs = [];
  htmlFiles.forEach((f) => {
    const html = read(f);
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const raw = m[1];
      if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(raw)) continue; // 外链 / 锚点 / data URI
      const clean = raw.split("#")[0].split("?")[0];
      if (!clean) continue;
      refs.push({ from: f, to: clean });
    }
  });

  // CSS 里的 url(...) 也算引用
  if (exists("style.css")) {
    const cssSrc = read("style.css");
    const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
    let m;
    while ((m = re.exec(cssSrc))) {
      const raw = m[1];
      if (/^(?:[a-z]+:|\/\/|data:)/i.test(raw)) continue;
      refs.push({ from: "style.css", to: raw.split("#")[0].split("?")[0] });
    }
  }

  // img-info.js 里记录的 webp / -800.webp
  if (IMG) {
    Object.keys(IMG).forEach((src) => {
      const info = IMG[src];
      [info.webp, info.small].forEach((p) => {
        if (p) refs.push({ from: "data/img-info.js", to: p });
      });
    });
  }

  // manifest 的图标与 start_url
  if (exists("manifest.webmanifest")) {
    try {
      const mf = JSON.parse(read("manifest.webmanifest"));
      if (mf.start_url) refs.push({ from: "manifest.webmanifest", to: mf.start_url });
      (mf.icons || []).forEach((i) => refs.push({ from: "manifest.webmanifest", to: i.src }));
    } catch (e) { /* 上一组已经报过错了 */ }
  }

  const badCase = refs.filter((r) => !existsExact(r.to));
  // 去掉「文件真的不存在」的（那是别的检查项的活），这里只报大小写不一致的
  const caseOnly = badCase.filter((r) => {
    const abs = path.join(ROOT, r.to);
    try { return fs.statSync(abs).isFile(); } catch (e) { return false; }
  });
  const missing = badCase.filter((r) => caseOnly.indexOf(r) < 0);

  if (missing.length) {
    fail("引用了不存在的文件：" + missing.slice(0, 5).map((r) => `${r.from} → ${r.to}`).join(" / "));
  } else pass(`全部 ${refs.length} 处本地引用都指向存在的文件`);

  if (caseOnly.length) {
    fail("大小写不一致（本机通过、上线 404）：" + caseOnly.map((r) => `${r.from} → ${r.to}`).join(" / "));
  } else pass("全部引用的大小写与磁盘文件名完全一致");
}

/* ---------- 2.9 诡异实录（影像档案） ---------- */
group("2.9 诡异实录（影像档案）");

let RECS = null;
try {
  require(path.join(ROOT, "data/recordings.js"));
  RECS = global.window.RECORDINGS || null;
} catch (e) {
  fail("加载 data/recordings.js 失败：" + e.message);
}

if (!Array.isArray(RECS)) {
  fail("data/recordings.js 没有挂上 window.RECORDINGS");
} else {
  pass(`影像档案 ${RECS.length} 条`);

  const ids = RECS.map((r) => r.id);
  if (new Set(ids).size !== ids.length) fail("id 有重复：" + ids.join(","));
  else if (ids.some((id, i) => id !== i + 1)) fail("id 不是从 1 起的连续整数：" + ids.join(","));
  else pass("id 连续：" + ids.join(","));

  const badCode = RECS.filter((r, i) => r.code !== "REC-" + String(i + 1).padStart(3, "0"));
  if (badCode.length) fail("登记号不合规：" + badCode.map((r) => r.code).join(","));
  else pass("登记号 REC-001 起连续");

  const badDur = RECS.filter(
    (r) =>
      !(typeof r.duration === "number" && r.duration > 0) ||
      r.durationText !== "00:" + r.duration.toFixed(1)
  );
  if (badDur.length) fail("时长与时间码不一致：" + badDur.map((r) => r.code).join(","));
  else pass("时长与时间码一致（mm:ss.s）");

  const badDim = RECS.filter((r) => !(r.w > 0 && r.h > 0 && r.thumbW > 0 && r.thumbH > 0));
  if (badDim.length) fail("缺少像素尺寸：" + badDim.map((r) => r.code).join(","));
  else pass("每段都有宽高（用于防止加载跳版）");

  // 资源存在 + 大小写完全一致 + 非空
  const missingRes = [];
  const emptyRes = [];
  const tooBig = [];
  RECS.forEach((r) => {
    [r.src, r.poster, r.thumb].forEach((rel) => {
      if (!existsExact(rel)) missingRes.push(r.code + " → " + rel);
      else {
        const st = fs.statSync(path.join(ROOT, rel));
        if (st.size === 0) emptyRes.push(rel);
        if (rel === r.src && st.size > 95 * 1024 * 1024) tooBig.push(rel);
      }
    });
  });
  if (missingRes.length) fail("引用的资源不存在或大小写不符：" + missingRes.join(" / "));
  else pass(`全部 ${RECS.length * 3} 个资源（mp4 / poster / thumb）都在，且大小写一致`);
  if (emptyRes.length) fail("资源为 0 字节：" + emptyRes.join(" / "));
  if (tooBig.length) fail("视频超过 GitHub 单文件 100 MB 限制：" + tooBig.join(" / "));

  const badExt = RECS.filter(
    (r) => !/\.mp4$/i.test(r.src) || !/\.webp$/i.test(r.poster) || !/\.webp$/i.test(r.thumb)
  );
  if (badExt.length) fail("扩展名不对（应为 .mp4 / .webp）：" + badExt.map((r) => r.code).join(","));
  else pass("扩展名：mp4 + webp 封面 + webp 缩略图");

  const badStatus = RECS.filter((r) => !["PENDING", "VERIFIED", "SEALED"].includes(r.status));
  if (badStatus.length) fail("status 不在约定取值内：" + badStatus.map((r) => r.status).join(","));
  else pass("status 取值合法");
}

// 页面接线
if (!exists("records.html")) {
  fail("缺少 records.html");
} else {
  const rp = read("records.html");
  if (!/data-record-grid/.test(rp)) fail("records.html 缺少 [data-record-grid]");
  else pass("records.html 有影像网格容器");
  const order = ["data/entries.js", "data/img-info.js", "data/recordings.js", "data/render.js", "ui.js"];
  let last = -1;
  let bad = false;
  order.forEach((s) => {
    const at = rp.indexOf('src="' + s + '"');
    if (at < 0 || at < last) bad = true;
    last = at;
  });
  if (bad) fail("records.html 的脚本顺序不对，应为：" + order.join(" → "));
  else pass("records.html 脚本顺序正确");
}

if (exists("index.html")) {
  const ip = read("index.html");
  if (!/data-record-grid/.test(ip)) fail("index.html 缺少诡异实录分区 [data-record-grid]");
  else pass("首页有诡异实录分区");
  if (!ip.includes('src="data/recordings.js"')) fail("index.html 没引 data/recordings.js");
  else pass("首页引了 data/recordings.js");
}

if (exists("ui.js") && !/video-lightbox/.test(read("ui.js"))) fail("ui.js 缺少视频灯箱");
else pass("ui.js 有视频灯箱");
if (exists("style.css")) {
  const css = read("style.css");
  const need = [".record-card", ".record-thumb", ".video-lightbox", ".video-el",
                ".rec-dur", ".record-note", ".record-meta"];
  const lack = need.filter((c) => !css.includes(c));
  if (lack.length) fail("style.css 缺少样式：" + lack.join(", "));
  else pass("影像卡片与视频灯箱样式齐全（" + need.length + " 项）");
}

/* ---------- 3. 残留硬编码 ---------- */
group("3. 硬编码残留");

["works1.html", "works2.html", "works3.html", "works.html", "sitemap.html"].forEach((f) => {
  if (!exists(f)) return;
  if (/class="dossier-card"/.test(read(f))) fail(f + " 仍写死了 dossier-card 卡片");
});
if (exists("view.html")) {
  const v = read("view.html");
  if (v.includes("const database")) fail("view.html 仍内联着 const database 数据");
  if (v.includes("<style>")) warn("view.html 仍有内联 <style>");
  if (!/id="monsterName"/.test(v) || !/id="monsterDesc"/.test(v)) fail("view.html 缺少详情页渲染锚点");
  else pass("view.html 渲染锚点齐全");
}
if (exists("sitemap.html") && read("sitemap.html").includes('href="work1.html"')) {
  warn("sitemap.html 仍指向旧版 work1.html（已被 view.html?id= 体系取代）");
}

/* ---------- 4. JS 语法 ---------- */
group("4. JavaScript 语法");

const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    if (d.name === "node_modules" || d.name.startsWith(".")) return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (d.name.endsWith(".js")) jsFiles.push(p);
  });
})(ROOT);

jsFiles.forEach((p) => {
  try {
    // 用 inherit：语法错误由 node 自己打印，同时在受限沙箱里也能正常工作
    // （沙箱禁止程序通过管道捕获另一个程序的输出，stdio:'pipe' 会 EPERM）
    execFileSync(process.execPath, ["--check", p], { stdio: "inherit" });
    pass(path.relative(ROOT, p));
  } catch (e) {
    fail(path.relative(ROOT, p) + " 语法错误（见上方 node 输出）");
  }
});

/* ---------- 5. CSS ---------- */
group("5. CSS");

const css = read("style.css");
const open = (css.match(/\{/g) || []).length;
const close = (css.match(/\}/g) || []).length;
if (open !== close) fail(`style.css 花括号不配平：{ ${open} 个 / } ${close} 个`);
else pass(`style.css 花括号配平（${open} 组）`);

// 用 hidden 属性控制显隐的块，只要 CSS 里给它写了 display:flex/grid/block…，
// hidden 就失效了（元素照样显示）。这种情况必须显式补 [hidden]{display:none}。
// 没写 display 的块不用管 —— hidden 的默认 display:none 就够。
const HIDDEN_BLOCKS = [
  { sel: ".foot-traffic", attr: "data-traffic" },
  { sel: ".tag-results", attr: "data-tag-results" },
  { sel: ".related-strip", attr: "data-related" },
];
const escSel = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
HIDDEN_BLOCKS.forEach((b) => {
  if (!htmlFiles.some((f) => read(f).includes(b.attr))) return;
  const rule = css.match(new RegExp(escSel(b.sel) + "\\s*\\{([^}]*)\\}"));
  const setsDisplay = rule && /(^|[;\s])display\s*:/.test(rule[1]);
  const hasOverride = new RegExp(escSel(b.sel) + "\\[hidden\\]\\s*\\{[^}]*display\\s*:\\s*none").test(css);
  if (setsDisplay && !hasOverride) {
    fail(`style.css 给 ${b.sel} 设了 display 但没写 ${b.sel}[hidden]{display:none}，${b.attr} 的隐藏会失效`);
  } else if (setsDisplay) {
    pass(`${b.sel} 的 display 已被 [hidden] 覆盖`);
  } else {
    pass(`${b.sel} 未设 display，hidden 属性直接生效`);
  }
});

/* ---------- 汇总 ---------- */
console.log("\n" + "=".repeat(56));
if (errors === 0) {
  console.log(warns === 0 ? "全部通过 ✓" : `通过，但有 ${warns} 条提醒`);
  process.exit(0);
} else {
  console.log(`${errors} 项失败，${warns} 条提醒`);
  process.exit(1);
}
