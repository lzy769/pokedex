(function () {
  // 0. 顶部系统状态条：全站一条，避免 13 个页面各改一遍 HTML
  const rail = document.createElement("div");
  rail.className = "sys-rail";
  rail.innerHTML =
    '<span class="rail-left"><i class="rail-dot"></i>SECURE ARCHIVE TERMINAL · NODE 07</span>' +
    '<span class="rail-right">CLEARANCE LEVEL 3 · <b id="railClock">--:--:--</b></span>';
  document.body.insertBefore(rail, document.body.firstChild);

  const railClock = rail.querySelector("#railClock");
  if (railClock) {
    const pad2 = n => String(n).padStart(2, "0");
    const railTick = () => {
      const d = new Date();
      railClock.textContent =
        pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    };
    railTick();
    setInterval(railTick, 1000);
  }

  // 1. 进度条填充
  const stats = document.querySelector(".stats");
  if (stats) {
    const bars = stats.querySelectorAll(".bar");
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          bars.forEach((bar, i) => {
            setTimeout(() => bar.classList.add("filled"), 200 + i * 150);
          });
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(stats);
  }

  // 2. 页脚时间戳
  const timeEl = document.querySelector(".foot-time strong");
  if (timeEl) {
    function tick() {
      const d = new Date();
      const pad = n => String(n).padStart(2, "0");
      timeEl.textContent =
        d.getFullYear() + "." +
        pad(d.getMonth() + 1) + "." +
        pad(d.getDate()) + " " +
        pad(d.getHours()) + ":" +
        pad(d.getMinutes()) + ":" +
        pad(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }

  // 3. 顶部滚动进度条
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.appendChild(progress);
  window.addEventListener("scroll", () => {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    const p = total > 0 ? (h.scrollTop / total) * 100 : 0;
    progress.style.width = p + "%";
  });

  // 4. 右下角状态栏
  const status = document.createElement("div");
  status.className = "status-bar";
  status.innerHTML = `
    <div class="sb-item"><span class="sb-label">FILE</span> <span id="sbFile">--</span></div>
    <div class="sb-item"><span class="sb-label">SCROLL</span> <span id="sbScroll">0%</span></div>
    <div class="sb-item"><span class="sb-label">TIME</span> <span id="sbTime">--:--:--</span></div>
  `;
  document.body.appendChild(status);

  const sbFile = status.querySelector("#sbFile");
  const sbScroll = status.querySelector("#sbScroll");
  const sbTime = status.querySelector("#sbTime");

  const pageTitle = (document.title.split(" · ")[0]) || "INDEX";
  sbFile.textContent = pageTitle;

  window.addEventListener("scroll", () => {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    const p = total > 0 ? Math.round((h.scrollTop / total) * 100) : 0;
    sbScroll.textContent = p + "%";
  });

  function tickTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    sbTime.textContent =
      pad(d.getHours()) + ":" +
      pad(d.getMinutes()) + ":" +
      pad(d.getSeconds());
  }
  tickTime();
  setInterval(tickTime, 1000);

  // 5. 画廊筛选
  const filterBtns = document.querySelectorAll(".filter-btn");
  const galleryFigures = document.querySelectorAll(".gallery figure");
  const galleryContainer = document.querySelector(".gallery");

  if (filterBtns.length && galleryFigures.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const f = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        let visibleCount = 0;
        galleryFigures.forEach(fig => {
          const cat = fig.dataset.cat;
          if (f === "all" || cat === f) {
            fig.classList.remove("hidden");
            visibleCount++;
          } else {
            fig.classList.add("hidden");
          }
        });

        if (visibleCount === 1) {
          galleryContainer.style.gridTemplateColumns = "1fr";
          galleryContainer.style.maxWidth = "400px";
        } else if (visibleCount === 2) {
          galleryContainer.style.gridTemplateColumns = "repeat(2, 1fr)";
          galleryContainer.style.maxWidth = "800px";
        } else {
          galleryContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
          galleryContainer.style.maxWidth = "1100px";
        }
      });
    });
  }

  // 6. 图片灯箱
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.innerHTML = `
    <button class="lightbox-close" aria-label="关闭">✕</button>
    <div class="lightbox-inner">
      <img src="" alt="">
      <div class="lightbox-caption"></div>
      <div class="lightbox-actions">
        <a href="#" class="lb-enter">查看完整档案 →</a>
        <button class="lb-close-btn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const lbImg = lightbox.querySelector("img");
  const lbCaption = lightbox.querySelector(".lightbox-caption");
  const lbEnter = lightbox.querySelector(".lb-enter");
  const lbClose = lightbox.querySelector(".lightbox-close");
  const lbCloseBtn = lightbox.querySelector(".lb-close-btn");

  function openLightbox(href, src, name, desc) {
    lbImg.src = src;
    lbImg.alt = name;
    lbCaption.innerHTML =
      '<div class="lb-name">' + name + '</div>' +
      (desc ? '<div class="lb-desc">' + desc + '</div>' : '');
    // 详情页的现场附件没有"下一页"，href 是 #，这时把按钮藏起来而不是留个死链
    if (!href || href === "#") {
      lbEnter.style.display = "none";
    } else {
      lbEnter.style.display = "";
      lbEnter.href = href;
    }
    lightbox.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  
  function closeLightbox() {
    lightbox.classList.remove("show");
    document.body.style.overflow = "";
  }

  // 灯箱绑定：
  //   .photo-grid a  档案卡片——点开先看大图，按钮再进详情页
  //   [data-lightbox] 详情页的现场附件——自带 data-src / data-caption
  document.querySelectorAll(".photo-grid a, [data-lightbox]").forEach(a => {
    const img = a.querySelector("img");
    const cap = a.querySelector(".caption, .attach-cap");
    if (!img) return;
    a.addEventListener("click", e => {
      e.preventDefault();
      const name = a.getAttribute("data-caption") || (cap ? cap.textContent.trim() : (img.alt || ""));
      const desc = img.getAttribute("data-desc") || a.getAttribute("data-desc") || "";
      openLightbox(a.getAttribute("href") || "", a.getAttribute("data-src") || img.src, name, desc);
    });
  });

  lbClose.addEventListener("click", closeLightbox);
  lbCloseBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && lightbox.classList.contains("show")) {
      closeLightbox();
    }
  });

  // 7. 全站搜索（即时下拉建议，替代原先「精确匹配 + alert」的实现）
  // 说明：档案部分不再手写，直接从 data/entries.js 生成——加一条档案只改那一个文件。
  //       这里只保留固定的页面入口。
  const PAGE_INDEX = [
    { title: "首页", sub: "Old Pokémon Pokédex", url: "index.html", kw: "home 首页" },
    { title: "图鉴", sub: "三大分类入口", url: "works.html", kw: "图鉴 分类 目录" },
    { title: "远古恐惧", sub: "分类 · 历史上的恶魔", url: "works1.html", kw: "分类 远古恐惧 恶魔" },
    { title: "未知之厄", sub: "分类 · 灾难发起者", url: "works2.html", kw: "分类 未知之厄 灾难" },
    { title: "人类希望", sub: "分类 · 向死而生", url: "works3.html", kw: "分类 人类希望 向死而生" },
    { title: "狞笑之杰", sub: "收录作品", url: "work1.html", kw: "作品 狞笑之杰" },
    { title: "青花瓷", sub: "收录作品", url: "work2.html", kw: "作品 青花瓷" },
    { title: "青鬼", sub: "收录作品", url: "work3.html", kw: "作品 青鬼" },
    { title: "反常", sub: "收录作品", url: "work4.html", kw: "作品 反常" },
    { title: "关于我们", sub: "站点说明", url: "about.html", kw: "关于 联系" },
    { title: "系统索引", sub: "全站链接", url: "sitemap.html", kw: "索引 站点地图" },
    { title: "事件时间线", sub: "按发现日期排列", url: "timeline.html", kw: "时间线 年表 历史 事件" },
    { title: "更新日志", sub: "版本记录与订阅", url: "changelog.html", kw: "更新 日志 版本 订阅 rss" },
  ];

  // 档案条目：由唯一数据源生成；若某页漏引 data/entries.js，就退化成只能搜页面
  const DEX = window.POKEDEX;
  const ENTRY_INDEX = DEX
    ? DEX.entries.map((e) => ({
        title: e.name,
        sub: `档案 ${e.code} · ${DEX.category(e.cat).name}`,
        url: `view.html?id=${e.id}`,
        code: String(e.code).replace(/[^0-9]/g, ""),
        kw: `${e.code} ${e.id} ${e.status} ${e.lead} ${(e.tags || []).join(" ")} ${e.place || ""}`,
      }))
    : [];

  const SITE_INDEX = ENTRY_INDEX.concat(PAGE_INDEX);

  const searchInput = document.getElementById("globalSearch");
  if (searchInput) {
    /* ---------- 1) 构建下拉容器并挂到搜索框下方 ---------- */
    const box = document.createElement("div");
    box.className = "search-results";
    box.id = "searchResults";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    searchInput.setAttribute("role", "combobox");
    searchInput.setAttribute("aria-autocomplete", "list");
    searchInput.setAttribute("aria-controls", "searchResults");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.parentElement.style.position = "relative";
    searchInput.parentElement.appendChild(box);

    let activeIndex = -1; // 当前键盘高亮的序号，-1 表示未选择

    /* ---------- 2) 工具函数 ---------- */
    // 转义，避免档案名里出现 < > 等字符时破坏结构
    const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const closeBox = () => {
      box.hidden = true;
      box.innerHTML = "";
      activeIndex = -1;
      searchInput.setAttribute("aria-expanded", "false");
    };

    // 在已转义的文本里给命中的那一段套 <mark>：转义后再定位，下标才与切片一致，
    // 也用 indexOf 而非正则，用户输入里的 . * ( ) 不会变成元字符。
    const mark = (text, key) => {
      const safe = escapeHtml(String(text));
      if (!key) return safe;
      const i = safe.toLowerCase().indexOf(key);
      if (i < 0) return safe;
      return safe.slice(0, i) +
        '<mark class="hl">' + safe.slice(i, i + key.length) + "</mark>" +
        safe.slice(i + key.length);
    };

    // 相关度打分：标题全等 > 标题开头 > 标题包含 > 编号全等 > 关键词命中 > 副标题命中，
    // 同分时标题更短的排前面（更具体）。
    const score = (it, key) => {
      const t = it.title.toLowerCase();
      const k = it.kw.toLowerCase();
      const s = it.sub.toLowerCase();
      let sc = 0;
      if (t === key) sc = 1000;
      else if (t.startsWith(key)) sc = 800;
      else if (t.includes(key)) sc = 600;
      else if (k.includes(key)) sc = 300;
      else if (s.includes(key)) sc = 150;
      if (!sc) return 0;
      const digits = key.replace(/[^0-9]/g, "");
      if (it.code && digits && it.code === digits) sc += 500;
      return sc - t.length;
    };

    const search = (q) => {
      const key = q.trim().toLowerCase();
      if (!key) return [];
      return SITE_INDEX
        .map((it) => ({ it, sc: score(it, key) }))
        .filter((r) => r.sc > 0)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 8)
        .map((r) => r.it);
    };

    const render = (list, key) => {
      if (!list.length) {
        box.innerHTML = '<div class="search-empty">未收录与「' + escapeHtml(key) + "」相关的档案</div>";
      } else {
        box.innerHTML = list.map((it, i) =>
          `<a class="search-item" role="option" id="search-opt-${i}" href="${it.url}">
             <span class="search-item-title">${mark(it.title, key)}</span>
             <span class="search-item-sub">${mark(it.sub, key)}</span>
           </a>`).join("");
      }
      box.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
      activeIndex = -1;
    };

    // 键盘高亮：同时更新 class 与 aria-activedescendant
    const highlight = (i) => {
      const items = box.querySelectorAll(".search-item");
      items.forEach((el, idx) => el.classList.toggle("active", idx === i));
      activeIndex = i;
      if (items[i]) {
        searchInput.setAttribute("aria-activedescendant", items[i].id);
        items[i].scrollIntoView({ block: "nearest" });
      }
    };

    /* ---------- 3) 事件 ---------- */
    // 查询词与打分都在 render 里用，统一走一次 run()，避免两处传参不一致
    const run = () => {
      const key = searchInput.value.trim().toLowerCase();
      if (!key) return closeBox();
      render(search(searchInput.value), key);
    };

    searchInput.addEventListener("input", run);

    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) run();
    });

    searchInput.addEventListener("keydown", (e) => {
      const items = box.querySelectorAll(".search-item");
      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault();
        highlight(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === "ArrowUp" && items.length) {
        e.preventDefault();
        highlight(Math.max(activeIndex - 1, 0));
      } else if (e.key === "Enter") {
        const target = items[activeIndex] || items[0];
        if (target) {
          e.preventDefault();
          const url = target.getAttribute("href");
          closeBox();
          searchInput.blur();
          window.location.href = url;
        }
      } else if (e.key === "Escape") {
        closeBox();
        searchInput.blur();
      }
    });

    // 点击下拉外部时收起
    document.addEventListener("click", (e) => {
      if (!searchInput.parentElement.contains(e.target)) closeBox();
    });
  }
  // 8. 自定义光标
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) {
    const cursorDot = document.createElement("div");
    cursorDot.className = "cursor-dot";
    const cursorRing = document.createElement("div");
    cursorRing.className = "cursor-ring";
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);

    let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

    document.addEventListener("mousemove", e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = mouseX + "px";
      cursorDot.style.top = mouseY + "px";
      cursorDot.style.opacity = "1";
      cursorRing.style.opacity = "1";
    });

    document.addEventListener("mouseleave", () => {
      cursorDot.style.opacity = "0";
      cursorRing.style.opacity = "0";
    });

    function animateCursor() {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      cursorRing.style.left = ringX + "px";
      cursorRing.style.top = ringY + "px";
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    const clickableElements = document.querySelectorAll("a, button, input, textarea, .card, .filter-btn, .gallery img, .entry");
    clickableElements.forEach(el => {
      el.addEventListener("mouseenter", () => cursorRing.classList.add("hover"));
      el.addEventListener("mouseleave", () => cursorRing.classList.remove("hover"));
    });
    document.addEventListener("mousedown", () => cursorRing.classList.add("click"));
    document.addEventListener("mouseup", () => cursorRing.classList.remove("click"));
  }

  // 9. 页面切换转场
  const transitionOverlay = document.createElement("div");
  transitionOverlay.className = "page-transition";
  transitionOverlay.innerHTML = `<div class="page-transition-text">SYSTEM LOADING...</div><div class="page-transition-line"></div>`;
  document.body.appendChild(transitionOverlay);

  document.addEventListener("click", e => {
    const link = e.target.closest("a");
    if (!link) return;
    if (link.target === "_blank") return;
    const href = link.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    const isInternal = !href.startsWith("http") || href.includes(window.location.hostname);
    if (!isInternal) return;

    // 如果是在播放音乐，记录当前时间
    if (window.bgm && !window.bgm.paused) {
      sessionStorage.setItem("bgmTime", window.bgm.currentTime);
    }

    e.preventDefault();
    transitionOverlay.classList.add("active");
    setTimeout(() => { window.location.href = href; }, 550);
  });

  window.addEventListener("pageshow", e => {
    if (e.persisted) {
      transitionOverlay.classList.remove("active");
      const line = transitionOverlay.querySelector(".page-transition-line");
      if (line) {
        line.style.transition = "none";
        line.style.width = "0";
        setTimeout(() => { line.style.transition = ""; }, 50);
      }
    }
  });

  // 10. 音效与全局背景音乐系统
  const soundBtn = document.createElement("button");
  soundBtn.className = "sound-toggle";
  document.body.appendChild(soundBtn);

  let audioCtx;
  let soundEnabled = false;

  // 将 bgm 挂载到 window 上，方便转场时读取
  window.bgm = new Audio(); // 先不设 src，避免每页都预下载 5.4MB
  window.bgm.preload = "none";
  window.bgm.src = "bgm.mp3";
  window.bgm.loop = true;
  window.bgm.volume = 0.3;

  // 检查是否在本次会话中开启过音乐
  if (sessionStorage.getItem("bgmPlaying") === "true") {
    soundEnabled = true;
    soundBtn.innerHTML = "🔊 关闭声音";
    soundBtn.classList.add("active");
    
    // 恢复播放进度
    const savedTime = sessionStorage.getItem("bgmTime");
    if (savedTime) {
      window.bgm.currentTime = parseFloat(savedTime);
    }
    
    // 因为浏览器的自动播放限制，转页后直接调用 play() 可能会被拦截。
    // 我们尝试静音播放，或者等待用户第一次点击页面时再发声。
    window.bgm.play().then(() => {
      // 播放成功（说明浏览器允许）
    }).catch(() => {
      // 播放被拦截，绑定一次点击事件来唤醒
      const wakeUpBgm = () => {
        window.bgm.play();
        document.removeEventListener("click", wakeUpBgm);
      };
      document.addEventListener("click", wakeUpBgm);
    });
  } else {
    soundBtn.innerHTML = "🔇 播放音乐与音效";
  }

  function playSound(type) {
    if (!soundEnabled) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === "hover") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === "click") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
  }

  const hoverElements = document.querySelectorAll("a, button, .gallery figure, .entry, .card, .filter-btn");
  hoverElements.forEach(el => {
    el.addEventListener("mouseenter", () => playSound("hover"));
  });

  document.addEventListener("click", e => {
    if (e.target.closest("a, button, .filter-btn")) {
      playSound("click");
    }
  });

  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    
    if (soundEnabled) {
      sessionStorage.setItem("bgmPlaying", "true"); // 记录开启状态
      window.bgm.play().catch(err => console.log("BGM 播放失败", err));
      soundBtn.innerHTML = "🔊 关闭声音";
      soundBtn.classList.add("active");
      playSound("click");
    } else {
      sessionStorage.setItem("bgmPlaying", "false"); // 记录关闭状态
      window.bgm.pause();
      soundBtn.innerHTML = "🔇 播放音乐与音效";
      soundBtn.classList.remove("active");
    }
  });

  // 11. 终极彩蛋：隐藏控制台
  const terminalOverlay = document.createElement("div");
  terminalOverlay.className = "terminal-overlay";
  terminalOverlay.innerHTML = `
    <div class="terminal-box">
      <div class="terminal-header">
        <span>OLD_POKEDEX_OS v2.0 (SECURE)</span>
        <span class="terminal-close">✕</span>
      </div>
      <div class="terminal-body" id="terminalBody">
        <div class="terminal-line">Type <span class="sys-msg">"help"</span> for a list of commands.</div>
      </div>
      <div class="terminal-input-wrap">
        <span class="terminal-prompt">root@archive:~#</span>
        <input type="text" id="terminalInput" autocomplete="off" spellcheck="false">
      </div>
    </div>
  `;
  document.body.appendChild(terminalOverlay);

  const terminalBody = document.getElementById("terminalBody");
  const terminalInput = document.getElementById("terminalInput");
  const terminalClose = terminalOverlay.querySelector(".terminal-close");

  let isPwdMode = false;

  function showTerminal() {
    terminalOverlay.classList.add("show");
    setTimeout(() => terminalInput.focus(), 100);
  }
  
  function hideTerminal() {
    terminalOverlay.classList.remove("show");
    terminalInput.value = "";
    isPwdMode = false;
  }

  terminalClose.addEventListener("click", hideTerminal);
  terminalOverlay.addEventListener("click", e => {
    if (e.target === terminalOverlay) hideTerminal();
  });

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "`" || e.key === "~") {
      e.preventDefault();
      if (terminalOverlay.classList.contains("show")) hideTerminal();
      else showTerminal();
    }
  });

  let logoClicks = 0;
  const brandEn = document.querySelector(".brand-en");
  if (brandEn) {
    brandEn.addEventListener("click", () => {
      logoClicks++;
      setTimeout(() => { logoClicks = 0; }, 2000);
      if (logoClicks >= 5) {
        showTerminal();
        logoClicks = 0;
      }
    });
  }

  function appendTerminalLine(text, className = "") {
    const div = document.createElement("div");
    div.className = "terminal-line";
    if (className) div.classList.add(className);
    div.textContent = text;
    terminalBody.appendChild(div);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  terminalInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const val = terminalInput.value.trim();
      terminalInput.value = ""; 
      
      if (isPwdMode) {
        appendTerminalLine("********", "sys-msg");
        if (val === "admin" || val === "pokedex") {
          appendTerminalLine("ACCESS GRANTED. Redirecting...", "sys-msg");
          setTimeout(() => { window.location.replace("hidden.html"); }, 1000);
        } else {
          appendTerminalLine("ACCESS DENIED.", "error-msg");
          isPwdMode = false;
        }
        return; 
      }

      if (!val) {
        appendTerminalLine("root@archive:~#");
        return;
      }

      appendTerminalLine(`root@archive:~# ${val}`);

      const cmd = val.toLowerCase();
      if (cmd === "help") {
        appendTerminalLine("Available commands:");
        appendTerminalLine("  help   - Show this list");
        appendTerminalLine("  clear  - Clear screen");
        appendTerminalLine("  login  - Access restricted file");
        appendTerminalLine("  exit   - Close terminal");
      } else if (cmd === "clear") {
        terminalBody.innerHTML = "";
      } else if (cmd === "exit") {
        hideTerminal();
      } else if (cmd === "login") {
        appendTerminalLine("Please enter access password:", "sys-msg");
        isPwdMode = true; 
      } else {
        appendTerminalLine(`command not found: ${cmd}`, "error-msg");
      }
    }
  });

  // 12. 档案室：三组筛选 + 排序（works1/2/3 共用，卡片由 data/render.js 生成）
  //     等级 / 发现年代 / 回收地点 各记一份选择，任意组合同时生效；排序按编号 id
  const filterBar2 = document.querySelector("[data-dossier-filter]");
  const dossierCards = document.querySelectorAll(".photo-grid .dossier-card");

  if (filterBar2 && dossierCards.length) {
    const grid2 = document.querySelector(".photo-grid");

    // id → 档案，用于取 status / found / place 与排序
    const DEX2 = window.POKEDEX || {};
    const byId = {};
    (DEX2.entries || []).forEach((e) => { byId[String(e.id)] = e; });

    const pick = { status: "all", year: "all", place: "all" };

    const decadeOf = (e) => {
      const f = String((e && e.found) || "");
      return f.length >= 4 ? f.slice(0, 3) + "0" : "";
    };
    const provinceOf = (e) =>
      String((e && e.place) || "").split("·")[0].replace(/\s/g, "");

    const countEl = filterBar2.querySelector(".filter-count");
    const updateCount = () => {
      if (!countEl) return;
      const visible = Array.prototype.filter.call(dossierCards, (c) => !c.classList.contains("hidden"));
      countEl.textContent = visible.length + " 条";
    };

    const applyFilters = () => {
      dossierCards.forEach((card) => {
        const e = byId[card.getAttribute("data-entry-id")];
        const ok =
          (pick.status === "all" || (e && e.status === pick.status)) &&
          (pick.year === "all" || decadeOf(e) === pick.year) &&
          (pick.place === "all" || provinceOf(e) === pick.place);
        card.classList.toggle("hidden", !ok);
      });
      updateCount();
    };

    // 按 id 数值重新排列卡片（保留 DOM 引用，只是改变顺序）
    const sortCards = (dir) => {
      const list = Array.prototype.slice.call(dossierCards).sort((a, b) => {
        const ia = parseInt(a.getAttribute("data-entry-id"), 10) || 0;
        const ib = parseInt(b.getAttribute("data-entry-id"), 10) || 0;
        return dir === "asc" ? ia - ib : ib - ia;
      });
      list.forEach((card) => grid2.appendChild(card));
      updateCount();
    };

    // 只有同一组的按钮互斥，三组之间互不影响
    const mark = (attr, val) => {
      filterBar2.querySelectorAll(".filter-btn[" + attr + "]").forEach((b) => b.classList.remove("active"));
      const hit = filterBar2.querySelector('.filter-btn[' + attr + '="' + val + '"]');
      if (hit) hit.classList.add("active");
    };

    filterBar2.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;

      if (btn.dataset.filter) {
        pick.status = btn.dataset.filter;
        mark("data-filter", pick.status);
        applyFilters();
      } else if (btn.dataset.year) {
        pick.year = btn.dataset.year;
        mark("data-year", pick.year);
        applyFilters();
      } else if (btn.dataset.place) {
        pick.place = btn.dataset.place;
        mark("data-place", pick.place);
        applyFilters();
      } else if (btn.dataset.sort) {
        mark("data-sort", btn.dataset.sort);
        sortCards(btn.dataset.sort);
      }
    });
  }

  // 13. 档案详情：键盘 ← / → 在当前分类内翻页（view.html）
  const entryNav = document.querySelector("[data-entry-nav]");
  if (entryNav) {
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const prevLink = entryNav.querySelector(".nav-link.prev");
      const nextLink = entryNav.querySelector(".nav-link.next");
      let href = null;
      if (e.key === "ArrowLeft" && prevLink && !prevLink.classList.contains("disabled")) {
        href = prevLink.getAttribute("href");
      } else if (e.key === "ArrowRight" && nextLink && !nextLink.classList.contains("disabled")) {
        href = nextLink.getAttribute("href");
      }
      if (!href) return;
      e.preventDefault();
      playSound("click");
      // 留 90ms 让翻页音效起声再跳走，人眼分辨不出来
      setTimeout(() => { window.location.href = href; }, 90);
    });
  }

  // 14. 涂黑条：点开看被划掉的内容
  //     标记由 data/entries.js 的 decorate() 生成：
  //       .redact[data-redact]  可以展开（看过就回不去了）
  //       .redact.perm          永久删除，点不动
  //     用事件委托：详情页 / 时间线 / 折叠日志里的涂黑条都是渲染后才出现的，直接绑定会漏。
  function revealRedact(el) {
    if (!el || el.classList.contains("perm") || el.classList.contains("open")) return;
    const hidden = el.getAttribute("data-redact");
    if (hidden == null) return;
    el.textContent = hidden;
    el.removeAttribute("data-redact");
    el.removeAttribute("role");
    el.removeAttribute("tabindex");
    el.classList.add("open");
    playSound("click");
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest) return;
    revealRedact(e.target.closest(".redact"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!e.target || !e.target.classList || !e.target.classList.contains("redact")) return;
    e.preventDefault();
    revealRedact(e.target);
  });

  /* ==========================================================================
   * 沉浸恐怖效果（B 组）
   * 15 减弱开关 / 16 悬停与翻页音效 / 17 解密进度 / 18 随机警报 / 19 闲置惩罚
   *
   * 两条刹车：用户自己的「减弱」开关（html.calm）和系统 prefers-reduced-motion。
   * 突发画面类效果（警报、抖动、眼睛）一律先问这两条，只留静态排版。
   * ========================================================================== */

  const mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const prefersReduced = () => !!(mqReduce && mqReduce.matches);
  const calmOn = () => document.documentElement.classList.contains("calm");

  // 转义：拼属性值时用，避免数据里的引号破坏结构
  const attr = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );

  // ---- 15. 减弱开关：状态存 localStorage，翻页/刷新都保持 ----
  const CALM_KEY = "siteCalm";
  // 先把 class 打上再建 DOM，免得"先闪一下扫描线再关掉"
  try {
    if (localStorage.getItem(CALM_KEY) === "1") document.documentElement.classList.add("calm");
  } catch (e) {}

  (function buildFxToggle() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fx-toggle";

    const paint = () => {
      const on = calmOn();
      btn.textContent = on ? "◍" : "◉";
      const tip = on ? "恐怖效果：已减弱（点击恢复全开）" : "恐怖效果：全开（点击减弱）";
      btn.title = tip;
      btn.setAttribute("aria-label", tip);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("on", on);
    };

    btn.addEventListener("click", () => {
      const on = !calmOn();
      document.documentElement.classList.toggle("calm", on);
      try { localStorage.setItem(CALM_KEY, on ? "1" : "0"); } catch (e) {}
      paint();
      playSound("click");
    });

    paint();
    document.body.appendChild(btn);
  })();

  // ---- 16. 音效：悬停与翻页（用户没开声音时 playSound 自己静默返回） ----
  let hoverLast = null;
  let hoverAt = 0;
  document.addEventListener("mouseover", (e) => {
    if (!e.target || !e.target.closest) return;
    const hit = e.target.closest("a, .tag-chip, .filter-btn, .redact, .random-entry");
    if (!hit || hit === hoverLast) return;
    hoverLast = hit;
    const now = Date.now();
    if (now - hoverAt < 90) return; // 快速划过一排链接时别连成一串噪音
    hoverAt = now;
    playSound("hover");
  });

  // ---- 17. 解密进度：记住读过哪些档案，首页显示「已解密 N / 11」 ----
  const SEEN_KEY = "siteSeenEntries";
  const readSeen = () => {
    try {
      const a = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      return new Set(Array.isArray(a) ? a.map(String) : []);
    } catch (e) {
      return new Set();
    }
  };
  const writeSeen = (s) => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s))); } catch (e) {}
  };

  // 详情页：把当前 ?id= 记成已读
  (function markCurrentEntry() {
    const m = /[?&]id=(\d+)/.exec(window.location.search);
    if (!m) return;
    const s = readSeen();
    if (s.has(m[1])) return;
    s.add(m[1]);
    writeSeen(s);
  })();

  // 首页：进度条 + 11 个格子，已读/未读一眼可辨
  (function buildProgress() {
    const box = document.querySelector("[data-decrypt-progress]");
    if (!box) return;
    const all = (window.POKEDEX && window.POKEDEX.entries) || [];
    if (!all.length) return;

    const seen = readSeen();
    const done = all.filter((e) => seen.has(String(e.id))).length;
    const pct = Math.round((done / all.length) * 100);

    box.innerHTML =
      '<div class="dp-head">' +
        '<span class="dp-label">档案解密进度</span>' +
        '<span class="dp-count">已解密 <b>' + done + "</b> / " + all.length + "（" + pct + "%）</span>" +
      "</div>" +
      '<div class="dp-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="dp-cells">' +
        all
          .map((e) => {
            const on = seen.has(String(e.id));
            return (
              '<a class="dp-cell' + (on ? " on" : "") + '" href="view.html?id=' + attr(e.id) +
              '" title="' + (on ? "已解密" : "未解密") + " · " + attr(e.code) + " " + attr(e.name) + '">' +
              (on ? "▣" : "▢") +
              "</a>"
            );
          })
          .join("") +
      "</div>";
  })();

  // ---- 11(按钮). 随机档案：page-title 与解密面板各挂一个 ----
  const goRandom = () => {
    const P = window.POKEDEX;
    if (!P || !P.entries || !P.entries.length) return;
    const e = P.entries[Math.floor(Math.random() * P.entries.length)];
    playSound("click");
    window.location.href = "view.html?id=" + e.id;
  };
  const makeRandomBtn = (extra) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "random-entry" + (extra ? " " + extra : "");
    b.textContent = "随机档案";
    b.title = "从 " + ((window.POKEDEX && window.POKEDEX.entries.length) || 0) + " 条里随便抽一条";
    b.addEventListener("click", goRandom);
    return b;
  };
  (function placeRandom() {
    const pt = document.querySelector(".page-title");
    if (pt) pt.appendChild(makeRandomBtn());
    const box = document.querySelector("[data-decrypt-progress]");
    if (box) box.appendChild(makeRandomBtn("dp-random"));
  })();

  // ---- 18. 随机警报：低频一次全屏告警，每个会话最多一次 ----
  (function randomAlarm() {
    const forced = /[?&]alarm=1/.test(window.location.search);
    if (!forced) {
      if (calmOn() || prefersReduced()) return;
      let shown = false;
      try { shown = sessionStorage.getItem("alarmShown") === "1"; } catch (e) {}
      if (shown) return;
      if (Math.random() > 0.05) return;
      try { sessionStorage.setItem("alarmShown", "1"); } catch (e) {}
    }

    let left = 3;
    let tick = null;

    const overlay = document.createElement("div");
    overlay.className = "alarm-overlay";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-label", "记忆抹除协议已启动");
    overlay.innerHTML =
      '<div class="alarm-box">' +
        '<div class="alarm-tag">▣ PRIORITY ALERT · 仅限 3 级权限</div>' +
        "<h2>记忆抹除协议已启动</h2>" +
        '<p>本终端附近的人员将被重新登记。剩余 <b class="alarm-count">3</b> 秒。</p>' +
        '<div class="alarm-bar"><i></i></div>' +
        '<button type="button" class="alarm-skip">我已获授权，继续查看</button>' +
      "</div>";

    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() {
      if (tick) { clearInterval(tick); tick = null; }
      document.removeEventListener("keydown", onKey);
      overlay.classList.add("out");
      setTimeout(() => overlay.remove(), 260);
    }

    overlay.querySelector(".alarm-skip").addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    setTimeout(() => {
      document.body.appendChild(overlay);
      playSound("click");
      const num = overlay.querySelector(".alarm-count");
      tick = setInterval(() => {
        left -= 1;
        if (num) num.textContent = String(Math.max(left, 0));
        if (left <= 0) close();
      }, 1000);
    }, 1400);
  })();

  // ---- 19. 闲置惩罚：30 秒没动 → 屏抖一下，底部浮出一只眼睛 ----
  (function idlePunish() {
    if (prefersReduced()) return;

    const eye = document.createElement("div");
    eye.className = "idle-eye";
    eye.setAttribute("aria-hidden", "true");
    eye.innerHTML = "<i></i>";
    document.body.appendChild(eye);

    const IDLE_MS = 30000;
    let idleTimer = null;
    let hideTimer = null;

    function sleep() {
      if (calmOn()) return;
      document.documentElement.classList.add("idle");
      hideTimer = setTimeout(() => {
        document.documentElement.classList.remove("idle");
        wake();
      }, 2600);
    }

    function wake() {
      document.documentElement.classList.remove("idle");
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      if (calmOn()) return; // 减弱模式不再安排下一次
      idleTimer = setTimeout(sleep, IDLE_MS);
    }

    ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"].forEach((ev) =>
      window.addEventListener(ev, wake, { passive: true })
    );
    wake();
  })();

  // 19. Service Worker：离线可看 + 可装到桌面
  //     只在 https / localhost 下注册——file:// 打开时浏览器直接拒绝，所以先判协议，
  //     注册失败也只吞掉错误：它是增强，不该影响页面本身。
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();