/* ------------------------------------------------------------------
 * data/traffic.js —— 站点访问计数（自托管，无第三方统计）
 *
 * 数据来源：仓库根目录的 .github/workflows/traffic.yml 每天调用
 *   GET /repos/{owner}/{repo}/traffic/views
 *   GET /repos/{owner}/{repo}/traffic/clones
 * 把聚合结果写回本文件末尾那一行并提交。不引入任何埋点脚本，
 * 页面不向第三方发请求，也不采集访客标识 —— 数字直接来自 GitHub
 * 自己的仓库流量统计。
 *
 * 口径说明（GitHub 的 traffic 接口只保留最近 14 天）：
 *   views        近 14 天页面访问次数合计（精确值）
 *   uniquePerDay 每天「独立访客」的平均值 —— 逐日去重后再平均；
 *                逐日数字不能相加（同一个人跨天会被重复计数），
 *                所以这里给平均而不是「独立访客总数」。
 *   bestDay      近 14 天里访问量最高的一天 { date, count }
 *   clones       近 14 天仓库克隆次数合计
 *
 * 值为 null 表示还没采集到数据，页面会把这一块整块隐藏（而不是显示 0）。
 * 本地想预览样式，可以临时手工填：
 *   window.TRAFFIC = { updated: "2026-10-21T04:00:00Z", days: 14, views: 1234,
 *                      uniquePerDay: 23, bestDay: { date: "2026-10-19", count: 210 }, clones: 56 };
 * ------------------------------------------------------------------ */
window.TRAFFIC = {"updated":"2026-10-21T04:52:27.959Z","days":14,"views":0,"uniquePerDay":0,"bestDay":{"date":"2026-10-08","count":0},"clones":0};
