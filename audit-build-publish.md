# 老可梦图鉴（my-site）静态站构建与发布链路审计报告

> 只读审计，未改动任何文件。审计范围：`my-site-audit/` 根目录站点 + `tools/*.js` 构建/校验脚本 + `tools/ci/*.yml` 工作流。
> 规模参考：站点根约 111 个文件（含 4 个视频共 18 MB、25+ 张 WebP 图），`tools/` 下 11 个 JS + 2 个报告。

---

## 0. 链路全景（事实描述）

本地构建链（`tools/build-all.js`，`build-all.js:37-45`）：

```
0 normalize-eol.js      —— 全站文本扫一遍，CRLF → LF（全量读+写）
1 build-feed.js         —— 生成 changelog.html（整份 head 重写）+ feed.xml
2 build-seo.js          —— 16 个 HTML 读改写 head；写 sitemap.xml / robots.txt
3 build-imgtags.js      —— 读 tools/image-report.json；写 data/img-info.js；改 HTML 的 <img>
4 build-pwa.js          —— 写 icon-192/512.png（纯 JS zlib level 9）、manifest、改 HTML head、算 sw.js
[gate] check-site.js    —— 数据校验 + 16 HTML 校验 + 全资产 hash + 每 JS 一个 node --check
[gate] smoke-render.js  —— 用 DOM 替身跑 data/render.js
```

发布链（`tools/publish-site.js`）：

```
node tools/publish-site.js          —— 全量字节比较 + 全量复制到 _publish/，git 不自动执行
cd _publish && git add -A && git commit && git push origin main    —— 手动（publish-site.js:167-173 打印）
GitHub Pages「从分支发布」自动部署
```

CI（`tools/ci/checks.yml` / `tools/ci/traffic.yml`，发布后位于发布仓库 `.github/workflows/`）：

```
checks.yml    push main / PR / dispatch → checkout → node tools/check-site.js → node tools/smoke-render.js
traffic.yml   schedule 03:17 UTC → checkout → node .github/scripts/collect-traffic.js → 有变化则 commit+push data/traffic.js
```

---

## 1. 当前瓶颈判断（按影响排序）

### 🔴 B1（最严重，CI 可靠性）traffic.yml 每次写 `data/traffic.js` 都会让 `check-site` 判 sw.js 过期

- `pwa-lib.js:18-28` `listAssets()` 把 `data/*.js` 全部纳入预缓存清单。
- `pwa-lib.js:46-56` `computeVersion()` 对清单里**每个文件**做 sha256，`sw.js` 里的缓存名 `pokedex-<hash>` 随之变化。
- `traffic.yml:46-50` 每天把新的 `updated/views/clones` 写进 `data/traffic.js` 并 `git push origin main`。
- `checks.yml:13-14` 由 `push: branches: [main]` 触发 → `check-site.js:336-339` 重新 `computeVersion()`，与 `sw.js` 里写死的版本比对 → **判「sw.js 缓存版本过期」并 fail**。

**后果**：只要当天流量数字发生变化，`checks.yml` 就会在流量提交上亮红叉；而 `checks.yml:9-11` 明确写了「只做校验、不做部署」，红叉并不拦发布。结果就是**常驻一个明知是误报的失败勾**，把 check-site 这条防线本身的可信度消耗掉。
证据链：`traffic.yml:51-52` 注释「故意不加 [skip ci]」→ 每次流量提交都会触发 checks；`check-site.js:339` 是硬失败；`pwa-lib.js:24-27` 把 `data/traffic.js` 纳入资产清单。

### 🟠 B2（构建耗时）全资产 hash 被重复计算 3 次

`computeVersion()` 是 O(站点全部字节) 的 sha256 循环（`pwa-lib.js:49-53`，每次循环还会再开一次子 hash），一次构建里被调用 3 遍：

| 位置 | 调用 | 时机 |
|---|---|---|
| `build-pwa.js:241` | `computeVersion(ASSETS)` | 写 sw.js 时 |
| `check-site.js:336` | `computeVersion(listAssets())` | 紧接着校验时 |
| `check-site.js:361` / `:363` | `listAssets()` × 2 次（覆盖度检查） | 同上 |

