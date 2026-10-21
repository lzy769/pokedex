# 老可梦图鉴 · 站点公开仓库

这是网站的**发布仓库**：仓库根目录就是站点根目录，GitHub Pages 直接从 `main` 分支发布。

- 线上地址：<https://lzy769.github.io/pokedex/>
- 发布方式：仓库 Settings → Pages → Source = `Deploy from a branch`，分支 `main` / 目录 `/`
- `.nojekyll` 已就位，GitHub 不会拿 Jekyll 处理这些文件

## 这个仓库里有什么

纯静态站点，没有构建步骤、没有依赖、没有后端：

| 路径 | 说明 |
| --- | --- |
| `*.html` | 16 个页面（首页 / 档案室 / 详情页 / 时间线 / 系统结构 / 更新日志 / 404 等） |
| `style.css` `ui.js` `intro.js` | 样式与交互（全部原生，无框架） |
| `data/entries.js` | 11 条档案的唯一数据源（正文、收容措施、附录、照片、标签、时间线） |
| `data/render.js` | 渲染层：把数据变成各页面的 DOM |
| `data/img-info.js` | 图片尺寸表（`srcset` / `sizes` / 宽高） |
| `data/traffic.js` | 访问计数（由 Actions 每天回写，不是手写的） |
| `tools/` | 站内自检脚本（CI 里跑的就是它们） |
| `og-cover.png` `favicon.svg` `icon-*.png` `manifest.webmanifest` `sw.js` | SEO 与 PWA 资源 |

## 自检

仓库自带两套自检，改完东西先跑一遍：

```bash
node tools/check-site.js    # 数据完整性、死链、脚本引入顺序、JS 语法、CSS 括号
node tools/smoke-render.js  # 用极简 DOM 替身跑一遍渲染层，验证卡片/详情/时间线
```

push 到 `main` 之后 `.github/workflows/checks.yml` 会自动跑这两套。

## 自动更新

- `.github/workflows/checks.yml` —— 每次 push / PR 跑自检
- `.github/workflows/traffic.yml` —— 每天北京时间 11:17 把仓库流量数字写回 `data/traffic.js`

## 关于内容

站内档案为**虚构创作**，是「中国乡土恐怖 × 冷幽默」的仿 SCP / 后室风格作品集，
与任何真实机构、地点、人物无关。文中出现的机构名、编号、事故记录均为虚构。

## 来源

站点源文件由开发仓库 `my-site/` 目录发布而来（`node tools/publish-site.js`）。
本仓库是**发布副本**，请不要直接在这里改内容 —— 下次发布会覆盖掉。
