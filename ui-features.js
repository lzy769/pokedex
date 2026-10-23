/* ============================================================================
 * ui-features.js —— 站点增强功能（批次 A：随机档案 / 主题切换 / 收藏 / 阅读进度 / 快捷键）
 * ----------------------------------------------------------------------------
 * 说明：这些功能独立于 ui.js 的核心交互，集中放这里便于维护。
 *      依赖 ui.js 已定义的 window.POKEDEX 与 data/render.js 已暴露的辅助函数。
 *      localStorage 键名统一加 "opp-" 前缀（Old Pokémon Pokédex）避免冲突。
 * ========================================================================== */
(function () {
  "use strict";

  var LS_THEME = "opp-theme";
  var LS_FAVS = "opp-favs";

  var DEX = window.POKEDEX;
  var ENTRIES = (DEX && DEX.entries) ? DEX.entries : [];

  /* ---------- 工具：localStorage 读写（降级为内存） ---------- */
  var mem = {};
  function lsGet(key) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? mem[key] || null : v;
    } catch (e) {
      return mem[key] || null;
    }
  }
  function lsSet(key, val) {
    mem[key] = val;
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  /* ---------- 工具：当前 ?id= ---------- */
  function currentId() {
    var m = /[?&]id=(\d+)/.exec(window.location.search);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ---------- 工具：按 id 找档案 ---------- */
  function findEntry(id) {
    for (var i = 0; i < ENTRIES.length; i++) if (ENTRIES[i].id === id) return ENTRIES[i];
    return null;
  }

  /* ---------- 工具：随机档案 id ---------- */
  function randomEntryId() {
    if (!ENTRIES.length) return null;
    return ENTRIES[Math.floor(Math.random() * ENTRIES.length)].id;
  }

  /* ========================================================================
   * 1. 随机档案按钮（#1）
   *    动态注入到 header（桌面端）+ 移动端汉堡菜单外，避免每个 HTML 手动加
   * ====================================================================== */
  (function injectRandomButton() {
    if (!ENTRIES.length) return;
    var header = document.querySelector("header");
    if (!header) return;
    var box = document.createElement("button");
    box.className = "opp-btn random-btn";
    box.type = "button";
    box.textContent = "随机档案";
    box.title = "随机打开一条档案（快捷键 r）";
    box.setAttribute("aria-label", "随机打开一条档案");
    box.setAttribute("data-random-entry", "1");
    box.addEventListener("click", function () {
      var id = randomEntryId();
      if (id != null) window.location.href = "view.html?id=" + id;
    });
    // 插到搜索框后面（header 最后一个子元素之前）
    var sb = header.querySelector(".search-box");
    if (sb && sb.parentNode) sb.parentNode.insertBefore(box, sb.nextSibling);
    else header.appendChild(box);
  })();

  /* ========================================================================
   * 2. 主题切换（#2）
   *    动态注入按钮到 header，点击在 dark / light 之间切换
   * ====================================================================== */
  (function injectThemeButton() {
    var header = document.querySelector("header");
    if (!header) return;
    var btn = document.createElement("button");
    btn.className = "opp-btn theme-toggle";
    btn.type = "button";
    btn.setAttribute("data-theme-toggle", "1");
    header.appendChild(btn);
  })();
  function applyTheme(mode) {
    if (mode === "light") document.documentElement.classList.add("theme-light");
    else document.documentElement.classList.remove("theme-light");
    // 同步按钮标题
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.textContent = mode === "light" ? "☀" : "🌙";
      b.setAttribute("title", mode === "light" ? "切换到暗色" : "切换到亮色");
      b.setAttribute("aria-label", mode === "light" ? "切换到暗色" : "切换到亮色");
    });
    // meta theme-color 同步，移动端浏览器地址栏变色
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "light" ? "#f4f6f8" : "#0f1418");
  }

  (function initTheme() {
    var saved = lsGet(LS_THEME) || "dark";
    applyTheme(saved);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = document.documentElement.classList.contains("theme-light") ? "dark" : "light";
        lsSet(LS_THEME, next);
        applyTheme(next);
      });
    });
  })();

  /* ========================================================================
   * 3. 档案收藏（#3）
   *    - view.html 的 [data-fav-toggle] 按钮：收藏 / 取消当前档案
   *    - works.html 的 [data-favs-list]：显示已收藏档案卡片
   *    - 收藏数据存 localStorage: "opp-favs" = JSON 数组（档案 id 列表）
   * ====================================================================== */
  function getFavs() {
    try {
      var v = lsGet(LS_FAVS);
      var arr = v ? JSON.parse(v) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function setFavs(list) {
    lsSet(LS_FAVS, JSON.stringify(list));
    updateFavButtons();
  }
  function isFav(id) {
    return getFavs().indexOf(id) >= 0;
  }
  function toggleFav(id) {
    var list = getFavs();
    var i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    setFavs(list);
    return i < 0; // true = 已收藏
  }

  function updateFavButtons() {
    var favs = getFavs();
    var id = currentId();
    document.querySelectorAll("[data-fav-toggle]").forEach(function (btn) {
      if (id == null) return;
      var active = favs.indexOf(id) >= 0;
      btn.textContent = active ? "★ 已收藏" : "☆ 收藏档案";
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  // view.html 收藏按钮
  document.querySelectorAll("[data-fav-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = currentId();
      if (id == null) return;
      var added = toggleFav(id);
      playSound && playSound(added ? "ok" : "click");
    });
  });

  // works.html 收藏列表：有 [data-favs-list] 才渲染
  (function renderFavs() {
    var host = document.querySelector("[data-favs-list]");
    if (!host || !DEX) return;
    host.hidden = false;
    var favs = getFavs();
    if (!favs.length) {
      host.innerHTML = '<h2 class="doc-h">我的收藏</h2><p class="favs-empty">还没有收藏任何档案。打开一条档案，点「☆ 收藏档案」或按 <kbd>f</kbd> 即可加入。</p>';
      return;
    }
    host.innerHTML = '<h2 class="doc-h">我的收藏 <span class="fav-count">(' + favs.length + ")</span></h2>" +
      '<div class="favs-strip">' +
      favs.map(function (id) {
        var e = findEntry(id);
        if (!e) return "";
        var cat = DEX.category(e.cat);
        return '<a class="fav-card" href="view.html?id=' + e.id + '">' +
          '<span class="fav-code">' + escapeHtml(String(e.code)) + "</span>" +
          '<span class="fav-name">' + escapeHtml(String(e.name)) + "</span>" +
          '<span class="fav-status" data-status="' + escapeHtml(String(e.status)) + '">' + escapeHtml(String(e.status)) + "</span>" +
          "</a>";
      }).join("") + "</div>";
  })();

  // 简单 HTML 转义（避免档案名含特殊字符时破坏结构）
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ========================================================================
   * 4. 阅读进度条（#4）
   *    view.html 的详情页：页面顶部滚动进度条 + 档案内阅读进度百分比
   *    进度 = 当前滚动位置 / 正文高度
   * ====================================================================== */
  (function readingProgress() {
    var bar = document.querySelector("[data-reading-progress]");
    if (!bar) return;
    var body = document.querySelector(".entry-desc, .work-content");
    if (!body) return;
    var onScroll = function () {
      var rect = body.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return;
      var p = Math.max(0, Math.min(1, -rect.top / total));
      bar.style.width = (p * 100) + "%";
      bar.setAttribute("aria-valuenow", Math.round(p * 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  })();

  /* ========================================================================
   * 5. 键盘快捷键（#5）
   *    - 输入框内不响应（避免干扰搜索/表单输入）
   *    - `/` 聚焦搜索框（不输入时）
   *    - `←` `→` 在 view.html 详情页切换上/下一条
   *    - `r` 随机跳转档案
   *    - `f` 收藏/取消收藏当前档案
   *    - `t` 切换主题
   * ====================================================================== */
  (function hotkeys() {
    document.addEventListener("keydown", function (e) {
      // 排除输入框、文本域、可编辑元素
      var tag = (e.target && e.target.tagName) || "";
      var isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable);
      // 排除修饰键组合
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!isTyping) {
        if (e.key === "/") {
          var si = document.getElementById("globalSearch");
          if (si) { e.preventDefault(); si.focus(); si.select(); }
          return;
        }
        if (e.key.toLowerCase() === "r") {
          var id = randomEntryId();
          if (id != null) window.location.href = "view.html?id=" + id;
          return;
        }
        if (e.key.toLowerCase() === "t") {
          var next = document.documentElement.classList.contains("theme-light") ? "dark" : "light";
          lsSet(LS_THEME, next);
          applyTheme(next);
          return;
        }
        if (e.key.toLowerCase() === "f" && currentId() != null) {
          toggleFav(currentId());
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          var idNow = currentId();
          if (idNow == null || !DEX) return;
          var all = ENTRIES;
          var idx = -1;
          for (var i = 0; i < all.length; i++) { if (all[i].id === idNow) { idx = i; break; } }
          if (idx < 0) return;
          var target = e.key === "ArrowLeft" ? all[idx - 1] : all[idx + 1];
          if (target) {
            e.preventDefault();
            window.location.href = "view.html?id=" + target.id;
          }
        }
      }
    });
  })();

  /* ==========================================================================
   * 批次 B：档案多章节导航 / 交叉引用提示 / 元数据增强 / 卡片搜索高亮
   * ========================================================================== */

  /* ---------- escHtml：拼 HTML 时转义（批次 B 局部工具） ---------- */
  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- B.1 档案多章节 → 正文章节导航条（#7） ----------
   * 详情页正文由 data/entries.js 里的 7 个小节（.section-label）组成。
   * 这里自动收集它们，在正文上方注入一条锚点导航，点一下平滑滚到对应小节。
   */
  function initSectionToc() {
    var desc = document.querySelector(".entry-desc");
    if (!desc) return;
    var labels = desc.querySelectorAll(".section-label");
    if (labels.length < 2) return;
    var toc = document.createElement("nav");
    toc.className = "section-toc";
    toc.setAttribute("aria-label", "档案章节导航");
    var items = [];
    for (var i = 0; i < labels.length; i++) {
      var lbl = labels[i];
      var text = (lbl.textContent || "").trim();
      var secId = "sec-" + (currentId() || 0) + "-" + i;
      lbl.id = secId;
      items.push('<button class="toc-link" type="button" data-target="' + secId + '">' + escHtml(text) + "</button>");
    }
    toc.innerHTML = '<span class="toc-label">目录</span>' + items.join("");
    desc.parentNode.insertBefore(toc, desc);
    toc.addEventListener("click", function (ev) {
      var t = ev.target;
      while (t && t !== toc && !(t.className && String(t.className).indexOf("toc-link") >= 0)) t = t.parentNode;
      if (!t || t === toc) return;
      var target = document.getElementById(t.getAttribute("data-target"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- B.2 交叉引用 → 正文 #00x 链接补档案名提示（#8） ----------
   * data/entries.js 的正文里写 #001、#004 会被自动变成指向该档案的链接，
   * 这里给正文里这些交叉引用链接补上悬停提示（档案名 + 编号），并标记样式便于识别。
   * 只处理正文（.entry-desc），不碰 related-block 的关联卡片。
   */
  function initXrefHints() {
    var scope = document.querySelector(".entry-desc");
    if (!scope) return;
    var links = scope.querySelectorAll('a[href*="view.html?id="]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      var m = /id=(\d+)/.exec(href);
      if (!m) continue;
      var target = findEntry(parseInt(m[1], 10));
      if (!target) continue;
      if (!links[i].getAttribute("title")) {
        links[i].setAttribute("title", "查看档案 " + target.code + " · " + target.name);
      }
      if (!links[i].className || links[i].className.indexOf("xref-link") < 0) {
        links[i].className = (links[i].className ? links[i].className + " " : "") + "xref-link";
      }
    }
  }

  /* ---------- B.3 元数据增强 → meta 行补发现地点（#9） ----------
   * render.js 在 meta 行写了「编号 · 分级 · 档案室」，这里再补上发现地点（entry.place），
   * 让详情页头部信息更完整，不新增任何容器。
   */
  function enhanceMeta() {
    var meta = document.getElementById("monsterMeta");
    var id = currentId();
    if (!meta || id == null) return;
    var entry = findEntry(id);
    if (!entry || !entry.place) return;
    if (meta.textContent.indexOf(entry.place) >= 0) return; // 不重复追加
    meta.textContent += " · " + entry.place;
  }

  /* ---------- B.4 卡片搜索高亮 → 档案室卡片 <mark> 高亮（#11） ----------
   * ui.js 的下拉建议已高亮，这里让档案室页（works1/2/3、works、sitemap）的卡片
   * 也随搜索框输入实时高亮命中关键词。纯 DOM 操作、不改 URL、不与 ui.js 冲突。
   */
  function initCardHighlight() {
    var input = document.getElementById("globalSearch");
    if (!input) return;
    var SELECTOR = ".dossier-card, .related-card";
    var FIELDS = [".dossier-name", ".dossier-lead"];

    function clear() {
      var marks = document.querySelectorAll(SELECTOR + " mark.hl");
      for (var i = 0; i < marks.length; i++) {
        var p = marks[i].parentNode;
        p.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
        p.normalize();
      }
    }
    function apply(q) {
      clear();
      if (!q) return;
      var cards = document.querySelectorAll(SELECTOR);
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        for (var f = 0; f < FIELDS.length; f++) {
          var el = card.querySelector(FIELDS[f]);
          if (!el) continue;
          var text = el.textContent;
          var idx = text.toLowerCase().indexOf(q.toLowerCase());
          if (idx < 0) continue;
          el.innerHTML = escHtml(text.slice(0, idx)) +
            '<mark class="hl">' + escHtml(text.slice(idx, idx + q.length)) + "</mark>" +
            escHtml(text.slice(idx + q.length));
        }
      }
    }
    input.addEventListener("input", function () { apply(input.value.trim()); });
    apply(input.value.trim()); // 浏览器回填 / 前进后退时也应用一次
  }

  /* ==========================================================================
   * 批次 C：视频挂档案 / 播放记忆（poster 已由 ui.js 灯箱实现，无需重复）
   * ========================================================================== */

  /* ---------- C.1 视频挂档案 → 详情页「疑似相关影像」（#12） ----------
   * 影像的内容来源与拍摄时间都未登记，不能断言"拍到了什么"。
   * 所以这里只做"疑似关联"：在详情页展示一段可能相关的影像缩略图，
   * 点击复用 ui.js 已有的 data-record-open 灯箱；文案明确写"尚未证实"。
   * 映射表放在这里，不改 data/recordings.js。
   */
  var RECORD_LINK = { 1: 4, 2: 2, 3: 8, 4: 11 };

  function initEntryRecordLink() {
    var id = currentId();
    if (id == null) return;
    var recId = null;
    for (var k in RECORD_LINK) {
      if (RECORD_LINK[k] === id) { recId = Number(k); break; }
    }
    if (!recId) return;
    var list = window.RECORDINGS || [];
    var rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === recId) { rec = list[i]; break; }
    }
    if (!rec) return;
    var anchor = document.querySelector(".related-block") || document.querySelector(".entry-nav");
    if (!anchor) return;
    var block = document.createElement("section");
    block.className = "doc-block record-link-block";
    block.innerHTML =
      '<h2 class="doc-h">疑似相关影像</h2>' +
      '<div class="record-link-strip">' +
        '<button type="button" class="record-link-card" data-record-open="' + rec.id + '" aria-label="播放 ' + escHtml(rec.title) + '">' +
          '<img loading="lazy" decoding="async" src="' + escHtml(rec.thumb) + '" width="' + rec.thumbW + '" height="' + rec.thumbH + '" alt="' + escHtml(rec.title) + ' 缩略图">' +
          '<span class="rl-code">' + escHtml(rec.code) + "</span>" +
          '<span class="rl-title">' + escHtml(rec.title) + "</span>" +
          '<span class="rl-duration">' + escHtml(rec.durationText) + "</span>" +
        "</button>" +
        '<p class="record-link-note">该影像与本条档案是否存在关联尚未证实，仅供参考。</p>' +
      "</div>";
    anchor.parentNode.insertBefore(block, anchor.nextSibling);
  }

  /* ---------- C.2 播放记忆 → 续播上次位置（#13） ----------
   * ui.js 的灯箱关闭时会摘掉 src，所以位置必须我们自己存。
   * 用 localStorage 按影像文件名分档记录，打开同一段时从中断处续播。
   */
  function initVideoResume() {
    var vbox = document.querySelector(".video-lightbox");
    if (!vbox) return;
    var vEl = vbox.querySelector(".video-el");
    if (!vEl) return;

    function keyOf(url) {
      return String(url || "").split("?")[0].split("/").pop();
    }

    // 每 2 秒存一次当前播放位置（只在真实播放时更新）
    var timer = null;
    vEl.addEventListener("timeupdate", function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        var src = vEl.currentSrc || vEl.src;
        if (!src || vEl.paused || vEl.ended) return;
        lsSet("opp-rec-time-" + keyOf(src), String(vEl.currentTime));
      }, 2000);
    });

    // 元数据加载完成时恢复位置（此刻才知道真实时长）
    vEl.addEventListener("loadedmetadata", function () {
      if (!vbox.classList.contains("show")) return;
      var src = vEl.currentSrc || vEl.src;
      if (!src) return;
      var t = parseFloat(lsGet("opp-rec-time-" + keyOf(src)));
      if (t && t > 0 && t < vEl.duration - 0.5) {
        vEl.currentTime = t;
      }
    });

    // 关闭灯箱时记一次最终位置（比 timeupdate 更及时）
    var obs = new MutationObserver(function () {
      if (!vbox.classList.contains("show")) {
        var src = vEl.currentSrc || vEl.src;
        if (src && !vEl.ended) {
          lsSet("opp-rec-time-" + keyOf(src), String(vEl.currentTime));
        }
      }
    });
    obs.observe(vbox, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- 初始化：批次 B ---------- */
  initSectionToc();
  initXrefHints();
  enhanceMeta();
  initCardHighlight();
  /* ==========================================================================
   * 批次 D：分享 / 复制链接 / 目击报告 / 本机热度排行
   * ========================================================================== */

  var LS_VIEWS = "opp-views";

  /* ---------- D.0 热度计数：每次打开详情页记一次（供 #18 用） ---------- */
  function bumpView(id) {
    var all = {};
    try {
      var raw = lsGet(LS_VIEWS);
      if (raw) all = JSON.parse(raw) || {};
    } catch (e) { all = {}; }
    all[String(id)] = (all[String(id)] || 0) + 1;
    lsSet(LS_VIEWS, JSON.stringify(all));
  }

  /* ---------- D.1 分享（#15） ----------
   * 优先用系统分享（手机），不支持就降级为复制链接并提示。
   */
  function shareEntry(entry) {
    var url = window.location.href;
    var title = entry.name + " · 老可梦图鉴";
    if (navigator.share) {
      navigator.share({ title: title, text: entry.code + " " + entry.name, url: url }).catch(function () {});
    } else {
      copyLink(url, "分享链接已复制");
    }
  }

  /* ---------- D.2 复制链接 / 文本（#16） ---------- */
  function copyLink(text, msg) {
    var done = function () { flashMessage(msg || "已复制到剪贴板"); };
    var fail = function () {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { flashMessage("复制失败，请手动复制地址栏"); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else { fail(); }
  }

  /* ---------- D.3 顶部小提示 ---------- */
  function flashMessage(msg) {
    var el = document.querySelector(".flash-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "flash-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 1800);
  }

  /* ---------- D.4 目击报告（#10，纯前端、无后端） ----------
   * 用户填写目击时间/地点/描述，生成一份「目击报告」文本并复制到剪贴板。
   * 不做任何上传。表单内嵌在详情页，点按钮展开 / 收起。
   */
  function initReport() {
    var btn = document.querySelector("[data-report-entry]");
    var entry = findEntry(currentId());
    if (!btn || !entry) return;

    var panel = document.createElement("div");
    panel.className = "report-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<h3 class="report-h">提交目击报告 · ' + escHtml(entry.code) + " " + escHtml(entry.name) + "</h3>" +
      '<p class="report-tip">报告只在你本机生成文本，不会上传到服务器。</p>' +
      '<label class="report-field">目击时间<input type="text" data-report-time placeholder="例如 2024-03-02 22:15"></label>' +
      '<label class="report-field">目击地点<input type="text" data-report-place placeholder="例如 湖南 · 沅江"></label>' +
      '<label class="report-field">现象描述<textarea data-report-desc rows="4" placeholder="描述你看到 / 听到 / 感受到的异常。"></textarea></label>' +
      '<div class="report-actions">' +
        '<button type="button" class="opp-btn report-gen" data-report-gen>生成并复制</button>' +
        '<button type="button" class="opp-btn report-cancel" data-report-cancel>取消</button>' +
      "</div>";
    btn.parentNode.insertBefore(panel, btn.nextSibling);

    function toggle(show) { panel.hidden = !show; }
    btn.addEventListener("click", function () { toggle(panel.hidden); });
    panel.querySelector("[data-report-cancel]").addEventListener("click", function () { toggle(false); });
    panel.querySelector("[data-report-gen]").addEventListener("click", function () {
      var time = panel.querySelector("[data-report-time]").value.trim();
      var place = panel.querySelector("[data-report-place]").value.trim();
      var desc = panel.querySelector("[data-report-desc]").value.trim();
      if (!desc) { flashMessage("请填写现象描述"); return; }
      var text =
        "【目击报告】\n" +
        "档案：" + entry.code + " " + entry.name + "\n" +
        "时间：" + (time || "未填写") + "\n" +
        "地点：" + (place || "未填写") + "\n" +
        "描述：\n" + desc + "\n" +
        "—— 老可梦图鉴访客提交（本机生成，未上传）";
      copyLink(text, "目击报告已复制，可粘贴到任何地方保存");
      toggle(false);
    });
  }

  /* ---------- D.5 本机热度排行（#18） ----------
   * 用 localStorage 统计"你打开过哪些档案、多少次"，在 works.html 显示 Top 5。
   * 只反映本机浏览，不代表全网。
   */
  function initHotList() {
    var box = document.querySelector("[data-hot-list]");
    if (!box) return;
    var all = {};
    try {
      var raw = lsGet(LS_VIEWS);
      if (raw) all = JSON.parse(raw) || {};
    } catch (e) { all = {}; }
    var pairs = [];
    for (var k in all) {
      var id = parseInt(k, 10);
      var e = findEntry(id);
      if (e) pairs.push([e, all[k]]);
    }
    if (!pairs.length) return;
    pairs.sort(function (a, b) { return b[1] - a[1]; });
    var top = pairs.slice(0, 5);
    box.innerHTML =
      '<h2 class="hot-h">你的最常访问</h2>' +
      '<ol class="hot-list">' +
        top.map(function (p) {
          return '<li><a class="hot-item" href="view.html?id=' + p[0].id + '">' +
            '<span class="hot-code">' + escHtml(p[0].code) + "</span>" +
            '<span class="hot-name">' + escHtml(p[0].name) + "</span>" +
            '<span class="hot-count">' + p[1] + " 次</span>" +
          "</a></li>";
        }).join("") +
      "</ol>" +
      '<p class="hot-note">仅记录你本机的浏览，不代表全站热度。</p>';
  }

  /* ==========================================================================
   * 批次 E：RSS 订阅 / 更新通知 / PWA 安装 / 访客评论
   * ========================================================================== */

  /* ---------- E.1 RSS 订阅按钮（#21） ----------
   * 在主导航右侧追加一个 RSS 链接，指向 build-feed 生成的 feed.xml。
   */
  function initRssButton() {
    if (document.querySelector("[data-rss-link]")) return;
    var nav = document.querySelector("nav#mainNav");
    if (!nav) return;
    var a = document.createElement("a");
    a.className = "rss-link";
    a.href = "feed.xml";
    a.setAttribute("data-rss-link", "");
    a.title = "订阅更新日志（RSS / Atom）";
    a.textContent = "RSS";
    nav.appendChild(a);
  }

  /* ---------- E.2 更新通知（#23） ----------
   * sw.js 里 skipWaiting() 让新版一装好就接管页面；前端监听 controllerchange，
   * 发现"换了个新版 SW"就提示用户刷新，让新内容立即可见。
   * 每个会话只提示一次（sessionStorage）。
   */
  function initUpdateNotice() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (sessionStorage.getItem("opp-update-shown")) return;
      sessionStorage.setItem("opp-update-shown", "1");
      var el = document.createElement("div");
      el.className = "update-toast";
      el.setAttribute("role", "status");
      el.innerHTML =
        '<span>站点有新的更新</span>' +
        '<button type="button" class="opp-btn" data-update-reload>刷新查看</button>';
      document.body.appendChild(el);
      el.querySelector("[data-update-reload]").addEventListener("click", function () {
        location.reload();
      });
    });
  }

  /* ---------- E.3 PWA 安装提示（#20） ----------
   * 满足安装条件时把 beforeinstallprompt 存起来；点"安装到桌面"按钮才弹系统安装框。
   * 不满足条件（如桌面 Safari / 未登录 PWA）就不显示任何提示。
   */
  function initInstallPrompt() {
    var deferred = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
      var btn = document.querySelector("[data-install-pwa]");
      if (btn) btn.hidden = false;
    });
    var header = document.querySelector("header");
    if (header && !document.querySelector("[data-install-pwa]")) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opp-btn install-btn";
      b.setAttribute("data-install-pwa", "");
      b.hidden = true;
      b.textContent = "安装到桌面";
      header.appendChild(b);
      b.addEventListener("click", function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; });
      });
    }
  }

  /* ---------- E.4 访客评论（#17，纯前端 localStorage） ----------
   * 详情页底部"访客留言"：用户写一条短评，保存在本机 localStorage，不联网。
   * 只显示自己在本机写过的留言。
   */
  function initVisitorComments() {
    var entry = findEntry(currentId());
    if (!entry) return;
    var wrap = document.querySelector("[data-comments]");
    if (!wrap) return;

    var LS_KEY = "opp-comments-" + entry.id;
    var list = [];
    try {
      var raw = lsGet(LS_KEY);
      if (raw) list = JSON.parse(raw) || [];
    } catch (e) { list = []; }

    wrap.innerHTML =
      '<h2 class="comments-h">访客留言</h2>' +
      '<div class="comments-list" data-comments-list>' +
        (list.length
          ? list.map(function (c) {
              return '<div class="comment-item">' +
                '<div class="comment-when">' + escHtml(c.when) + "</div>" +
                '<div class="comment-text">' + escHtml(c.text) + "</div>" +
              "</div>";
            }).join("")
          : '<p class="comments-empty">还没有留言，写下你的看法吧。</p>') +
      "</div>" +
      '<form class="comments-form" data-comments-form>' +
        '<textarea data-comment-input rows="2" maxlength="280" placeholder="写下你对这条档案的看法（只保存在本机，不联网）。"></textarea>' +
        '<div class="comments-actions">' +
          '<button type="submit" class="opp-btn">发表</button>' +
        "</div>" +
      "</form>" +
      '<p class="comments-note">留言只保存在你本机的浏览器里，清除站点数据会一并清空。</p>';

    wrap.querySelector("[data-comments-form]").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = wrap.querySelector("[data-comment-input]");
      var text = input.value.trim();
      if (!text) return;
      list.push({ when: new Date().toISOString().slice(0, 10), text: text });
      if (list.length > 20) list = list.slice(-20);
      lsSet(LS_KEY, JSON.stringify(list));
      initVisitorComments(); // 重绘
    });
  }

  /* ---------- 初始化：批次 D ---------- */
  var _curId = currentId();
  if (_curId != null) bumpView(_curId);
  (function () {
    var entry = findEntry(_curId);
    if (!entry) return;
    var sb = document.querySelector("[data-share-entry]");
    if (sb) sb.addEventListener("click", function () { shareEntry(entry); });
    var cb = document.querySelector("[data-copy-link]");
    if (cb) cb.addEventListener("click", function () { copyLink(window.location.href, "档案链接已复制"); });
  })();
  initReport();
  initHotList();

  /* ---------- 初始化：批次 C ---------- */
  initEntryRecordLink();
  initVideoResume();
  updateFavButtons();

  /* ---------- 初始化：批次 E ---------- */
  initRssButton();
  initUpdateNotice();
  initInstallPrompt();
  initVisitorComments();
})();