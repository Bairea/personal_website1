# 导航重构与地图移除 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除地图功能，重构导航栏为首页/时间线/搜索/分类/标签/项目/技术专栏，基于 Hugo 原生 taxonomy 实现列表页与详情页。

**Architecture:** 利用 Hugo 内置 taxonomy 系统，通过 `hugo.toml` 注册 category/tag/project/column 四个 taxonomy，创建自定义模板覆盖 PaperMod 默认的 taxonomy.html 和 list.html，实现分类列表页（卡片式/标签云）和详情页（文章列表）。同时移除所有地图相关代码（D3.js、图谱 JSON、API 端点、构建脚本）。

**Tech Stack:** Hugo taxonomies, PaperMod theme, Go template, Express.js, TypeScript, Pagefind

## Global Constraints

- 语言：中文（zh-CN），UI 字符串和错误消息均为中文
- Hugo Goldmark `unsafe = false`
- Express 仅监听 `127.0.0.1`
- 安全响应头由 Express 中间件设置
- Git commit message 使用英文，AngularJS/Conventional Commits 格式，无 AI 署名
- 代码中禁止 Emoji
- category/project/column 约定单选（作者自律，Hugo taxonomy 本身多值）
- 列表页添加 `data-pagefind-ignore`，详情页可被 Pagefind 索引

---

### Task 1: 移除地图相关文件

**Files:**
- Delete: `content/map.md`
- Delete: `layouts/_default/discovery-map.html`
- Delete: `frontend/src/map.ts`
- Delete: `static/js/map.js`
- Delete: `static/js/d3.v7.min.js`
- Delete: `scripts/build-artifacts.js`

**Interfaces:**
- Consumes: 无
- Produces: 干净的文件系统，无地图残留

- [ ] **Step 1: 删除地图内容页**

```bash
rm content/map.md
```

- [ ] **Step 2: 删除地图模板**

```bash
rm layouts/_default/discovery-map.html
```

- [ ] **Step 3: 删除地图前端代码和编译产物**

```bash
rm frontend/src/map.ts
rm static/js/map.js
rm static/js/d3.v7.min.js
```

- [ ] **Step 4: 删除图谱构建脚本**

```bash
rm scripts/build-artifacts.js
```

- [ ] **Step 5: 验证删除完成**

```bash
# 确认以上文件均已删除
ls content/map.md layouts/_default/discovery-map.html frontend/src/map.ts static/js/map.js static/js/d3.v7.min.js scripts/build-artifacts.js 2>&1
```

Expected: 所有路径报 "No such file or directory"

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore(map): remove map feature files and build script"
```

---

### Task 2: 清理服务端地图 API

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Consumes: Task 1 的删除结果（确认 build-artifacts.js 已删除）
- Produces: 精简的 Express 服务器，仅保留静态文件服务 + 安全头 + 请求 ID

- [ ] **Step 1: 重写 server/index.js，移除所有图谱相关代码**

将 `server/index.js` 替换为以下内容（移除 `readJsonIfExists`、`parseTags`、`normalizeGraph`、`pickSubgraph`、`getStaticGraph`、`/api/graph` 端点、`ART_DIR` 常量）：

```javascript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

function makeRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** In-memory rate limiter — no dependencies, sufficient for a single-process low-resource server. */
function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of hits) {
      if (entry.resetAt <= cutoff) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader("x-ratelimit-limit", String(max));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader("retry-after", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        ok: false,
        request_id: res.locals.requestId || "",
        error: "rate_limited",
        detail: "请求过于频繁，请稍后再试",
      });
    }
    next();
  };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.locals.requestId = makeRequestId();
  res.setHeader("x-request-id", res.locals.requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, "127.0.0.1", () => {
  console.log(`http://localhost:${port}`);
});
```

- [ ] **Step 2: 验证服务器可启动**

```bash
npm run build:site && npm run start &
sleep 2
curl -s http://localhost:8787/ | head -5
curl -s http://localhost:8787/api/graph 2>&1 | head -3
kill %1
```

Expected: 首页返回 HTML；`/api/graph` 返回 404（端点已移除）

- [ ] **Step 3: 提交**

```bash
git add server/index.js
git commit -m "refactor(server): remove graph API endpoint and helpers"
```

---

### Task 3: 清理构建配置和依赖

**Files:**
- Modify: `package.json`
- Modify: `layouts/partials/extend_head.html`
- Modify: `assets/css/extended/extended.css`

**Interfaces:**
- Consumes: Task 1 的删除结果
- Produces: 无 build:artifacts 的构建流程，无地图 CSS/JS 加载

- [ ] **Step 1: 更新 package.json — 移除 build:artifacts 和 gray-matter**

将 `package.json` 替换为：

```json
{
  "name": "personal-website",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "npm run build:frontend && npm run build:site && npm run build:search",
    "build:frontend": "tsc -p tsconfig.frontend.json",
    "build:site": "hugo --cleanDestinationDir",
    "build:search": "npx pagefind --site public --force-language zh",
    "typecheck:frontend": "tsc -p tsconfig.frontend.json --noEmit",
    "start": "node server/index.js"
  },
  "devDependencies": {
    "hugo-bin": "^0.149.2",
    "typescript": "^5.9.2"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pagefind": "^1.5.2"
  }
}
```

- [ ] **Step 2: 更新 extend_head.html — 移除地图条件块**

将 `layouts/partials/extend_head.html` 替换为（仅保留搜索相关部分）：

```html
{{- /* Search page: load Pagefind */ -}}
{{- if eq .Layout "discovery-search" -}}
<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<script src="/pagefind/pagefind-ui.js"></script>
<style>
  /* Override Pagefind UI defaults after pagefind-ui.css loads.
     Pagefind's :root sets --pagefind-ui-text:#393939 etc. which is
     near-black and invisible in dark mode. We must override here
     because this <style> block comes AFTER pagefind-ui.css. */
  :root {
    --pagefind-ui-scale: 1;
    --pagefind-ui-text: var(--primary);
    --pagefind-ui-primary: var(--primary);
    --pagefind-ui-background: var(--entry);
    --pagefind-ui-border: var(--border);
    --pagefind-ui-tag: var(--tertiary);
    --pagefind-ui-border-width: 1px;
    --pagefind-ui-border-radius: var(--radius);
    --pagefind-ui-image-border-radius: var(--radius);
    --pagefind-ui-image-box-ratio: 40%;
    --pagefind-ui-font: inherit;
  }
  :root[data-theme="dark"] {
    --pagefind-ui-text: rgb(228, 228, 229);
    --pagefind-ui-primary: rgb(228, 228, 229);
    --pagefind-ui-background: rgb(46, 46, 51);
    --pagefind-ui-border: rgb(70, 70, 72);
    --pagefind-ui-tag: rgb(88, 89, 91);
  }
  :root[data-theme="dark"] .pagefind-ui__result-excerpt {
    color: rgb(210, 210, 211);
  }
  :root[data-theme="dark"] .pagefind-ui__filter-label,
  :root[data-theme="dark"] .pagefind-ui__result-tag {
    color: rgb(228, 228, 229);
  }
  :root[data-theme="dark"] .pagefind-ui__filter-checkbox {
    border-color: rgb(100, 100, 102);
  }
  :root[data-theme="dark"] .pagefind-ui__search-input {
    color: rgb(228, 228, 229);
  }
  :root[data-theme="dark"] .pagefind-ui__search-input::placeholder {
    color: rgba(228, 228, 229, 0.4);
  }
  :root[data-theme="dark"] .pagefind-ui__search-clear {
    color: rgb(228, 228, 229);
  }
  :root[data-theme="dark"] .pagefind-ui__message {
    color: rgb(228, 228, 229);
  }
  :root[data-theme="dark"] .pagefind-ui__filter-name {
    color: rgb(228, 228, 229);
  }
  :root[data-theme="dark"] .pagefind-ui__button {
    color: rgb(228, 228, 229);
    border-color: rgb(100, 100, 102);
  }
  :root[data-theme="dark"] .pagefind-ui__button:hover {
    border-color: rgb(228, 228, 229);
    color: rgb(228, 228, 229);
  }
  /* Highlight mark in search results */
  :root[data-theme="dark"] .pagefind-ui mark {
    background: rgba(228, 228, 229, 0.25);
    color: rgb(240, 240, 241);
  }
