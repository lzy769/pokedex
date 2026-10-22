#!/usr/bin/env node
/**
 * build-imgtags.js —— 图片接线：把 <img> 指向 WebP，并生成 srcset
 *
 * 输入： tools/image-report.json  （Pillow 转 WebP 时实测出来的尺寸）
 * 产出： data/img-info.js          （给 render.js 用的尺寸表 + srcset 拼装函数）
 *        改写各 HTML 里的静态 <img>
 *
 * 用法： node tools/build-imgtags.js
 *
 * 三个刻意的设计：
 *   1. 幂等——已经有 srcset 的 <img> 直接跳过，重复跑不会叠加。
 *   2. 小图不硬凑——原图宽度 ≤ 800 时 `-800.webp` 和全尺寸图一样大，
 *      放进 srcset 只会让浏览器多下一个更差的版本，所以 small 记成 null。
 *   3. 原图（jpg/png）保留不动，作为重新生成 WebP 的母本；
 *      页面上不再引用它们，所以不影响加载体积。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT = path.join(ROOT, "tools", "image-report.json");

/** 不同位置的渲染宽度不一样，sizes 要分开给，否则浏览器会挑错图 */
const SIZES = {
  grid: "(max-width: 560px) 92vw, (max-width: 980px) 46vw, 340px",
  hero: "(max-width: 980px) 92vw, 900px",
  card: "(max-width: 560px) 92vw, (max-width: 980px) 46vw, 300px"
};

/** 哪些 class 的图算"大图"，用 hero 档 sizes */
const HERO_CLASSES = ["work-hero", "corrupted-img", "dynamic-hero", "hero-img", "lb-img"];

function main() {
  const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  const list = Array.isArray(report.images) ? report.images : [];
  if (!list.length) {
    console.error("image-report.json 里没有 images，先跑一次图片转换。");
    process.exit(1);
  }

  /* ---------- 1. 生成 data/img-info.js ---------- */
  const info = {};
  list.forEach((r) => {
    if (!r || !r.src || !r.webp || !r.verified) return;
    const small = r.srcW > 800 && r.small ? r.small : null;
    info[r.src] = { w: r.w, h: r.h, full: r.webp, small: small };
  });

  const keys = Object.keys(info).sort();
  const body = keys
    .map((k) => {
      const i = info[k];
      return "  " + JSON.stringify(k) + ": { w: " + i.w + ", h: " + i.h +
        ", full: " + JSON.stringify(i.full) +
        ", small: " + (i.small ? JSON.stringify(i.small) : "null") + " }";
    })
    .join(",\n");

  const js = `/* 由 tools/build-imgtags.js 生成 —— 不要手改。
 * 数据来自 tools/image-report.json 的实测尺寸。改了图就重跑：
 *     node tools/build-imgtags.js
 *
 * full   = 全尺寸 WebP 文件名
 * small  = 800px 宽的 WebP（原图本身 ≤800 时为 null，因为再缩一次没有意义）
 */
window.IMG_INFO = {
${body}
};

window.SIZES = ${JSON.stringify(SIZES)};

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
`;

  fs.writeFileSync(path.join(ROOT, "data", "img-info.js"), js, "utf8");
  console.log("data/img-info.js：" + keys.length + " 张图（其中 " +
    keys.filter((k) => info[k].small).length + " 张带 -800 小图）");

  /* ---------- 2. 改写静态 <img> ---------- */
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  let touched = [];

  htmlFiles.forEach((f) => {
    const p = path.join(ROOT, f);
    const before = fs.readFileSync(p, "utf8");
    let count = 0;

    const after = before.replace(/<img\b[^>]*>/g, (tag) => {
      if (/\bsrcset\s*=/.test(tag)) return tag;

      const m = tag.match(/\bsrc\s*=\s*"([^"]*)"/);
      if (!m) return tag;
      const src = m[1];
      const rec = info[src];
      if (!rec) return tag; // 不认识的图（含 view.html 的空 src）原样放过

      const cls = (tag.match(/\bclass\s*=\s*"([^"]*)"/) || [null, ""])[1];
      const isHero = HERO_CLASSES.some((c) => cls.split(/\s+/).indexOf(c) >= 0);
      const sizes = isHero ? SIZES.hero : SIZES.grid;

      // webp 尺寸比原图小才换；万一某张 webp 反而更大就保留原图
      const useWebp = rec.full !== src;
      let out = tag
        .replace(/\bsrc\s*=\s*"[^"]*"/, 'src="' + (useWebp ? rec.full : src) + '"');
      // 无论是否有 alt，都补上宽高，避免图片加载时的布局跳动
      if (!/\bwidth\s*=/.test(out)) {
        out = out.replace(/(\bsrc\s*=\s*"[^"]*")/, '$1 width="' + rec.w + '" height="' + rec.h + '"');
      }

      if (useWebp && rec.small && !/\bsizes\s*=/.test(out)) {
        out = out.replace(
          /\bsrc\s*=\s*"([^"]*)"/,
          'src="$1" srcset="' + rec.small + " 800w, " + rec.full + " " + rec.w + 'w" sizes="' + sizes + '"'
        );
      }

      count++;
      return out;
    });

    if (after !== before) {
      fs.writeFileSync(p, after, "utf8");
      touched.push(f + " (" + count + " 张)");
    }
  });

  console.log("改写静态 <img>：" + (touched.length ? touched.join("、") : "无变化"));
}

main();
