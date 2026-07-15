# 写作看板

## 最近 30 天编辑

```dataview
TABLE date AS 发布日期, categories AS 分类, tags AS 标签
FROM "content/posts"
WHERE !contains(file.name, "_index") AND file.mtime >= date(today) - dur(30 days)
SORT file.mtime DESC
```

## 全部文章（按发布日期倒序）

```dataview
TABLE WITHOUT ID file.link AS 标题, date AS 日期, categories AS 分类
FROM "content/posts"
WHERE !contains(file.name, "_index")
SORT date DESC
```

## 缺 description 的文章

```dataview
LIST
FROM "content/posts"
WHERE !contains(file.name, "_index") AND (!description OR description = "")
```

## 按分类统计

```dataview
TABLE length(rows) AS 篇数
FROM "content/posts"
WHERE !contains(file.name, "_index")
FLATTEN categories AS cat
GROUP BY cat
SORT cat ASC
```