</style>
<script src="/js/search.js"></script>
{{- end -}}
```

- [ ] **Step 3: 更新 extended.css — 移除地图样式，保留搜索和深色模式样式**

将 `assets/css/extended/extended.css` 替换为：

```css
/* ========================================
   Custom styles for search page
   ======================================== */

/* --- Pagefind UI theme --- */
/* Pagefind CSS variables are overridden in layouts/partials/extend_head.html
   via an inline <style> block AFTER pagefind-ui.css loads.
   This ensures we win the cascade against Pagefind's built-in :root defaults. */

:root {
  --pagefind-ui-scale: 1;
  --pagefind-ui-text: var(--primary);
  --pagefind-ui-primary: var(--primary);
  --pagefind-ui-background: var(--entry);
  --pagefind-ui-border: var(--border);
  --pagefind-ui-tag: var(--tertiary);
  --pagefind-ui-border-width: 1px;
  --pagefind-ui-border-radius: var(--radius);
  --pagefind-ui-image-border-radius: var(--radius);
  --pagefind-ui-image-box-ratio: 40%;
  --pagefind-ui-font: inherit;
}

/* --- Dark mode contrast fix --- */
/* PaperMod dark defaults:
     --primary   rgb(218,218,219) ~ 6.9:1  (OK for large text, marginal for body)
     --secondary rgb(155,156,157) ~ 4.1:1  (FAILS AA)
     --content   rgb(196,196,197) ~ 5.8:1  (barely AA, fails AAA)
     --tertiary  rgb(65,66,68)               (tag/filter bg — too dark, text on it invisible)
   Fix: brighten secondary/content for readability; brighten tertiary so tags are legible;
   brighten primary slightly so Pagefind excerpts (which inherit --pagefind-ui-text) are clear. */

:root[data-theme="dark"] {
  --primary: rgb(228, 228, 229);             /* ~8.5:1 — strong for titles, links, Pagefind text */
  --secondary: rgb(175, 176, 177);           /* ~4.6:1 — passes AA for meta/breadcrumbs */
  --content: rgb(210, 210, 211);             /* ~7.3:1 — passes AAA for body text */
  --tertiary: rgb(88, 89, 91);               /* tag/filter bg — light enough for text on top */
}

.custom-search {
    max-width: 600px;
    margin: 0 auto;
}

/* --- Taxonomy list page --- */

.taxonomy-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
}

.taxonomy-card {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--entry);
    color: var(--primary);
    text-decoration: none;
    font-size: 0.95rem;
    transition: border-color 0.2s;
}

.taxonomy-card:hover {
    border-color: var(--secondary);
}

.taxonomy-card .count {
    font-size: 0.8rem;
    color: var(--secondary);
}

/* --- Tag cloud --- */

.tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    align-items: baseline;
}

.tag-cloud-item {
    display: inline-block;
    color: var(--primary);
    text-decoration: none;
    transition: opacity 0.2s;
}

.tag-cloud-item:hover {
    opacity: 0.7;
}

/* --- Responsive --- */

@media (max-width: 768px) {
    .taxonomy-cards {
        flex-direction: column;
    }
}
```

- [ ] **Step 4: 卸载 gray-matter 依赖**

```bash
npm uninstall gray-matter
```

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

Expected: 构建成功，无报错。`public/` 中无 `artifacts/` 目录。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore(build): remove build-artifacts step, gray-matter dep, and map CSS/JS"
```

---

### Task 4: 更新 Hugo 配置 — taxonomies 和导航

**Files:**
- Modify: `hugo.toml`

**Interfaces:**
- Consumes: 无
- Produces: 新的 taxonomy 定义和导航菜单，供 Task 5/6 的模板使用

