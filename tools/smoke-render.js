/* ============================================================================
 * 老可梦图鉴 · 渲染冒烟测试（不启动浏览器）
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/smoke-render.js
 *
 * 为什么需要它：data/render.js 是靠 document.querySelector 找容器来渲染的，
 * 静态检查只能确认"钩子存在"，确认不了"渲染出来的东西对不对"。
 * 这里用一套极小的 DOM 替身把 render.js 跑一遍，验证：
 *   - 三个档案室页各渲染出 4 / 3 / 4 张卡片，编号与顺序正确
 *   - 图鉴页渲染出 3 个分类入口
 *   - 系统索引页渲染出 11 条档案链接
 *   - 详情页按 ?id= 填入名称/图片/正文/返回链接，非法 id 走 404 兜底
 * 这样在没有浏览器的环境（CI、受限沙箱）里也能挡住"改完数据页面白屏"这类事故。
 * ========================================================================== */
"use strict";

const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENTRIES = path.join(ROOT, "data/entries.js");
const IMGINFO = path.join(ROOT, "data/img-info.js");
const RENDER = path.join(ROOT, "data/render.js");

let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log("  [ok]   " + msg);
  else { console.log("  [FAIL] " + msg); failures++; }
};

/* ---------- 极小 DOM 替身 ---------- */
function makeEl(attrs) {
  return {
    attrs: attrs || {},
    html: "",
    style: {},
    textContent: "",
    innerHTML: "",
    src: "",
    alt: "",
    href: "",
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    insertAdjacentHTML(pos, html) { this.html += html; },
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
  };
}

// 每个场景重建一次全局对象，避免上一个场景的 document 串味
function loadRender(docSpec, search) {
  Object.keys(require.cache).forEach((k) => {
    if (k === ENTRIES || k === IMGINFO || k === RENDER) delete require.cache[k];
  });

  const nodes = {};
  const byId = {};
  Object.keys(docSpec.byId || {}).forEach((id) => { byId[id] = makeEl(); nodes[id] = byId[id]; });
  const bySelector = {};
  Object.keys(docSpec.bySelector || {}).forEach((sel) => { bySelector[sel] = makeEl(docSpec.bySelector[sel]); });

  global.window = Object.assign({ location: { search: search || "" } }, docSpec.windowExtra || {});
  global.document = {
    title: "",
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => bySelector[sel] || null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeEl(),
  };

  require(ENTRIES);
  // img-info.js 提供 window.IMG_INFO / window.SIZES；少了它 render.js 无法验证 srcset 接线
  require(IMGINFO);
  require(RENDER);

  return { byId, bySelector, doc: global.document };
}

const ids = (html) => (html.match(/view\.html\?id=(\d+)/g) || []).map((s) => Number(s.replace(/\D/g, "")));
const count = (html, re) => (html.match(re) || []).length;

/* ---------- 1. 三个档案室页 ---------- */
const GRIDS = [
  ["works1.html", "ancient", [1, 2, 3, 4]],
  ["works2.html", "unknown", [7, 8, 10]],
  ["works3.html", "hope", [5, 6, 9, 11]],
];

GRIDS.forEach(([file, cat, expect]) => {
  console.log(`\n1. ${file}（data-category="${cat}"）`);
  const { bySelector } = loadRender({ bySelector: { "[data-dossier-grid]": { "data-category": cat } } });
  const htmlOut = bySelector["[data-dossier-grid]"].html;

  const got = ids(htmlOut);
  check(JSON.stringify(got) === JSON.stringify(expect), `卡片编号与顺序 = [${expect}]，实际 [${got}]`);
  check(count(htmlOut, /class="dossier-card"/g) === expect.length, `卡片数量 = ${expect.length}`);
  check(count(htmlOut, /class="dossier-img-wrap"/g) === expect.length, "<img> 包装容器数量正确");
  check(count(htmlOut, /loading="lazy"/g) === expect.length, "每张卡片都延迟加载图片");
  check(!/undefined|null/.test(htmlOut), "渲染结果里没有 undefined / null 泄漏");
});

