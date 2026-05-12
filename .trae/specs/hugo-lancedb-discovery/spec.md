# Hugo + LanceDB 发现系统一体化落地 Spec

## Why

目前仓库已有“发现系统”（搜索/知识地图/Chat）的 MVP，但站点本体尚未用 Hugo 构建与承载。需要把“个人网站（SEO 友好、日更发布、图床、统计）”与“搜索 + Chat（向量库）+ 知识地图”统一到一套可部署、可演进、低资源的自建方案里。

## What Changes

- 用 Hugo 构建站点本体（文章、栏目、SEO 基线、RSS/sitemap），并把现有搜索/地图/Chat 前端页面迁移为 Hugo 页面
- 统一 URL 规则：Hugo 的文章 URL 与索引/图谱/向量库中的 doc.url 保持一致且长期稳定
- 将构建阶段产物纳入 Hugo 构建链路：关键词索引（SQLite FTS5）、图谱 JSON、向量库（LanceDB）
- API 服务继续保持极轻量（Node/Express），以 `/api/*` 提供：混合搜索、Chat、反馈采集与导出；其余内容由 Hugo 静态托管
- 把“阶段 2/3”的增强能力一并纳入规划：agent 元数据生成、可解释混合检索、问题图/实体图、临时子图可保存为公共导览图
- 站点外观升级：基于内容定位挑选并集成一个合适的 Hugo 主题，统一首页、文章、地图、搜索、Chat 的视觉风格与导航体验
- 明确图床与统计：图床以 `static/media/**` 为默认；统计以本地反馈库与导出为默认（可选接入 GoatCounter）
- 给出部署拓扑（Nginx/Caddy 反代静态与 API）、备份与重建策略

## Impact

- Affected specs: recommend-blog-stack、integrate-discovery、add-knowledge-maps
- Affected code: Hugo 站点结构、Hugo layout、索引/图谱/向量构建脚本、API 服务路由、部署与运维文档

## ADDED Requirements

### Requirement: Hugo 站点骨架

系统 SHALL 以 Hugo 生成站点页面（文章页、列表页、标签/系列页），并输出可部署的静态目录。

#### Scenario: 发布文章

- **WHEN** 新增或修改一篇 Markdown 文章并执行构建
- **THEN** Hugo 输出更新后的静态页面，且该文章的 URL 保持稳定

### Requirement: Hugo 主题选型与统一外观

系统 SHALL 根据当前内容特征（技术文章、搜索入口、知识地图、Chat 工具页）选择一个 Hugo 主题并完成统一视觉集成，要求：

- 首页、文章页、标签页、系列页与工具页（/search /map /chat）视觉风格一致
- 导航结构清晰，突出“文章阅读 + 搜索 + 地图 + Chat”主路径
- 主题在低资源环境下保持轻量（静态资源可控、无重型运行时依赖）
- 不破坏既有 URL、SEO 基线与现有 API 交互

#### Scenario: 主题切换后功能保持

- **WHEN** 完成主题替换并重新构建站点
- **THEN** 页面风格更新，同时搜索、地图、Chat、反馈导出等功能入口与行为保持可用

### Requirement: URL 一致性

系统 SHALL 定义并锁定文章 URL 规则，且索引/图谱/向量库中的 `doc.url` 必须与 Hugo 产物一致。

### Requirement: 搜索能力（混合）

系统 SHALL 提供搜索：

- 关键词检索：基于 SQLite FTS5（低运维、可解释）
- 语义检索：基于 LanceDB（向量库）
- 混合合并：返回 why 字段解释 lexical/vector 命中原因

### Requirement: 阶段 2 AI 补强（元数据与向量）

系统 SHALL 在构建阶段支持 agent 自动生成并维护：

- tags/summary/keywords（写入可重建缓存，不覆盖 Markdown 权威来源）
- embedding 生成策略：优先标题+摘要，再扩展到正文 chunk
- 结果可追溯（记录生成时间、模型标识、版本）

### Requirement: Chat（RAG）

系统 SHALL 提供 Chat 接口并返回：

- answer（可由用户提供的 AI API 生成；未配置时提供本地 fallback）
- citations（Evidence 格式，可跳转文章）
- unfamiliar 模式：reading_path + temp_graph（临时子图）
- 支持将临时子图按需保存为“公共导览图”

### Requirement: 知识地图（整体框架一览）

系统 SHALL 生成并展示至少两张“零模型”地图：

- 内链/引用图（可解释）
- 标签共现图（概念视角）
  并支持节点预览与跳转文章。

### Requirement: 知识地图交互增强（Obsidian 风格）

系统 SHALL 为知识地图提供更强交互能力，至少包括：

- 拖拽节点（Drag）与画布平移（Pan）
- 滚轮缩放（Zoom）与视图重置（Reset View）
- 悬浮高亮：高亮当前节点及一阶邻居，弱化无关节点
- 点击聚焦：锁定中心节点并展示关系面板（邻居、边类型、文章预览）
- 基础筛选：按图类型、标签、边类型、最小权重筛选
- 大图性能保护：节点/边数量较大时仍保持可用交互（节流/分层渲染/简化样式）

#### Scenario: 用户探索知识图谱

- **WHEN** 用户在地图页拖拽、缩放、点击节点并切换筛选条件
- **THEN** 视图应实时响应，且用户能快速看清节点关系并继续跳转阅读文章

#### Scenario: 近似 Obsidian 的关系感知

- **WHEN** 用户悬浮或选中某个节点
- **THEN** 界面突出显示相关连接与邻居，提供接近 Obsidian 图谱的探索体验

### Requirement: 阶段 3 知识体系增强

系统 SHALL 在“零模型地图”基础上，先落地以下增强能力之一（可配置二选一）：

- 问题图（Query/Question Graph）
- 实体图（Entity Graph）

并提供基础纠错入口（人工修订与白名单/黑名单），用于持续提升图谱质量。

### Requirement: 图床

系统 SHALL 支持文章图片引用并满足：

- 默认图床路径为 Hugo 的 `static/media/**`
- 产物 URL 稳定（不因构建/部署变化）

### Requirement: 统计与反馈闭环

系统 SHALL 支持记录与导出最小化反馈数据：

- 搜索查询与点击
- Chat 查询与引用点击
- 知识地图节点点击/打开
  并可导出 JSON/CSV 用于内容优化。

### Requirement: 低资源自建与可恢复

系统 SHALL 适配 2C/2G/3Mbps/40G 环境：

- 线上以静态托管为主
- API 服务可限流、可鉴权、并发受控
- 索引/图谱/向量均可从 Markdown 重建

## MODIFIED Requirements

### Requirement: Markdown 为单一事实来源

系统 SHALL 将 `content/**/*.md` 迁移为 Hugo 的内容目录并保持“单一事实来源”；衍生产物（索引/图谱/向量/AI 缓存）不得成为权威来源。

## REMOVED Requirements

无