- [ ] **Step 1: 重写 hugo.toml**

将 `hugo.toml` 替换为：

```toml
baseURL = "/"
languageCode = "zh-CN"
title = "个人网站"
theme = "PaperMod"

[params]
  defaultTheme = "auto"
  ShowReadingTime = true
  ShowShareButtons = false
  ShowPostNavLinks = true
  ShowBreadCrumbs = true
  ShowCodeCopyButtons = true
  description = "面向技术内容的个人站点，提供文章发布与分类浏览。"
  keywords = ["hugo", "pagefind", "搜索", "分类", "标签"]

  [params.homeInfoParams]
    Title = "个人网站"
    Content = "面向技术内容的个人站点，提供文章发布与分类浏览。"

  [params.assets]
    disableFingerprinting = true

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

[permalinks]
  posts = "/posts/:slug/"

[taxonomies]
  category = "categories"
  tag = "tags"
  project = "projects"
  column = "columns"

[markup.goldmark.renderer]
  unsafe = false

[markup.highlight]
  noClasses = false
```

- [ ] **Step 2: 验证 Hugo 配置**

```bash
npm run build:site
```

Expected: 构建成功。`public/categories/`、`public/tags/`、`public/projects/`、`public/columns/` 目录已生成。

- [ ] **Step 3: 提交**

```bash
git add hugo.toml
git commit -m "feat(config): add category/project/column taxonomies and restructure nav menu"
```

---

### Task 5: 迁移现有文章 front matter

**Files:**
- Modify: `content/posts/hello.md`
- Modify: `content/posts/hugo-quickstart.md`
- Modify: `content/posts/fts5-search.md`
- Modify: `content/posts/lancedb-rag.md`
- Modify: `content/posts/map-design.md`
- Modify: `content/posts/feedback-iteration.md`

**Interfaces:**
- Consumes: Task 4 的 taxonomy 定义
- Produces: 带 `category` 字段的文章，Hugo 可据此生成 taxonomy 页面

- [ ] **Step 1: 更新 hello.md**

将 front matter 替换为：

```yaml
---
title: "Hello Discovery"
date: "2026-03-21"
category: "技术"
tags: ["discovery", "mvp"]
summary: "用于验证关键词索引、内链图与标签图的最小示例文章。"
slug: "hello"
---
```

- [ ] **Step 2: 更新 hugo-quickstart.md**

将 front matter 替换为：

```yaml
---
title: "Hugo 快速搭建：从零到可发布"
date: "2026-03-22"
category: "技术"
tags: ["hugo", "部署", "seo", "入门"]
summary: "用 Hugo 搭建个人站点的最短路径：目录结构、页面路由、SEO 基线与发布流程。"
slug: "hugo-quickstart"
---
```

- [ ] **Step 3: 更新 fts5-search.md**

将 front matter 替换为：

```yaml
---
title: "SQLite FTS5 关键词搜索实战"
date: "2026-03-22"
category: "技术"
tags: ["搜索", "sqlite", "fts5", "hugo"]
summary: "解释 lexical 搜索为何适合低配服务器，并展示字段命中与 why 解释。"
slug: "fts5-search"
---
```

- [ ] **Step 4: 更新 lancedb-rag.md**

将 front matter 替换为：

```yaml
---
title: "LanceDB 向量检索与 RAG 入门"
date: "2026-03-22"
category: "技术"
tags: ["向量数据库", "lancedb", "rag", "chat"]
summary: "介绍本项目如何构建向量索引、生成引用证据，并在 Chat 中返回阅读顺序。"
slug: "lancedb-rag"
---
```

- [ ] **Step 5: 更新 map-design.md**

将 front matter 替换为：

```yaml
---
title: "知识地图设计：内链图、标签图、实体图"
date: "2026-03-22"
category: "技术"
tags: ["知识图谱", "地图", "实体图", "可视化"]
summary: "对比三种地图视角，并说明如何通过纠错规则提升实体图质量。"
slug: "map-design"
---
```

