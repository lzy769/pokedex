/* ============================================================================
 * 老可梦图鉴 · SEO / 站点文件生成
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/build-seo.js
 *
 * 作用：
 *   1. 给 16 个 HTML 的 <head> 补 meta description / Open Graph / twitter card
 *   2. 插入 favicon 引用 / canonical / og:url
 *   3. 生成 sitemap.xml（含 11 条档案详情页）
 *   4. 生成 robots.txt
 *
 * 说明：本脚本是可重复执行的（幂等）——已经写过 description 的页面不会重复插入。
 *
 * 关于绝对地址：站点已上线到 https://lzy769.github.io/pokedex/ ，
 * 所以 og:image / og:url / canonical / sitemap 的 <loc> / robots 的 Sitemap 行
 * 都必须写绝对 URL —— 相对路径在分享卡片和搜索引擎抓取里会被解析错。
 * 站点换域名或换仓库名时，只改下面的 SITE_BASE 一处，再重跑本脚本。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, c) => fs.writeFileSync(path.join(ROOT, f), c, "utf8");

/* ---------- 读数据源 ---------- */
global.window = {};
require(path.join(ROOT, "data", "entries.js"));
const P = global.window.POKEDEX;
const entries = P.entries;
const cats = P.categories;

/* ---------- 各页面的描述与关键词 ---------- */
const SITE = "Old Pokémon Pokédex";
const SITE_DESC = "一份收录怪异个体影像的私人档案室，按分类浏览档案、检索编号。";
// 线上站点根地址（末尾必须带 /）。换域名/换仓库名只改这一行。
const SITE_BASE = "https://lzy769.github.io/pokedex/";
// 分享卡片图：专门为 OG 生成的 1200×630
const OG_IMAGE = SITE_BASE + "og-cover.png";

const META = {
  "index.html": {
    title: `${SITE} · 首页`,
    desc: "老可梦图鉴首页：三道分类入口、异常信号雷达与留言入口。",
    kw: "老可梦图鉴,Old Pokémon Pokédex,档案室,怪异档案,图鉴",
  },
  "works.html": {
    title: "图鉴 · Old Pokémon Pokédex",
    desc: "档案室总览，按「远古恐惧 / 未知之厄 / 人类希望」三大分类浏览。",
    kw: "图鉴,分类,远古恐惧,未知之厄,人类希望",
  },
  "about.html": {
    title: "关于我们 · Old Pokémon Pokédex",
    desc: "关于这个档案室的来历、立场与联系方式。",
    kw: "关于我们,联系,档案室,来路",
  },
  "sitemap.html": {
    title: "系统索引 · Old Pokémon Pokédex",
    desc: "全站页面与全部档案的链接索引。",
    kw: "索引,站点地图,档案列表,链接",
  },
  "hidden.html": {
    title: "ERROR_404_CORRUPTED",
    desc: "站点损坏页 / 404 兜底页。",
    kw: "404,损坏,兜底",
  },
  "view.html": {
    title: "调取档案中... · Old Pokémon Pokédex",
    desc: "档案详情页：按编号调取某条档案的影像、导语与完整记录。",
    kw: "档案详情,编号检索,个体档案",
  },
  "work1.html": { title: "狞笑之杰 · Old Pokémon Pokédex", desc: "狞笑之杰：档案 #001 的独立记录页。", kw: "狞笑之杰,档案 001" },
  "work2.html": { title: "青花瓷 · Old Pokémon Pokédex", desc: "青花瓷（好皮帅哥）：档案 #002 的独立记录页。", kw: "青花瓷,好皮帅哥,档案 002" },
  "work3.html": { title: "青鬼 · Old Pokémon Pokédex", desc: "青鬼：档案 #003 的独立记录页。", kw: "青鬼,档案 003" },
  "work4.html": { title: "反常 · Old Pokémon Pokédex", desc: "反常：档案 #004 的独立记录页。", kw: "反常,档案 004" },
  "works1.html": {
    title: "远古恐惧 · Old Pokémon Pokédex",
    desc: `远古恐惧档案室（历史上的恶魔），收录档案 ${entries.filter((e) => e.cat === "ancient").map((e) => e.code).join("、")}。`,
    kw: "远古恐惧,历史上的恶魔,档案室",
  },
  "works2.html": {
    title: "未知之厄 · Old Pokémon Pokédex",
    desc: `未知之厄档案室（灾难发起者），收录档案 ${entries.filter((e) => e.cat === "unknown").map((e) => e.code).join("、")}。`,
    kw: "未知之厄,灾难发起者,档案室",
  },
  "works3.html": {
    title: "人类希望 · Old Pokémon Pokédex",
    desc: `人类希望档案室（向死而生），收录档案 ${entries.filter((e) => e.cat === "hope").map((e) => e.code).join("、")}。`,
    kw: "人类希望,向死而生,档案室",
  },
  "timeline.html": {
    title: "事件时间线 · Old Pokémon Pokédex",
    desc: "按发现日期汇总全部档案与观测事件的时间线，最早的记录最不可靠。",
    kw: "事件时间线,时间线,发现日期,档案年表",
  },
  "changelog.html": {
    title: "更新日志 · Old Pokémon Pokédex",
    desc: "站点与档案库的版本记录：每次新增了什么档案、什么功能。",
    kw: "更新日志,changelog,RSS,版本记录",
  },
};

