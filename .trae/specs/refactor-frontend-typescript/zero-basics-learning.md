# 零基础学习文档：前端 TypeScript 改造项目

## 1. 先理解这次改造在做什么

这次改造的目标是把模板里的业务内联脚本迁移到 `frontend/src/*.ts`，再编译到主题静态目录，让页面继续用原有 URL 和 API 工作，但代码更容易维护和扩展。

## 2. 项目结构与核心组件

### 2.1 你最常会改到的目录

- `frontend/src/`：前端源码入口
  - `search.ts`：搜索页交互
  - `map.ts`：知识地图交互
  - `chat.ts`：聊天页交互
  - `common.ts`：通用方法（DOM、转义、反馈上报）
  - `bootstrap.ts`：站点级最小初始化
- `themes/discovery-light/layouts/_default/`：Hugo 模板（结构 + 脚本引用）
- `themes/discovery-light/static/js/`：TypeScript 编译产物，页面直接加载
- `server/index.js`：`/api/search`、`/api/chat`、`/api/graph`、`/api/feedback` 等后端接口
- `scripts/build-artifacts.js`：索引、图谱、向量构建
- `content/posts/`：文章源内容
- `data/`：运行数据（SQLite、缓存、规则）

### 2.2 页面与脚本入口关系

- 基础脚本：`baseof.html` 引入 `js/bootstrap.js`
- 搜索页：`discovery-search.html` 引入 `js/search.js`
- 地图页：`discovery-map.html` 引入 `js/map.js`
- 聊天页：`discovery-chat.html` 引入 `js/chat.js`

你定位问题时，先看页面模板对应加载了哪个脚本，再进入 `frontend/src` 找同名 `.ts` 文件。

## 3. 数据流（从内容到页面，再到反馈）

## 3.1 构建期数据流

1. `content/posts/*.md` 作为事实源。
2. `npm run build:site` 用 Hugo 生成页面到 `public/`。
3. `npm run build:artifacts` 生成搜索索引、图谱和向量数据。
4. `npm run build:frontend` 把 `frontend/src/*.ts` 编译到 `themes/discovery-light/static/js/*.js`。

## 3.2 运行时数据流

1. 用户打开 `/search/` `/map/` `/chat/` 页面。
2. 页面加载对应 `js/*.js` 脚本。
3. 脚本调用后端 API：
   - 搜索页调用 `/api/search`
   - 地图页调用 `/api/graph` 与 `/api/graph/rules`
   - 聊天页调用 `/api/chat` 与 `/api/graph/public`
4. 关键交互通过 `sendFeedback` 上报到 `/api/feedback`，最终落入 `data/feedback.db`。

## 4. 前端构建链路与常见改动路径

## 4.1 构建链路（必须掌握）

- TypeScript 配置：`tsconfig.frontend.json`
  - 源目录：`frontend/src`
  - 产物目录：`themes/discovery-light/static/js`
- 常用命令：
  - `npm run build:frontend`：只编译前端 TS
  - `npm run typecheck:frontend`：只做前端类型检查
  - `npm run build`：前端 + 站点 + 构建产物全量构建
  - `npm run start`：启动本地服务（默认 `http://localhost:8787`）

## 4.2 常见改动路径

- 改页面交互文案或行为：
  1. 找模板入口（例如 `discovery-search.html`）
  2. 找对应 TS（例如 `frontend/src/search.ts`）
  3. 修改后执行 `npm run typecheck:frontend`
  4. 执行 `npm run build:frontend`
  5. 刷新页面验证
- 改通用工具：
  1. 修改 `frontend/src/common.ts`
  2. 回归验证 search/map/chat 三页
- 改 API 交互参数：
  1. 先看前端发起请求的 payload
  2. 对照 `server/index.js` 接口约定同步修改
  3. 优先保证 URL 和字段向后兼容

## 5. 从定位问题到验证发布：实操示例

示例目标：把搜索页空查询提示改成“请输入关键词开始搜索”。

## 5.1 定位改动点

1. 搜索页模板是 `discovery-search.html`，加载 `js/search.js`。
2. 对应源码在 `frontend/src/search.ts`。
3. 在初始化和 Enter 空输入分支里都能看到“请输入查询词。”。

## 5.2 实施改动

1. 修改 `frontend/src/search.ts` 中两处提示文案。
2. 运行：

```bash
npm run typecheck:frontend
npm run build:frontend
```

## 5.3 本地验证

1. 启动服务：

```bash
npm run start
```

2. 打开 `http://localhost:8787/search/`，输入框为空直接回车。
3. 预期结果：提示文案为“请输入关键词开始搜索”。
4. 再输入 `hugo` 回车，预期能正常展示命中列表。

## 5.4 发布前最小检查清单

1. 前端类型检查通过：`npm run typecheck:frontend`
2. 全量构建通过：`npm run build`
3. 页面可访问：`/` `/search/` `/map/` `/chat/`
4. 关键 API 可用：`/api/search` `/api/chat` `/api/graph`

如果你只改了前端文案或交互逻辑，但没改后端契约，这套检查通常已经足够覆盖风险。
