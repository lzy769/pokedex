/* ============================================================================
 * 老可梦图鉴 · 渲染层
 * ----------------------------------------------------------------------------
 * 只做一件事：把 data/entries.js 里的数据画成 DOM。
 * 页面 HTML 里只留"空容器 + data-* 标记"，不再写死任何档案内容。
 *
 * 约定（改 HTML 时按这个加属性即可）：
 *   [data-dossier-grid][data-category="ancient"]  档案室页：渲染该分类的卡片
 *   [data-category-list]                          图鉴页：渲染三大分类入口
 *   [data-entry-index]                            系统索引页：渲染全部档案链接
 *   [data-tag-index]                              标签云（sitemap.html）
 *   [data-tag-results]                            图鉴页：?tag=xxx 时的聚合结果
 *   [data-timeline]                               时间线页：全部事件按日期排列
 *   [data-record-grid]                            诡异实录：影像档案卡片网格
 *   #monsterName / #monsterImg / ...              详情页：由 ?id= 决定内容
 *
 * 引入顺序必须是：entries.js → render.js → ui.js
 * （ui.js 里的图片灯箱会查询 .photo-grid a，必须先有卡片才能绑上事件）
 * ========================================================================== */
(function () {
  "use strict";

  var P = window.POKEDEX;
  if (!P) {
    console.error("[render] 没找到 window.POKEDEX，请检查 data/entries.js 是否在本文件之前引入");
    return;
  }

  /* ---------- 小工具 ---------- */
  // HTML 转义：拼字符串时所有"来自数据"的文本都要过一遍，避免名字里出现 < > 破坏结构
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 图片地址补上站内相对前缀，避免以后把站点放进子目录时出错
  function asset(src) {
    return esc(src);
  }

  /* 断点 sizes 提示：正常由 data/img-info.js 提供 window.SIZES（值与此处一致）。
     那个文件没加载时（比如离线单测）用这里的默认值兜底，
     免得读到 undefined 直接抛错、整页渲染中断。 */
  var SIZES_DEFAULT = {
    grid: "(max-width: 560px) 92vw, (max-width: 980px) 46vw, 340px",
    card: "(max-width: 560px) 92vw, (max-width: 980px) 46vw, 300px",
    hero: "(max-width: 980px) 92vw, 900px",
  };
  function size(key) {
    var s = window.SIZES || {};
    return s[key] || SIZES_DEFAULT[key] || "100vw";
  }

  /* ---------- 图片：统一走 WebP + srcset ----------
   * 尺寸表在 data/img-info.js（由 tools/build-imgtags.js 从 tools/image-report.json 生成）。
   * 那个文件没加载时退化成"直接用原文件名"，老图照样能显示，不会白屏。
   */
  function imgTag(src, alt, opt) {
    opt = opt || {};
    var name = String(src == null ? "" : src);
    var info = window.IMG_INFO && window.IMG_INFO[name];
    var full = info ? info.full : name;

    var out = '<img loading="lazy" decoding="async" src="' + asset(full) + '"';

    if (info && info.small) {
      out += ' srcset="' + esc(info.small + " 800w, " + info.full + " " + info.w + "w") + '"';
      out += ' sizes="' + esc(opt.sizes || size("grid")) + '"';
    }
    // 显式写宽高：CSS 没给高度的地方（比如详情页大图）靠它撑住版位，避免加载时跳动
    if (info) out += ' width="' + info.w + '" height="' + info.h + '"';
    if (opt.cls) out += ' class="' + esc(opt.cls) + '"';
    if (opt.id) out += ' id="' + esc(opt.id) + '"';
    out += ' alt="' + esc(alt == null ? "" : alt) + '"';
    if (opt.desc) out += ' data-desc="' + esc(opt.desc) + '"';
    return out + ">";
  }

  /** 原图名 → 全尺寸 WebP 名（灯箱、og:image 这类只想要一个地址的地方用） */
  function webpOf(src) {
    var info = window.IMG_INFO && window.IMG_INFO[src];
    return info ? info.full : src;
  }

  // 标签统一走图鉴页的 ?tag= 聚合，不额外开页面
  function tagHref(t) {
    return "works.html?tag=" + encodeURIComponent(t);
  }

  /* ---------- 1. 档案卡片 ---------- */
  // 结构必须和 style.css 里的 .dossier-* 保持一致
  function cardHTML(e) {
    return (
      '<a href="view.html?id=' + e.id + '" class="dossier-card" data-entry-id="' + e.id + '">' +
        '<div class="dossier-header">' +
          '<span class="dossier-id">FILE: ' + esc(e.code) + "</span>" +
        "</div>" +
        '<div class="dossier-img-wrap">' +
          imgTag(e.img, e.name, { desc: "点开看详情。" }) +
        "</div>" +
        /* 卡片层级（规范 §5.2）：编号 → 名称（衬线）→ 一句话摘要（次要色）→ 等级标记 */
        '<div class="dossier-body">' +
          '<h3 class="dossier-name">' + esc(e.name) + "</h3>" +
          '<p class="dossier-lead">' + esc(e.lead) + "</p>" +
        "</div>" +
        '<div class="dossier-footer" data-status="' + esc(e.status) + '">' +
          '<span class="dossier-dot" aria-hidden="true"></span>' +
          '<span class="dossier-status">[ ' + esc(e.status) + " ]</span>" +
        "</div>" +
      "</a>"
    );
  }

  // 档案室页：容器上写 data-category，卡片渲染到容器末尾（保留里面的 .file-tag）
  var grid = document.querySelector("[data-dossier-grid]");
  if (grid) {
    var key = grid.getAttribute("data-category");
    var list = P.byCategory(key);
    var cat = P.category(key);

    if (!cat || !list.length) {
      grid.insertAdjacentHTML("beforeend", '<p class="grid-empty">该分类暂无档案。</p>');
    } else {
      grid.insertAdjacentHTML("beforeend", list.map(cardHTML).join(""));
    }
  }

  /* ---------- 2. 图鉴页：三大分类入口 ---------- */
  var catList = document.querySelector("[data-category-list]");
  if (catList) {
    catList.insertAdjacentHTML(
      "beforeend",
      P.categories
        .map(function (c) {
          return (
            '<a class="entry" href="' + esc(c.page) + '">' +
              '<div class="entry-thumb">' + imgTag(c.cover, c.name, { sizes: size("card") }) + "</div>" +
              "<h3>" + esc(c.name) + "</h3>" +
              "<p>" + esc(c.sub) + "</p>" +
            "</a>"
          );
        })
        .join("")
    );
  }

  /* ---------- 3. 系统索引页：全部档案链接 ---------- */
  var indexList = document.querySelector("[data-entry-index]");
  if (indexList) {
    indexList.insertAdjacentHTML(
      "beforeend",
      P.entries
        .map(function (e) {
          var c = P.category(e.cat);
          return (
            '<li><a href="view.html?id=' + e.id + '"><span>' +
            esc(e.code) + " " + esc(e.name) + " · " + esc(c ? c.name : "") +
            '</span> <span class="file-id">VIEW.HTML?ID=' + e.id + "</span></a></li>"
          );
        })
        .join("")
    );
  }

  /* ---------- 3b. 标签云 ---------- */
  var tagIndex = document.querySelector("[data-tag-index]");
  if (tagIndex) {
    tagIndex.innerHTML = P.tags()
      .map(function (t) {
        return '<a class="tag-chip" href="' + tagHref(t.name) + '">' + esc(t.name) +
          '<b class="tag-n">' + t.count + "</b></a>";
      })
      .join("");
  }

  /* ---------- 3c. 图鉴页按标签聚合（works.html?tag=模因） ---------- */
  var tagResults = document.querySelector("[data-tag-results]");
  if (tagResults) {
    var tagName = new URLSearchParams(window.location.search).get("tag");
    if (!tagName) {
      tagResults.hidden = true;
    } else {
      var hits = P.byTag(tagName);
      // 聚合态下把常规的三大分类入口收起来，避免同屏出现两套导航
      var catSection = document.querySelector("[data-category-list]");
      if (catSection) catSection.hidden = true;

      tagResults.innerHTML =
        '<h2 class="tag-result-title">标签聚合：' + esc(tagName) +
        ' <span class="tag-result-n">' + hits.length + " 条档案</span></h2>" +
        (hits.length
          ? '<div class="photo-grid">' + hits.map(cardHTML).join("") + "</div>"
          : '<p class="grid-empty">没有档案带这个标签。</p>') +
        '<p class="tag-back"><a href="works.html">← 回到全部分类</a> · <a href="sitemap.html#tags">全部标签</a></p>';
    }
  }

  /* ---------- 3d. 时间线页 ---------- */
  var tlEl = document.querySelector("[data-timeline]");
  if (tlEl) {
    var rows = P.timeline();
    tlEl.innerHTML = rows
      .map(function (r) {
        return (
          '<li class="tl-item">' +
            '<span class="tl-date">' + esc(r.date) + "</span>" +
            '<div class="tl-body">' +
              '<a class="tl-link" href="view.html?id=' + r.id + '">' + esc(r.code) + " " + esc(r.name) + "</a>" +
              '<b class="tl-title">' + esc(r.title) + "</b>" +
              (r.text ? '<p class="tl-text">' + P.rich(r.text) + "</p>" : "") +
            "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  /* ---------- 4. 详情页 ---------- */
  var nameEl = document.getElementById("monsterName");
  if (nameEl) {
    var params = new URLSearchParams(window.location.search);
    var entry = P.get(params.get("id"));
    var imgEl = document.getElementById("monsterImg");
    var leadEl = document.getElementById("monsterLead");
    var descEl = document.getElementById("monsterDesc");
    var metaEl = document.getElementById("monsterMeta");
    var docItemEl = document.getElementById("docItem");
    var docClassEl = document.getElementById("docClass");
    var docSectorEl = document.getElementById("docSector");
    var docRecoveryEl = document.getElementById("docRecovery");
    var backEl = document.querySelector("[data-back-category]");

    var cEl = document.getElementById("monsterContainment");
    var addEl = document.getElementById("monsterAddenda");
    var phEl = document.getElementById("monsterPhotos");
    var tagEl = document.getElementById("monsterTags");
    var relEl = document.getElementById("monsterRelated");
    var crumbEl = document.getElementById("monsterCrumb");

    // 详情页各扩展块：有数据就填、没数据就整块隐藏，避免出现空标题
    function fillDetail(e, cat2) {
      if (crumbEl) {
        crumbEl.innerHTML =
          '<a href="works.html">图鉴</a><span class="crumb-sep">/</span>' +
          (cat2 ? '<a href="' + esc(cat2.page) + '">' + esc(cat2.name) + "</a><span class=\"crumb-sep\">/</span>" : "") +
          '<span class="crumb-here">' + esc(e.code) + " " + esc(e.name) + "</span>";
      }
      if (cEl) {
        cEl.innerHTML = e.containment ? '<h2 class="doc-h">特殊收容措施</h2>' + P.rich(e.containment) : "";
        cEl.hidden = !e.containment;
      }
      if (addEl) {
        var adds = e.addenda || [];
        addEl.innerHTML = adds.length
          ? '<h2 class="doc-h">附录 / 观测日志</h2>' +
            adds
              .map(function (a, i) {
                return (
                  '<details class="log-fold">' +
                    '<summary><span class="log-date">' + esc(a.date || "--") + "</span>" +
                    '<span class="log-name">' + esc(a.title || "附录 " + (i + 1)) + "</span>" +
                    '<span class="log-mark">展开</span>' +
                  "</summary>" +
                    '<div class="log-body">' + P.rich(a.body) + "</div>" +
                  "</details>"
                );
              })
              .join("")
          : "";
        addEl.hidden = !adds.length;
      }
      if (phEl) {
        var ph = e.photos || [];
        phEl.innerHTML = ph.length
          ? '<h2 class="doc-h">现场附件</h2><div class="attach-strip">' +
            ph
              .map(function (p) {
                return (
                  '<a class="attach" href="#" data-lightbox data-src="' + asset(webpOf(p.src)) +
                  '" data-caption="' + esc(p.caption || "") + '" data-desc="附件照片 · ' + esc(e.code) + '">' +
                    imgTag(p.src, p.caption || e.name, { sizes: size("card") }) +
                    '<span class="attach-cap">' + esc(p.caption || "") + "</span>" +
                  "</a>"
                );
              })
              .join("") +
            "</div>"
          : "";
        phEl.hidden = !ph.length;
      }
      if (tagEl) {
        var ts = e.tags || [];
        tagEl.innerHTML = ts.length
          ? '<span class="tag-label">标签</span>' +
            ts.map(function (t) {
              return '<a class="tag-chip" href="' + tagHref(t) + '">' + esc(t) + "</a>";
            }).join("")
          : "";
        tagEl.hidden = !ts.length;
      }
      if (relEl) {
        var rel = P.related(e);
        relEl.innerHTML = rel.length
          ? '<h2 class="doc-h">关联档案</h2><div class="related-strip">' +
            rel
              .map(function (r) {
                return (
                  '<a class="related-card" href="view.html?id=' + r.id + '">' +
                    '<span class="related-code">' + esc(r.code) + "</span>" +
                    '<span class="related-name">' + esc(r.name) + "</span>" +
                    '<span class="related-status" data-status="' + esc(r.status) + '">' + esc(r.status) + "</span>" +
                  "</a>"
                );
              })
              .join("") +
            "</div>"
          : "";
        relEl.hidden = !rel.length;
      }
    }

    if (entry) {
      var cat2 = P.category(entry.cat);

      document.title = entry.name + " · Old Pokémon Pokédex";

      // 详情页元数据：给每条档案独立的 description / canonical / og:*，
      // 避免 11 条档案被搜索引擎归并为同一个空壳页（view.html 只有一套静态 meta）。
      var descMeta = document.querySelector('meta[name="description"]');
      var ogTitleEl = document.querySelector('meta[property="og:title"]');
      var ogDescEl = document.querySelector('meta[property="og:description"]');
      var ogUrlEl = document.querySelector('meta[property="og:url"]');
      var canonicalEl = document.querySelector('link[rel="canonical"]');
      var entryDesc = entry.name + " · " + (cat2 ? cat2.name : "未分类") + "：档案 " + entry.code + " 的完整记录。";
      var entryUrl = window.location.origin + window.location.pathname + "?id=" + entry.id;
      if (descMeta) descMeta.setAttribute("content", entryDesc);
      if (ogTitleEl) ogTitleEl.setAttribute("content", entry.name + " · Old Pokémon Pokédex");
      if (ogDescEl) ogDescEl.setAttribute("content", entryDesc);
      if (ogUrlEl) ogUrlEl.setAttribute("content", entryUrl);
      if (canonicalEl) canonicalEl.setAttribute("href", entryUrl);

      imgEl.src = webpOf(entry.img);
      imgEl.alt = entry.name;
      // 详情页大图也走 srcset：手机上一张 1920px 的图纯属浪费流量
      var heroInfo = window.IMG_INFO && window.IMG_INFO[entry.img];
      if (heroInfo && heroInfo.small) {
        imgEl.setAttribute("srcset", heroInfo.small + " 800w, " + heroInfo.full + " " + heroInfo.w + "w");
        imgEl.setAttribute("sizes", size("hero"));
      } else {
        imgEl.removeAttribute("srcset");
        imgEl.removeAttribute("sizes");
      }
      if (heroInfo) {
        imgEl.setAttribute("width", heroInfo.w);
        imgEl.setAttribute("height", heroInfo.h);
      }
      nameEl.textContent = entry.name;
      leadEl.textContent = entry.lead;
      metaEl.textContent = entry.code + " · " + entry.status + " · " + (cat2 ? cat2.name : "未分类");

      // 文档头部四格：编号 / 分级 / 所属档案室 / 回收日期
      if (docItemEl) docItemEl.textContent = entry.code;
      if (docClassEl) {
        docClassEl.textContent = entry.status;
        docClassEl.setAttribute("data-status", entry.status);
      }
      if (docSectorEl) docSectorEl.textContent = cat2 ? cat2.name : "未分类";
      if (docRecoveryEl) docRecoveryEl.textContent = entry.found || "PENDING";

      // desc 是我们自己写在 entries.js 里的可信 HTML（含 .section-label 小节标题），
      // 所以这里用 innerHTML；文本字段（name / lead / status）一律走 textContent。
      descEl.innerHTML = P.desc(entry);
      fillDetail(entry, cat2);

      // 上一条 / 下一条：只在当前分类内部翻动，不会跳到别的档案室
      var navEl = document.querySelector("[data-entry-nav]");
      if (navEl) {
        var peers = P.byCategory(entry.cat);
        var idx = -1;
        for (var k = 0; k < peers.length; k++) {
          if (peers[k].id === entry.id) { idx = k; break; }
        }
        var prev = idx > 0 ? peers[idx - 1] : null;
        var next = idx >= 0 && idx < peers.length - 1 ? peers[idx + 1] : null;
        navEl.innerHTML =
          (prev
            ? '<a class="nav-link prev" href="view.html?id=' + prev.id + '">← ' + esc(prev.code) + " " + esc(prev.name) + "</a>"
            : '<span class="nav-link disabled">← 已到最早</span>') +
          (next
            ? '<a class="nav-link next" href="view.html?id=' + next.id + '">' + esc(next.code) + " " + esc(next.name) + " →</a>"
            : '<span class="nav-link disabled">已到最新 →</span>');
      }

      if (backEl && cat2) {
        backEl.href = cat2.page;
        backEl.textContent = "← 返回" + cat2.name;
      }
    } else {
      // 编号不存在、或没带 id：给出兜底页，而不是一片空白
      document.title = "档案丢失 · Old Pokémon Pokédex";
      imgEl.style.display = "none";
      nameEl.textContent = "无此档案";
      leadEl.textContent = "ERROR 404";
      metaEl.textContent = "SYSTEM · NO RECORD";
      if (docItemEl) docItemEl.textContent = "—";
      if (docClassEl) docClassEl.textContent = "—";
      if (docSectorEl) docSectorEl.textContent = "—";
      if (docRecoveryEl) docRecoveryEl.textContent = "—";
      if (crumbEl) crumbEl.innerHTML = '<a href="works.html">图鉴</a><span class="crumb-sep">/</span><span class="crumb-here">无效编号</span>';
      descEl.innerHTML = "<p>系统未在数据库中找到该编号的影像记录。请返回图鉴重新选择。</p>";
      [cEl, addEl, phEl, tagEl, relEl].forEach(function (el) { if (el) el.hidden = true; });
      if (backEl) {
        backEl.href = "works.html";
        backEl.textContent = "← 返回图鉴";
      }
    }
  }

  /* ---------- 5. 档案室：筛选 + 排序栏 ---------- */
  // 三组筛选（等级 / 发现年代 / 回收地点）加一组排序，按钮文案全部由数据生成；
  // 点击后的组合逻辑在 ui.js 第 12 节。
  var filterBar = document.querySelector("[data-dossier-filter]");
  if (filterBar && grid) {
    var list2 = P.byCategory(grid.getAttribute("data-category"));

    // 等级：该分类真的出现过的分级
    var seenSt = {};
    var chips = [];
    list2.forEach(function (e) {
      if (!seenSt[e.status]) { seenSt[e.status] = 1; chips.push(e.status); }
    });

    // 发现年代：按十年分桶，只列该分类真的有的桶
    var decades = [];
    var seenDec = {};
    list2.forEach(function (e) {
      var f = String(e.found || "");
      if (f.length < 4) return;
      var d = f.slice(0, 3) + "0";
      if (!seenDec[d]) { seenDec[d] = 1; decades.push(d); }
    });
    decades.sort();

    // 回收地点：place 形如「湖南 · 沅江」，只取省一级
    var places = [];
    var seenPl = {};
    list2.forEach(function (e) {
      var p = String(e.place || "").split("·")[0].replace(/\s/g, "");
      if (p && !seenPl[p]) { seenPl[p] = 1; places.push(p); }
    });

    var bar = '<span class="filter-group"><b class="fg-label">等级</b>';
    bar += '<button class="filter-btn active" data-filter="all">全部</button>';
    chips.forEach(function (s) {
      bar += '<button class="filter-btn" data-filter="' + esc(s) + '">' + esc(s) + "</button>";
    });
    bar += "</span>";

    if (decades.length > 1) {
      bar += '<span class="filter-group"><b class="fg-label">发现年代</b>';
      bar += '<button class="filter-btn active" data-year="all">全部</button>';
      decades.forEach(function (d) {
        bar += '<button class="filter-btn" data-year="' + esc(d) + '">' + esc(d) + "s</button>";
      });
      bar += "</span>";
    }

    if (places.length > 1) {
      bar += '<span class="filter-group"><b class="fg-label">回收地点</b>';
      bar += '<button class="filter-btn active" data-place="all">全部</button>';
      places.forEach(function (p) {
        bar += '<button class="filter-btn" data-place="' + esc(p) + '">' + esc(p) + "</button>";
      });
      bar += "</span>";
    }

    bar += '<span class="filter-group"><b class="fg-label">排序</b>';
    bar += '<button class="filter-btn" data-sort="asc">编号 ↑</button>';
    bar += '<button class="filter-btn" data-sort="desc">编号 ↓</button>';
    bar += "</span>";

    bar += '<span class="filter-count">' + list2.length + " 条</span>";
    filterBar.innerHTML = bar;
  }

  /* ---------- 6. 404 页：最近归档的三条记录 ---------- */
  // 走错路的访客不该只看到一句「页面不存在」，给他三条最近归档把路接回去。
  var lostEl = document.querySelector("[data-lost-suggest]");
  if (lostEl) {
    var recent = P.entries.slice().sort(function (a, b) {
      const x = String(b.found || "");
      const y = String(a.found || "");
      return x < y ? -1 : (x > y ? 1 : 0);
    }).slice(0, 3);
    lostEl.innerHTML = recent
      .map(function (e) {
        return (
          '<li><a href="view.html?id=' + e.id + '">' +
            '<span class="lost-code">' + esc(e.code) + "</span>" +
            '<span class="lost-name">' + esc(e.name) + "</span>" +
            '<span class="lost-date">' + esc(e.found || "----") + "</span>" +
          "</a></li>"
        );
      })
      .join("");
  }

  /* ---------- 7. 站点访问计数（自托管，见 data/traffic.js 头部说明） ---------- */
  // 数据由 .github/workflows/traffic.yml 每日写回 data/traffic.js。
  // 拿不到数据（window.TRAFFIC 为 null/undefined）就保持整块 hidden，
  // 绝不显示 0 —— 那会把「还没采集」说成「没人来过」。
  var trafficEl = document.querySelector("[data-traffic]");
  if (trafficEl && window.TRAFFIC && typeof window.TRAFFIC === "object") {
    var t = window.TRAFFIC;
    // 全 0 也当作「没有可展示的数据」：GitHub 的 traffic 接口只统计仓库页面，
    // Pages 上的访问不计入，新仓库拿到的永远是 0 —— 显示 0 比不显示更误导。
    var tally = [t.views, t.uniquePerDay, t.clones, t.bestDay && t.bestDay.count];
    var hasAny = tally.some(function (v) {
      return Number(v) > 0;
    });
    if (!hasAny) {
      trafficEl.hidden = true;
      trafficEl.innerHTML = "";
    } else {
      var row = function (label, val) {
        return (
          '<span class="tr-item"><b class="tr-num">' + esc(String(val == null ? "—" : val)) +
          '</b><span class="tr-label">' + esc(label) + "</span></span>"
        );
      };
      var html =
        row("近 14 天访问", t.views) +
        row("日均独立访客", t.uniquePerDay) +
        row(
          "单日最高" + (t.bestDay && t.bestDay.date ? " · " + String(t.bestDay.date).slice(5) : ""),
          t.bestDay ? t.bestDay.count : null
        ) +
        row("仓库克隆", t.clones);
      // updated 是 ISO 时间；只取到日期，避免暴露采集时刻
      if (t.updated) html += '<span class="tr-updated">统计截至 ' + esc(String(t.updated).slice(0, 10)) + "</span>";
      trafficEl.innerHTML = html;
      trafficEl.hidden = false;
    }
  }

  /* ---------- 8. 诡异实录：影像档案网格 ---------- */
  // 数据来自 data/recordings.js；点击播放由 ui.js 第 20 节的视频灯箱接管
  // （用事件委托，所以卡片后渲染也能点）。
  // 缩略图不写 srcset：每张只有 6–15 KB，再派生一套 -800 图并不划算。
  var recGrid = document.querySelector("[data-record-grid]");
  if (recGrid) {
    var recs = (window.RECORDS && window.RECORDS.list()) || [];
    if (!recs.length) {
      recGrid.insertAdjacentHTML("beforeend", '<p class="grid-empty">影像档案尚未登记。</p>');
    } else {
      recGrid.insertAdjacentHTML(
        "beforeend",
        recs
          .map(function (r) {
            var label = esc(r.code + " " + r.title);
            return (
              '<article class="record-card" data-record-id="' + r.id + '">' +
                '<button type="button" class="record-thumb" data-record-open="' + r.id + '"' +
                  ' aria-label="播放 ' + label + '">' +
                  '<img loading="lazy" decoding="async" src="' + esc(r.thumb) + '"' +
                    ' width="' + r.thumbW + '" height="' + r.thumbH + '" alt="' + label + '">' +
                  '<span class="rec-play" aria-hidden="true"></span>' +
                  '<span class="rec-dur">' + esc(r.durationText) + "</span>" +
                  '<span class="rec-ratio">' + esc(r.ratio) + "</span>" +
                "</button>" +
                '<div class="record-body">' +
                  '<div class="record-head">' +
                    '<span class="record-code">' + esc(r.code) + "</span>" +
                    '<span class="record-status" data-status="' + esc(r.status) + '">[ ' + esc(r.status) + " ]</span>" +
                  "</div>" +
                  '<h3 class="record-title">' + esc(r.title) + "</h3>" +
                  '<p class="record-note">' + esc(r.note) + "</p>" +
                  '<div class="record-meta">' +
                    "<span>" + esc(r.w + "×" + r.h) + "</span>" +
                    "<span>" + esc(r.durationText) + "</span>" +
                  "</div>" +
                "</div>" +
              "</article>"
            );
          })
          .join("")
      );
    }
  }
})();
