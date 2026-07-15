# 个人知识网站

基于 Hugo + Express 构建的中文个人知识网站。提供文章发布、分类浏览、客户端搜索（Pagefind）。面向低资源服务器长期稳定运行设计。

## 快速开始

```bash
# 克隆仓库（含子模块）
git clone --recurse-submodules <repo-url>
cd personal-website

# 安装依赖（含 Hugo 二进制）
npm install

# 本地预览（含草稿、热重载，端口 1313）
npm run dev

# 全量构建（前端 TS + Hugo + Pagefind 搜索索引）
npm run build

# 启动服务器（端口 8787）
npm run start
```

> 若已克隆但未带子模块，执行 `git submodule update --init --recursive`，否则构建报 theme not found。

内容变更后：`npm run build && npm run start`。

## 项目结构

```
content/posts/          # 文章源文件（按年份子目录）
static/media/          # 图片附件（扁平存放）
_obsidian/             # Obsidian 写作脚手架
layouts/               # Hugo 模板覆盖
frontend/src/          # 前端 TypeScript 源码
server/index.js        # Express 服务器
public/                # 构建产物（可完全重建）
```

## 写文章

### 使用 Obsidian（推荐）

仓库根即 Obsidian vault 根。

**一次性设置：**

1. 设置 → 文件与链接：
   - 附件默认位置：Vault 文件夹 = `static/media`
   - 内部链接类型：基于当前笔记的相对路径
   - 使用 `[[ ]]` Wiki 链接：关闭
2. 设置 → 核心插件 → 时间戳笔记生成器：启用
   - 新建笔记存放位置：`content/posts/2026`（或其他年份）
   - 时间戳格式：`YYYYMMDD-HHmm_`
   - 模板文件位置：`_obsidian/templates/post`
3. 安装社区插件 Dataview（用于写作看板）

**写文流程：**

1. 命令面板（Ctrl/Cmd+P）→ "创建时间戳笔记"
2. 填写 front matter（title/categories/tags/description）
3. 写正文，粘贴图片自动进 `static/media/`
4. `npm run build` → 部署

打开 `_obsidian/dashboard.md` 查看写作看板。
【注】pending的双链要先创建对应笔记再创建双链。

### 手动创建

文章放在 `content/posts/<年>/<时间戳>.md`。最小示例：

```yaml
---
title: "文章标题"
date: "2026-07-14"
categories: ["技术"]
tags: ["hugo", "博客"]
description: "文章摘要"
---

正文……
```

### Front matter 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 文章标题 |
| `date` | 否 | 发布日期 |
| `categories` | 否 | 分类（约定单选），如 `["技术"]`/`["生活"]` |
| `tags` | 否 | 标签（可多选） |
| `description` | 否 | 文章摘要（搜索结果描述） |
| `slug` | 否 | URL slug；省略则用文件名（时间戳） |

**注意：**

- 可选字段省略整行，不要填 `""` 或 `[""]`
- `categories`/`projects`/`columns` 约定单选（数组只放一个元素）
- Markdown 中不可嵌入原始 HTML

### 图片

- 粘贴图片自动落入 `static/media/`，构建时自动改写链接
- 手动添加的图片用 `<时间戳>-<描述>.<ext>` 命名
- 格式优先级：SVG > WebP > PNG > JPG
- 图片纳入 Git，不使用图床或 Git LFS

### 文章互链

Hugo 不自动解析 `.md` 链接，需使用以下方式之一：

```markdown
<!-- 推荐：使用 relref -->
[文字]({{< relref "other.md" >}})

<!-- 或绝对路径 -->
[文字](/posts/slug/)
```

## 构建命令

| 命令 | 作用 |
|---|---|
| `npm run build` | 全量构建：前端 TS → Hugo 站点 → Pagefind 索引 |
| `npm run dev` | Hugo 本地预览（端口 1313，含草稿） |
| `npm run start` | 启动 Express 服务器（端口 8787） |
| `npm run build:site` | 仅 Hugo 构建 |
| `npm run build:search` | 仅 Pagefind 索引 |
| `npm run build:frontend` | 仅前端 TypeScript 编译 |

注意：`dev` 不编译前端 TS、不生成 Pagefind 索引。完整预览用 `npm run build && npm run start`。

## 部署

详见 [docs/DEPLOY.md](docs/DEPLOY.md)。要点：

- Express 仅监听 `127.0.0.1:8787`，不直接暴露公网
- Nginx 反向代理 + systemd 服务
- 部署前先 `git submodule update --init --recursive` 初始化主题
- 安全头 snippet 须复制到 `/etc/nginx/snippets/`

## 备份

仅需备份以下目录，其余均可通过 `npm run build` 重建：

- `content/` — 文章源文件
- `static/media/` — 图片附件

## 技术栈

- **Hugo 0.152.2** — 静态站点生成器
- **PaperMod** — Hugo 主题（git submodule）
- **Express** — 静态文件服务器
- **Pagefind** — 客户端搜索
- **TypeScript** — 前端脚本

## 约定

- **语言**：中文（zh-CN）
- **分类/项目/专栏**：约定单选
- **无自动生成内容**：所有元数据来自手写 front matter
- **图片纳入 Git**：不使用图床或 Git LFS

## 更多文档

- [CLAUDE.md](CLAUDE.md) — 开发约定（模板覆盖、安全头机制等）
- [docs/DEPLOY.md](docs/DEPLOY.md) — 部署指南
