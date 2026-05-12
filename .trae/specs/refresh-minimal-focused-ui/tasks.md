# Tasks

- [x] Task 1: 盘点并冻结改版范围
  - [x] SubTask 1.1: 确认受影响页面与模板映射关系
  - [x] SubTask 1.2: 梳理当前样式与文案基线，记录需调整项
- [x] Task 2: 实现统一的简洁专注视觉系统
  - [x] SubTask 2.1: 建立全局设计 token（颜色、排版、间距、边框与阴影）
  - [x] SubTask 2.2: 调整通用布局容器与导航层级，降低视觉噪声
  - [x] SubTask 2.3: 统一链接、按钮、输入框、卡片与提示态样式
- [x] Task 3: 分页面完成样式落地
  - [x] SubTask 3.1: 优化首页与列表页的信息密度与阅读节奏
  - [x] SubTask 3.2: 优化文章页排版与内容可读性
  - [x] SubTask 3.3: 优化搜索页、地图页、聊天页的界面层级与状态呈现
- [x] Task 4: 完成文案润色与语气统一
  - [x] SubTask 4.1: 润色导航、标题、副标题与操作提示文案
  - [x] SubTask 4.2: 润色空状态、错误提示与引导说明文案
  - [x] SubTask 4.3: 校对中英文混排与术语一致性
- [x] Task 5: 回归验证并固化结果
  - [x] SubTask 5.1: 验证核心页面视觉一致性与响应式表现
  - [x] SubTask 5.2: 验证搜索、地图、聊天核心交互不回归
  - [x] SubTask 5.3: 记录验收结果并补齐必要说明（见 `verification-2026-03-23.md`）

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 3
- Task 5 depends on Task 4
