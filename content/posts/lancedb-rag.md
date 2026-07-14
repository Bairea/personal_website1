---
title: "LanceDB 向量检索与 RAG 入门"
date: "2026-03-22"
categories: ["技术"]
tags: ["向量数据库", "lancedb", "rag", "chat"]
description: "介绍本项目如何构建向量索引、生成引用证据，并在 Chat 中返回阅读顺序。"
slug: "lancedb-rag"
---

本项目的向量策略是：先标题与摘要，再正文 chunk，优先兼顾速度与效果。

## Chat 的关键返回
- `answer`
- `citations`
- `reading_path`（不熟悉模式）
- `temp_graph`

## API 示例

```bash
curl -s -X POST "http://localhost:8787/api/chat" \
  -H "content-type: application/json" \
  -d '{"q":"我不熟悉这个主题，给我阅读顺序","unfamiliar":true}'
```

## 继续阅读
- 了解地图与纠错：[知识地图设计：内链图、标签图、实体图](map-design.md)
