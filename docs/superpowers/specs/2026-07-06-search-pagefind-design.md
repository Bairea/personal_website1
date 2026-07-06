# 搜索系统迁移至 Pagefind 设计文档

**日期**：2026-07-06
**状态**：已确认

## 背景

当前搜索系统基于 FTS5（SQLite）+ LanceDB（哈希嵌入向量）混合搜索，运行时通过 Express `/api/search` 端点提供服务。存在以下问题：

1. **LanceDB 维护风险**：`^0.27.1` 版本迭代快，API 可能 breaking change
2. **哈希嵌入质量低**：`fnv1a32` 生成的伪向量不具备真正的语义搜索能力，本质是另一种关键词搜索
3. **服务器资源占用**：搜索请求消耗 2G 服务器的 CPU 和内存
4. **前端体验简陋**：仅支持 Enter 触发，无高亮、无防抖、无标签过滤

约束条件：
- 2 核 2G 严格低资源服务器，不能跑 ML 推理
- 不使用外部 API，完全自包含
- 10 年运行，技术成熟度和可维护性优先

## 决策

采用 Pagefind（v1.5.2）替代整个搜索系统。搜索从服务器端 API 变为纯客户端静态搜索。

核心理由：
- 搜索完全在浏览器端执行，运行时零服务器开销
- Pagefind 内置防抖、高亮、标签过滤、子结果
- 中文 CJK 分词支持（`--force-language zh`）
- 即使 Pagefind 停止维护，已生成的静态搜索 bundle 仍然永久可用
- 移除 LanceDB + SQLite 后，依赖更稳定，内存占用更低

## 架构变更

### 当前架构

```
content/posts/*.md → Hugo → public/（静态 HTML）
                  → build-artifacts.js → data/search_lexical.db（FTS5）
                                        vectors/（LanceDB）
                                        public/artifacts/graph-*.json
                                        public/artifacts/docs.json

运行时：Express 提供 public/ + /api/search + /api/graph
```

### 新架构

```
content/posts/*.md → Hugo → public/（静态 HTML）
                  → build-artifacts.js → public/artifacts/graph-*.json
                                        public/artifacts/docs.json
                  → npx pagefind → public/pagefind/（搜索索引 + JS/WASM bundle）

运行时：Express 提供 public/ + /api/graph（搜索完全客户端）
```

## 构建流程

### npm 脚本

```json
{
  "scripts": {
    "build": "npm run build:frontend && npm run build:site && npm run build:artifacts && npm run build:search",
    "build:frontend": "tsc -p tsconfig.frontend.json",
    "build:site": "hugo --cleanDestinationDir",
    "build:artifacts": "node scripts/build-artifacts.js",
    "build:search": "npx pagefind --site public --force-language zh",
    "typecheck:frontend": "tsc -p tsconfig.frontend.json --noEmit",
    "start": "node server/index.js"
  }
}
```

`build:search` 在 `build:site` 之后执行，扫描 Hugo 生成的 HTML，输出搜索索引到 `public/pagefind/`。

### build-artifacts.js 简化

移除所有 FTS5 和 LanceDB 相关代码，保留：
- 图谱 JSON 生成（`graph-internal-links.json`、`graph-tag-cooccurrence.json`）

移除：
- `fnv1a32()`、`hashEmbedding()`、`chunkText()`、`makeChunkRows()` 函数
- SQLite 数据库创建和写入
- LanceDB 表创建
- 导出副本（`export/` 目录、`manifest.json`）
- `docs.json` 生成（搜索 API 辅助产物，不再需要）
- 常量：`DATA_DIR`、`VECTORS_DIR`、`SEARCH_DB_PATH`、`EXPORT_DIR`、`VECTOR_DIM`、`CHUNK_SIZE`、`CHUNK_OVERLAP`

保留：
- `stripMd()`、`extractLinks()`、`resolveInternalMdLink()`
- `slugFromFilePath()`、`urlFromSlug()`、`normalizeTags()`
- `walkFiles()`、`ensureDir()`

## Hugo 模板适配

### 文章详情页（覆盖 PaperMod single.html）

```html
{{- define "main" }}
<article class="post-single">
  <header class="post-header">
    <h1 class="post-title" data-pagefind-meta="title">{{ .Title }}</h1>
    {{- with .Params.summary }}
    <p class="post-description" data-pagefind-meta="description">{{ . }}</p>
    {{- end }}
    {{- if .Params.tags }}
    <div data-pagefind-filter="tags">
      {{- range .Params.tags }}
      <span>{{ . }}</span>
      {{- end }}
    </div>
    {{- end }}
  </header>
  <div class="post-content" data-pagefind-body>
    {{ .Content }}
  </div>
</article>
{{- end }}
```

Pagefind 属性说明：
- `data-pagefind-body`：标记正文区域，仅含此属性的页面被索引
- `data-pagefind-meta="title"`：标题关联为搜索结果元数据
- `data-pagefind-meta="description"`：摘要关联为搜索结果描述
- `data-pagefind-filter="tags"`：标签设为可过滤字段

