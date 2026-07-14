# 个人网站

基于 Hugo + Pagefind + Express 的中文个人知识网站。提供文章发布、分类浏览与客户端全文搜索，面向低资源服务器（2 核 2G）长期稳定运行。无自动生成内容--所有元数据来自作者手写的 front matter。

## 特性

- 文章发布与时间线归档
- 分类浏览：分类（categories）、标签（tags）、项目（projects）、技术专栏（columns）
- 客户端全文搜索（Pagefind，零服务器开销）
- 深色模式（满足 WCAG AA 对比度）
- 安全响应头、速率限制、仅 loopback 绑定
- 全静态产物，可完全重建

## 技术栈

- [Hugo](https://gohugo.io/) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题（git submodule）- 静态站点生成
- [Pagefind](https://pagefind.app/) - 客户端搜索索引（构建时生成）
- Express - 静态文件服务（仅监听 loopback）
- TypeScript - 前端脚本

## 快速开始

```bash
git clone --recurse-submodules <repo-url>
cd personal-website
npm install          # 安装依赖（含 Hugo 二进制）
npm run build        # 全量构建：前端 TS -> Hugo 站点 -> Pagefind 索引
npm run start        # 启动服务，访问 http://localhost:8787/
```

> 若已克隆但未带子模块，执行 `git submodule update --init --recursive`，否则构建报 theme not found。

## 本地预览（热重载）

```bash
npm run dev          # Hugo server，含草稿、热重载，http://localhost:1313/
```

注意：`dev` 不编译前端 TS、不生成 Pagefind 索引（搜索不可用）。完整预览（含搜索）用 `npm run build && npm run start`。

## 构建命令

| 命令 | 说明 |
|---|---|
| `npm run build` | 全量构建：前端 -> 站点 -> 搜索索引 |
| `npm run build:frontend` | 仅编译 TypeScript（`frontend/src` -> `static/js`） |
| `npm run build:site` | 仅生成 Hugo 静态站点 |
| `npm run build:search` | 仅生成 Pagefind 搜索索引 |
| `npm run start` | 启动 Express 服务（端口 8787，loopback） |
| `npm run dev` | Hugo 本地预览（端口 1313，含草稿、热重载） |
| `npm run typecheck:frontend` | 仅类型检查前端 TS，不输出文件 |

内容变更后：`npm run build && npm run start`。每次构建完全重建所有产物，无增量。

## 写文章

文章放在 `content/posts/*.md`。最小 front matter 示例（可直接复制，无需行内注释）：

```markdown
---
title: "文章标题"
date: "2026-07-14"
categories: ["技术"]
tags: ["hugo", "部署"]
description: "文章摘要"
slug: "my-post"
---

正文……
```

### Front matter 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | 字符串 | 是 | 文章标题；缺失时回退为 slug |
| `date` | 字符串 | 否 | 发布日期 |
| `categories` | 数组 | 否 | 分类，约定单选，如 `["技术"]`/`["生活"]`/`["历史"]`/`["健康"]` |
| `tags` | 数组 | 否 | 标签，可多选，用于 Pagefind 标签过滤 |
| `projects` | 数组 | 否 | 关联 GitHub 项目，约定单选，如 `["personal-website"]` |
| `columns` | 数组 | 否 | 技术专栏，约定单选，如 `["Hugo 搭建指南"]` |
| `description` | 字符串 | 否 | 文章摘要，用于搜索结果描述与 RSS/SEO meta（Hugo 的 `.Description` 读取此字段） |
| `slug` | 字符串 | 否 | URL slug；省略时默认取**标题**（如标题 "My Post" -> `/posts/my-post/`），显式设置可缩短 URL |

### 注意事项

- **可选字段直接省略整行，不要填 `""`。**
  - 数组字段（`categories`/`tags`/`projects`/`columns`）尤其不要写 `[""]`：会产生一个空的无效 term，文章页脚出现指向列表页的空标签链接。要表示“无值”，省略该行或写 `[]`。
  - `slug: ""` 与省略等效（都回退到标题）；`description: ""` 表示无摘要。均无意义，直接省略。
- `categories`/`projects`/`columns` 约定单选（数组只放一个元素），作者自律；Hugo taxonomy 本身支持多值。
- 内部链接用相对 `.md` 路径：`[文字](./other.md)`。外部链接（`http://`/`https://`/`mailto:`）正常渲染。
- Markdown 中不可嵌入原始 HTML（Hugo Goldmark `unsafe = false`）。
- front matter 支持 `#` 行内注释（`#` 前须有空格），YAML 会忽略、不影响解析。

### 图片

- 放在 `static/media/<yyyy>/<mm>/`，文件名 `<slug>-<描述>.<ext>`
- 文中引用：`![描述](/media/<yyyy>/<mm>/<slug>-<描述>.<ext>)`
- 格式优先：SVG > WebP > PNG > JPG
- 图片纳入 Git，不使用图床或 Git LFS

## 目录结构

```
content/posts/        文章源文件（数据源头）
content/_index.md     首页标记（首页可见内容见 hugo.toml 的 homeInfoParams）
content/search.md     搜索页
content/archives.md    时间线页
static/media/         图片，按 /<yyyy>/<mm>/<slug>-<desc>.<ext> 组织
static/js/            编译后的前端 JS（来自 frontend/src/，构建时生成）
static/fonts/         自托管字体
frontend/src/         前端 TypeScript 源
layouts/              Hugo 模板（覆盖 PaperMod）
assets/css/extended/  自定义样式（字体、深色模式对比度、taxonomy 卡片）
deploy/               部署配置（Nginx、systemd、安全头 snippet）
hugo.toml             Hugo 配置
server/index.js       Express 静态服务（loopback）
tsconfig.frontend.json 前端 TS 编译配置
public/               构建产物（gitignored，可完全重建）
docs/                 文档（DEPLOY.md、设计文档与实施计划）
themes/PaperMod/       主题（git submodule，pin 在固定 commit）
```

## 搜索

Pagefind 在构建时扫描 HTML 中的 `data-pagefind-body`/`data-pagefind-meta`/`data-pagefind-filter` 属性（由 `layouts/_default/single.html` 模板自动添加），生成索引输出到 `public/pagefind/`。运行时浏览器加载索引分片执行搜索，无需服务器参与。中文分词通过 `--force-language zh` 启用。列表页带 `data-pagefind-ignore` 不参与索引。

搜索页地址：`/search/`，支持 URL 参数 `?q=` 预填查询。

## 部署

详见 [`docs/DEPLOY.md`](docs/DEPLOY.md)（Nginx 反向代理 + systemd，面向 2 核 2G 服务器）。要点：

- Express 仅监听 `127.0.0.1:8787`，不直接暴露公网
- Nginx 直出静态文件并设置安全头，集中在 `deploy/snippets/security-headers.conf`，各 location 通过 `include` 引用
- **安全头 snippet 须复制到服务器 `/etc/nginx/snippets/`，否则 Nginx 启动失败**
- 部署前先 `git submodule update --init --recursive` 初始化主题

## 安全

- CSP：`default-src 'self'; script-src 'self'`（脚本无 `unsafe-inline`）
- X-Frame-Options `DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy`
- 速率限制：Express 120 次/分钟/IP（静态资源防滥用）+ Nginx `/api/` 限流
- Hugo Goldmark `unsafe = false`（禁止 Markdown 内嵌原始 HTML）
- systemd 加固（`NoNewPrivileges`、`ProtectSystem=strict`、`ProtectHome`、`PrivateTmp`）
- HSTS 由 Nginx 层补充（HTTPS 就绪后）

## 备份

仅需备份 `content/` 与 `static/media/`。其余均可通过 `npm run build` 完全重建。

恢复：还原 `content/` 与 `static/media/` -> `npm install` -> `npm run build` -> `npm run start`。

## 开发指引

- [`CLAUDE.md`](CLAUDE.md) - 详细的开发约定（模板覆盖、Pagefind CSS 覆盖、深色模式对比度、taxonomy 约定、安全头机制等），供 Claude Code 与开发者参考
- [`docs/DEPLOY.md`](docs/DEPLOY.md) - 部署指南
- `docs/superpowers/` - 设计文档（specs）与实施计划（plans）
