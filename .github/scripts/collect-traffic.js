#!/usr/bin/env node
/* ----------------------------------------------------------------------------
 * .github/scripts/collect-traffic.js
 * ----------------------------------------------------------------------------
 * 由 .github/workflows/traffic.yml 每天调用（在 ubuntu-latest 上，用内置 node）。
 * 也可以在本机手动跑：需要 GH_TOKEN 环境变量（有 repo 读权限的 PAT）。
 *
 * 定位说明：这个文件在开发仓库里是 my-site/tools/ci/collect-traffic.js；
 * 发布时由 tools/publish-site.js 放到「只放网站」那个仓库的 .github/scripts/ 下，
 * 那边仓库根目录就是站点根目录，所以下面按 ../../data/traffic.js 找目标。
 *
 * 做三件事：
 *   1. 读 GitHub 的仓库流量接口（views / clones，各保留最近 14 天）
 *   2. 只把「口径说得清」的数字算出来（见下）
 *   3. 原地替换 data/traffic.js 末尾的 window.TRAFFIC = ... 那一行
 *
 * 口径（宁可少给一个数，也不给一个会误导的数）：
 *   views        近 14 天访问次数合计 —— 逐日相加，精确。
 *   uniquePerDay 逐日「独立访客」的平均值。逐日数字不能相加：
 *                同一个人跨两天各被算一次，相加会得到「比总人数还大」的假数。
 *   bestDay      访问量最高的一天（附日期），页面显示成「单日最高 · 10-19」。
 *   clones       近 14 天克隆次数合计。
 *
 * 接口没有数据时（新仓库 / 14 天内零访问）返回全 0 是正常的，会照实写。
 * 接口报错则退出码 1，让这次 Action 失败并保留上一次的数字（不写半截数据）。
 * ------------------------------------------------------------------------- */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPO)) {
  console.error(`非法 REPO 值，拒绝发送令牌：${REPO}`);
  process.exit(1);
}
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
// __dirname 在线上是 <仓库根>/.github/scripts → 上溯两级就是站点根
const TARGET = path.resolve(__dirname, "../../data/traffic.js");

if (!REPO) {
  console.error("缺少 REPO / GITHUB_REPOSITORY 环境变量");
  process.exit(1);
}
if (!TOKEN) {
  console.error("缺少 GH_TOKEN 环境变量（需要有仓库读权限的令牌）");
  process.exit(1);
}

async function api(pathname) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${pathname}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pokedex-traffic-collector",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${pathname} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return res.json();
}

const sum = (arr, key) => arr.reduce((n, x) => n + (Number(x[key]) || 0), 0);

(async () => {
  const views = await api("traffic/views?per=day");
  // clones 接口在部分仓库上可能 403（权限或频率），拿不到就记 null 而不是让整体失败
  let clones = null;
  try {
    clones = await api("traffic/clones?per=day");
  } catch (e) {
    console.warn("读 clones 失败，本次留空：" + e.message);
  }

  const days = views.views || [];
  const payload = {
    updated: new Date().toISOString(),
    days: days.length,
    views: sum(days, "count"),
    // 逐日独立访客取平均；days 为空时给 0，不留 undefined
    uniquePerDay: days.length ? Math.round(sum(days, "uniques") / days.length) : 0,
    bestDay: days.length
      ? days.reduce((best, d) => (d.count > best.count ? d : best), days[0])
      : null,
    clones: clones ? sum(clones.clones || [], "count") : null,
  };
  if (payload.bestDay) {
    payload.bestDay = { date: String(payload.bestDay.timestamp).slice(0, 10), count: payload.bestDay.count };
  }

  const src = fs.readFileSync(TARGET, "utf8");
  const line = "window.TRAFFIC = " + JSON.stringify(payload) + ";";
  if (!/^window\.TRAFFIC = .*$/m.test(src)) {
    console.error("在 data/traffic.js 里找不到 window.TRAFFIC = ... 那一行，拒绝改写");
    process.exit(1);
  }
  const next = src.replace(/^window\.TRAFFIC = .*$/m, line);
  if (next === src) {
    console.log("数字与上次一致，文件未变。");
  } else {
    fs.writeFileSync(TARGET, next, "utf8");
    console.log("已更新 data/traffic.js：");
  }
  console.log(JSON.stringify(payload, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
