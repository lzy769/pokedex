#!/usr/bin/env node
/**
 * build-feed.js —— 更新日志 + RSS
 *
 * 单一数据源就是下面的 RELEASES 数组。跑一次会同时重写：
 *   my-site/changelog.html   给人看的更新日志页
 *   my-site/feed.xml         RSS 2.0 订阅源
 *
 * 用法： node tools/build-feed.js
 *
 * 为什么不用手写 HTML：更新日志一旦手写就会和 feed 走散。
 * 日期是写死的，所以重复运行输出完全一致（幂等）。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = "Old Pokémon Pokédex";
const SITE_CN = "老可梦图鉴";
// 线上站点根地址（末尾必须带 /）：换域名/换仓库名只改这一行。
const LINK_BASE = "https://lzy769.github.io/pokedex/";

/** 版本从新到旧；date 用 YYYY-MM-DD。 */
const RELEASES = [
  {
    ver: "1.3.0",
    date: "2026-10-21",
    title: "档案室扩建：收容措施、附录与检索",
    items: [
      "11 条档案全部补上「特殊收容措施」与「描述」正文段",
      "每条档案新增 1–2 篇折叠式观测日志（附录 A / 附录 B）",
      "档案互链：正文里出现「见 004」即可点击跳转",
      "新增事件时间线页，按发现日期汇总全部记录",
      "附件照片：部分档案附带现场照片，可点开灯箱",
      "标签系统：模因 / 物理 / 认知危害，点标签聚合同类档案",
      "高级筛选：威胁等级 + 发现年份 + 回收地点",
      "详情页底部新增「相关档案」推荐与面包屑导航",
      "搜索结果支持高亮与相关度排序",
      "涂黑条：部分内容可点开，部分内容永久删除"
    ]
  },
  {
    ver: "1.2.0",
    date: "2026-10-20",
    title: "视觉改版：SCP 档案库 × 后室荧光走廊",
    items: [
      "配色由青色霓虹改为昏暗琥珀荧光，全站方角、1px 细线",
      "新增顶部系统状态栏与扫描线覆盖层",
      "面板化重排：统计 / 图鉴 / 分类 / 雷达 / 表单统一装订角",
      "详情页改为临床文档版式，新增四格登记表与危险等级色",
      "导航自动编号，正文改用衬线字体",
      "新增 prefers-reduced-motion 适配，尊重系统减弱动效设置"
    ]
  },
  {
    ver: "1.1.0",
    date: "2026-10-19",
    title: "检索、无障碍与分享",
    items: [
      "档案室新增威胁等级筛选与编号排序",
      "详情页支持 ←/→ 键盘翻页与上一条/下一条导航",
      "联系表单改为前端校验 + 内联提示，不再弹窗",
      "补全 13 个页面的 SEO meta、Open Graph 与 favicon",
      "生成 sitemap.xml 与 robots.txt",
      "修复缺失的 .hidden 规则（此前画廊筛选实际无效）",
      "修复 view.html 中 3 处 <<p 标签拼写错误"
    ]
  },
  {
    ver: "1.0.0",
    date: "2026-10-18",
    title: "单数据源重构",
    items: [
      "11 条档案数据集中到 data/entries.js，页面不再各写一份",
      "新增 data/render.js 渲染层，图鉴/详情/索引由数据生成",
      "11 条档案补全七节正文（长相 / 身高 / 体重 / 性格 / 能力 / 智力 / 威胁等级）",
      "新增 tools/check-site.js 静态自检与 tools/smoke-render.js 渲染冒烟测试",
      "图片补 loading=lazy，背景音乐改为按需加载"
    ]
  },
  {
    ver: "0.9.0",
    date: "2026-10-17",
    title: "站点导入",
    items: [
      "迁入 11 件档案、图鉴总览、分类页与详情页",
      "补全全部页面的 viewport 与 lang 属性",
      "修正卡片名与详情页名不一致的问题"
    ]
  }
];

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rfc822(dateStr) {
  const d = new Date(dateStr + "T09:00:00+08:00");
  return d.toUTCString();
}

/* ------------------------------------------------------------------ */
/* changelog.html                                                      */
/* ------------------------------------------------------------------ */

