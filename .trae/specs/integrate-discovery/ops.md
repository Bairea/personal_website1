# 运维与备份（Hugo + Discovery）

## 运行方式

### 本地

- 安装依赖：`npm install`
- 构建站点与发现产物：`npm run build`
- 启动服务：`npm run start`
- 入口：
  - `/`：导航
  - `/search/`：搜索
  - `/map/`：知识地图
  - `/chat/`：Chat

## 图床发布规范（static/media）

### 目录约定

- 图片一律放在 `static/media/**`，推荐分层：`static/media/<yyyy>/<mm>/<slug>.<ext>`
- 文件命名使用小写英文与短横线，避免空格和中文文件名，降低 URL 编码与兼容风险
- 文章中一律用站点绝对路径引用：`/media/<yyyy>/<mm>/<slug>.<ext>`

### 引用示例

- Markdown：`![流程图](/media/2026/03/discovery-pipeline.webp)`
- HTML：`<img src="/media/2026/03/discovery-pipeline.webp" alt="流程图" loading="lazy">`

### 发布流程

1. 将图片写入 `static/media/**`
2. 在文章中引用 `/media/**`
3. 执行 `npm run build`
4. 确认 `public/media/**` 已生成同名文件后再发布

## 统计与反馈闭环

### 已采集事件

- 搜索：`search_query`、`search_click`
- Chat：`chat_query`、`chat_citation_click`、`chat_path_click`、`chat_temp_graph_saved`
- 地图：`graph_node_click`、`graph_node_open`

### 写入接口

- `POST /api/feedback`
- 最小字段：`type`（必填）
- 可选字段：`ts`、`q`、`docId`、`url`、`nodeId`、`kind`

### 导出接口

- JSON：`GET /api/feedback/export.json?since=<ms>&until=<ms>`
- CSV：`GET /api/feedback/export.csv?since=<ms>&until=<ms>`
- 不传参数时默认导出全量（`since=0` 到当前时间）

### 导出流程（建议日更）

1. 确定时间窗（如前一天 00:00-24:00 的毫秒时间戳）
2. 导出 JSON 归档原始数据
3. 导出 CSV 供表格工具快速分析
4. 同步备份 `data/feedback.db` 以支持后续二次分析

## 可选 GoatCounter 接入

### 适用场景

- 需要页面 PV/UV、来源、设备等站点级指标
- 与本地 `feedback.db` 互补：GoatCounter 管站点访问，`/api/feedback` 管搜索与交互行为

### 最小接入步骤

1. 在 GoatCounter 创建站点并获取 `script` 地址（`https://gc.zgo.at/count.js`）与 `data-goatcounter` 值
2. 在 `themes/minimal/layouts/_default/baseof.html` 的 `</body>` 前插入统计脚本
3. 重新执行 `npm run build` 并发布

### 推荐脚本片段

```html
<script
  data-goatcounter="https://<your-site>.goatcounter.com/count"
  async
  src="//gc.zgo.at/count.js"
></script>
```

## 环境变量

- `PORT`：服务端口（默认 8787）
- `API_KEY`：开启后要求 `x-api-key` 或 `Authorization: Bearer <key>` 才能访问 `/api/chat` 与 `/api/feedback`
- `CHAT_CONCURRENCY`：Chat 并发上限（默认 2）
- `AI_CHAT_URL`：可选，提供后 `/api/chat` 会调用该 URL（POST JSON：question/contexts/citations）
- `AI_CHAT_KEY`：可选，作为 `Authorization: Bearer` 传递给 `AI_CHAT_URL`
- `EMBEDDING_PROVIDER`：用于返回引用证据中的 provenance.model（默认 hash）

## 反代与缓存示例（静态 + /api）

