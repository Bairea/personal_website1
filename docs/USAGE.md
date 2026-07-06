# 个人网站使用文档

## 1. 项目能力总览

- 站点：Hugo 生成静态页面（文章、标签、系列、RSS、sitemap）
- 搜索：`/api/search` 提供 `lexical` / `vector` / `hybrid` 三模式
- 知识地图：`/map/` 可切换内链图、标签图

## 2. 目录约定

- `content/posts/`：文章源文件
- `static/media/`：图床目录（构建后映射为 `/media/...`）
- `scripts/build-artifacts.js`：索引/向量/图谱构建
- `server/index.js`：API 服务
- `data/`：构建与运行数据
- `public/`：Hugo 输出静态站点

## 3. 快速启动

```bash
npm install
npm run build
npm run start
```

- 首页：`http://localhost:8787/`
- 搜索：`http://localhost:8787/search/`
- 知识地图：`http://localhost:8787/map/`

## 4. 环境变量

- `PORT`：服务端口，默认 `8787`

## 5. 数据流说明

- Markdown → Hugo：生成文章页、列表页、标签页、系列页
- Markdown → Artifacts：
  - `data/search_lexical.db`（FTS5）
  - `vectors/`（LanceDB）
  - `public/artifacts/graph-*.json`（内链图、标签图）

## 6. 内容编写规范

- 文章放在 `content/posts/*.md`
- 推荐 front matter：`title`、`date`、`tags`、`summary`、`series`、`slug`
- 图片统一引用：
  - 文件放 `static/media/...`
  - 文中用绝对路径 `/media/...`
- 内部链接使用相对 `.md` 路径（如 `[text](./other.md)`）

## 7. 常用命令

```bash
npm run build              # 全量构建
npm run build:site         # 仅构建 Hugo 页面
npm run build:artifacts    # 仅构建索引/图谱/向量
npm run start              # 启动服务
npm run typecheck:frontend # 类型检查
```

## 8. 常见问题

- 页面 404：确认先执行 `npm run build`
- 搜索无结果：检查文章是否在 `content/posts/` 且包含 `title/summary/tags`
- 地图太稀疏：补充内链和标签交叉

## 9. 备份与恢复

- 必备备份：`content/`、`static/media/`
- 可重建项（可不备份）：`public/`、`vectors/`、`data/search_lexical.db`

恢复流程：

1. 恢复 `content/` 与 `static/media/`
2. 执行 `npm install` + `npm run build`
3. 启动 `npm run start`
