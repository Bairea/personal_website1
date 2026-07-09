# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概述

中文个人知识网站，基于 Hugo + Express 构建。提供文章发布与展示、客户端搜索（Pagefind）、交互式知识图谱（D3.js）。面向低资源服务器（2核2G）长期稳定运行（10+ 年）设计。无自动生成内容——所有元数据均来自作者手写的 front matter。

### 当前状态

- **搜索**：Pagefind 客户端搜索（已从 FTS5+LanceDB 迁移，旧搜索 API 已移除）
- **图谱**：D3.js 力导向图，数据由构建时生成
- **安全**：Express 仅监听 loopback，CSP/X-Frame-Options/Permissions-Policy 已配置，D3.js 本地化，API 速率限制已启用，Hugo Goldmark `unsafe = false`
- **部署**：已部署到服务器（Ubuntu 24.04, 175.178.87.181）。Nginx 反代 + systemd 服务已配置。HTTP 可用，HTTPS 待域名后配置。部署路径 `/srv/personal-website/`，Node 路径 `/usr/local/bin/node`
- **图片**：按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织，Git 管理，无图床

## 构建与运行命令

```bash
npm install                # 安装依赖（含 Hugo 二进制下载）
npm run build              # 全量构建：前端 TS → Hugo 站点 → 产物（图谱）→ Pagefind 搜索索引
npm run build:frontend     # 仅编译 TypeScript（frontend/src → static/js）
npm run build:site         # 仅生成 Hugo 静态站点
npm run build:artifacts    # 从内容重建图谱 JSON
npm run build:search       # 生成 Pagefind 搜索索引（扫描 public/ 中的 HTML）
npm run start              # 启动 Express 服务器，端口 8787
npm run typecheck:frontend # 仅类型检查前端 TS，不输出文件
```

内容变更后：`npm run build && npm run start`。

## 架构

系统分为两个阶段：**构建时**（生成静态资源与搜索索引）和**运行时**（提供静态文件 + API）。搜索完全在客户端执行，无需服务器端 API。

### 构建时 — `scripts/build-artifacts.js`

通过 gray-matter 读取 `content/posts/*.md`，生成图谱 JSON：

- `graph-internal-links.json` — 节点为文档，边为 `[text](./other.md)` 内链
- `graph-tag-cooccurrence.json` — 节点为标签，边为文档间的共享标签

关键函数：`stripMd()`、`extractLinks()`、`resolveInternalMdLink()`、`normalizeTags()`、`slugFromFilePath()`、`urlFromSlug()`。

### 构建时 — Pagefind（`npx pagefind --site public --force-language zh`）

扫描 Hugo 生成的 HTML，基于 Pagefind 数据属性构建搜索索引：

- `data-pagefind-body`：标记正文区域，仅含此属性的页面被索引
- `data-pagefind-meta="title"`：标题关联为搜索结果元数据
- `data-pagefind-meta="description"`：摘要关联为搜索结果描述
- `data-pagefind-filter="tags"`：标签设为可过滤字段

输出到 `public/pagefind/`（搜索索引 + JS/WASM bundle），运行时由浏览器直接加载。

### 运行时 — `server/index.js`

Express 服务器，端口 8787，仅监听 `127.0.0.1`（配合 Nginx 反向代理使用）。以静态文件方式提供 Hugo 的 `public/`，另有一个 API 端点：

- **`GET /api/graph?kind=links|tags&node_ids=&max_nodes=`**
  - 提供预构建的图谱 JSON，支持可选的子图选取
  - 速率限制：每 IP 每分钟 30 次请求（内存计数器，无外部依赖）

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
| `common.ts` | `escapeHtml()`、`byId<T>()` |
| `search.ts` | 搜索页：加载 PagefindUI 组件，内置防抖/高亮/标签过滤/子结果，支持 URL 参数（`?q=`） |
| `map.ts` | 知识地图：D3.js 力导向图，缩放/拖拽/过滤，节点详情侧边栏，邻居导航，标签/边类型/权重过滤器，图谱类型切换（links/tags），图谱缓存，仿真自动停止 |
| `bootstrap.ts` | 在 `<html>` 上设置 `data-frontend-ts="ready"` |

### 数据流

```
content/posts/*.md  →  Hugo → public/（静态 HTML）
                   →  build-artifacts.js → public/artifacts/graph-*.json
                   →  npx pagefind → public/pagefind/（搜索索引 + JS/WASM）
```

每次 `npm run build` 完全重建所有产物，无增量构建。

### 关键目录

- `content/posts/` — 文章源文件（数据源头）
- `content/_index.md` — 首页内容
- `content/search.md` — 搜索页内容
- `content/map.md` — 地图页内容
- `content/archives.md` — 归档页内容
- `static/media/` — 图片，按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织，引用路径为 `/media/...`
- `static/js/` — 编译后的前端 JS（来自 `frontend/src/`）及本地化的第三方库（d3.v7.min.js）
- `public/` — Hugo 输出 + 产物（gitignored，可完全重建）
- `public/pagefind/` — Pagefind 搜索索引和 JS/WASM bundle（构建时生成）
- `public/artifacts/` — 图谱 JSON
- `docs/` — 项目文档（USAGE.md、DEPLOY.md）
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
- `tags` — 标签数组（用于标签图谱和 Pagefind 标签过滤）
- `summary` — 文章摘要（用于搜索结果描述和图谱节点）
- `series` — 系列分组
- `slug` — URL slug 覆盖（默认：相对于 `content/posts/` 的文件路径）

