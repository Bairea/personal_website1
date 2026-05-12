# Tasks
- [x] Task 1: 定义统一的内容与索引数据模型
  - [x] 规范文章 frontmatter 字段与派生字段（tags/keywords/summary/series）
  - [x] 定义 chunk 规则与引用证据格式（用于 RAG 与图谱预览）
- [x] Task 2: 搭建零模型 MVP 的发现能力
  - [x] 构建关键词索引并接入前端搜索页
  - [x] 生成内链图与标签共现图并接入知识地图页面（含预览与跳转）
  - [x] 增加最小化反馈采集与导出
- [x] Task 3: 引入向量库与混合检索
  - [x] 引入向量库并写入 embedding 与 chunk 元数据
  - [x] 实现混合检索合并策略与可解释返回字段
- [x] Task 4: 实现 Chat（RAG）与学习路径/临时子图
  - [x] 实现 RAG 对话接口（答案 + 引用）
  - [x] 实现“我不熟悉”模式的阅读顺序建议
  - [x] 实现围绕 query 的临时子图生成（可选保存）
- [x] Task 5: 安全、运维与备份策略落地
  - [x] 定义鉴权、限流、并发控制与日志策略
  - [x] 定义备份范围与重建流程（索引/图谱可重建）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 2
