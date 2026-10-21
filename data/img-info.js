/* 由 tools/build-imgtags.js 生成 —— 不要手改。
 * 数据来自 tools/image-report.json 的实测尺寸。改了图就重跑：
 *     node tools/build-imgtags.js
 *
 * full   = 全尺寸 WebP 文件名
 * small  = 800px 宽的 WebP（原图本身 ≤800 时为 null，因为再缩一次没有意义）
 */
window.IMG_INFO = {
  "1.jpg": { w: 652, h: 652, full: "1.webp", small: null },
  "10.jpg": { w: 1080, h: 1902, full: "10.webp", small: "10-800.webp" },
  "11.jpg": { w: 1920, h: 1080, full: "11.webp", small: "11-800.webp" },
  "2.jpg": { w: 868, h: 1920, full: "2.webp", small: "2-800.webp" },
  "3.jpg": { w: 568, h: 1024, full: "3.webp", small: null },
  "4.png": { w: 1440, h: 1920, full: "4.webp", small: "4-800.webp" },
  "5.png": { w: 1280, h: 960, full: "5.webp", small: "5-800.webp" },
  "6.png": { w: 1280, h: 960, full: "6.webp", small: "6-800.webp" },
  "7.png": { w: 661, h: 1920, full: "7.webp", small: null },
  "8.jpg": { w: 886, h: 1920, full: "8.webp", small: "8-800.webp" },
  "9.png": { w: 1080, h: 1920, full: "9.webp", small: "9-800.webp" },
  "gallery1.jpg": { w: 1280, h: 1707, full: "gallery1.webp", small: "gallery1-800.webp" },
  "gallery2.jpg": { w: 1206, h: 2622, full: "gallery2.webp", small: "gallery2-800.webp" },
  "gallery3.jpg": { w: 1280, h: 1706, full: "gallery3.webp", small: "gallery3-800.webp" },
  "gallery4.jpg": { w: 1920, h: 1080, full: "gallery4.webp", small: "gallery4-800.webp" },
  "hero.jpg": { w: 1920, h: 1080, full: "hero.webp", small: "hero-800.webp" },
  "天主.png": { w: 719, h: 991, full: "天主.webp", small: null }
};

window.SIZES = {"grid":"(max-width: 560px) 92vw, (max-width: 980px) 46vw, 340px","hero":"(max-width: 980px) 92vw, 900px","card":"(max-width: 560px) 92vw, (max-width: 980px) 46vw, 300px"};

/** 取某个原图名（如 "5.png"）对应的 srcset 字符串；没有就返回空串 */
window.imgSrcset = function (name) {
  var i = window.IMG_INFO && window.IMG_INFO[name];
  if (!i || !i.small) return "";
  return i.small + " 800w, " + i.full + " " + i.w + "w";
};

/** 取全尺寸 WebP 名；没有记录就返回原文件名，保证老图还能显示 */
window.imgFull = function (name) {
  var i = window.IMG_INFO && window.IMG_INFO[name];
  return i ? i.full : name;
};
