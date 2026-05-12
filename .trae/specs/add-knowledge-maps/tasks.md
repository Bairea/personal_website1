# Tasks
- [ ] Task 1: 确定知识地图的数据模型与产物格式
  - [ ] 定义节点/边/权重/证据字段（文章、标签、实体、问题等）
  - [ ] 定义导出格式（JSON 为主，兼容 CSV/GraphML）
- [ ] Task 2: 实现首个最小可用地图（零模型）
  - [ ] 实现站内内链解析生成引用图（方案 2）
  - [ ] 基于 frontmatter 标签生成共现图（方案 3）
  - [ ] 增加知识地图页面并可跳转文章
- [ ] Task 3: 增加增量更新与去噪策略
  - [ ] 新增/修改文章时只更新受影响节点与边
  - [ ] 增加阈值/最大度数/黑名单/同义合并等去噪能力
- [ ] Task 4: 可选增强（AI agent）
  - [ ] 增加 embedding 相似度图（方案 4），优先使用标题+摘要
  - [ ] 增加“问题图”或“实体图”中的一种（方案 5 或 9），并提供人工纠错入口
- [ ] Task 5: 验证与文档
  - [ ] 为小样本文集生成地图并校验可视化可用性
  - [ ] 记录运维与隐私开关策略（默认不外发正文）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 2

