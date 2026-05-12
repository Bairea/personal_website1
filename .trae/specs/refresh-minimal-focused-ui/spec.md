# 简洁专注页面改版 Spec

## Why

当前网站在视觉层次与文案表达上存在信息噪声，影响阅读专注度与品牌一致性。需要在保持现有信息架构的前提下，统一页面审美并提升文案清晰度。

## What Changes

- 重构首页与核心内容页（列表页、文章页、搜索页、地图页、聊天页）的视觉样式，形成“简洁、专注、克制”的统一设计语言。
- 优化排版系统（字号、行高、字重、段落间距、容器宽度）以提升长文阅读体验。
- 统一交互细节（链接、按钮、输入框、卡片、提示态）的视觉规则，减少装饰性干扰。
- 对关键页面文案进行润色，强化信息可读性与动作引导（如搜索提示、空状态、导航文案）。
- 在不改变核心功能与路由结构的前提下完成改版，确保现有脚本行为保持可用。

## Impact

- Affected specs: 主题模板展示规范、页面可读性规范、交互一致性规范、文案语气规范
- Affected code: `themes/minimal/layouts/_default/*`、必要的样式入口文件、`content/*.md` 与 `content/posts/*.md` 中需润色的标题/摘要/引导文案

## Spec 补充说明（Task 1 基线冻结）

### 当前生效主题与页面模板映射

- 当前 `hugo.toml` 生效主题为 `discovery-light`，本次改版优先以 `themes/discovery-light/layouts/_default/*` 为主范围；`themes/minimal/layouts/_default/*` 作为历史主题保持只读，不纳入本轮实施。
- 首页 `/` 与文章列表 `/posts/` 使用 `list.html`。
- 文章详情 `/posts/:slug.html` 使用 `single.html`。
- 搜索页 `/search/` 使用 `discovery-search.html`。
- 地图页 `/map/` 使用 `discovery-map.html`。
- 聊天页 `/chat/` 使用 `discovery-chat.html`。
- 标签与系列聚合页分别由 `terms.html` 与 `taxonomy.html` 提供。

### 样式基线（改版前）

- 样式主要以内联 `<style>` 分散在 `baseof.html`、`discovery-search.html`、`discovery-map.html`、`discovery-chat.html`，尚未形成统一 token 与组件层。
- `baseof.html` 已定义基础变量（`--bg`、`--panel`、`--text`、`--muted`、`--primary`、`--border`、`--ring`）与卡片/导航基础样式，但子页面仍存在重复定义与局部覆盖。
- 搜索、地图、聊天页分别维护 `tool-card`、`map-*`、`chat-*` 局部样式，边框半径、间距、描边与 hover/focus 规则尚未完全统一。
- taxonomy/terms 列表项仍含行内样式，导致页面级样式复用能力弱、后续维护成本偏高。

### 文案基线（改版前）

- 全局导航与页头文案基于 `baseof.html`（如“首页/文章/标签/系列/搜索/地图/Chat”与“技术内容 · 可检索 · 可探索 · 可对话”）。
- 页面引导文案分布在模板与前端脚本：搜索输入提示、地图操作提示、聊天提示与按钮文案存在语气差异。
- 状态文案分散在 `themes/discovery-light/static/js/search.js`、`map.js`、`chat.js`（如“请输入查询词”“提交中…”“完成”），缺少统一措辞与风格规则。
- 内容入口文案基于 `content/_index.md`、`content/posts/_index.md` 与各文章 front matter 的 `title/summary`，需在不改变信息意图前提下进行简化与统一。

### 本轮改版范围冻结

- 纳入：`themes/discovery-light/layouts/_default/baseof.html`、`list.html`、`single.html`、`terms.html`、`taxonomy.html`、`discovery-search.html`、`discovery-map.html`、`discovery-chat.html`。
- 纳入：`themes/discovery-light/static/js/search.js`、`map.js`、`chat.js` 中直接面向用户的状态与提示文案。
- 纳入：`content/_index.md`、`content/posts/_index.md` 与 `content/posts/*.md` 的标题、摘要、引导段落等展示文案。
- 不纳入：后端接口语义、路由结构、数据模型与图算法逻辑，仅做视觉与文案层改版。

## ADDED Requirements

### Requirement: 统一的简洁专注视觉系统

系统 SHALL 提供统一且可复用的视觉规则，确保所有核心页面具备一致的简洁风格与阅读节奏。

#### Scenario: 核心页面一致性

- **WHEN** 用户在首页、列表页、文章页与功能页之间切换
- **THEN** 页面应呈现一致的排版尺度、留白策略与交互风格

### Requirement: 面向阅读的文案润色机制

系统 SHALL 在不改变原有信息意图的情况下，对关键界面文案进行简洁化与可读性优化。

#### Scenario: 文案可读性提升

- **WHEN** 用户查看导航、说明文案、空状态与操作提示
- **THEN** 文案应更短、更明确，并与页面整体语气一致

## MODIFIED Requirements

### Requirement: 现有主题模板呈现规则

系统 SHALL 将现有模板中的视觉表现调整为“低干扰、强可读、弱装饰”风格，保持原有功能入口与信息结构不变。

#### Scenario: 兼容原有功能

- **WHEN** 用户执行搜索、查看地图或使用聊天入口
- **THEN** 页面视觉样式已更新，但功能路径与核心交互结果保持不变

## REMOVED Requirements

### Requirement: 旧版高噪声视觉表现

**Reason**: 旧样式中存在不必要的视觉竞争，影响阅读效率与信息聚焦。  
**Migration**: 以统一设计 token 与组件样式替代分散样式，逐页回归验证视觉与功能一致性。