/* ---------- 2. 图鉴页 ---------- */
console.log("\n2. works.html 分类入口");
{
  const { bySelector } = loadRender({ bySelector: { "[data-category-list]": {} } });
  const htmlOut = bySelector["[data-category-list]"].html;
  check(count(htmlOut, /class="entry"/g) === 3, "渲染出 3 个分类入口");
  check(/href="works1\.html"/.test(htmlOut) && /href="works2\.html"/.test(htmlOut) && /href="works3\.html"/.test(htmlOut), "三个入口分别指向 works1/2/3.html");
  // 分类封面：接线到 img-info.js 后应输出全尺寸 WebP + srcset（原图 ≤800 的没有 small）
  const catHtml = bySelector["[data-category-list]"].html;
  check(/gallery1\.webp/.test(catHtml) && /gallery3\.webp/.test(catHtml), "分类封面图已换成 WebP");
  check(/srcset="[^"]*gallery1-800\.webp 800w/.test(catHtml), "分类封面带 srcset 小图");
  check(/width="\d+" height="\d+"/.test(catHtml), "分类封面写了宽高，避免加载跳动");
  check(!/undefined/.test(htmlOut), "没有 undefined 泄漏");
}

/* ---------- 3. 系统索引页 ---------- */
console.log("\n3. sitemap.html 档案索引");
{
  const { bySelector } = loadRender({ bySelector: { "[data-entry-index]": {} } });
  const htmlOut = bySelector["[data-entry-index]"].html;
  check(count(htmlOut, /<li>/g) === 11, "渲染出 11 条档案链接");
  check(ids(htmlOut).length === 11, "11 条链接都指向 view.html?id=");
  check(/scp撒康求/.test(htmlOut) && /老年泰深/.test(htmlOut), "首尾条目名称正确");
  check(!/undefined/.test(htmlOut), "没有 undefined 泄漏");
}