一次调用 = 全站 WebP/PNG/HTML/JS 全部读一遍并 sha256。量级：25 张 WebP + 图标 + HTML/JS，约 10–15 MB 二进制 → 单次 0.5–1 s；一个完整构建里累计 2–3 s。
说明：`check-site` 里重算是有意为之（防「改了文件没重跑 build-pwa」的漂移，见 `check-site.js:332-340` 注释），但**同一次运行内** `build-pwa` 刚算完、`check-site` 又全量算一遍，是确定性的重复 I/O。

### 🟠 B3（构建耗时）`check-site.js:585-594` 每个 JS 文件 spawn 一个 `node --check`

```
jsFiles.forEach((p) => execFileSync(process.execPath, ["--check", p], { stdio: "inherit" }));
```
项目 JS 约 20 个（`data/*.js` 5 个 + `ui.js` + `intro.js` + `tools/*.js` 11 个 + 生成的 `img-info.js`/`traffic.js`）。每次 `execFileSync` 是一个子进程（node 启动 + 文件解析），量级 30–80 ms/次，合计约 1–2 s。`check-site.js:587-588` 注释说明这是为了兼容受限沙箱（`stdio:'pipe'` 会 EPERM），不是性能考量——沙箱限制下这个写法合理，但在本机/CI（非受限沙箱）里可以合并。

### 🟡 B4（发布耗时）`publish-site.js` 全量字节比较 + 全量复制

- `publish-site.js:131-141`：对 `want`（全站文件）逐个 `fs.statSync` + `fs.readFileSync` 比较 `_publish` 里的对应文件（`same()` 在 `:121-124` 全量读入再 `Buffer.equals`），然后**全部 `copyFileSync` 一遍**（不区分 changed/unchanged）。
- 站内含 4 个视频（合计 18 MB）→ 每次发布都要读+复制这几 MB，量级 1–3 s，且与「是否真有改动」无关。

### 🟡 B5（链路自动化）发布链停在 `_publish`，git 部分靠人手

`publish-site.js:14-17` 明确「不碰 git」，末尾 `:167-173` 只打印 `git add/commit/push` 命令。对单人站点：改完代码 → 跑 `build-all` → 跑 `publish-site` → **手动敲三条 git 命令** → 等 Pages 部署。这条「人肉」环节是当前**端到端延迟**（编辑 → 上线）里占比最大的一段（通常数秒到数分钟），完全可脚本化。

### 🟡 B6（冗余/不可并行）顺序化 spawn + 重复全量读 HTML

- `build-all.js:57-60` 用 `spawnSync` 串行跑 7 个子进程，每次冷启动（node + 模块加载），约 30–60 ms × 7 ≈ 0.5 s 纯开销；且每个脚本都要重新 `require` `data/entries.js` 等（`build-seo.js:30-32`、`check-site.js:56-58` 各自 `global.window={}` + `require`）。
- HTML 文件被全量读改写 **≥ 3 遍**：`build-feed` 重写 1 个 → `build-seo` 读 16 个改 N 个 → `build-imgtags` 读 16 个改 M 个 → `build-pwa` 读 16 个改 K 个 → `check-site` 再读 16 个。每次都是「readdir 全站 + 全读 + 正则 + 写」。这是**结构性的重复 I/O**，但改动收益受站点规模限制（16 个 HTML 全读也就几百 KB，量级 <100 ms/次）。
- 真正的顺序约束只有 `0 normalize-eol → 1 build-feed → 2 build-seo`（`build-feed` 会整份重写 head，`build-seo` 必须后跑补回 canonical/og，见 `build-all.js:10-25`）和「4 build-pwa 必须最后，因为它要算 hash」。`3 build-imgtags`（改 `<img>`）与 `1/2`（改 `<head>`）实际互不冲突，理论上可并行。

### 🟡 B7（CI 结构）`checks.yml` 两步独立跑，无 gate、无缓存

