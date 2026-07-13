# 导航重构与地图移除设计

日期：2026-07-13

## 概述

移除知识地图功能，重构导航栏，新增分类/标签/项目/技术专栏四个导航项，基于 Hugo 原生 taxonomy 系统实现列表页与详情页。

## 需求

1. 完全移除地图相关功能（D3.js、图谱 JSON、API 端点、模板、CSS、构建脚本）
2. 导航栏顺序：首页、时间线、搜索、分类、标签、项目、技术专栏
3. 分类（category）：大类划分，单选，自由填写
4. 标签（tag）：细分标记，多选，保持现有用法
5. 项目（project）：GitHub 项目关联，单选，文章标记式
6. 技术专栏（column）：独立字段，单选，不从其他字段筛选

## 方案

采用 Hugo 原生 taxonomy 系统。Hugo 自动为每个 taxonomy 生成列表页和详情页，无需自定义构建脚本。

## Front matter 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 是 | 文章所属分类，单选。如 `技术`、`生活`、`历史`、`健康` |
| `tags` | string[] | 否 | 细分标签，多选 |
| `project` | string | 否 | 所属 GitHub 项目名，单选 |
| `column` | string | 否 | 所属技术专栏名，单选 |

`series` 字段废弃，从 taxonomies 中移除。现有文章的 `series` 值删除。

## Hugo 配置

### Taxonomies

```toml
[taxonomies]
  category = "categories"
  tag = "tags"
  project = "projects"
  column = "columns"
```

### 导航菜单

```toml
[[menu.main]]
  name = "首页"
  url = "/"
  weight = 1

[[menu.main]]
  name = "时间线"
  url = "/archives"
  weight = 2

[[menu.main]]
  name = "搜索"
  url = "/search"
  weight = 3

[[menu.main]]
  name = "分类"
  url = "/categories/"
  weight = 4

[[menu.main]]
  name = "标签"
  url = "/tags/"
  weight = 5

[[menu.main]]
  name = "项目"
  url = "/projects/"
  weight = 6

[[menu.main]]
  name = "技术专栏"
  url = "/columns/"
  weight = 7
```

### URL 模式

| Taxonomy | 列表页 URL | 详情页 URL 示例 |
|---|---|---|
| categories | `/categories/` | `/categories/技术/` |
| tags | `/tags/` | `/tags/hugo/` |
| projects | `/projects/` | `/projects/personal-website/` |
| columns | `/columns/` | `/columns/RAG实战/` |

## 页面模板

### 模板文件

| 模板文件 | 用途 | 对应 URL |
|---|---|---|
| `layouts/categories/list.html` | 分类列表页 | `/categories/` |
| `layouts/categories/term.html` | 分类详情页 | `/categories/技术/` |
| `layouts/tags/list.html` | 标签列表页 | `/tags/` |
| `layouts/tags/term.html` | 标签详情页 | `/tags/hugo/` |
| `layouts/projects/list.html` | 项目列表页 | `/projects/` |
| `layouts/projects/term.html` | 项目详情页 | `/projects/personal-website/` |
| `layouts/columns/list.html` | 技术专栏列表页 | `/columns/` |
| `layouts/columns/term.html` | 技术专栏详情页 | `/columns/RAG实战/` |

### 列表页设计

展示某个 taxonomy 下所有项，每项显示名称 + 文章数量，点击跳转详情页。

- 分类列表页：卡片式展示各分类名 + 文章数
- 标签列表页：标签云形式，字体大小按文章数加权
- 项目列表页：卡片式展示项目名 + 文章数
- 技术专栏列表页：卡片式展示专栏名 + 文章数

列表页添加 `data-pagefind-ignore` 属性，不参与搜索索引。

### 详情页设计

展示属于某个 taxonomy 项的所有文章，按日期倒序排列，每篇显示标题、日期、摘要（如有）。与 PaperMod 标准文章列表风格一致。

详情页可被 Pagefind 搜索索引。

### 模板复用

