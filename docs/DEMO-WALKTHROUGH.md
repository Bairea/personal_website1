# Demo 巡检手册（可直接照做）

## 0. 准备

```bash
npm install
npm run build
npm run start
```

默认地址：`http://localhost:8787`

## 1. 页面巡检

### 1.1 首页与文章
- 打开 `/`
- 预期：能看到文章列表与导航（文章/标签/系列/搜索/地图/Chat）

### 1.2 搜索页
- 打开 `/search/`
- 输入关键词：`hugo`、`向量`、`知识图谱`
- 预期：
  - 每个关键词都返回可读结果
  - 点击结果可跳转文章

### 1.3 地图页
- 打开 `/map/`
- 依次切换：内链图、标签图、实体图、公共导览图
- 预期：
  - 内链图/标签图/实体图均非空
  - 点击节点右侧出现预览
  - 双击文章节点可打开文章

### 1.4 Chat 页
- 打开 `/chat/`
- 普通提问：`如何在这个站点做搜索？`
- 不熟悉提问：勾选“我不熟悉”后提问 `请给我一个从零入门路线`
- 预期：
  - 返回 answer
  - citations 至少 2 条（在 demo 语料下）
  - unfamiliar 返回 reading_path 与 temp_graph
  - 可点击“保存为公共导览图”

## 2. API 巡检

### 2.1 搜索接口

```bash
curl -s "http://localhost:8787/api/search?q=hugo&mode=lexical"
curl -s "http://localhost:8787/api/search?q=hugo&mode=vector"
curl -s "http://localhost:8787/api/search?q=hugo&mode=hybrid"
```

预期：三种模式均返回 `ok: true`，`hybrid` 含 `why` 解释字段。

### 2.2 图谱接口

```bash
curl -s "http://localhost:8787/api/graph?kind=links"
curl -s "http://localhost:8787/api/graph?kind=tags"
curl -s "http://localhost:8787/api/graph?kind=entity"
curl -s "http://localhost:8787/api/graph?kind=public"
```

预期：`links/tags/entity` 节点数大于 0；`public` 在保存后可读到数据。

### 2.3 Chat 接口

```bash
curl -s -X POST "http://localhost:8787/api/chat" \
  -H "content-type: application/json" \
  -d '{"q":"我不熟悉这个主题，请给我阅读路径","unfamiliar":true}'
```

预期：返回 `answer`、`citations`、`reading_path`、`temp_graph`。

### 2.4 反馈导出

```bash
curl -s "http://localhost:8787/api/feedback/export.json"
curl -s "http://localhost:8787/api/feedback/export.csv"
```

预期：JSON/CSV 均可正常返回。

## 3. 实体图纠错演示

### 3.1 添加规则
- 打开 `/map/`，切到“实体图”
- 在“图谱纠错”表单中填写：
  - 模式：`whitelist_entity`
  - 值：`hugo`
- 点击提交
- 预期：刷新实体图后可见该实体节点（或关联增强）

### 3.2 删除规则
- 模式：`blacklist_entity`
- 值：`hugo`
- 提交后重新构建并刷新
- 预期：相关实体弱化或消失

## 4. 一键验收标准
- 搜索：3 个关键词均有结果
- 地图：初次打开非空、可切换 4 种视图
- Chat：至少返回 2 条引用，unfamiliar 有阅读顺序
- 公共导览图：能保存并再次读取
- 导出：feedback JSON/CSV 可下载