/* ---------- 4. 详情页 ---------- */
console.log("\n4. view.html 详情页");
{
  const { byId, doc } = loadRender(
    { byId: { monsterName: 1, monsterImg: 1, monsterLead: 1, monsterDesc: 1, monsterMeta: 1 } },
    "?id=5"
  );
  check(doc.title === "黄猿 · Old Pokémon Pokédex", "浏览器标题 = 黄猿 · Old Pokémon Pokédex，实际 " + doc.title);
  check(byId.monsterName.textContent === "黄猿", "h1 名称正确");
  check(byId.monsterImg.src === "5.webp", "主图已换成 WebP（5.webp），实际 " + byId.monsterImg.src);
  check(byId.monsterImg.attrs.srcset === "5-800.webp 800w, 5.webp 1280w", "主图写入了 srcset，实际 " + byId.monsterImg.attrs.srcset);
  check(byId.monsterImg.attrs.sizes === "(max-width: 980px) 92vw, 900px", "主图 sizes 正确，实际 " + byId.monsterImg.attrs.sizes);
  check(/人类希望/.test(byId.monsterMeta.textContent), "meta 里带分类名");
  check(/#005/.test(byId.monsterMeta.textContent), "meta 里带编号 #005");
  check(/section-label/.test(byId.monsterDesc.innerHTML), "正文用了 .section-label 小节结构");
  check(byId.monsterDesc.innerHTML.length > 200, "正文不是空壳");
}
{
  // 非法 / 缺失 id 必须走兜底，而不是白屏或抛错
  const { byId, doc } = loadRender(
    { byId: { monsterName: 1, monsterImg: 1, monsterLead: 1, monsterDesc: 1, monsterMeta: 1 } },
    "?id=999"
  );
  check(byId.monsterName.textContent === "无此档案", "?id=999 显示「无此档案」");
  check(doc.title.indexOf("档案丢失") === 0, "标题变成「档案丢失」");
  check(byId.monsterDesc.innerHTML.length > 0, "兜底页仍有说明文字");
}
{
  const { byId } = loadRender(
    { byId: { monsterName: 1, monsterImg: 1, monsterLead: 1, monsterDesc: 1, monsterMeta: 1 } },
    ""
  );
  check(byId.monsterName.textContent === "无此档案", "不带 id 时也走兜底");
}

/* ---------- 5. 正文完整性 ---------- */
console.log("\n5. 档案正文");
{
  const P = global.window.POKEDEX;
  const entries = P.entries;
  const SECS = ["长相", "身高", "体重", "性格", "能力", "智力", "威胁等级"];

  const noDesc = entries.filter((e) => !e.desc);
  check(noDesc.length === 0, `11 条档案都写了 desc（缺 ${noDesc.length} 条）`);

  const tooShort = entries.filter((e) => (e.desc || "").length < 80);
  check(tooShort.length === 0, `正文长度合理（短于 80 字：${tooShort.length} 条）`);

  const missingSecs = [];
  entries.forEach((e) => {
    SECS.forEach((label) => {
      if (!new RegExp('class="section-label">' + label + "<").test(e.desc || "")) {
        missingSecs.push(`${e.code}(${label})`);
      }
    });
  });
  check(
    missingSecs.length === 0,
    "每条正文都含 7 个小节标题" + (missingSecs.length ? "（缺：" + missingSecs.join(" ") + "）" : "")
  );

  const seen = new Map();
  const dup = [];
  entries.forEach((e) => {
    if (seen.has(e.desc)) dup.push(`${seen.get(e.desc)} 与 ${e.code} 重复`);
    else seen.set(e.desc, e.code);
  });
  check(dup.length === 0, "11 条正文互不相同" + (dup.length ? "（" + dup.join("; ") + "）" : ""));

  const leftover = entries.filter((e) => (e.desc || "").indexOf("狞笑之杰") >= 0);
  check(
    leftover.length === 0,
    "正文里没有残留占位文案" + (leftover.length ? "（" + leftover.map((e) => e.code).join(", ") + "）" : "")
  );
}

/* ---------- 6. 内容模型（A 组：收容措施 / 附录 / 附件 / 标签 / 时间线 / 关联） ---------- */
console.log("\n6. 内容模型与正文标记");
{
  const P = global.window.POKEDEX;
  const entries = P.entries;

  const miss = [];
  entries.forEach((e) => {
    if (!Array.isArray(e.tags) || !e.tags.length) miss.push(e.code + ":tags");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.found || "")) miss.push(e.code + ":found");
    if (!e.place) miss.push(e.code + ":place");
    if (!e.containment) miss.push(e.code + ":containment");
    if (!Array.isArray(e.addenda) || !e.addenda.length) miss.push(e.code + ":addenda");
    if (!Array.isArray(e.photos) || !e.photos.length) miss.push(e.code + ":photos");
    if (!Array.isArray(e.related) || !e.related.length) miss.push(e.code + ":related");
  });
  check(miss.length === 0, `11 条档案扩展字段齐全（缺 ${miss.length}${miss.length ? "：" + miss.slice(0, 8).join(" ") : ""}）`);

  // 标记语法必须被 decorate 吃掉，不能把 [[ ]] {{ }} 暴露给读者
  // 注意：要看渲染后的结果（P.desc / P.rich），原始数据里保留标记是设计如此
  const raw = [];
  entries.forEach((e) => {
    const text = [P.desc(e), P.rich(e.containment || "")]
      .concat((e.addenda || []).map((a) => P.rich(a.body || "")))
      .join("\n");
    if (/\[\[|\{\{|\]\]|\}\}/.test(text)) raw.push(e.code);
  });
  check(raw.length === 0, "渲染后的正文里没有残留 [[ ]] / {{ }} 字面量" + (raw.length ? "（" + raw.join(", ") + "）" : ""));

  // decorate 三种标记
  const r1 = P.rich("这里有一段[[不可见记录]]被遮住");
  check(/class="redact"/.test(r1) && !/redact perm/.test(r1), "[[x]] 渲染成可点开的涂黑条");
  check(!/\[\[/.test(r1) && /data-redact="不可见记录"/.test(r1), "涂黑条把原文放进 data-redact，正文不裸露");
  const r2 = P.rich("{{铅板}}");
  check(/class="redact perm"/.test(r2), "{{x}} 渲染成永久涂黑条");
  check(count(r2, /█/g) === 4, "2 字的永久涂黑条给 4 个方块（下限），实际 " + count(r2, /█/g));
  check(count(P.rich("{{" + "甲".repeat(40) + "}}"), /█/g) === 14, "超长永久涂黑条封顶 14 个方块");
  const r3 = P.rich("详见 #001 的记录");
  check(/href="view\.html\?id=1"/.test(r3) && /class="xref"/.test(r3), "#001 变成指向档案 1 的互链");
  check(P.rich("编号 #999 不存在") === "编号 #999 不存在", "不存在的编号原样保留，不变死链");

  // 标签
  const tags = P.tags();
  check(tags.length > 0 && tags.every((t) => t.name && t.count > 0), `标签云有 ${tags.length} 个标签`);
  const sorted = tags.every((t, i) => i === 0 || tags[i - 1].count >= t.count);
  check(sorted, "标签按出现次数降序");
  const tagSet = new Set(tags.map((t) => t.name));
  const strayTag = [];
  entries.forEach((e) => e.tags.forEach((t) => { if (!tagSet.has(t)) strayTag.push(e.code + ":" + t); }));
  check(strayTag.length === 0, "没有不在词表里的野标签" + (strayTag.length ? "（" + strayTag.join(" ") + "）" : ""));

  const badByTag = tags.filter((t) => {
    const hit = P.byTag(t.name);
    return hit.length !== t.count || hit.some((e) => e.tags.indexOf(t.name) < 0);
  });
  check(badByTag.length === 0, "byTag 的命中数与计数一致" + (badByTag.length ? "（" + badByTag.map((t) => t.name).join(" ") + "）" : ""));

  // 地点与时间线
  const places = P.places();
  check(places.length === new Set(places).size && places.join("|") === [...places].sort().join("|"), `地点列表去重且升序（${places.length} 个）`);

  const tl = P.timeline();
  const evCount = entries.reduce((n, e) => n + (e.events || []).length, 0);
  check(tl.length === entries.length + evCount, `时间线 = 11 条发现 + ${evCount} 条事件 = ${tl.length}`);
  const ordered = tl.every((r, i) => i === 0 || tl[i - 1].date <= r.date);
  check(ordered, "时间线按日期升序");
  check(tl.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.title && r.id), "时间线每条都有日期、标题与档案 id");

  // 关联档案
  const badRel = entries.filter((e) => {
    const rel = P.related(e);
    return rel.length !== 3 || rel.some((r) => r.id === e.id) || new Set(rel.map((r) => r.id)).size !== 3;
  });
  check(badRel.length === 0, "每条档案都有 3 条互不重复、不含自身的关联档案" + (badRel.length ? "（" + badRel.map((e) => e.code).join(" ") + "）" : ""));
}

