---
title: "反馈驱动迭代：从日志到内容优化"
date: "2026-03-22"
categories: ["技术"]
tags: ["反馈", "分析", "迭代", "运营"]
description: "展示如何通过搜索点击与 Chat 行为导出，驱动内容改版与导航优化。"
slug: "feedback-iteration"
---

内容优化不是拍脑袋，需要可导出的行为证据。

## 你可以导出的数据
- 搜索关键词与点击
- 地图节点点击
- Chat 查询与引用点击

## 导出示例

```bash
curl -s "http://localhost:8787/api/feedback/export.json"
curl -s "http://localhost:8787/api/feedback/export.csv"
```

## 推荐阅读
- 入门路线：[Hugo 快速搭建：从零到可发布](hugo-quickstart.md)
- 检索能力：[SQLite FTS5 关键词搜索实战](fts5-search.md)