- [ ] **Step 6: 更新 feedback-iteration.md**

将 front matter 替换为：

```yaml
---
title: "反馈驱动迭代：从日志到内容优化"
date: "2026-03-22"
category: "技术"
tags: ["反馈", "分析", "迭代", "运营"]
summary: "展示如何通过搜索点击与 Chat 行为导出，驱动内容改版与导航优化。"
slug: "feedback-iteration"
---
```

- [ ] **Step 7: 验证 Hugo 构建**

```bash
npm run build:site
ls public/categories/ public/tags/ public/projects/ public/columns/ 2>&1
```

Expected: `public/categories/` 下有 `技术` 子目录；`public/tags/` 下有各标签子目录；`public/projects/` 和 `public/columns/` 存在但可能为空（无文章标记 project/column）。

- [ ] **Step 8: 提交**

```bash
git add content/posts/
git commit -m "feat(content): add category field and remove series from all posts"
```

---

### Task 6: 创建 taxonomy 通用 partial 模板

**Files:**
- Create: `layouts/partials/taxonomy_list.html`
- Create: `layouts/partials/taxonomy_term.html`

**Interfaces:**
- Consumes: Task 4 的 taxonomy 定义，Task 3 的 CSS 样式类
- Produces: 供 Task 7 各 taxonomy 模板调用的通用 partial

- [ ] **Step 1: 创建 taxonomy_list.html — 通用列表页 partial**

创建 `layouts/partials/taxonomy_list.html`：

```html
{{- /* taxonomy_list.html — generic taxonomy list page partial
     Expects dict: "Page" .  "TaxonomyName" string (e.g. "分类")  "Style" string ("cards" | "cloud") */ -}}

{{- $p := .Page -}}
{{- $style := .Style | default "cards" -}}

<header class="page-header">
    <h1>{{ $p.Title }}</h1>
</header>

{{- if eq $style "cloud" -}}
<div class="tag-cloud" data-pagefind-ignore>
    {{- range $key, $value := $p.Data.Terms.Alphabetical -}}
    {{- $name := $value.Name -}}
    {{- $count := $value.Count -}}
    {{- with site.GetPage (printf "/%s/%s" $p.Type $name) -}}
    {{- $min := 0.8 -}}
    {{- $max := 2.0 -}}
    {{- $maxCount := 1 -}}
    {{- range $p.Data.Terms.ByCount -}}
        {{- if gt .Count $maxCount -}}
            {{- $maxCount = .Count -}}
        {{- end -}}
    {{- end -}}
    {{- $ratio := 0 -}}
    {{- if gt $maxCount 0 -}}
        {{- $ratio = div (float $count) (float $maxCount) -}}
    {{- end -}}
    {{- $fontSize := add $min (mul (sub $max $min) $ratio) -}}
    <a class="tag-cloud-item" href="{{ .Permalink }}" style="font-size: {{ printf "%.2f" $fontSize }}rem;">{{ .LinkTitle }}<sup>{{ $count }}</sup></a>
    {{- end -}}
    {{- end -}}
</div>
{{- else -}}
<div class="taxonomy-cards" data-pagefind-ignore>
    {{- range $key, $value := $p.Data.Terms.Alphabetical -}}
    {{- $name := $value.Name -}}
    {{- $count := $value.Count -}}
    {{- with site.GetPage (printf "/%s/%s" $p.Type $name) -}}
    <a class="taxonomy-card" href="{{ .Permalink }}">{{ .LinkTitle }}<span class="count">{{ $count }}</span></a>
    {{- end -}}
    {{- end -}}
</div>
{{- end -}}
```

- [ ] **Step 2: 创建 taxonomy_term.html — 通用详情页 partial**

创建 `layouts/partials/taxonomy_term.html`：

