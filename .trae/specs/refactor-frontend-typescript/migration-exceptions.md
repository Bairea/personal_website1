# Task4 迁移例外与后续处理清单

## 例外清单

1. `discovery-map` 仍依赖外部 CDN 注入的全局 `d3`，未纳入 TypeScript 构建产物。
2. `themes/minimal` 主题模板仍保留旧版内联脚本，当前运行主题为 `discovery-light`，不影响现网路径。

## 后续处理

1. 评估将 `d3` 改为本地静态资源或构建期依赖，消除对外部 CDN 的可用性耦合。
2. 若需要切换到 `minimal` 主题，先复用 `discovery-light` 的外置脚本接线方式完成模板迁移。
