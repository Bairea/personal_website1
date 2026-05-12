# 个人博客技术栈备选方案对比 Spec

## Why
在已有低配自建服务器与“省心、低成本、强 SEO、每日发文”目标下，需要一组可落地的技术栈备选方案，并明确取舍依据，避免后期返工与维护负担。

## What Changes
- 输出不少于 10 个可自建部署的建站方案（技术栈 + 部署拓扑 + 维护成本说明）
- 每个方案必须覆盖：内容生产/发布流程、SEO 策略基线、访问量统计方案、图床方案、备份与安全要点
- 给出默认推荐方案（优先“省心/低维护/资源友好”），并说明适用边界

## Impact
- Affected specs: 部署与运维策略、内容发布流程、统计/分析闭环、媒体资产管理、SEO 基线
- Affected code: 待选（取决于最终方案），可能涉及站点生成器配置、Nginx/Caddy 配置、统计服务与数据库、上传接口/脚本

## ADDED Requirements

### Requirement: 方案覆盖度
系统 SHALL 提供至少 10 个满足约束条件的自建部署方案，且每个方案包含：
- 技术栈组件清单（Web 服务、内容层、可选数据库/缓存、构建/发布方式）
- 资源与运维画像（对 2C/2G/40G/3Mbps 的适配性、常见瓶颈点）
- 访问量统计方案（可自建，提供可分析数据）
- 图床方案（可自建，支持文章图片引用）
- SEO 基线（URL、站点地图、OpenGraph、结构化数据、静态渲染/可抓取性）
- 安全与备份要点（最小权限、上传面、数据与媒体备份）

#### Scenario: Success case
- **WHEN** 用户阅读本 Spec
- **THEN** 能在无需额外澄清的前提下，从候选方案中选择 1 个作为实施方向

### Requirement: 技术栈排除
系统 SHALL 不提出以 PHP、Java 生态为核心的方案作为默认推荐（可作为“对比项”说明但不作为主推）。

### Requirement: 自建优先
系统 SHALL 以自建部署为主线描述，托管平台方案仅作为备选了解项，不作为主要方向。

## 通用前置考虑（所有方案共同适用）

- 域名与 HTTPS：强 SEO 的基本前提是稳定域名与全站 HTTPS；无域名可先用 IP 验证 MVP，但正式上线建议购入低价域名并启用 ACME 自动证书
- 带宽与性能：3Mbps 需要强缓存（静态资源长缓存、HTML 适度缓存）、压缩（Brotli/Gzip）、图片强优化（WebP/AVIF、响应式尺寸、懒加载）
- 统计数据的“可用性”：明确口径（PV/UV、入口来源、页面路径、回访/留存、设备/地区），并保证可导出（CSV/JSON）用于内容迭代
- 图床与媒体资产：优先“本机目录 + 简单上传 + Nginx/Caddy 分发”以降低组件数；需要对象存储能力再引入 MinIO
- 安全基线：反代限流、上传端鉴权、最小化暴露端口、设置安全响应头；统计系统避免采集敏感信息
- 备份基线：至少备份“文章源文件 + 图片目录 + 统计数据库或日志”，并做一次可恢复演练

## 方案对比（至少 10 个）

为便于对比，下列方案均假设：服务器使用 Nginx 或 Caddy 作为统一入口（TLS/压缩/缓存/限流），并将“统计/图床”作为可插拔能力。

### 方案 1（默认推荐）：Hugo SSG + Nginx/Caddy + GoatCounter（或 GoAccess）+ 本机图床
**定位**：极低资源、极低运维、极强 SEO，最贴合“每日发文 + 长期省心”。

- 组件：Hugo（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）/ WebDAV 或 SFTP（上传）
- 发布流程：Markdown（本地）-> Git -> 本地或 CI 构建 -> rsync/scp 同步到服务器静态目录
- 统计：GoatCounter（看板+导出）或 Nginx 日志 + GoAccess（更省资源但偏运维分析）
- 图床：本机静态目录（/media）+ WebDAV（BasicAuth）或 SFTP 上传，文章引用稳定 URL
- SEO：静态 HTML + sitemap/RSS + canonical/OG/结构化数据；URL 可控且可长期稳定
- 安全与备份：上传端鉴权+限流；备份内容仓库、媒体目录、统计数据（DB 或日志）

