# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概述

中文个人知识网站，基于 Hugo + Express 构建。提供文章发布与分类浏览、客户端搜索（Pagefind）。面向低资源服务器（2核2G）长期稳定运行（10+ 年）设计。无自动生成内容——所有元数据均来自作者手写的 front matter。

### 当前状态

- **搜索**：Pagefind 客户端搜索（已从 FTS5+LanceDB 迁移，旧搜索 API 已移除）
- **分类浏览**：Hugo 原生 taxonomy 系统，支持分类（categories）、标签（tags）、项目（projects）、技术专栏（columns）
- **安全**：Express 仅监听 loopback，CSP/X-Frame-Options/Permissions-Policy 已配置，速率限制已启用（静态资源防滥用，120 次/分钟/IP），Hugo Goldmark `unsafe = false`
- **部署**：已部署到服务器（Ubuntu 24.04, 175.178.87.181）。Nginx 反代 + systemd 服务已配置。HTTP 可用，HTTPS 待域名后配置。部署路径 `/srv/personal-website/`，Node 路径 `/usr/local/bin/node`
- **图片**：按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织，Git 管理，无图床

## 构建与运行命令

```bash
npm install                # 安装依赖（含 Hugo 二进制下载）
npm run build              # 全量构建：前端 TS → Hugo 站点 → Pagefind 搜索索引
npm run build:frontend     # 仅编译 TypeScript（frontend/src → static/js）
npm run build:site         # 仅生成 Hugo 静态站点
npm run build:search       # 生成 Pagefind 搜索索引（扫描 public/ 中的 HTML）
npm run start              # 启动 Express 服务器，端口 8787
npm run dev                # Hugo 本地预览（含草稿、热重载，端口 1313；不含前端 TS 与 Pagefind 索引）
npm run typecheck:frontend # 仅类型检查前端 TS，不输出文件
```

内容变更后：`npm run build && npm run start`。

## 架构

系统分为两个阶段：**构建时**（生成静态资源与搜索索引）和**运行时**（提供静态文件）。搜索完全在客户端执行，无需服务器端 API。

### 构建时 — Hugo Taxonomies

Hugo 根据 `hugo.toml` 中的 `[taxonomies]` 配置和文章 front matter 中的 taxonomy 字段，自动生成列表页和详情页：

- `categories` — 分类列表页 `/categories/` + 详情页 `/categories/<name>/`
- `tags` — 标签列表页 `/tags/` + 详情页 `/tags/<name>/`
- `projects` — 项目列表页 `/projects/` + 详情页 `/projects/<name>/`
- `columns` — 技术专栏列表页 `/columns/` + 详情页 `/columns/<name>/`

自定义模板覆盖 PaperMod 默认：
- `layouts/<taxonomy>/list.html` — 调用 `partials/taxonomy_list.html`（卡片式或标签云）
- `layouts/<taxonomy>/term.html` — 调用 `partials/taxonomy_term.html`（文章列表）

列表页添加 `data-pagefind-ignore`，不参与搜索索引。详情页可被 Pagefind 索引。

### 构建时 — Pagefind（`npx pagefind --site public --force-language zh`）

扫描 Hugo 生成的 HTML，基于 Pagefind 数据属性构建搜索索引：

- `data-pagefind-body`：标记正文区域，仅含此属性的页面被索引
- `data-pagefind-meta="title"`：标题关联为搜索结果元数据
- `data-pagefind-meta="description"`：摘要关联为搜索结果描述
- `data-pagefind-filter="tags"`：标签设为可过滤字段

输出到 `public/pagefind/`（搜索索引 + JS/WASM bundle），运行时由浏览器直接加载。

### 运行时 — `server/index.js`

Express 服务器，端口 8787，仅监听 `127.0.0.1`（配合 Nginx 反向代理使用）。以静态文件方式提供 Hugo 的 `public/`。

安全响应头（由 Express 中间件设置，Nginx 层会补充 HSTS）：
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `x-frame-options: DENY`
- `content-security-policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'`
- `permissions-policy: camera=(), microphone=(), geolocation=()`

请求 ID 使用 `crypto.randomUUID()` 生成，不可预测。

搜索完全在客户端执行——浏览器加载 `pagefind.js` 和搜索索引分片，无需服务器参与。

### 前端 — `frontend/src/` → `static/js/`

TypeScript 通过 `tsconfig.frontend.json` 编译（ES2020、strict、DOM lib、moduleResolution: Bundler）。无打包工具——直接以 `<script>` 标签加载编译后的 JS。

| 文件 | 用途 |
|---|---|
| `search.ts` | 搜索页：加载 PagefindUI 组件，内置防抖/高亮/标签过滤/子结果，支持 URL 参数（`?q=`） |

### 数据流

```
content/posts/*.md  →  Hugo → public/（静态 HTML + taxonomy 页面）
                   →  npx pagefind → public/pagefind/（搜索索引 + JS/WASM）
```

每次 `npm run build` 完全重建所有产物，无增量构建。

### 关键目录

- `content/posts/` — 文章源文件（数据源头）
- `content/_index.md` — 首页标记（首页可见内容来自 `hugo.toml` 的 `homeInfoParams`，编辑首页文案改后者）
- `content/search.md` — 搜索页内容
- `content/archives.md` — 时间线页内容
- `static/media/` — 图片，按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织，引用路径为 `/media/...`
- `static/js/` — 编译后的前端 JS（来自 `frontend/src/`）
- `public/` — Hugo 输出（gitignored，可完全重建）
- `public/pagefind/` — Pagefind 搜索索引和 JS/WASM bundle（构建时生成）
- `docs/` — 项目文档（DEPLOY.md 部署指南、superpowers/ 设计文档与实施计划）
- `docs/superpowers/specs/` — 设计文档（搜索迁移、图片存储策略等）
- `docs/superpowers/plans/` — 实施计划
- `deploy/` — 部署配置（Nginx 反代、systemd 服务）