内部链接：使用相对 `.md` 路径，如 `[文字](./other.md)`。构建时解析为图谱边。外部链接（`http://`、`https://`、`mailto:`）不参与图谱构建。

图片：放在 `static/media/<yyyy>/<mm>/`，文件名为 `<slug>-<描述>.<ext>`，Markdown 中以 `/media/<yyyy>/<mm>/<slug>-<描述>.<ext>` 引用。格式优先 SVG > WebP > PNG > JPG。

## API 响应格式

所有 API 响应遵循：
```json
{ "ok": true, "request_id": "req_...", ... }
{ "ok": false, "request_id": "req_...", "error": "code", "detail": "..." }
```

## 重要约定

- **语言**：中文（zh-CN）。UI 字符串、错误消息和内容均为中文。Hugo `languageCode = "zh-CN"`。
- **无自动生成内容**：所有元数据（summary、tags）来自 front matter。缺失时默认为空——不从正文推断。
- **客户端搜索**：Pagefind 扫描 HTML 中的 `data-pagefind-body`/`data-pagefind-meta`/`data-pagefind-filter` 属性构建索引。中文 CJK 分词通过 `--force-language zh` 启用。
- **图片存储**：图片放 `static/media/`，按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织。格式优先级：SVG > WebP > PNG > JPG。Markdown 中用绝对路径 `/media/...` 引用。图片纳入 Git，不使用图床或 Git LFS。详见 `static/media/README.md` 和 `docs/superpowers/specs/2026-07-06-image-storage-design.md`。
- **Pagefind CSS 覆盖**：`pagefind-ui.css` 内含 `:root` 默认值（`--pagefind-ui-text: #393939` 等），在 `stylesheet.css` 之后加载会覆盖主题变量。通过 `layouts/partials/extend_head.html` 中的内联 `<style>` 块（位于 pagefind-ui.css 之后）确保覆盖生效。修改 Pagefind 主题时须在此处同步。
- **深色模式对比度**：PaperMod 深色模式默认的 `--secondary`/`--content` 偏暗，在 `assets/css/extended/extended.css` 中通过 `:root[data-theme="dark"]` 提亮。修改时须验证 WCAG AA 对比度。
- **Hugo 模板覆盖**：`layouts/_default/single.html` 覆盖 PaperMod 的同名模板，添加 Pagefind 数据属性。修改时须保持与 PaperMod 结构同步。
- **Hugo 主题**：`PaperMod`（见 `hugo.toml`），存储在 gitignored 的 `themes/` 目录。自定义布局：搜索页（`discovery-search`）、地图页（`discovery-map`）。
- **D3.js 本地化**：D3.js 已下载到 `static/js/d3.v7.min.js`，不依赖 CDN。模板 `extend_head.html` 引用 `/js/d3.v7.min.js`。CSP 的 `script-src` 仅允许 `'self'`，无需额外域名。
- **Hugo Goldmark**：`unsafe = false`，禁止 Markdown 中嵌入原始 HTML。若需启用（如 `<details>` 标签），须确保所有内容为作者手写。
- **Express 绑定**：仅监听 `127.0.0.1`，不直接暴露公网。部署时须配合 Nginx 反向代理（见 `deploy/` 目录）。
- **安全响应头**：Express 中间件设置 CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy。Nginx 对静态文件也设置相同安全头（Nginx `add_header` 不继承 server 级别，每个 location 块需单独设置）。HSTS 由 Nginx 层补充（HTTPS 就绪后）。API 速率限制：Nginx 层 `limit_req`（429）+ Express 层 30 次/分钟/IP。请求 ID 使用 `crypto.randomUUID()`。
- **部署约定**：项目部署在 `/srv/personal-website/`，由 `www-data` 用户运行。Node.js 在 `/usr/local/bin/node`（从 nvm 复制，因 `ProtectHome=true` 阻止访问 /home）。systemd 服务文件见 `deploy/personal-website.service`。主题目录（gitignored）需单独复制到部署路径。
- **备份**：仅需备份 `content/` 和 `static/media/`。其余均可通过 `npm run build` 完全重建。

## 依赖

| 包 | 用途 | 稳定性 |
|---|---|---|
| `express` | HTTP 服务器 | 非常稳定，LTS |
| `gray-matter` | Markdown front matter 解析 | 非常稳定 |
| `pagefind` | 客户端搜索索引生成 | 稳定，构建时工具 |
| `hugo-bin` | Hugo 二进制包装 | 稳定 |
| `typescript` | 前端编译 | 非常稳定 |
