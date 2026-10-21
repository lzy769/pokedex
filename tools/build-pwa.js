/* ============================================================================
 * 老可梦图鉴 · PWA 构建（离线可用 + 可安装到桌面）
 * ----------------------------------------------------------------------------
 * 用法（在 my-site 目录下）：
 *     node tools/build-pwa.js
 *
 * 幂等：重复跑只会覆盖自己生成的那几个文件，不会重复插入 <link>。
 *
 * 产物：
 *   - icon-192.png / icon-512.png   程序生成，不依赖任何图像库
 *   - manifest.webmanifest          安装信息（名字 / 配色 / 图标）
 *   - sw.js                         Service Worker，预缓存清单在这里面
 *   - 给每个 HTML 的 <head> 补 <link rel="manifest"> 与 <meta name="theme-color">
 *
 * 缓存版本是算出来的：把所有预缓存文件的名字 + 字节数 + 修改时间喂给 sha256，
 * 取前 10 位当缓存名前缀。也就是说「改了任何一个文件 → sw.js 内容变化 →
 * 浏览器发现新 SW → 重新预缓存并丢掉旧缓存」，不需要手工维护版本号。
 *
 * 注意：Service Worker 只在 https 或 localhost 下生效，直接双击打开 html
 * （file://）时浏览器会拒绝注册，ui.js 里已经做了协议判断，不会报错。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { listAssets, computeVersion } = require("./pwa-lib");

const ROOT = path.resolve(__dirname, "..");
const p = (rel) => path.join(ROOT, rel);
const say = (m) => console.log("  " + m);

/** 内容相同就不落盘，保持脚本幂等（重复跑不产生无意义的改动） */
function writeIfChanged(file, text) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old === text) return false;
  fs.writeFileSync(file, text, "utf8");
  return true;
}

/* ---------------------------------------------------------------------------
 * 1. 极简 PNG 编码器（zlib + 手写 CRC32），省掉 sharp/canvas 这类原生依赖
 * ------------------------------------------------------------------------ */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, w, h, rgba) {
  // PNG 每行前面要加一个 filter 字节，这里统一用 0（无滤波）
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  // 内容一样就不落盘：缓存版本是拿 mtime 算的，白写一次会让所有访客重下一次缓存
  const old = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (!old || !old.equals(png)) fs.writeFileSync(file, png);
  return { bytes: png.length, changed: !old || !old.equals(png) };
}

/* ---------------------------------------------------------------------------
 * 2. 图标：与 favicon.svg 同一套语言（暗底 + 琥珀边框 + 中心红点）
 *    maskable 安全区是中间 80%，所以内容全部收在 12% 边距以内。
 * ------------------------------------------------------------------------ */
const hex2rgb = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

function drawIcon(size) {
  const BG = hex2rgb("#0a0a08");
  const AMBER = hex2rgb("#d9a13b");
  const RED = hex2rgb("#b33227");
  const px = Buffer.alloc(size * size * 4);

  const set = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const al = a === undefined ? 1 : a;
    if (px[i + 3] === 0) {
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    } else {
      px[i] = Math.round(px[i] * (1 - al) + c[0] * al);
      px[i + 1] = Math.round(px[i + 1] * (1 - al) + c[1] * al);
      px[i + 2] = Math.round(px[i + 2] * (1 - al) + c[2] * al);
    }
    px[i + 3] = 255;
  };

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  // 极淡的扫描线，让它看起来像一块屏幕而不是一块色板
  const step = Math.max(4, Math.round(size / 48));
  for (let y = 0; y < size; y += step * 2) {
    for (let x = 0; x < size; x++) set(x, y, [235, 225, 200], 0.035);
  }

  // 外框
  const inset = Math.round(size * 0.12);
  const thick = Math.max(2, Math.round(size * 0.022));
  for (let t = 0; t < thick; t++) {
    const lo = inset + t;
    const hi = size - 1 - inset - t;
    for (let x = lo; x <= hi; x++) { set(x, lo, AMBER); set(x, hi, AMBER); }
    for (let y = lo; y <= hi; y++) { set(lo, y, AMBER); set(hi, y, AMBER); }
  }

  // 中心的红点：设备上那颗录制指示灯
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size * 0.11;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) set(x, y, RED, d > r - 1.5 ? 0.5 : 1);
    }
  }
  return px;
}