- `checks.yml:26-35`：checkout → 两个 `node tools/*.js` 步骤。无依赖缓存（本仓无 `node_modules`，无收益）、无并发、无产物复用。
- 关键设计缺口：**检查结果不 gate Pages 部署**（`checks.yml:9-11` 明说 Pages 是「从分支发布」，红叉只是事后提示）。这是「构建与发布链路」里最值得商榷的一环——当前链路是「先发布、后检查」，与"发布前把关"的直觉相反；若要 gate 需把 Pages 切到 GitHub Actions 部署（或加一个 `if: always()` 的失败提示 job）。
- `smoke-render.js:57-58` 每个场景删 `require.cache` 后重新 `require` 4 个数据脚本（`entries/img-info/recordings/render`），本身是 O(场景数 × 脚本体量) 的重复执行，但场景仅数个，量级可忽略。

### ⚪ B8（低优先级，代码健康度）生成物自身的细节问题

- **`build-feed.js:218-223` 存在确定的生成缺陷**：生成的 `changelog.html` 在 `<script src="ui.js"></script>`（:218）之后，直接以裸的 `const mainNav = document.getElementById("mainNav");`（:219）开头，`:223` 处还有一个孤立的 `</script>` —— 即这一段 JS 体**缺少对应的 `<script>` 开标签**。产物里这段代码会被浏览器当成普通文本输出，且 `menuToggle` 在该作用域未定义，本页导航折叠功能失效。而 `check-site.js:585-594` 只 `--check` `.js` 文件、`smoke-render.js` 不渲染 changelog.html，**这条路径无人校验**，问题会一直带进线上。
- `build-seo.js:241-265` `sitemap.xml` 使用了 `news:title`（`xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`），但 `<urlset>` 上**没有声明 `xmlns:news`**（`:262-263`），命名空间未绑定 —— 校验器可能报命名空间错误。
- `check-site.js:363` `listAssets().length` 与 `:361` 的过滤结果重复 `listAssets()`，是 B2 之外的又一次目录扫描。
- `build-imgtags.js:115-118` 幂等判断仅查 `srcset`，但 `:116-119` 仍会**无条件重写** `src`/`width`/`height`/`srcset` —— 幂等但不「无写入」。

---

## 2. 可优化点与预估收益（按 ROI 排序）

> 收益量级针对「单人、每次改动都要走一遍完整链」的场景；`build-all` 全链估算约 5–15 s（含子进程 + hash + 语法检查）。

