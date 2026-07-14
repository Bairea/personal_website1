---
title: "SQLite FTS5 关键词搜索实战"
date: "2026-03-22"
categories: ["技术"]
tags: ["搜索", "sqlite", "fts5", "hugo"]
description: "解释 lexical 搜索为何适合低配服务器，并展示字段命中与 why 解释。"
slug: "fts5-search"
---

在低配置服务器上，FTS5 是高性价比方案：文件型、低运维、可解释。

## 查询模式
- `mode=lexical`：纯关键词召回
- `mode=vector`：语义近邻召回
- `mode=hybrid`：合并排序并返回 why

## API 示例

```bash
curl -s "http://localhost:8787/api/search?q=hugo&mode=hybrid"
```

## 下一步阅读
- 向量检索细节：[LanceDB 向量检索与 RAG 入门](lancedb-rag.md)
- 图谱入口设计：[知识地图设计：内链图、标签图、实体图](map-design.md)