### 方案 2：Zola SSG + Nginx/Caddy + GoatCounter（或 GoAccess）+ 本机图床
**定位**：与 Hugo 同类但工具不同（Rust 构建），线上同样极轻，适合作为静态方案的第二选择。

- 组件：Zola（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：Markdown -> Zola 构建 -> 同步静态目录
- 统计：GoatCounter 或日志分析
- 图床：本机目录 + WebDAV/SFTP
- SEO：静态 HTML + sitemap/RSS/OG/结构化数据
- 安全与备份：同方案 1；注意锁定主题与构建版本

### 方案 3：Astro SSG + Nginx/Caddy + 自建轻量统计 + 本机图床
**定位**：更现代的组件化前端体验，运行期仍静态托管，兼顾交互与 SEO。

- 组件：Astro（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：MD/MDX -> 构建静态产物 -> 部署
- 统计：GoatCounter 或日志分析（也可选 Umami，但引入 DB 与更高资源开销）
- 图床：本机目录 + WebDAV/SFTP；需要对象存储体验再加 MinIO
- SEO：SSG 静态 HTML；元数据可细粒度控制
- 安全与备份：同方案 1；构建依赖的 Node 生态需锁定版本与依赖

### 方案 4：Eleventy（11ty）SSG + Nginx/Caddy + 自建轻量统计 + 本机图床
**定位**：偏内容组织与模板管线的静态生成器，适合把“数据/标签/系列文章”做得更系统。

- 组件：Eleventy（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：Markdown/数据文件 -> 11ty 构建 -> 静态部署
- 统计：GoatCounter 或 GoAccess
- 图床：本机目录上传；可用脚本自动压缩与重命名
- SEO：静态 HTML + sitemap/RSS/结构化数据
- 安全与备份：同方案 1；Node 依赖需可重复构建（lockfile）

### 方案 5：Hexo SSG + Nginx/Caddy + 自建轻量统计 + 本机图床
**定位**：成熟的博客型 SSG，主题与插件多，上手快，适合快速产出。

- 组件：Hexo（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：Markdown -> Hexo 生成 -> 静态部署
- 统计：GoatCounter 或日志分析
- 图床：本机目录上传；配合图片压缩与批处理工具
- SEO：静态 HTML；主题常自带 SEO 组件但需校验质量
- 安全与备份：同方案 1；插件生态需要定期清理与锁定版本

### 方案 6：Jekyll SSG + Nginx/Caddy + 自建轻量统计 + 本机图床
**定位**：经典静态博客方案，生态稳定，适合偏保守与长期可维护的工具链偏好。

- 组件：Jekyll（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：Markdown -> Jekyll 构建 -> 静态部署
- 统计：GoatCounter 或 GoAccess
- 图床：本机目录 + WebDAV/SFTP 上传
- SEO：静态 HTML + sitemap/RSS/OG
- 安全与备份：同方案 1；Ruby 工具链建议固定版本

### 方案 7：Pelican SSG + Nginx/Caddy + 自建轻量统计 + 本机图床
**定位**：Python 工具链的静态博客生成器，适合你希望用 Python 自动化写作与发布流程。

- 组件：Pelican（构建）/ Nginx 或 Caddy（线上）/ GoatCounter（可选）
- 发布流程：Markdown/ReST -> Pelican 构建 -> 静态部署
- 统计：GoatCounter 或日志分析
- 图床：本机目录上传；可用 Python 脚本做批量优化与发布前校验
- SEO：静态 HTML + sitemap/RSS/OG
- 安全与备份：同方案 1；Python 依赖使用虚拟环境并锁定

### 方案 8：静态站点 + Git 驱动 CMS（Decap CMS）+ 自建 Git（可选 Gitea/Forgejo）+ 自建轻量统计 + 本机图床
**定位**：需要网页后台写作，但不想牺牲静态站点的性能与 SEO；线上仍极轻。

- 组件：任一 SSG（Hugo/Zola/Astro 等）/ Decap CMS（静态管理端）/ Git 服务（可选）/ Nginx 或 Caddy（线上）
- 发布流程：浏览器后台编辑 -> 提交到 Git -> 自动构建 -> 静态部署
- 统计：GoatCounter 或 GoAccess
- 图床：媒体目录与内容同仓库或同服务器；上传通道使用 WebDAV/SFTP（CMS 仅管理引用）
- SEO：静态 HTML 最佳；元数据/结构化数据可控
- 安全与备份：Git 版本化天然利于回滚；仍需备份媒体目录与统计数据；Git 服务暴露面需控制