function buildHtml() {
  const latest = RELEASES[0];
  const desc = "本站的全部更新记录：内容扩充、版式调整与工程改动。最新 " + latest.ver + "（" + latest.date + "）。";

  const list = RELEASES.map((r) => {
    const items = r.items.map((t) => "        <li>" + esc(t) + "</li>").join("\n");
    return [
      '    <li class="cl-item">',
      '      <div class="cl-head">',
      '        <span class="cl-ver">v' + esc(r.ver) + "</span>",
      '        <time class="cl-date" datetime="' + esc(r.date) + '">' + esc(r.date) + "</time>",
      "      </div>",
      '      <h2 class="cl-title">' + esc(r.title) + "</h2>",
      '      <ul class="cl-body">',
      items,
      "      </ul>",
      "    </li>"
    ].join("\n");
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>更新日志 · ${SITE}</title>

  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="更新日志,更新记录,changelog,RSS">
  <meta property="og:type" content="website">
  <meta property="og:title" content="更新日志 · ${SITE}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="og-cover.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="更新日志 · ${SITE}">
  <meta name="twitter:description" content="${esc(desc)}">
  <link rel="alternate" type="application/rss+xml" title="${SITE_CN} 更新日志" href="feed.xml">
  <link rel="stylesheet" href="style.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
</head>
<body>
  <header>
    <div>
      <div class="brand-en">${SITE}</div>
      <div class="brand-cn">${SITE_CN}</div>
    </div>
    <button class="menu-toggle" id="menuToggle">≡</button>
    <nav id="mainNav">
      <a href="index.html">首页</a>
      <a href="works.html">图鉴</a>
      <a href="timeline.html">事件时间线</a>
      <a href="about.html">关于我们</a>
      <a href="changelog.html" class="active">更新日志</a>
      <a href="index.html#contact">联系我们</a>
    </nav>
    <div class="search-box">
      <input type="text" id="globalSearch" placeholder="搜索档案..." autocomplete="off">
    </div>
  </header>

  <section class="page-title">
    <h1>更新日志</h1>
    <p>共 ${RELEASES.length} 次更新 · 最新一次 ${esc(latest.date)} · <a href="feed.xml">RSS 订阅</a></p>
  </section>

  <!-- 本页由 tools/build-feed.js 生成。要改内容请改脚本里的 RELEASES 再跑一次，不要手改本文件。 -->
  <ol class="changelog">
${list}
  </ol>

  <footer>
    <div class="foot-brand">${SITE}</div>
    <div class="contact">
      <div>联系我们</div>
      <div>邮箱：<a href="mailto:lzy7690@163.com">lzy7690@163.com</a></div>
      <div>电话：<a href="tel:18024248787">180-2424-8787</a></div>
      <div>地址：广东省河源市屁王高级中学</div>
    </div>
    <div class="foot-time">
      系统时间 <strong>----</strong>
    </div>
  </footer>

  <!-- ui.js 的全站搜索要读 window.POKEDEX（在 data/entries.js 里定义）。
       少了它，本页搜索框能弹出、但永远搜不到档案 —— check-site.js 会把这种情况拦下来。 -->
  <script src="data/entries.js"></script>
  <script src="ui.js"></script>
    const mainNav = document.getElementById("mainNav");
    if (menuToggle && mainNav) {
      menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
    }
  </script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* feed.xml                                                            */
/* ------------------------------------------------------------------ */

function buildFeed() {
  const items = RELEASES.map((r) => {
    const body = r.items.map((t) => "  • " + t).join("\n");
    const guid = "pokedex-v" + r.ver;
    return [
      "  <item>",
      "    <title>" + esc("v" + r.ver + " · " + r.title) + "</title>",
      "    <link>" + esc(LINK_BASE + "changelog.html#v" + r.ver) + "</link>",
      '    <guid isPermaLink="false">' + esc(guid) + "</guid>",
      "    <pubDate>" + esc(rfc822(r.date)) + "</pubDate>",
      "    <description>" + esc(body) + "</description>",
      "  </item>"
    ].join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(SITE_CN + " · 更新日志")}</title>
  <link>${esc(LINK_BASE + "changelog.html")}</link>
  <description>${esc("档案库的每一次改动。")}</description>
  <language>zh-CN</language>
  <lastBuildDate>${esc(rfc822(RELEASES[0].date))}</lastBuildDate>
  <atom:link href="${esc(LINK_BASE + "feed.xml")}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

/* ------------------------------------------------------------------ */

const html = buildHtml();
const feed = buildFeed();

fs.writeFileSync(path.join(ROOT, "changelog.html"), html, "utf8");
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed, "utf8");

console.log("已写入 changelog.html：" + Buffer.byteLength(html, "utf8") + " 字节，" + RELEASES.length + " 个版本");
console.log("已写入 feed.xml：" + Buffer.byteLength(feed, "utf8") + " 字节");