/* ---------- HTML 转义（属性值里不能出现裸引号） ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* ---------- 1. 补齐各页面 head ---------- */
const HTML_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

const metaTag = (m, file) =>
  `  <meta name="description" content="${esc(m.desc)}">\n` +
  `  <meta name="keywords" content="${esc(m.kw)}">\n` +
  `  <link rel="canonical" href="${SITE_BASE + file}">\n` +
  `  <meta property="og:type" content="website">\n` +
  `  <meta property="og:site_name" content="${esc(SITE)}">\n` +
  `  <meta property="og:url" content="${SITE_BASE + file}">\n` +
  `  <meta property="og:title" content="${esc(m.title)}">\n` +
  `  <meta property="og:description" content="${esc(m.desc)}">\n` +
  `  <meta property="og:image" content="${OG_IMAGE}">\n` +
  `  <meta property="og:image:width" content="1200">\n` +
  `  <meta property="og:image:height" content="630">\n` +
  `  <meta name="twitter:card" content="summary_large_image">\n` +
  `  <meta name="twitter:title" content="${esc(m.title)}">\n` +
  `  <meta name="twitter:description" content="${esc(m.desc)}">\n` +
  `  <meta name="twitter:image" content="${OG_IMAGE}">`;

let patched = 0;
// 兜底页不该被搜索引擎收录：它是给「不存在的地址」用的，
// 不写 noindex 的话搜索引擎会把任意 404 都当成这个页面的副本。
const NOINDEX = `<meta name="robots" content="noindex,follow">`;
HTML_FILES.forEach((file) => {
  let html = read(file);
  const before = html;

  // 不在 META 里的页面（目前只有 404.html）只做 noindex，不写标题/描述
  const m = META[file];
  if (!m) {
    if (file === "404.html" && !/name="robots"/.test(html)) {
      const anchor = '<link rel="stylesheet" href="style.css">';
      if (html.includes(anchor)) html = html.replace(anchor, NOINDEX + '\n  ' + anchor);
    }
    if (html !== before) {
      write(file, html);
      patched++;
    }
    return;
  }

  // 已经写过 description 就跳过，避免重复
  if (!/name="description"/.test(html)) {
    const idx = html.indexOf("</title>");
    if (idx < 0) { console.log("  [warn] " + file + " 没有 <title>，跳过 meta"); return; }
    const end = html.indexOf("\n", idx);
    html = html.slice(0, end + 1) + "\n" + metaTag(m, file) + html.slice(end + 1);
  }

  // ---- 升级既有页面（早期版本写的是相对 og:image，也没有 canonical / og:url）----
  // og:image 一律换成绝对地址的 1200×630 分享图
  html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${OG_IMAGE}">`);
  html = html.replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${OG_IMAGE}">`);

  // og:image:width / height 缺失就补在 og:image 后面
  if (!/property="og:image:width"/.test(html)) {
    html = html.replace(
      /(<meta property="og:image" content="[^"]*">)/,
      '$1\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">'
    );
  }

  // twitter:image 缺失就插在 twitter:description 后面
  if (!/name="twitter:image"/.test(html)) {
    html = html.replace(
      /(<meta name="twitter:description" content="[^"]*">)/,
      '$1\n  <meta name="twitter:image" content="' + OG_IMAGE + '">'
    );
  }

  // og:site_name / og:url 缺失就补在 og:type 后面
  if (!/property="og:site_name"/.test(html)) {
    html = html.replace(
      /(<meta property="og:type" content="website">)/,
      '$1\n  <meta property="og:site_name" content="' + esc(SITE) + '">\n  <meta property="og:url" content="' + SITE_BASE + file + '">'
    );
  }

  // canonical 缺失就插在 style.css 之前
  if (!/rel="canonical"/.test(html)) {
    const anchor = '<link rel="stylesheet" href="style.css">';
    if (html.includes(anchor)) {
      html = html.replace(anchor, '<link rel="canonical" href="' + SITE_BASE + file + '">\n  ' + anchor);
    }
  }

  // favicon（幂等）
  if (!/rel="icon"/.test(html)) {
    const anchor = '<link rel="stylesheet" href="style.css">';
    if (html.includes(anchor)) {
      html = html.replace(anchor, anchor + '\n  <link rel="icon" type="image/svg+xml" href="favicon.svg">');
    } else {
      console.log("  [warn] " + file + " 找不到 style.css 链接，未插 favicon");
    }
  }

  if (html !== before) {
    write(file, html);
    patched++;
  }
});
console.log(`[ok] 已写入 ${patched} 个页面的 SEO meta + favicon`);