### 方案 9：WriteFreely（Go）+ SQLite + Nginx/Caddy + 独立统计 + 外置图床
**定位**：更像 CMS 的在线写作/发布体验，但仍保持轻量自建友好。

- 组件：WriteFreely（线上）/ SQLite（存储）/ Nginx 或 Caddy（反代）/ GoatCounter（可选）
- 发布流程：在线编辑/发布；数据落 SQLite（或 MySQL，按需）
- 统计：优先独立 GoatCounter；或用日志分析补齐来源/路径维度
- 图床：建议外置本机媒体目录（独立上传与引用），降低应用上传面与安全风险
- SEO：服务端渲染；可控 URL；sitemap/RSS 取决于产品支持度
- 安全与备份：systemd 管理进程；备份 SQLite 与媒体目录；反代限流与安全头

### 方案 10：Ghost（Node）+ Nginx/Caddy + SQLite/MySQL + 独立统计 + 本机或 MinIO 图床
**定位**：写作后台与主题生态更成熟，但资源与升级维护成本更高，适合“体验优先”。

- 组件：Ghost（线上）/ SQLite 或 MySQL（存储）/ Nginx 或 Caddy（反代）/ GoatCounter（推荐独立）
- 发布流程：Ghost 后台写作与发布；主题可定制
- 统计：独立 GoatCounter（避免侵入业务）；或 Umami（更重）
- 图床：Ghost 本地媒体库（省事）或 MinIO（更像对象存储）
- SEO：主题多自带 SEO，但仍需你校验 sitemap/OG/结构化数据与性能
- 安全与备份：升级策略要明确；备份数据库与媒体；反代限流与安全头

### 方案 11（对比项，不作为主推）：自研轻量博客（Go/Rust）+ SQLite + 内置统计 + 内置图床
**定位**：完全按需求定制（统计口径、图床、工作流），线上资源最可控，但维护成本由你承担。

- 组件：单体服务（SSR 或静态化缓存）/ SQLite / Nginx 或 Caddy
- 发布流程：自建管理端写作（Markdown/富文本）-> SQLite；支持草稿/发布/标签
- 统计：内置 PV/UV/来源/页面维度 + 导出；可做更贴合“内容优化”的指标体系
- 图床：内置上传（按日期/文章分目录）；可选派生图与压缩
- SEO：SSR/静态化；站点地图、RSS、canonical、OG、结构化数据
- 安全与备份：你需要自己覆盖鉴权、上传安全、备份与迁移、漏洞修复

## 统一对比表（摘要）

说明：表格为“面向 2C/2G/3Mbps/40G 与省心优先”的取向性摘要；统计与图床均以“可自建”为前提，默认更偏轻量选项（GoatCounter、WebDAV/SFTP、本机目录），需要更复杂能力时再升级到 MinIO 等组件。

| 方案 | 类型 | 线上形态 | 写作/发布体验 | 统计建议 | 图床建议 | SEO 天然优势 | 资源/运维压力 |
|---|---|---|---|---|---|---|---|
| 1 Hugo | 静态 | 仅 Nginx/Caddy | 本地写作 + Git/脚本发布 | GoatCounter 或 GoAccess | 本机目录 + WebDAV/SFTP | 极强 | 极低 |
| 2 Zola | 静态 | 仅 Nginx/Caddy | 本地写作 + 构建发布 | GoatCounter 或 GoAccess | 本机目录 + WebDAV/SFTP | 极强 | 极低 |
| 3 Astro | 静态 | 仅 Nginx/Caddy | 本地写作 + Node 构建发布 | GoatCounter（优先） | 本机目录（必要时 MinIO） | 很强 | 低（构建更重） |
| 4 11ty | 静态 | 仅 Nginx/Caddy | 本地写作 + 构建发布 | GoatCounter 或 GoAccess | 本机目录 | 很强 | 低（构建中等） |
| 5 Hexo | 静态 | 仅 Nginx/Caddy | 本地写作 + 主题/插件 | GoatCounter | 本机目录 | 很强 | 低（插件维护中等） |
| 6 Jekyll | 静态 | 仅 Nginx/Caddy | 本地写作 + Ruby 构建 | GoatCounter 或 GoAccess | 本机目录 | 很强 | 低（工具链维护） |
| 7 Pelican | 静态 | 仅 Nginx/Caddy | 本地写作 + Python 构建 | GoatCounter 或 GoAccess | 本机目录 | 很强 | 低（工具链维护） |
| 8 SSG + Decap | 静态+后台 | 仅 Nginx/Caddy（可加 Git 服务） | 网页后台写作 + Git 构建发布 | GoatCounter | 本机目录 + WebDAV/SFTP | 极强 | 中（流程更复杂） |
| 9 WriteFreely | 动态轻量 | Go 服务 + SQLite | 在线写作发布 | 独立 GoatCounter | 外置本机目录 | 强 | 中（多一套服务） |
| 10 Ghost | 动态偏重 | Node 服务 + DB | 在线写作发布（成熟） | 独立 GoatCounter | 本机媒体或 MinIO | 强 | 高（升级与资源） |