## 环境变量

| 变量 | 默认值 | 用途 |
|---|---|---|
| `PORT` | `8787` | 服务器监听端口 |

## 内容编写

文章放在 `content/posts/*.md`。Front matter 字段：

- `title`（必填）— 文章标题；缺失时回退为 slug
- `date` — 发布日期
- `categories` — 分类数组（约定单选，如 `["技术"]`、`["生活"]`、`["历史"]`、`["健康"]`）
- `tags` — 标签数组（用于细分标记和 Pagefind 标签过滤）
- `projects` — 项目数组（约定单选，关联 GitHub 项目，如 `["personal-website"]`）
- `columns` — 技术专栏数组（约定单选，如 `["Hugo 搭建指南"]`）
- `description` — 文章摘要（用于搜索结果描述）
- `slug` — URL slug 覆盖（省略时默认取标题，如标题 "My Post" -> `/posts/my-post/`；显式设置可缩短 URL）

内部链接：使用相对 `.md` 路径，如 `[文字](./other.md)`。外部链接（`http://`、`https://`、`mailto:`）正常渲染。

图片：放在 `static/media/<yyyy>/<mm>/`，文件名为 `<slug>-<描述>.<ext>`，Markdown 中以 `/media/<yyyy>/<mm>/<slug>-<描述>.<ext>` 引用。格式优先 SVG > WebP > PNG > JPG。

## 重要约定

- **语言**：中文（zh-CN）。UI 字符串、错误消息和内容均为中文。Hugo `languageCode = "zh-CN"`。
- **无自动生成内容**：所有元数据（description、tags、categories）来自 front matter。缺失时默认为空——不从正文推断。
- **客户端搜索**：Pagefind 扫描 HTML 中的 `data-pagefind-body`/`data-pagefind-meta`/`data-pagefind-filter` 属性构建索引。中文 CJK 分词通过 `--force-language zh` 启用。
- **Taxonomy 约定**：`categories`/`projects`/`columns` 约定单选（数组中只有一个元素），作者自律。Hugo taxonomy 本身支持多值。
- **图片存储**：图片放 `static/media/`，按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织。格式优先级：SVG > WebP > PNG > JPG。Markdown 中用绝对路径 `/media/...` 引用。图片纳入 Git，不使用图床或 Git LFS。详见 `static/media/README.md` 和 `docs/superpowers/specs/2026-07-06-image-storage-design.md`。
- **Pagefind CSS 覆盖**：`pagefind-ui.css` 内含 `:root` 默认值（`--pagefind-ui-text: #393939` 等），在 `stylesheet.css` 之后加载会覆盖主题变量。通过 `layouts/partials/extend_head.html` 中的内联 `<style>` 块（位于 pagefind-ui.css 之后）确保覆盖生效。修改 Pagefind 主题时须在此处同步。
- **深色模式对比度**：PaperMod 深色模式默认的 `--secondary`/`--content` 偏暗，在 `assets/css/extended/extended.css` 中通过 `:root[data-theme="dark"]` 提亮。修改时须验证 WCAG AA 对比度。
- **Hugo 模板覆盖**：`layouts/_default/single.html` 覆盖 PaperMod 的同名模板，添加 Pagefind 数据属性和 taxonomy 链接。修改时须保持与 PaperMod 结构同步。
- **Hugo 主题**：`PaperMod`（见 `hugo.toml`），以 git submodule 形式嵌入 `themes/PaperMod`（pin 在固定 commit，见 `.gitmodules`）。克隆或部署须先执行 `git submodule update --init --recursive`，否则 `hugo` 构建报 theme not found。自定义布局：搜索页（`discovery-search`）、taxonomy 列表页/详情页。
- **Hugo Goldmark**：`unsafe = false`，禁止 Markdown 中嵌入原始 HTML。若需启用（如 `<details>` 标签），须确保所有内容为作者手写。
- **Express 绑定**：仅监听 `127.0.0.1`，不直接暴露公网。部署时须配合 Nginx 反向代理（见 `deploy/` 目录）。
- **安全响应头**：Express 中间件设置 CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy。Nginx 对静态文件也设置相同安全头，集中在 `deploy/snippets/security-headers.conf`，各 location 通过 `include` 引用（Nginx `add_header` 不继承 server 级别；部署须复制 snippet 到 `/etc/nginx/snippets/`，否则 Nginx 启动失败）。HSTS 由 Nginx 层补充（HTTPS 就绪后）。API 速率限制：Nginx 层 `limit_req`（429，针对 `/api/`）+ Express 层 120 次/分钟/IP（静态资源防滥用基线；原 30 次/分钟针对已移除的 API，全局 30 会误伤静态浏览）。请求 ID 使用 `crypto.randomUUID()`。
- **部署约定**：项目部署在 `/srv/personal-website/`，由 `www-data` 用户运行。Node.js 在 `/usr/local/bin/node`（从 nvm 复制，因 `ProtectHome=true` 阻止访问 /home）。systemd 服务文件见 `deploy/personal-website.service`。主题为 git submodule，部署时须先 `git submodule update --init --recursive` 初始化（详见 `docs/DEPLOY.md`）。
- **备份**：仅需备份 `content/` 和 `static/media/`。其余均可通过 `npm run build` 完全重建。

## 依赖

| 包 | 用途 | 稳定性 |
|---|---|---|
| `express` | HTTP 服务器 | 非常稳定，LTS |
| `pagefind` | 客户端搜索索引生成 | 稳定，构建时工具 |
| `hugo-bin` | Hugo 二进制包装 | 稳定 |
| `typescript` | 前端编译 | 非常稳定 |