/* ---------- 2. sitemap.xml ---------- */
const today = new Date().toISOString().slice(0, 10);
const pages = [
  "index.html",
  "works.html",
  "about.html",
  "sitemap.html",
  "hidden.html",
  "work1.html",
  "work2.html",
  "work3.html",
  "work4.html",
  "works1.html",
  "works2.html",
  "works3.html",
];

const entries_xml = entries
  .map((e) => {
    const cat = P.category(e.cat);
    return (
      "  <url>\n" +
      "    <loc>" + SITE_BASE + "view.html?id=" + e.id + "</loc>\n" +
      "    <lastmod>" + today + "</lastmod>\n" +
      "    <changefreq>monthly</changefreq>\n" +
      "    <priority>0.8</priority>\n" +
      "    <news:title>" + esc(e.name) + (cat ? " · " + esc(cat.name) : "") + "</news:title>\n" +
      "  </url>"
    );
  })
  .join("\n");

const pages_xml = pages
  .map((p) => "  <url>\n    <loc>" + SITE_BASE + p + "</loc>\n    <lastmod>" + today + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>" + (p === "index.html" ? "1.0" : "0.7") + "</priority>\n  </url>")
  .join("\n");

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n` +
  pages_xml + "\n" + entries_xml + "\n</urlset>\n"
);
console.log(`[ok] sitemap.xml：${pages.length} 个页面 + ${entries.length} 条档案`);

/* ---------- 3. robots.txt ---------- */
write(
  "robots.txt",
  `# 老可梦图鉴 robots.txt\n` +
  `# Sitemap 必须是绝对地址：站点在 https://lzy769.github.io/pokedex/ ，\n` +
  `# 写成 /sitemap.xml 会被解析到域名根目录（lzy769.github.io/sitemap.xml），抓不到。\n` +
  `User-agent: *\n` +
  `Allow: /\n` +
  `\n` +
  `Sitemap: ` + SITE_BASE + `sitemap.xml\n`
);
console.log("[ok] robots.txt");