console.log("1. 生成图标");
[192, 512].forEach((size) => {
  const r = writePng(p(`icon-${size}.png`), size, size, drawIcon(size));
  say(`icon-${size}.png  ${size}×${size}  ${(r.bytes / 1024).toFixed(1)} KB  ${r.changed ? "已更新" : "无变化"}`);
});

/* ---------------------------------------------------------------------------
 * 3. 预缓存清单（与 check-site.js 共用 tools/pwa-lib.js，避免两边规则不一致）
 *    刻意排除：bgm.mp3（5 MB，装着让安装包变大，改成用的时候再进运行时缓存）、
 *    tools/ 与 _* 临时目录、sw.js 自己。
 * ------------------------------------------------------------------------ */
const ASSETS = listAssets();

console.log("\n2. 计算缓存版本");
const VERSION = computeVersion(ASSETS);
say(`${ASSETS.length} 个文件 → 版本 ${VERSION}`);

/* ---------------------------------------------------------------------------
 * 4. manifest
 * ------------------------------------------------------------------------ */
const MANIFEST = {
  name: "老可梦图鉴 · Old Pokémon Pokédex",
  short_name: "老可梦图鉴",
  description: "一份不该被公开查阅的档案库。11 条记录，3 个档案室，越早的事越不可靠。",
  lang: "zh-CN",
  start_url: "index.html",
  scope: "./",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: "#0a0a08",
  theme_color: "#0a0a08",
  categories: ["education", "entertainment"],
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

const manifestChanged = writeIfChanged(p("manifest.webmanifest"), JSON.stringify(MANIFEST, null, 2) + "\n");
console.log("\n3. manifest.webmanifest");
say(`name = ${MANIFEST.name}`);
say(`icons = ${MANIFEST.icons.length} 条（含 1 条 maskable）`);
say(manifestChanged ? "已更新" : "无变化");

/* ---------------------------------------------------------------------------
 * 5. Service Worker
 * ------------------------------------------------------------------------ */
const SW = `/* 本文件由 tools/build-pwa.js 生成，不要手改 —— 改完再跑一次脚本即可。
 * 缓存版本是预缓存清单的 sha256 前 10 位，所以内容一变版本就变。 */
const CACHE = "pokedex-${VERSION}";
const OFFLINE_URL = "404.html";
const PRECACHE = ${JSON.stringify(ASSETS, null, 2).replace(/\n/g, "\n")};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 逐个 add：某一张图挂了不至于让整次安装失败
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：先走网络（保证看到的是最新内容），断网再退回缓存与离线页
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // 其余静态资源：缓存优先，未命中再联网并顺手存下来
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
`;

const swChanged = writeIfChanged(p("sw.js"), SW);
console.log("\n4. sw.js");
say(`缓存名 ${"pokedex-" + VERSION}`);
say(`预缓存 ${ASSETS.length} 个文件（不含 bgm.mp3，音频走运行时缓存）`);
say(swChanged ? "已更新" : "无变化");

/* ---------------------------------------------------------------------------
 * 6. 给每个 HTML 补 manifest / theme-color（幂等）
 * ------------------------------------------------------------------------ */
console.log("\n5. 页面接线");

const HEAD_ADD =
  '<link rel="manifest" href="manifest.webmanifest">\n' +
  '  <meta name="theme-color" content="#0a0a08">\n' +
  '  <meta name="apple-mobile-web-app-title" content="老可梦图鉴">\n';

let touched = 0;
let skipped = 0;

fs.readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort()
  .forEach((file) => {
    let html = fs.readFileSync(p(file), "utf8");
    if (html.includes('rel="manifest"')) { skipped++; return; }
    if (!/<\/head>/.test(html)) { say(`[跳过] ${file} 没有 </head>`); return; }
    // 插在 </head> 之前，保持缩进一致
    html = html.replace(/\n?(\s*)<\/head>/, "\n  " + HEAD_ADD + "</head>");
    fs.writeFileSync(p(file), html, "utf8");
    touched++;
  });

say(`写入 ${touched} 个页面，跳过 ${skipped} 个（已接线）`);

/* ---------------------------------------------------------------------------
 * 汇总
 * ------------------------------------------------------------------------ */
console.log("\n" + "=".repeat(56));
console.log(`PWA 产物就绪：缓存版本 ${VERSION}`);
console.log("提示：Service Worker 只在 https / localhost 生效，file:// 下浏览器会拒绝注册。");