/* ---------- 7. 档案室筛选栏（等级 / 年代 / 地点 三组 + 排序） ---------- */
console.log("\n7. 档案室筛选栏");
{
  const P = global.window.POKEDEX;
  const vals = (html, attr) =>
    (html.match(new RegExp(attr + '="([^"]+)"', "g")) || []).map((s) => s.replace(new RegExp('^' + attr + '="|"$', "g"), ""));

  GRIDS.forEach(([file, cat]) => {
    const { bySelector } = loadRender({
      bySelector: { "[data-dossier-grid]": { "data-category": cat }, "[data-dossier-filter]": {} },
    });
    const bar = bySelector["[data-dossier-filter]"].innerHTML;
    const catEntries = P.byCategory(cat);

    check(count(bar, /class="filter-group"/g) === 4, `${file}：4 个筛选组（等级/年代/地点/排序），实际 ${count(bar, /class="filter-group"/g)}`);
    check(/class="fg-label"/.test(bar), `${file}：每组都有组名`);
    check(vals(bar, "data-filter")[0] === "all", `${file}：等级组第一颗是「全部」`);

    const years = vals(bar, "data-year").filter((v) => v !== "all");
    const badYear = years.filter((y) => !catEntries.some((e) => String(e.found || "").slice(0, 3) + "0" === y));
    check(years.length > 0 && badYear.length === 0, `${file}：${years.length} 个年代芯片都能命中档案` + (badYear.length ? "（空档：" + badYear.join(" ") + "）" : ""));

    const pls = vals(bar, "data-place").filter((v) => v !== "all");
    const badPl = pls.filter((p) => !catEntries.some((e) => String(e.place || "").split("·")[0].replace(/\s/g, "") === p));
    check(pls.length > 0 && badPl.length === 0, `${file}：${pls.length} 个地点芯片都能命中档案` + (badPl.length ? "（空档：" + badPl.join(" ") + "）" : ""));

    check(vals(bar, "data-sort").join(",") === "asc,desc", `${file}：排序只有编号升/降两个按钮`);
    check(new RegExp(">" + catEntries.length + " 条<").test(bar), `${file}：计数显示 ${catEntries.length} 条`);
    check(!/undefined|null/.test(bar), `${file}：筛选栏没有 undefined 泄漏`);
  });
}