| # | 优化点 | 改动面 | 预估收益 | ROI |
|---|---|---|---|---|
| **R1** | **修掉 traffic → sw.js 过期误报**。把 `data/traffic.js` 从 `listAssets()` 的预缓存清单里剔除（改 `pwa-lib.js:24-27`），或让 `check-site.js:336` 对 `data/traffic.js` 做白名单跳过 | `pwa-lib.js` + `check-site.js` 约 3–5 行 | **消灭每天一个 CI 红叉**，恢复 check-site 防线可信度；顺带让「流量回写」不再触发全量 hash | **最高**（成本极低，收益是「防线可用性」，非秒级性能） |
| **R2** | **发布链补上自动 `git add/commit/push`**。`publish-site.js` 末尾（`:167-173`）把打印的命令改为 `execFileSync('git', ...)`，仅在 `updated.length+added.length+stale.length>0` 时提交 | `publish-site.js` 约 10–15 行 | 端到端「编辑 → 上线」省掉人手 5–30 s，且可避免忘 push | **高**（一次性成本低，收益每次都兑现） |
| **R3** | **给 `computeVersion` 加缓存 / 只算一次**。在 `build-all.js` 里用环境变量或临时文件把 build-pwa 算出的 hash 传给 check-site（或让 check-site 读 `sw.js` 里已有的版本 + 仅对「可能变动的文件」复核）；`check-site.js:336` 与 `:361/:363` 合并成一次 `listAssets()` | `build-all.js` + `check-site.js` + `pwa-lib.js` 约 15 行 | 一次完整构建少 1.5–2 s hash I/O（约 30–40% 构建耗时） | **高** |
| **R4** | **`check-site.js` 的 `node --check` 改为一次进程批量校验**。用 `node --check` 不行就改为 `vm.Script`/`new Function` 逐个 `try/catch`（不 spawn），或在非沙箱路径下保留但用 `stdio:'pipe'` 捕获报错 | `check-site.js:585-594` 约 10 行 | 省约 1–2 s（20 个 spawn） | **中高** |
| **R5** | **`publish-site.js` 只复制 changed 文件**。`:131-141` 已有 `added/updated/unchanged` 三分类，把 `if (APPLY)` 里的 `copyFileSync` 移进 `added`/`updated` 分支即可 | `publish-site.js` 约 5 行 | 无改动发布时省掉 18 MB 的读+写（约 1–3 s） | **中高** |
| **R6** | **`build-all.js` 引入增量/跳过**。加一个基于 `mtime` 或内容摘要的脏文件标记：`--quick` 已存在但不够；可加 `--since <git rev>` 只重跑受影响脚本（RELEASES 没动就跳过 build-feed/seo，`image-report.json` 没动就跳过 imgtags） | `build-all.js` 约 30 行 | 常见「只改数据不改图片」场景从 5–15 s 降到 2–4 s | **中**（复杂度略高，需谨慎保持顺序约束） |
| **R7** | **`checks.yml` 加部署 gate 或失败提示**。要么把 Pages 切到 Actions 部署（deploy job `needs: check`），要么在 check 失败时加一个 `if: failure()` 的提示 job 打日志/通知 | `checks.yml` 约 10 行 | 让「红叉=未部署」成为事实，而非事后通知 | **中**（行为变更，需用户确认部署模式） |
| **R8** | **`traffic.yml` 提交时带 `[skip ci]` 并触发一次 build-pwa**。或者在 `checks.yml` 里对 traffic 提交用 `paths-ignore: data/traffic.js` | `traffic.yml` / `checks.yml` 约 5 行 | 与 R1 互补，避免 traffic 提交重复跑全链自检 | **中** |
| **R9** | **修复 sitemap 的 `xmlns:news` 命名空间**（`build-seo.js:262-263` 加 `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`）与 **修复 `build-feed.js:218-223` 缺 `<script>` 开标签的生成缺陷**（把 `:219-222` 那段 JS 包进 `<script>...</script>`） | `build-seo.js` + `build-feed.js` | 消除可能的校验器报错 / 运行时 JS 报错；**收益偏「正确性」而非「速度」**，但 changelog 那处是**已确认的功能缺陷**（导航折叠失效），应优先修 | **中低**（代码改动小，但要跑一次 build-feed 重生成产物） |
| **R10** | 把 7 个子进程合并成一个 Node 进程内联调用（`build-all.js` 用 `require` 代替 `spawnSync`，共享 `require.cache`），并让 `build-feed`+`build-seo` 与 `build-imgtags` 并行 | `build-all.js` 重构 | 省 7 次 node 冷启动 + 重复 require，约 0.5–1 s；**复杂度高，顺序约束易错**，收益与站点规模相比不成比例 | **低**（不建议优先做） |

---

## 3. 结论

1. **当前链路最大的问题不是"跑得慢"，而是"跑得不对"**：`traffic.yml` 与 `check-site.js` 的缓存版本判定相互冲突，导致 CI 每天一次必然失败的红叉（B1 / R1）。这是本审计里**唯一确定性的功能性缺陷**。
2. **构建耗时**以「重复的全资产 sha256」为主（B2 / R3），其次是 `check-site` 的逐文件 `node --check`（B3 / R4）；两者合计约占一次完整 `build-all` 的 30–50%。
3. **发布链路**的短板是「全量比较 + 全量复制」(`publish-site.js`，B4 / R5) 与「git 部分靠人手」（B5 / R2）。对单人站点，R2（自动化 git）的**端到端收益最直观**。
4. **增量/缓存**（B6 / R6）可行但收益受站点规模限制；**并行化**（R10）复杂度高、顺序约束硬（`build-feed → build-seo`，`build-pwa` 必须最后），不建议在站点规模下优先投入。
5. **`checks.yml` 不 gate 部署**（B7）是当前「发布链路」在可靠性上的最大设计缺口：先发布、后检查，检查失败只能事后知道。若要真正把关，需要把 Pages 部署改为 Actions 驱动。

**建议落地顺序**：R1（消误报）→ R2（自动 push）→ R3+R4（去重复 hash / 合并语法检查）→ R5（增量复制）→ R7（gate 部署，需确认）→ R9（补命名空间 / 核实 changelog 尾部）。