### Nginx 示例

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ~* \.(css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store";
  }

  location ~ ^/api/(search|graph)$ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=30";
  }
}
```

### Caddy 示例

```caddyfile
example.com {
  encode zstd gzip

  @asset path_regexp asset \.(css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$
  header @asset Cache-Control "public, max-age=2592000, immutable"

  @api path /api/*
  header @api Cache-Control "no-store"

  @api_cache path /api/search* /api/graph*
  header @api_cache Cache-Control "public, max-age=30"

  reverse_proxy 127.0.0.1:8787
}
```

### 缓存策略建议

- 静态资源：长缓存（30 天）+ immutable，降低带宽与回源
- 页面 HTML：依赖默认协商缓存（ETag/Last-Modified），避免过期页面长期驻留
- API 默认：`no-store`，避免 Chat/反馈被缓存
- API 可短缓存：仅对只读查询接口（`/api/search`、`/api/graph`）设置 10-30 秒

## 备份范围

### 必备（必须备份）

- `content/`：Markdown 原文（单一事实来源）
- `static/media/`：图床原图（发布稳定 URL）
- `data/`：
  - `feedback.db`、`feedback.db-wal`、`feedback.db-shm`（反馈闭环核心数据）
  - `search_lexical.db`（可重建）
- `vectors/`（可重建）

### 可选

- `public/`：静态页面与图谱 JSON（可重建，备份可加速恢复）
- `package.json` 与锁文件（保证可重复安装）

### 备份频率建议

- 每次发布前：备份 `content/` 与 `static/media/`
- 每日：备份 `data/feedback.db*`
- 每周：打包快照 `content/ + static/media/ + data/feedback.db* + package*.json`
- 每月：抽样做一次重建演练并记录耗时

### 备份示例命令

```bash
mkdir -p backups
ts="$(date +%Y%m%d-%H%M%S)"
tar -czf "backups/site-${ts}.tgz" \
  content static/media \
  data/feedback.db data/feedback.db-wal data/feedback.db-shm \
  package.json package-lock.json
```

## 重建流程（灾备/迁移）

1. 恢复 `content/`、`static/media/` 与 `data/feedback.db*`（如需保留反馈历史）
2. 执行 `npm ci`（或 `npm install`）
3. 执行 `npm run build` 重建 `public/`、`data/search_lexical.db`、`public/artifacts/*`、`vectors/`
4. 执行 `npm run start` 启动服务
5. 用 `GET /api/contract`、`GET /api/search?q=...`、`GET /api/graph?kind=links` 做快速验收

## 端到端验证清单（Task 6）

### 1) Hugo 与产物构建

- 命令：`npm run build`
- 通过标准：退出码为 0，且 `public/index.html`、`public/artifacts/docs.json` 存在

### 2) 搜索接口

- 命令：`curl "http://127.0.0.1:8787/api/search?q=hello&mode=hybrid"`
- 通过标准：返回 `ok: true` 且 `hits` 非空

### 3) 地图接口

- 命令：`curl "http://127.0.0.1:8787/api/graph?kind=entity"`
- 通过标准：返回 `ok: true` 且 `graph.nodes` 非空

### 4) Chat 接口

- 命令：`curl -X POST "http://127.0.0.1:8787/api/chat" -H "content-type: application/json" -d '{"q":"我不熟悉这个站点，从零开始怎么读？","unfamiliar":true}'`
- 通过标准：返回 `ok: true`，包含 `answer`、`citations`，并出现 `reading_path` 与 `temp_graph`

### 5) 反馈导出

- 先写入：`curl -X POST "http://127.0.0.1:8787/api/feedback" -H "content-type: application/json" -d '{"type":"search_query","q":"hello"}'`
- 再导出：
  - JSON：`curl "http://127.0.0.1:8787/api/feedback/export.json?since=0"`
  - CSV：`curl "http://127.0.0.1:8787/api/feedback/export.csv?since=0"`
- 通过标准：JSON 含新增事件，CSV 含表头与事件行

## 本次验证记录（2026-03-22）

- 构建验证：`npm run build` 退出码 0，Hugo 构建与 artifacts 生成成功
- 页面验证：`/`、`/search/`、`/map/`、`/chat/` 均返回 HTML
- 搜索验证：`/api/search?q=hello&mode=hybrid` 返回 `ok: true` 且命中 `hello`
- 地图验证：`/api/graph?kind=entity` 返回 `ok: true` 且 `graph.nodes` 非空
- Chat 验证：`/api/chat` 返回 `answer`、`citations`，在 unfamiliar 场景返回 `reading_path` 与 `temp_graph`
- 反馈导出验证：写入 `search_query` 后，JSON/CSV 导出均含事件数据
