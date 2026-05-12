# 使用文档与可视化 Demo 计划

## 目标
- 提供一份可直接上手的使用文档，覆盖 Hugo 站点、搜索、知识地图、Chat、反馈导出、实体图纠错。
- 提供“足够可见”的 demo 数据与演示路径，让你启动后无需额外配置即可看到主要功能效果。

## 范围
- 仅新增/更新文档与 demo 数据、示例页面内容、可复现实验步骤。
- 不改变当前总体架构（Hugo + Node API + SQLite FTS5 + LanceDB）。

## 交付物
- `docs/USAGE.md`：主使用文档（从 0 到可运行）
- `docs/DEMO-WALKTHROUGH.md`：功能巡检脚本（点击路径 + API 验证）
- `content/posts/` 下新增 4~6 篇演示文章（包含标签、系列、内链、图片引用）
- `static/media/demo/` 下新增演示图片资源
- `data/entity-graph-rules.json` 示例规则补充（保留可回滚）
- （可选）`scripts/demo-verify.sh`：一键验证关键接口

## 实施步骤

### 第 1 步：梳理当前能力与文档缺口
- 盘点当前可用页面与接口：`/`, `/posts`, `/search`, `/map`, `/chat`, `/api/search`, `/api/chat`, `/api/graph`, `/api/feedback/export.*`
- 明确文档缺口：启动顺序、环境变量、常见问题、demo 数据准备、验收路径
- 输出文档目录结构与章节大纲

### 第 2 步：编写主使用文档（USAGE）
- 写“5 分钟启动”章节：
  - 安装依赖
  - 一次构建（Hugo + artifacts）
  - 启动服务
  - 浏览器访问入口
- 写“配置”章节：
  - `PORT`、`API_KEY`、`AI_CHAT_URL`、`AI_CHAT_KEY`、`CHAT_CONCURRENCY`
  - 未配置 AI 时的 fallback 行为说明
- 写“数据流”章节：
  - Markdown -> Hugo 页面
  - Markdown -> FTS5/LanceDB/图谱 JSON
  - 用户行为 -> feedback 导出
- 写“维护与重建”章节：
  - 增量构建
  - 全量重建
  - 备份与恢复最小集合

### 第 3 步：准备可见效果的 demo 内容
- 新增 4~6 篇演示文章，覆盖：
  - 至少 2 个系列（series）
  - 至少 8~12 个标签
  - 明确的文章内链（用于内链图）
  - 关键词与摘要（提升搜索效果）
  - 至少 2 篇包含图片（`/media/demo/...`）
- 设计文章主题有“先修关系”（便于 Chat 生成阅读顺序）

### 第 4 步：增强实体图 demo 可见性
- 在 `entity-graph-rules.json` 增加小规模白名单/黑名单示例
- 提供 2~3 条“人工节点/人工边”样例，确保“纠错入口”操作后能即时看到变化
- 文档补充“如何添加/删除一条规则”的步骤与预期结果

### 第 5 步：编写 Demo Walkthrough（可直接照做）
- 页面巡检流程（浏览器）：
  - 首页 -> 文章列表 -> 标签/系列 -> 搜索 -> 地图 -> Chat
- API 巡检流程（命令行）：
  - `GET /api/search?mode=lexical|vector|hybrid`
  - `POST /api/chat`（普通与 unfamiliar 两种）
  - `GET /api/graph?kind=links|tags|entity|public`
  - `POST /api/graph/public`
  - `GET /api/feedback/export.json|csv`
- 每一步都写“预期现象”，并给失败排查建议

### 第 6 步：做端到端验收并记录结果
- 执行完整构建与启动
- 按 Walkthrough 逐项验证
- 记录最终“通过清单”：
  - 页面可访问
  - 搜索三模式可返回结果与 why
  - 地图可切换（links/tags/entity/public）
  - Chat 返回 citations，unfamiliar 返回 reading_path + temp_graph
  - 反馈导出可用

## Demo 设计标准（通过门槛）
- 搜索任意 3 个关键词都应返回可读结果
- 地图页初次打开就有足够节点（非空、非单点）
- Chat 至少能输出 2 条引用（在 demo 语料下）
- unfamiliar 场景下能给出 3 条以上阅读顺序建议
- 公共导览图可保存并再次读取

## 风险与规避
- 风险：demo 文章太少导致向量检索和图谱稀疏  
  规避：增加跨主题但有交叉标签的文章，确保边密度
- 风险：图片路径不统一导致 404  
  规避：统一使用 `/media/demo/...`，并在文档写明约定
- 风险：AI 未配置造成误解  
  规避：文档明确 fallback 输出与如何接入 AI API

## 完成定义（DoD）
- 使用文档可让新用户在 10 分钟内跑通全功能
- Demo Walkthrough 按步骤执行可稳定复现结果
- 所有关键页面与 API 在 demo 数据下均有可见输出
- 文档覆盖“启动、配置、使用、排障、重建、备份”
