# 个人网站使用文档（Hugo + LanceDB）

## 1. 项目能力总览

- 站点：Hugo 生成静态页面（文章、标签、系列、RSS、sitemap）
- 搜索：`/api/search` 提供 `lexical` / `vector` / `hybrid` 三模式
- 知识地图：`/map/` 可切换内链图、标签图、实体图、公共导览图
- Chat：`/chat/` 支持 RAG 引用、不熟悉模式阅读顺序、临时子图保存
- 反馈闭环：`/api/feedback` 采集行为，`/api/feedback/export.json|csv` 导出

## 2. 目录约定

- `content/posts/`：文章源文件（事实来源）
- `static/media/`：图床目录（构建后映射为 `/media/...`）
- `scripts/build-artifacts.js`：索引/向量/图谱构建
- `server/index.js`：API 服务
- `themes/discovery-light/layouts/_default/`：页面模板
- `data/`：构建与运行数据（SQLite、规则、缓存、公共导览图）
- `public/`：Hugo 输出静态站点

## 3. 快速启动（5 分钟）

### 3.1 安装依赖

```bash
npm install
```

### 3.2 一次构建（站点 + 索引 + 图谱 + 向量）

```bash
npm run build
```

### 3.3 启动服务

```bash
npm run start
```

### 3.4 打开页面

- 首页：`http://localhost:8787/`
- 搜索：`http://localhost:8787/search/`
- 知识地图：`http://localhost:8787/map/`
- Chat：`http://localhost:8787/chat/`

## 4. 主题选型（Task 8）

- 选型：`discovery-light`（自定义 Hugo 主题）
- 选择理由：
  - 贴合技术博客 + 工具入口场景，首页/文章/标签/系列与 `/search` `/map` `/chat` 视觉统一
  - 保持轻量，仅使用 Hugo 模板与少量原生 CSS/JS，适配低资源服务器
  - 保持既有 URL、`/api/*` 交互与 sitemap/RSS 生成路径不变

## 5. 环境变量

- `PORT`：服务端口，默认 `8787`
- `API_KEY`：启用后，`/api/chat` 与 `/api/feedback` 需要鉴权
- `CHAT_CONCURRENCY`：Chat 并发上限，默认 `2`
- `AI_CHAT_URL`：可选，自定义 AI 接口地址（POST JSON）
- `AI_CHAT_KEY`：可选，请求 `AI_CHAT_URL` 的 Bearer Token
- `EMBEDDING_PROVIDER`：证据 provenance 的模型标识，默认 `hash`

## 6. 数据流说明

- Markdown -> Hugo：生成文章页、列表页、标签页、系列页
- Markdown -> Artifacts：
  - `data/search_lexical.db`（FTS5）
  - `vectors/`（LanceDB）
  - `public/artifacts/graph-*.json`（图谱）
  - `data/ai_cache.json`（元数据缓存）
- 用户行为 -> `data/feedback.db` -> JSON/CSV 导出

## 7. 内容编写规范

- 文章放在 `content/posts/*.md`
- 推荐 front matter：
  - `title`、`date`、`tags`、`summary`
  - `series`、`slug`（建议固定）
- 图片统一引用：
  - 文件放 `static/media/...`
  - 文中用绝对路径 `/media/...`

## 8. 常用命令

```bash
# 全量构建（推荐）
npm run build

# 仅构建 Hugo 页面
npm run build:site

# 仅构建索引/图谱/向量
npm run build:artifacts

# 启动服务
npm run start
```

## 9. 常见问题

- 页面 404：确认先执行 `npm run build`，并检查访问路径是否以 `/search/` `/map/` `/chat/` 结尾
- 搜索无结果：检查文章是否在 `content/posts/` 且包含 `title/summary/tags`
- 地图太稀疏：补充内链和标签交叉；检查 `data/entity-graph-rules.json`
- Chat 没有 AI 答复：未配置 `AI_CHAT_URL` 时会使用本地 fallback（仍返回引用）

## 10. 备份与恢复（最小集合）

- 必备备份：
  - `content/`
  - `static/media/`
  - `data/feedback.db`、`data/feedback.db-wal`、`data/feedback.db-shm`
  - `data/entity-graph-rules.json`
- 可重建项（可不备份）：
  - `public/`、`vectors/`、`data/search_lexical.db`、`data/ai_cache.json`

恢复流程：

1. 恢复 `content/` 与 `static/media/`
2. 执行 `npm install`
3. 执行 `npm run build`
4. 恢复 `feedback.db*`（如需保留行为数据）
5. 启动 `npm run start`