```html
{{- /* taxonomy_term.html — generic taxonomy term detail page partial
     Expects dict: "Page" .  "TaxonomyName" string (e.g. "分类") */ -}}

{{- $p := .Page -}}
{{- $taxonomyName := .TaxonomyName -}}

<header class="page-header">
    {{- partial "breadcrumbs.html" $p -}}
    <h1>{{ $taxonomyName }}: {{ $p.Title }}</h1>
</header>

{{- $pages := $p.Pages -}}

{{- range $pages -}}
<article class="post-entry tag-entry">
    <header class="entry-header">
        <h2 class="entry-hint-parent">{{ .Title }}</h2>
    </header>
    {{- if (ne (.Param "hideSummary") true) -}}
    <div class="entry-content">
        <p>{{ .Summary | plainify | htmlUnescape }}{{ if .Truncated }}...{{ end }}</p>
    </div>
    {{- end -}}
    {{- if not (.Param "hideMeta") -}}
    <footer class="entry-footer">
        {{- partial "post_meta.html" . -}}
    </footer>
    {{- end -}}
    <a class="entry-link" aria-label="post link to {{ .Title | plainify }}" href="{{ .Permalink }}"></a>
</article>
{{- end -}}
```

- [ ] **Step 3: 验证模板语法**

```bash
npm run build:site 2>&1 | tail -5
```

Expected: 构建成功（模板尚未被调用，但语法正确）

- [ ] **Step 4: 提交**

```bash
git add layouts/partials/taxonomy_list.html layouts/partials/taxonomy_term.html
git commit -m "feat(layouts): add generic taxonomy list and term partial templates"
```

---

### Task 7: 创建各 taxonomy 的列表页和详情页模板

**Files:**
- Create: `layouts/categories/list.html`
- Create: `layouts/categories/term.html`
- Create: `layouts/tags/list.html`
- Create: `layouts/tags/term.html`
- Create: `layouts/projects/list.html`
- Create: `layouts/projects/term.html`
- Create: `layouts/columns/list.html`
- Create: `layouts/columns/term.html`

**Interfaces:**
- Consumes: Task 6 的 `taxonomy_list.html` 和 `taxonomy_term.html` partial
- Produces: 完整的 taxonomy 页面，Hugo 可生成对应 URL

- [ ] **Step 1: 创建 categories 模板**

创建 `layouts/categories/list.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_list.html" (dict "Page" . "TaxonomyName" "分类" "Style" "cards") }}
{{- end }}
```

创建 `layouts/categories/term.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_term.html" (dict "Page" . "TaxonomyName" "分类") }}
{{- end }}
```

- [ ] **Step 2: 创建 tags 模板**

创建 `layouts/tags/list.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_list.html" (dict "Page" . "TaxonomyName" "标签" "Style" "cloud") }}
{{- end }}
```

创建 `layouts/tags/term.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_term.html" (dict "Page" . "TaxonomyName" "标签") }}
{{- end }}
```

- [ ] **Step 3: 创建 projects 模板**

创建 `layouts/projects/list.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_list.html" (dict "Page" . "TaxonomyName" "项目" "Style" "cards") }}
{{- end }}
```

创建 `layouts/projects/term.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_term.html" (dict "Page" . "TaxonomyName" "项目") }}
{{- end }}
```

- [ ] **Step 4: 创建 columns 模板**

创建 `layouts/columns/list.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_list.html" (dict "Page" . "TaxonomyName" "技术专栏" "Style" "cards") }}
{{- end }}
```

创建 `layouts/columns/term.html`：

```html
{{- define "main" }}
{{- partial "taxonomy_term.html" (dict "Page" . "TaxonomyName" "技术专栏") }}
{{- end }}
```

- [ ] **Step 5: 验证全量构建**

```bash
npm run build
```

Expected: 构建成功。检查生成的页面：

```bash
ls public/categories/index.html public/tags/index.html public/projects/index.html public/columns/index.html 2>&1
ls public/categories/技术/index.html 2>&1
```

Expected: 所有列表页和分类详情页存在

- [ ] **Step 6: 启动服务器验证页面**

```bash
npm run start &
sleep 2
curl -s http://localhost:8787/categories/ | grep -o "技术"
curl -s http://localhost:8787/tags/ | grep -o "hugo"
curl -s http://localhost:8787/categories/技术/ | grep -o "Hello"
kill %1
```

