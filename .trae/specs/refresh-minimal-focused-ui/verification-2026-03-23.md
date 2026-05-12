# 回归验证记录（2026-03-23）

## 执行命令与结果

1. `npm run typecheck:frontend`：退出码 0
2. `npm run build`：退出码 0
3. `bash scripts/demo-verify.sh http://localhost:8787 skip-build`：退出码 0
4. 页面样式与响应式抽样校验（`/`、`/posts/`、`/search/`、`/map/`、`/chat/`）：退出码 0
5. 搜索/地图/聊天交互链路校验（含公共导览图保存与读取）：退出码 0

## 验收结论

- 视觉一致性通过：核心页面均继承统一设计 token 与组件样式规则。
- 响应式通过：基础断点规则生效，核心页面在窄屏下无明显布局破损。
- 功能回归通过：搜索、地图、聊天核心交互与结果正常，聊天不熟悉模式可返回阅读路径与临时子图，并可保存为公共导览图后读取。

## 对应证据位置

- 任务清单已完成：`.trae/specs/refresh-minimal-focused-ui/tasks.md`
- 验收清单已全勾选：`.trae/specs/refresh-minimal-focused-ui/checklist.md`
- 端到端回归脚本：`scripts/demo-verify.sh`