创建两个通用 partial 减少重复：

- `layouts/partials/taxonomy_list.html` — 通用列表页 partial
- `layouts/partials/taxonomy_term.html` — 通用详情页 partial

各 taxonomy 的 `list.html` / `term.html` 调用 partial 并传入 taxonomy 显示名称：

```html
<!-- layouts/categories/list.html -->
{{- define "main" }}
{{- partial "taxonomy_list.html" (dict "Page" . "TaxonomyName" "分类") }}
{{- end }}
```

### 时间线页面

现有归档页（`content/archives.md`，`layout: "archives"`）仅重命名导航菜单项为"时间线"，页面内容和模板不变。

## 地图功能移除

### 移除清单

| 类别 | 文件/内容 | 动作 |
|---|---|---|
| 内容 | `content/map.md` | 删除 |
| 模板 | `layouts/_default/discovery-map.html` | 删除 |
| 前端 TS | `frontend/src/map.ts` | 删除 |
| 编译产物 | `static/js/map.js` | 删除 |
| 第三方库 | `static/js/d3.v7.min.js` | 删除 |
| 构建脚本 | `scripts/build-artifacts.js` | 删除 |
| 服务端 | `server/index.js` 中 `/api/graph` 端点及辅助函数 | 删除 |
| 导航 | `hugo.toml` 中"地图"菜单项 | 删除 |
| 模板 | `extend_head.html` 中 `discovery-map` 条件块 | 删除 |
| CSS | `extended.css` 中 `.map-*` / `.graph-*` / `.pill` / `.node-quick` 样式 | 删除 |
| package.json | `build:artifacts` 脚本 | 删除，`build` 脚本去掉该步骤 |
| 依赖 | `gray-matter` | 从 dependencies 移除 |
| 站点描述 | `hugo.toml` 中 description/keywords/homeInfoParams | 移除"知识地图"文字 |

### 保留

- `frontend/src/common.ts` / `static/js/common.js` — 通用工具函数
- `frontend/src/bootstrap.ts` / `static/js/bootstrap.js` — 前端就绪标记
- `frontend/src/search.ts` / `static/js/search.js` — 搜索页逻辑

## 构建流程变更

**变更前：**
```
build:frontend → build:site → build:artifacts → build:search
```

**变更后：**
```
build:frontend → build:site → build:search
```

`build:artifacts` 步骤移除。`gray-matter` 依赖移除。

## 服务端变更

`server/index.js` 移除：
- `/api/graph` 端点
- `normalizeGraph()`、`pickSubgraph()`、`getStaticGraph()` 函数
- `ART_DIR` 常量
- `readJsonIfExists()` 函数

保留：
- 静态文件服务
- 安全响应头中间件
- 请求 ID 中间件

## 现有文章迁移

| 文件 | category | column | tags | project |
|---|---|---|---|---|
| hello.md | `技术` | - | discovery, mvp | - |
| hugo-quickstart.md | `技术` | - | hugo, 部署, seo, 入门 | - |
| fts5-search.md | `技术` | - | 搜索, sqlite, fts5, hugo | - |
| lancedb-rag.md | `技术` | - | 向量数据库, lancedb, rag, chat | - |
| map-design.md | `技术` | - | 知识图谱, 地图, 实体图, 可视化 | -可视化 | - |
| feedback-iteration.md | `技术` | - | 反馈, 分析, 迭代, 运营 | - |

所有现有文章 `series` 字段删除。

## 站点描述更新

```toml
description = "面向技术内容的个人站点，提供文章发布与分类浏览。"
keywords = ["hugo", "pagefind", "搜索", "分类", "标签"]

[params.homeInfoParams]
  Title = "个人网站"
  Content = "面向技术内容的个人站点，提供文章发布与分类浏览。"
```

## CLAUDE.md 同步更新

需同步更新项目文档，反映：
- 移除地图相关描述
- 新增 taxonomy 系统
- 导航菜单变更
- 构建流程变更
- front matter 字段变更
