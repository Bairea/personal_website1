# 前端脚本模块化与 TypeScript 化 Spec

## Why

当前主题页面将较多 JavaScript 直接内嵌在 HTML 模板中，导致复用、测试和维护成本偏高。将脚本外置并逐步 TypeScript 化，可降低长期改动风险，并为后续功能扩展建立更清晰的工程边界。

## What Changes

- 将 `themes/*/layouts/_default` 中内嵌脚本抽离为独立静态脚本模块，按页面能力拆分（search/map/chat/通用）。
- 在不改变现有 URL 与 API 契约的前提下，引入 TypeScript 编译链路，将核心前端逻辑迁移为 `.ts` 源码并产出浏览器可用脚本。
- 建立统一的前端目录结构（源码、构建产物、类型定义）与最小构建命令，保证本地开发与构建流程可复现。
- 补充一份从零上手的项目学习文档，覆盖仓库结构、数据流、页面入口、构建流程、常见改动路径与验证方式。
- 补充迁移边界与回退策略，确保分步迁移过程中线上行为可回归验证。

## Impact

- Affected specs: 站点主题渲染能力、发现系统前端交互能力、项目文档能力
- Affected code: `themes/*/layouts/_default/*.html`、前端脚本目录（新增）、前端构建配置（新增/调整）、项目文档目录

## ADDED Requirements

### Requirement: 前端脚本外置模块化

系统 SHALL 将页面内联脚本迁移为外置脚本文件，并按页面能力与共享能力进行模块划分。

#### Scenario: 页面加载外置脚本成功

- **WHEN** 用户访问 search/map/chat 或文章页面
- **THEN** 页面通过模板引用外置脚本并保持既有交互行为

### Requirement: 前端 TypeScript 构建链路

系统 SHALL 提供可执行的 TypeScript 构建流程，将源码编译为当前主题可直接引用的静态脚本。

#### Scenario: 本地执行构建

- **WHEN** 开发者执行前端构建命令
- **THEN** 生成可发布脚本且无类型错误阻断（或仅保留明确登记的例外）

### Requirement: 零基础学习文档

系统 SHALL 提供面向新加入开发者的学习文档，帮助其理解项目组成并可独立完成常见改动。

#### Scenario: 新开发者按文档完成一次改动

- **WHEN** 新开发者按文档执行“定位页面 -> 修改脚本 -> 本地验证”
- **THEN** 能找到对应代码入口并完成一次最小可验证改动

## MODIFIED Requirements

### Requirement: 主题页面资源组织方式

主题页面模板 SHALL 以“结构与数据绑定”为主，不再承载大段业务脚本逻辑；业务逻辑通过外置脚本模块提供。

## REMOVED Requirements

### Requirement: 无

**Reason**: 本次为增量重构，不移除既有产品能力。
**Migration**: 不涉及数据迁移；通过分页面迁移与回归验证保证平滑过渡。
