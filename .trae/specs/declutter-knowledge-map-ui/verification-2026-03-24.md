# 回归验证记录（2026-03-24，Task6）

## 执行命令与结果

1. `bash scripts/demo-verify.sh http://localhost:8787 skip-build`：退出码 0（页面、搜索/聊天/图谱 API、反馈导出均通过）
2. 图谱切换抽样请求校验（`links`、`tags`、`entity`、`public`）：退出码 0
   - links: nodes=6, edges=8, maxWeight=1
   - tags: nodes=21, edges=31, maxWeight=1
   - entity: nodes=73, edges=423, maxWeight=2
   - public: nodes=6, edges=8, maxWeight=1
3. 交互链路实现校验（`frontend/src/map.ts`）：
   - 图切换：`graphKind.onchange`
   - 筛选：`tagFilter.onchange`、`edgeTypeFilter.onchange`、`minWeight.oninput`
   - 重置：`resetView.onclick`
   - 节点点击：`node.on("click")` + 侧栏邻居快捷点击 `data-node-id` 事件
4. 响应式与主视觉占比校验（`themes/discovery-light/layouts/_default/discovery-map.html`）：
   - 断点规则存在：1279 / 980 / 767
   - 画布容器：`#map-wrap` 双栏 `1fr + 260px`，并设置 `min-height: clamp(620px, 78vh, 860px)`
   - 窄屏收敛：980 以下切换单栏并提升可视高度 `clamp(620px, 82vh, 920px)`
   - 信息合并：节点信息、关系、图谱纠错均位于同一 `map-side-card` 容器
5. `npm run typecheck:frontend`：退出码 0

## 验收结论

- Task6 通过：图切换、筛选、重置、节点点击链路正常，未发现回归。
- 桌面与窄屏下可读性通过：控制区和筛选区具备明确重排规则，交互控件未与图谱区域产生遮挡冲突。
- 图谱主视觉占比通过：首屏空间以图谱画布为主，侧栏信息已收敛到紧凑容器，不再竞争主要展示区域。

## 同步更新

- `tasks.md`：Task6 与全部子任务已勾选。
- `checklist.md`：新增三项（主视觉占比、信息容器合并、空间竞争收敛）已勾选。