Expected: 分类列表页包含"技术"，标签列表页包含"hugo"，分类详情页包含文章标题

- [ ] **Step 7: 提交**

```bash
git add layouts/categories/ layouts/tags/ layouts/projects/ layouts/columns/
git commit -m "feat(layouts): add taxonomy list and term templates for categories/tags/projects/columns"
```

---

### Task 8: 更新 single.html 模板中的 tags 过滤

**Files:**
- Modify: `layouts/_default/single.html`

**Interfaces:**
- Consumes: Task 4 的 taxonomy 定义
- Produces: 文章详情页正确显示 category/tags/project/column 信息

- [ ] **Step 1: 更新 single.html — 添加 category 显示，移除 series 引用**

将 `layouts/_default/single.html` 替换为：

```html
{{- define "main" }}

<article class="post-single">
  <header class="post-header">
    {{ partial "breadcrumbs.html" . }}
    <h1 class="post-title entry-hint-parent" data-pagefind-meta="title">
      {{ .Title }}
      {{- if .Draft }}
      <span class="entry-hint" title="Draft">
        <svg xmlns="http://www.w3.org/2000/svg" height="35" viewBox="-960 960 960 960" fill="currentColor">
          <path
            d="M160-410v-60h300v60H160Zm0-165v-60h470v60H160Zm0-165v-60h470v60H160Zm360 580v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q9 9 13 20t4 22q0 11-4.5 22.5T862.09-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z" />
        </svg>
      </span>
      {{- end }}
    </h1>
    {{- if .Description }}
    <div class="post-description" data-pagefind-meta="description">
      {{ .Description }}
    </div>
    {{- end }}
    {{- if not (.Param "hideMeta") }}
    <div class="post-meta">
      {{- partial "post_meta.html" . -}}
      {{- partial "translation_list.html" . -}}
      {{- partial "edit_post.html" . -}}
      {{- partial "post_canonical.html" . -}}
    </div>
    {{- end }}
    {{- if .Params.tags }}
    <div data-pagefind-filter="tags" style="display:none">
      {{- range .Params.tags }}
      <span>{{ . }}</span>
      {{- end }}
    </div>
    {{- end }}
  </header>
  {{- $isHidden := (.Param "cover.hiddenInSingle") | default (.Param "cover.hidden") | default false }}
  {{- partial "cover.html" (dict "cxt" . "IsSingle" true "isHidden" $isHidden) }}
  {{- if (.Param "ShowToc") }}
  {{- partial "toc.html" . }}
  {{- end }}

  {{- if .Content }}
  <div class="post-content md-content" data-pagefind-body>
    {{- if not (.Param "disableAnchoredHeadings") }}
    {{- partial "anchored_headings.html" .Content -}}
    {{- else }}{{ .Content }}{{ end }}
  </div>
  {{- end }}

  {{- partial "extend_post_content.html" . }}

  <footer class="post-footer">
    {{- if .Params.category }}
    <ul class="post-tags">
      <li><a href="/categories/{{ .Params.category | urlize }}/">{{ .Params.category }}</a></li>
    </ul>
    {{- end }}
    {{- $tags := .Language.Params.Taxonomies.tag | default "tags" }}
    <ul class="post-tags">
      {{- range ($.GetTerms $tags) }}
      <li><a href="{{ .Permalink }}">{{ .LinkTitle }}</a></li>
      {{- end }}
    </ul>
    {{- if .Params.project }}
    <ul class="post-tags">
      <li><a href="/projects/{{ .Params.project | urlize }}/">{{ .Params.project }}</a></li>
    </ul>
    {{- end }}
    {{- if .Params.column }}
    <ul class="post-tags">
      <li><a href="/columns/{{ .Params.column | urlize }}/">{{ .Params.column }}</a></li>
    </ul>
    {{- end }}
    {{- if (.Param "ShowPostNavLinks") }}
    {{- partial "post_nav_links.html" . }}
    {{- end }}
    {{- if (and site.Params.ShowShareButtons (ne .Params.disableShare true)) }}
    {{- partial "share_icons.html" . -}}
    {{- end }}
  </footer>

  {{- if (.Param "comments") }}
  {{- partial "comments.html" . }}
  {{- end }}
</article>

{{- end }}{{/* end main */}}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add layouts/_default/single.html
git commit -m "feat(layouts): add category/project/column links in post footer"
```

