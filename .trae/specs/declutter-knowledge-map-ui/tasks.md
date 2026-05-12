# Tasks

- [x] Task 1: 盘点知识地图拥挤与重复项
  - [x] SubTask 1.1: 标记控制区中的重复术语与重复层级
  - [x] SubTask 1.2: 冻结目标布局分组与响应式断点策略
- [x] Task 2: 重构地图控制区布局与视觉层级
  - [x] SubTask 2.1: 拆分主操作层与筛选层并统一间距规则
  - [x] SubTask 2.2: 精简按钮与下拉组合，保留核心操作优先级
  - [x] SubTask 2.3: 处理窄屏重排，避免控件拥堵与遮挡
- [x] Task 3: 统一地图术语与提示文案
  - [x] SubTask 3.1: 去除图类型与筛选标签中的同义重复
  - [x] SubTask 3.2: 对齐提示文案语气，保持简洁专注风格
- [x] Task 4: 回归验证与验收固化
  - [x] SubTask 4.1: 验证地图核心交互（图切换、筛选、重置）无回归
  - [x] SubTask 4.2: 验证不同宽度下控制区可读性与可操作性
  - [x] SubTask 4.3: 记录验收结果并补齐验证说明
- [x] Task 5: 提升图谱画布占比并收敛次级信息
  - [x] SubTask 5.1: 合并可复用信息区块，减少分散大面板
  - [x] SubTask 5.2: 提升图谱画布高度与可视占比，确保首屏聚焦图谱
  - [x] SubTask 5.3: 调整控制区为紧凑布局，避免挤占图谱主区域
- [x] Task 6: 回归验证图谱聚焦改版
  - [x] SubTask 6.1: 验证图切换、筛选、重置与节点点击链路正常
  - [x] SubTask 6.2: 验证桌面与窄屏下图谱展示面积与可读性
  - [x] SubTask 6.3: 记录聚焦改版验收结果并更新验证文档

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5
