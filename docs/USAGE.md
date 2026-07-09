# 个人网站使用文档

## 1. 项目能力总览

- 站点：Hugo 生成静态页面（文章、标签、系列、RSS、sitemap）
- 搜索：Pagefind 客户端搜索（浏览器端执行，零服务器开销）
- 知识地图：`/map/` 可切换内链图、标签图
- 图谱 API：`/api/graph` 提供预构建的图谱 JSON

## 2. 目录约定

- `content/posts/`：文章源文件
- `static/media/`：图片目录，按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织（构建后映射为 `/media/...`）
- `scripts/build-artifacts.js`：图谱 JSON 构建
- `server/index.js`：静态文件 + 图谱 API 服务
- `public/`：Hugo 输出静态站点
- `public/pagefind/`：Pagefind 搜索索引 + JS/WASM bundle（构建时生成）
- `public/artifacts/`：图谱 JSON（构建时生成）

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
- Markdown → build-artifacts.js：生成 `public/artifacts/graph-*.json`（内链图、标签图）
- Hugo HTML → Pagefind：生成 `public/pagefind/`（搜索索引 + JS/WASM bundle）

## 6. 内容编写规范

- 文章放在 `content/posts/*.md`
- 推荐 front matter：`title`、`date`、`tags`、`summary`、`series`、`slug`
- 图片存储：
  - 文件放 `static/media/<yyyy>/<mm>/<slug>-<desc>.<ext>`
  - 文中用绝对路径 `/media/<yyyy>/<mm>/<slug>-<desc>.<ext>`
  - 格式优先级：SVG > WebP > PNG > JPG
- 内部链接使用相对 `.md` 路径（如 `[text](./other.md)`）

## 7. 常用命令

```bash
npm run build              # 全量构建
npm run build:site         # 仅构建 Hugo 页面
npm run build:artifacts    # 仅构建图谱 JSON
npm run build:search       # 仅构建 Pagefind 搜索索引
npm run build:frontend     # 仅编译前端 TypeScript
npm run start              # 启动服务
npm run typecheck:frontend # 类型检查
```

## 8. 常见问题

- 页面 404：确认先执行 `npm run build`
- 搜索无结果：检查文章是否在 `content/posts/` 且包含 `data-pagefind-body` 属性（由 `layouts/_default/single.html` 模板自动添加）
- 地图太稀疏：补充内链和标签交叉
- 深色模式搜索框不可见：检查 `layouts/partials/extend_head.html` 中 Pagefind CSS 变量覆盖是否生效

## 9. 备份与恢复

- 必备备份：`content/`、`static/media/`
- 可重建项（可不备份）：`public/`、`node_modules/`

恢复流程：

1. 恢复 `content/` 与 `static/media/`
2. 执行 `npm install` + `npm run build`
3. 启动 `npm run start`