---

### Task 9: 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: 所有前序任务的变更结果
- Produces: 与代码同步的项目文档

- [ ] **Step 1: 更新 CLAUDE.md**

需要更新的内容点：
1. 项目概述：移除"知识地图"描述，改为"分类浏览"
2. 当前状态：移除图谱相关描述，新增 taxonomy 系统
3. 构建命令：移除 `build:artifacts`
4. 架构：移除构建时图谱生成描述，新增 taxonomy 说明
5. 数据流：移除 build-artifacts.js 步骤
6. 关键目录：移除 `public/artifacts/`，新增 taxonomy 相关说明
7. 前端文件表：移除 map.ts
8. 内容编写：front matter 字段更新（category/column/project，移除 series）
9. 重要约定：移除 D3.js 本地化、图谱相关约定，新增 taxonomy 约定
10. 依赖表：移除 gray-matter

由于 CLAUDE.md 较长，此处不列出完整替换内容。实施时需逐段对照修改，确保只改相关部分，不改动已正常工作的描述。

- [ ] **Step 2: 验证文档与代码一致**

```bash
# 检查 CLAUDE.md 中不再提及已移除的功能
grep -n "地图\|map\|graph\|D3\|d3\|build-artifacts\|gray-matter\|series" CLAUDE.md
```

Expected: 无匹配（或仅在"变更历史"等上下文中合理出现）

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(claude): sync project docs with navigation restructure changes"
```

---

### Task 10: 端到端验证

**Files:**
- 无新文件

**Interfaces:**
- Consumes: 所有前序任务的产出
- Produces: 验证通过的可部署状态

- [ ] **Step 1: 全量构建**

```bash
npm run build
```

Expected: 构建成功，无报错

- [ ] **Step 2: 启动服务器并验证所有页面**

```bash
npm run start &
sleep 2

# 首页
curl -s http://localhost:8787/ | grep -o "个人网站"

# 时间线
curl -s http://localhost:8787/archives/ | grep -o "归档"

# 搜索
curl -s http://localhost:8787/search/ | grep -o "搜索"

# 分类列表
curl -s http://localhost:8787/categories/ | grep -o "技术"

# 分类详情
curl -s http://localhost:8787/categories/技术/ | grep -o "Hello"

# 标签列表
curl -s http://localhost:8787/tags/ | grep -o "hugo"

# 标签详情
curl -s http://localhost:8787/tags/hugo/ | grep -o "Hugo"

# 项目列表（空）
curl -s http://localhost:8787/projects/ | head -5

# 技术专栏列表（空）
curl -s http://localhost:8787/columns/ | head -5

# 地图页应 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/map/

# 图谱 API 应 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/graph

kill %1
```

Expected:
- 首页/时间线/搜索/分类/标签页面返回正确内容
- 项目/专栏列表页存在（可能为空列表）
- `/map/` 返回 404
- `/api/graph` 返回 404

- [ ] **Step 3: 验证 Pagefind 搜索索引**

```bash
ls public/pagefind/pagefind.js 2>&1
```

Expected: Pagefind 索引文件存在

- [ ] **Step 4: 验证无残留文件**

```bash
# 确认无地图相关文件残留
ls static/js/d3.v7.min.js static/js/map.js scripts/build-artifacts.js 2>&1
# 确认无图谱产物
ls public/artifacts/ 2>&1
```

Expected: 所有路径报 "No such file or directory"

- [ ] **Step 5: 最终提交（如有未提交的变更）**

```bash
git status
# 如有未提交变更：
git add -A
git commit -m "chore: final cleanup after navigation restructure"
```