## 选择建议（面向约束条件的结论）
- 默认推荐：方案 1（Hugo 静态 + Nginx/Caddy + GoatCounter 或 GoAccess + 本机图床）
- 想要网页后台写作但仍保持静态：方案 8（SSG + Decap CMS + Git）
- 想要在线写作但仍轻量：方案 9（WriteFreely + SQLite）
- 体验优先且能接受更高运维：方案 10（Ghost）

## 默认推荐方案落地清单（方案 1）

### MVP（先跑通“每日发文 + SEO + 统计 + 图床”闭环）
- 内容生产：本地 Markdown 写作；统一 frontmatter（标题、日期、标签、摘要、canonical）
- 构建发布：本地构建产物为纯静态目录；用 rsync/scp 覆盖同步到服务器站点目录
- Web 服务：Nginx/Caddy 托管静态目录；开启压缩与静态资源长缓存；HTML 不做激进缓存
- 统计（推荐优先）：GoatCounter 自建一套；站点全局引入统计脚本；确认支持导出与按页面维度查看
- 图床（推荐优先）：服务器本机 /media 目录由 Nginx/Caddy 公开；上传通道使用 WebDAV（BasicAuth）或 SFTP
- SEO 基线：sitemap.xml、RSS、robots.txt、canonical、OG；确保 URL 结构长期不变

### 进阶（面向“省心”和“数据驱动迭代”）
- 指标口径：固定 PV/UV、入口来源、Top 页面、搜索词（若可得）、回访与阅读路径
- 图片优化：上传前压缩与格式转换（优先 WebP/AVIF）；为大图生成多尺寸并在文章中引用合适尺寸
- 安全加固：上传端限流；隐藏目录列表；安全响应头；统计系统后台限制访问来源与强口令
- 备份策略：定期备份内容源文件、媒体目录、统计数据（GoatCounter DB 或日志）；保留多份与可恢复演练
- 运维卫生：日志轮转；磁盘水位告警；关键进程由 systemd 托管；定期升级但控制变更频率

## 实施路线图（先 IP 后域名）

### 阶段 0：用 IP 跑通 MVP（不追求 SEO 极致）
- 静态站点可访问：IP + 端口或 IP + 默认 80
- 图床可用：/media 可访问 + 上传通道可用
- 统计可用：GoatCounter（或 GoAccess）能看到数据并能导出
- 基础安全：反代限流与上传鉴权到位；仅开放必要端口

### 阶段 1：补齐域名与 HTTPS（开始面向 SEO）
- 购买域名并解析到服务器；启用 ACME 自动证书
- 固化 URL 结构与 canonical；生成并提交 sitemap.xml
- 启用缓存与压缩；图片按需做多尺寸与懒加载

### 阶段 2：数据驱动迭代（围绕内容优化）
- 定义内容 KPI：Top 页面、入口来源、转化路径（例如从首页到文章页的点击）
- 每周/每月导出统计数据做复盘：标题、摘要、内链、更新频率等优化
- 对热点文章做版本化更新：在不改 URL 的前提下优化内容与结构化数据

## MODIFIED Requirements
无

## REMOVED Requirements
无
