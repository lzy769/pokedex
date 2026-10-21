/* 本文件由 tools/build-pwa.js 生成，不要手改 —— 改完再跑一次脚本即可。
 * 缓存版本是预缓存清单的 sha256 前 10 位，所以内容一变版本就变。 */
const CACHE = "pokedex-950632b8ae";
const OFFLINE_URL = "404.html";
const PRECACHE = [
  "1-800.webp",
  "1.webp",
  "10-800.webp",
  "10.webp",
  "11-800.webp",
  "11.webp",
  "2-800.webp",
  "2.webp",
  "3-800.webp",
  "3.webp",
  "4-800.webp",
  "4.png",
  "4.webp",
  "404.html",
  "5-800.webp",
  "5.png",
  "5.webp",
  "6-800.webp",
  "6.png",
  "6.webp",
  "7-800.webp",
  "7.png",
  "7.webp",
  "8-800.webp",
  "8.webp",
  "9-800.webp",
  "9.png",
  "9.webp",
  "about.html",
  "changelog.html",
  "data/entries.js",
  "data/img-info.js",
  "data/render.js",
  "data/traffic.js",
  "favicon.svg",
  "feed.xml",
  "gallery1-800.webp",
  "gallery1.webp",
  "gallery2-800.webp",
  "gallery2.webp",
  "gallery3-800.webp",
  "gallery3.webp",
  "gallery4-800.webp",
  "gallery4.webp",
  "hero-800.webp",
  "hero.webp",
  "hidden.html",
  "icon-192.png",
  "icon-512.png",
  "index.html",
  "intro.js",
  "manifest.webmanifest",
  "og-cover.png",
  "robots.txt",
  "sitemap.html",
  "sitemap.xml",
  "style.css",
  "timeline.html",
  "ui.js",
  "view.html",
  "work1.html",
  "work2.html",
  "work3.html",
  "work4.html",
  "works.html",
  "works1.html",
  "works2.html",
  "works3.html",
  "天主-800.webp",
  "天主.png",
  "天主.webp"
];

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