/* ---------- 8. 详情页扩展块 ---------- */
console.log("\n8. view.html 详情页扩展块");
const DETAIL_IDS = {
  monsterName: 1, monsterImg: 1, monsterLead: 1, monsterDesc: 1, monsterMeta: 1,
  monsterCrumb: 1, docItem: 1, docClass: 1, docSector: 1, docRecovery: 1,
  monsterContainment: 1, monsterAddenda: 1, monsterPhotos: 1, monsterTags: 1, monsterRelated: 1,
};
{
  const P = global.window.POKEDEX;
  const e1 = P.get(1);
  const { byId } = loadRender({ byId: Object.assign({}, DETAIL_IDS) }, "?id=1");

  check(/class="crumb-sep"/.test(byId.monsterCrumb.innerHTML), "面包屑渲染出分隔符");
  check(/href="works1\.html"/.test(byId.monsterCrumb.innerHTML), "面包屑带分类返回链接");
  check(byId.docRecovery.textContent === e1.found, `回收日期填成了 ${e1.found}`);
  check(byId.docClass.attrs["data-status"] === e1.status, "分级四格带 data-status（用于上色）");

  check(/class="containment-block"|class="doc-h"/.test(byId.monsterContainment.innerHTML), "收容措施小节已渲染");
  check(/class="redact/.test(byId.monsterContainment.innerHTML), "收容措施里的涂黑条生效");
  check(byId.monsterContainment.hidden === false, "有收容措施时不隐藏");

  check(count(byId.monsterAddenda.innerHTML, /<details/g) === e1.addenda.length, `附录折叠块数量 = ${e1.addenda.length}`);
  check(/class="log-mark"/.test(byId.monsterAddenda.innerHTML), "折叠块带「展开」标记");

  check(count(byId.monsterPhotos.innerHTML, /class="attach"/g) >= e1.photos.length, "附件照片渲染出灯箱链接");
  check(/class="attach-cap"/.test(byId.monsterPhotos.innerHTML), "附件带图注");
  check(/\.webp/.test(byId.monsterPhotos.innerHTML) && !/data-src="[^"]*\.jpg/.test(byId.monsterPhotos.innerHTML), "附件图走 WebP，不再引用原图");

  check(count(byId.monsterTags.innerHTML, /class="tag-chip"/g) === e1.tags.length, `标签芯片数量 = ${e1.tags.length}`);
  check(/href="works\.html\?tag=/.test(byId.monsterTags.innerHTML), "标签指向聚合页");

  check(count(byId.monsterRelated.innerHTML, /class="related-card"/g) === 3, "关联档案渲染出 3 张卡片");
  check(!/view\.html\?id=1"/.test(byId.monsterRelated.innerHTML), "关联档案里没有它自己");

  check(!/undefined|null/.test(byId.monsterDesc.innerHTML + byId.monsterContainment.innerHTML), "详情页渲染没有 undefined 泄漏");
}
{
  // 非法 id：所有扩展块必须整块隐藏，而不是留一堆空标题
  const { byId } = loadRender({ byId: Object.assign({}, DETAIL_IDS) }, "?id=999");
  const shouldHide = ["monsterContainment", "monsterAddenda", "monsterPhotos", "monsterTags", "monsterRelated"];
  const shown = shouldHide.filter((k) => byId[k].hidden !== true);
  check(shown.length === 0, "404 时扩展块全部隐藏" + (shown.length ? "（未隐藏：" + shown.join(" ") + "）" : ""));
  check(/无效编号/.test(byId.monsterCrumb.innerHTML), "404 面包屑显示「无效编号」");
}

/* ---------- 9. 404 页的「最近归档」 ---------- */
console.log("\n9. 404.html 最近归档");
{
  const P = global.window.POKEDEX;
  const { bySelector } = loadRender({ bySelector: { "[data-lost-suggest]": {} } });
  const htmlOut = bySelector["[data-lost-suggest]"].innerHTML;
  const got = ids(htmlOut);

  check(got.length === 3, `给出 3 条建议记录，实际 ${got.length}`);

  // 必须真的是「最近」：按 found 倒序的前三条
  const expectRecent = P.entries
    .slice()
    .sort((a, b) => (String(b.found) < String(a.found) ? -1 : 1))
    .slice(0, 3)
    .map((e) => e.id);
  check(JSON.stringify(got) === JSON.stringify(expectRecent), `按发现日期倒序取前三条 [${expectRecent}]，实际 [${got}]`);

  check(count(htmlOut, /class="lost-name"/g) === 3, "每条带档案名");
  check(count(htmlOut, /class="lost-date"/g) === 3, "每条带发现日期");
  check(/20\d\d-\d\d-\d\d/.test(htmlOut), "日期格式正确");
  check(!/undefined|null/.test(htmlOut), "没有 undefined 泄漏");
}

/* ---------- 10. 访问计数块（自托管） ---------- */
console.log("\n10. 访问计数块");
{
  // 没有采集到数据：整块必须保持 hidden，不能显示 0
  const { bySelector } = loadRender({ bySelector: { "[data-traffic]": {} } });
  const el = bySelector["[data-traffic]"];
  check(el.hidden !== false, "TRAFFIC 为 null 时保持 hidden（不把「还没采集」显示成「没人来过」）");
  check(!el.innerHTML, "TRAFFIC 为 null 时不写入任何内容");
}
{
  const traffic = {
    updated: "2026-10-21T04:52:27.959Z",
    days: 14,
    views: 1234,
    uniquePerDay: 23,
    bestDay: { date: "2026-10-19", count: 210 },
    clones: 56,
  };
  const { bySelector } = loadRender({
    bySelector: { "[data-traffic]": {} },
    windowExtra: { TRAFFIC: traffic },
  });
  const el = bySelector["[data-traffic]"];
  const out = el.innerHTML;
  check(el.hidden === false, "有数据时取消 hidden");
  check(count(out, /class="tr-item"/g) === 4, `输出 4 项统计，实际 ${count(out, /class="tr-item"/g)}`);
  [1234, 23, 210, 56].forEach((v) => check(out.includes(">" + v + "<"), `显示数字 ${v}`));
  check(/单日最高 · 10-19/.test(out), "单日最高带日期（只到月-日）");
  check(/统计截至 2026-10-21/.test(out), "统计时间只到日期，不暴露采集时刻");
  check(!/undefined|null|NaN/.test(out), "没有 undefined/null/NaN 泄漏");
}
{
  // clones 接口可能拿不到（权限/频率），此时是 null —— 要显示成 —，不能变成 null 字面量
  const { bySelector } = loadRender({
    bySelector: { "[data-traffic]": {} },
    windowExtra: { TRAFFIC: { updated: "2026-10-21T04:52:27.959Z", views: 5, uniquePerDay: 1, bestDay: null, clones: null } },
  });
  const out = bySelector["[data-traffic]"].innerHTML;
  check(!/null/.test(out), "缺失的字段显示为 —，没有 null 字面量");
  check(/—/.test(out), "缺失字段用了占位符 —");
}

/* ---------- 汇总 ---------- */
console.log("\n" + "=".repeat(56));
if (failures === 0) {
  console.log("全部通过 ✓");
  process.exit(0);
} else {
  console.log(`${failures} 项失败`);
  process.exit(1);
}
