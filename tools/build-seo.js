/* ============================================================================
 * 老可梦图鉴 · SEO / 站点文件生成
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/build-seo.js
 *
 * 作用：
 *   1. 给 13 个 HTML 的 <head> 补 meta description / Open Graph / twitter card
 *   2. 插入 favicon 引用
 *   3. 生成 sitemap.xml（含 11 条档案详情页）
 *   4. 生成 robots.txt
 *
 * 说明：本脚本是可重复执行的（幂等）——已经写过 description 的页面不会重复插入。
 *      OG 图片用的是相对路径，本地预览够用；真正上线时把 og:image 换成绝对 URL。
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
};

/* ---------- HTML 转义（属性值里不能出现裸引号） ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* ---------- 1. 补齐各页面 head ---------- */
const HTML_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

const metaTag = (m) =>
  `  <meta name="description" content="${esc(m.desc)}">\n` +
  `  <meta name="keywords" content="${esc(m.kw)}">\n` +
  `  <meta property="og:type" content="website">\n` +
  `  <meta property="og:title" content="${esc(m.title)}">\n` +
  `  <meta property="og:description" content="${esc(m.desc)}">\n` +
  `  <meta property="og:image" content="hero.jpg">\n` +
  `  <meta name="twitter:card" content="summary_large_image">\n` +
  `  <meta name="twitter:title" content="${esc(m.title)}">\n` +
  `  <meta name="twitter:description" content="${esc(m.desc)}">`;

let patched = 0;
HTML_FILES.forEach((file) => {
  const m = META[file];
  if (!m) return;
  let html = read(file);
  const before = html;

  // 已经写过 description 就跳过，避免重复
  if (!/name="description"/.test(html)) {
    const idx = html.indexOf("</title>");
    if (idx < 0) { console.log("  [warn] " + file + " 没有 <title>，跳过 meta"); return; }
    const end = html.indexOf("\n", idx);
    html = html.slice(0, end + 1) + "\n" + metaTag(m) + html.slice(end + 1);
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
      "    <loc>view.html?id=" + e.id + "</loc>\n" +
      "    <lastmod>" + today + "</lastmod>\n" +
      "    <changefreq>monthly</changefreq>\n" +
      "    <priority>0.8</priority>\n" +
      "    <news:title>" + esc(e.name) + (cat ? " · " + esc(cat.name) : "") + "</news:title>\n" +
      "  </url>"
    );
  })
  .join("\n");

const pages_xml = pages
  .map((p) => "  <url>\n    <loc>" + p + "</loc>\n    <lastmod>" + today + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>" + (p === "index.html" ? "1.0" : "0.7") + "</priority>\n  </url>")
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
  `# 上线后把下面的 Sitemap 改成你的域名，例如 https://你的域名/sitemap.xml\n` +
  `User-agent: *\n` +
  `Allow: /\n` +
  `\n` +
  `Sitemap: /sitemap.xml\n`
);
console.log("[ok] robots.txt");
