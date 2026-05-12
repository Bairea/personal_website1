# 统一内容与索引数据模型（Frontmatter / 派生字段 / Chunk / 引用证据）

本规范用于：SSG 构建、关键词索引、向量库、RAG 引用、知识地图预览等所有“内容衍生产物”。
原则：Markdown 原文为单一事实来源；衍生字段与索引产物均可重建。

## 1. 文章 Frontmatter 规范（Source of Truth）

### 1.1 必填字段（MUST）
- title: string
- date: string（ISO 8601，建议含时区，例如 2026-03-21 或 2026-03-21T10:30:00+08:00）
- tags: string[]（建议 0~8 个；统一小写/或统一中文，不混用同义词）
- summary: string（80~200 字，面向搜索结果与卡片预览）

### 1.2 选填字段（SHOULD / MAY）
- keywords: string[]（用于 lexical/SEO；可由 agent 派生，但不强制写回原文）
- series: string（系列名；用于学习路径/聚合页）
- series_order: number（系列内排序；无则按 date）
- draft: boolean（true 则不进入公开索引与图谱）
- cover: string（封面图 URL 或相对路径）
- lang: string（例如 zh-CN；多语言时使用）
- canonical_url: string（如有外部发布地址）
- aliases: string[]（标题别名/历史 slug；用于跳转与去重）
- updated: string（可选；若缺省可由构建系统或 git 推导）

### 1.3 禁止字段（MUST NOT）
- 任何会与衍生字段“权威冲突”的字段：例如 word_count / reading_time / chunk_count 等不应写入原文

### 1.4 示例
```yaml
---
title: "SQLite FTS5 做站内搜索：从 0 到可解释"
date: "2026-03-21T10:30:00+08:00"
tags: ["search", "sqlite", "fts5"]
summary: "用 SQLite FTS5 构建轻量站内搜索：索引结构、BM25、字段权重与高亮片段，并给出可解释的命中原因。"
series: "站内发现系统"
series_order: 2
draft: false
---
```

## 2. 统一派生字段（Derived Fields）

派生字段由构建/索引管线生成，写入“索引产物”（SQLite/JSON/向量库元数据），默认不回写 Markdown。

### 2.1 Document 派生字段（doc.*）
- doc.id: string（稳定唯一；推荐：相对路径 hash 或路径本身）
- doc.source_path: string（content/ 相对路径）
- doc.slug: string（由路径或标题生成；需稳定）
- doc.url: string（站内 URL）
- doc.title: string（来自 frontmatter.title）
- doc.date_published: string（来自 frontmatter.date）
- doc.date_updated: string（frontmatter.updated 或 git/构建时间推导）
- doc.tags: string[]（来自 frontmatter.tags，做规范化）
- doc.series: string | null
- doc.series_order: number | null
- doc.summary: string（来自 frontmatter.summary；若缺省可由 agent 产出但必须标注 provenance）
- doc.keywords: string[]（frontmatter.keywords + agent 补充，需去重）
- doc.lang: string（缺省 zh-CN）
- doc.draft: boolean
- doc.word_count: number
- doc.reading_time_minutes: number（按 300~400 中文字/分钟或 200~250 英文词/分钟规则统一）
- doc.headings: Array<{depth:number, text:string, anchor?:string}>
- doc.outlinks: string[]（解析站内链接得到；用于引用图）
- doc.hash: string（原文内容 hash，用于增量更新判定）

### 2.2 Chunk 派生字段（chunk.*）
- chunk.id: string（doc.id + chunk_index 的组合，稳定）
- chunk.doc_id: string
- chunk.index: number（从 0 开始）
- chunk.text: string（用于 embedding / RAG）
- chunk.text_hash: string
- chunk.token_count_est: number（估算即可）
- chunk.char_start / chunk.char_end: number（在“抽取后的纯文本”中的偏移；用于引用定位）
- chunk.heading_path: string[]（例如 ["SQLite FTS5 做站内搜索", "BM25 与字段权重"]）
- chunk.contains_code: boolean
- chunk.contains_table: boolean

## 3. Chunk 规则（用于向量库 / RAG / 预览）

目标：语义完整、可定位、可追溯；避免把代码块/表格切碎。

### 3.1 预处理（MUST）
- 去除 frontmatter
- Markdown 解析为结构块（heading/paragraph/list/code/table/blockquote）
- 保留代码块为原样文本（含语言标识可选放入首行）

### 3.2 切分策略（SHOULD）
- 优先以二级/三级标题段落为边界聚合
- 每个 chunk 的目标长度：
  - chunk_token_target: 400~800（或字符 800~1800，二选一实现即可）
  - chunk_token_max: 1000（超出则按段落/句子二次切分）
- overlap：
  - 对纯文本 chunk 允许 10%~15% 的尾部重叠（便于召回）
  - 对包含 code/table 的 chunk 不做重叠，避免重复噪声
- 最小长度：
  - 小于 120 tokens（或 240 字符）的尾部碎片，尽量并入前一个 chunk（除非跨标题会破坏语义）

### 3.3 Heading 路径（MUST）
- 每个 chunk 必须记录 heading_path：
  - path[0] = 文档标题（frontmatter.title）
  - 后续为最近的 heading 文本序列（h2/h3/...）

## 4. 引用证据格式（Evidence）——RAG 与图谱预览统一

Evidence 是“可追溯”的最小单元：指向具体文章与 chunk，并提供可展示的摘录与定位信息。

### 4.1 JSON 约定字段
```json
{
  "evidence_id": "string",
  "doc": {
    "id": "string",
    "title": "string",
    "url": "string",
    "date_published": "string",
    "date_updated": "string"
  },
  "chunk": {
    "id": "string",
    "index": 0,
    "heading_path": ["string"],
    "char_start": 0,
    "char_end": 0
  },
  "quote": {
    "text": "string",
    "md_excerpt": "string"
  },
  "retrieval": {
    "source": "lexical|vector|hybrid|graph",
    "score": 0.0,
    "query": "string"
  },
  "provenance": {
    "generated_at": "string",
    "pipeline_version": "string",
    "model": "string"
  }
}
```

### 4.2 规范要求
- MUST：doc.id/doc.url/chunk.id/chunk.heading_path/quote.text
- SHOULD：char_start/char_end（用于精确定位与高亮）
- MUST：retrieval.source（解释“为什么命中”）
- MUST：provenance（用于可追溯与回滚；零模型阶段 model 可为 none）

