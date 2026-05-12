# Tasks

- [x] Task 1: 盘点并分类现有页面内联脚本
  - [x] 梳理 search/map/chat 与通用模板中的内联 JS 入口
  - [x] 标注可直接迁移、需改造、暂缓迁移的脚本块
- [x] Task 2: 建立前端 TypeScript 工程与构建产物目录
  - [x] 新增前端源码目录与基础 ts 配置
  - [x] 新增构建命令并输出到主题可引用位置
  - [x] 验证构建产物可被 Hugo 页面加载
- [x] Task 3: 分页面迁移脚本到外置 TS 模块
  - [x] 迁移 map 页面交互脚本并保持现有功能
  - [x] 迁移 search 页面交互脚本并保持现有功能
  - [x] 迁移 chat 页面交互脚本并保持现有功能
  - [x] 抽离通用工具逻辑并复用到各页面模块
- [x] Task 4: 完成模板接线与回归验证
  - [x] 更新模板脚本引用，移除对应内联业务脚本
  - [x] 执行功能回归验证（页面加载、API 调用、关键交互）
  - [x] 记录迁移例外与后续处理清单
- [x] Task 5: 编写零基础学习文档
  - [x] 说明项目目录、核心组件与数据流关系
  - [x] 说明前端构建链路与常见改动路径
  - [x] 提供从定位问题到验证发布的实操示例
- [x] Task 6: 补齐遗留主题的内联脚本迁移
  - [x] 清理 minimal 主题中 search/map/chat 的业务内联脚本
  - [x] 统一改为外置脚本引用并复用现有编译产物
  - [x] 验证切换主题后页面交互与 API 调用正常
- [x] Task 7: 修复回归失败并恢复核心交互可用性
  - [x] 排查 hybrid 搜索未返回 why 字段的根因并修复
  - [x] 修复 links/tags/entity 图谱返回空节点问题
  - [x] 修复 chat unfamiliar 场景缺少 citations 与 reading_path
  - [x] 复跑 search/graph/chat API 巡检并记录通过证据

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 2
- Task 6 depends on Task 3
- Task 7 depends on Task 4