### 搜索页（layouts/discovery-search.html）

```html
{{- define "main" }}
<header class="page-header">
    <h1>{{ .Title }}</h1>
</header>
<div class="custom-search" data-pagefind-ignore>
    <div id="search"></div>
</div>
{{- end }}
```

搜索页用 `data-pagefind-ignore` 避免被索引。

### extend_head.html

```html
{{- /* Search page: load Pagefind */ -}}
{{- if eq .Layout "discovery-search" -}}
<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<script src="/pagefind/pagefind-ui.js"></script>
<script src="/js/search.js"></script>
{{- end -}}

{{- /* Map page: load D3 + map JS */ -}}
{{- if eq .Layout "discovery-map" -}}
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="/js/common.js"></script>
<script src="/js/map.js"></script>
{{- end -}}
```

## 前端搜索重写

### search.ts

使用 Pagefind Component UI（`PagefindUI`），内置搜索框、防抖、结果渲染、高亮、过滤面板：

```typescript
const container = document.getElementById("search");

async function main(): Promise<void> {
  const pagefind = await import("/pagefind/pagefind.js");
  pagefind.init();

  new (window as any).PagefindUI({
    element: "#search",
    showSubResults: true,
    showFilters: true,
    autofocus: true,
  });

  // 支持 URL 参数 ?q=
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q");
  if (initialQuery) {
    const input = container?.querySelector("input");
    if (input) {
      input.value = initialQuery;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

main().catch((error: unknown) => {
  if (container) container.textContent = "搜索初始化失败：" + String(error);
});
```

### CSS 变量适配

在 `assets/css/extended/extended.css` 中添加 Pagefind UI 主题映射：

```css
:root {
  --pagefind-ui-scale: 1;
  --pagefind-ui-text: var(--primary);
  --pagefind-ui-background: var(--entry);
  --pagefind-ui-border: var(--border);
  --pagefind-ui-tag: var(--tertiary);
  --pagefind-ui-border-width: 1px;
  --pagefind-ui-border-radius: var(--radius);
  --pagefind-ui-image-border-radius: var(--radius);
  --pagefind-ui-image-box-ratio: 40%;
  --pagefind-ui-font: inherit;
}
```

确保暗色/亮色主题切换时搜索 UI 跟随变化。

## 服务器端简化

### server/index.js 变更

移除：
- `import Database from "better-sqlite3"`
- `import { connect } from "@lancedb/lancedb"`
- `searchDb`、`vectorDb`、`vectorTable` 初始化逻辑
- `fnv1a32()`、`hashEmbedding()` 函数
- `ensureVectorTable()`、`vectorSearch()` 函数
- `runLexicalSearch()` 函数
- `uniqueBy()` 函数
- 整个 `/api/search` 路由处理器
- `DATA_DIR`、`SEARCH_DB_PATH`、`VECTORS_DIR`、`VECTOR_DIM` 常量

保留：
- `import fs`、`import path`、`import express`
- `readJsonIfExists()`、`parseTags()`
- `normalizeGraph()`、`pickSubgraph()`、`getStaticGraph()`
- `/api/graph` 路由处理器
- `makeRequestId()`、`sendOk()`、`sendErr()`
- 静态文件中间件和服务器启动逻辑

## 依赖变更

| 包 | 变更 | 原因 |
|---|---|---|
| `@lancedb/lancedb` | 移除 | 搜索改用 Pagefind |
| `better-sqlite3` | 移除 | FTS5 索引移除，图谱 API 改用 JSON |
| `pagefind` | 新增 `^1.5.2` | 客户端搜索索引生成 |
| `express` | 保留 | 静态文件 + 图谱 API |
| `gray-matter` | 保留 | 图谱构建需解析 front matter |

## 移除的文件和目录

- `data/search_lexical.db`（及 `-shm`、`-wal`）
- `vectors/` 整个目录
- `public/artifacts/export/` 整个目录

这些文件/目录不再由构建流程生成，可手动清理。

## 备份影响

原备份策略：仅需备份 `content/` 和 `static/media/`。

新策略不变——所有搜索产物（`public/pagefind/`、`public/artifacts/`）均可通过 `npm run build` 完全重建。

## 10 年风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Pagefind 停止维护 | 低 | 低 | 已生成的静态 bundle 永久可用，WASM+JS 无运行时依赖 |
| Pagefind API breaking change | 中 | 低 | 锁定 `package-lock.json` 版本，构建时才运行 |
| Pagefind 中文分词质量不足 | 中 | 中 | 可通过 `--force-language zh` + 自定义分词配置调整 |
| Pagefind 索引体积过大 | 低 | 低 | Pagefind 按需加载索引分片，10k 页面 < 300kB |
| 浏览器禁用 JS | 极低 | 中 | 静态站点搜索天然依赖 JS，无替代方案 |
