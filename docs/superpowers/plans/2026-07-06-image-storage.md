# 图片存储策略实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有演示图片迁移到按日期组织的目录结构，并更新 README 规范文档，使图片存储遵循长期策略。

**Architecture:** 图片从 `static/media/demo/` 迁移到 `static/media/<yyyy>/<mm>/`，文章中的引用路径同步更新，README 补充格式偏好和命名规则。不引入新依赖，不改构建流程或服务器配置。

**Tech Stack:** Git（文件移动 + 引用更新）

## Global Constraints

- 语言：中文（zh-CN），文档和注释用中文
- 图片存储在 `static/media/`，Git 管理，不做 `.gitignore` 排除
- 不引入图床、Git LFS、图片优化构建步骤
- 不改 Hugo 配置或服务器配置
- Markdown 中图片用绝对路径 `/media/...` 引用

---

### Task 1: 迁移演示图片到按日期组织的目录

**Files:**
- Move: `static/media/demo/roadmap.svg` → `static/media/2026/03/hugo-quickstart-roadmap.svg`
- Move: `static/media/demo/entity-map.svg` → `static/media/2026/03/map-design-entity.svg`
- Modify: `content/posts/hugo-quickstart.md` — 更新图片引用路径
- Modify: `content/posts/map-design.md` — 更新图片引用路径
- Delete: `static/media/demo/` 目录

**Interfaces:**
- Consumes: 现有图片文件和文章中的引用
- Produces: 按日期组织的新目录结构和更新后的引用路径

两篇文章的 front matter `date` 均为 `2026-03-22`，因此图片归入 `2026/03/`。

- [ ] **Step 1: 创建目标目录**

```bash
mkdir -p static/media/2026/03
```

- [ ] **Step 2: 用 `git mv` 移动图片文件**

```bash
git mv static/media/demo/roadmap.svg static/media/2026/03/hugo-quickstart-roadmap.svg
git mv static/media/demo/entity-map.svg static/media/2026/03/map-design-entity.svg
```

- [ ] **Step 3: 更新 hugo-quickstart.md 中的图片引用**

将：
```md
![学习路径示意](/media/demo/roadmap.svg)
```
改为：
```md
![学习路径示意](/media/2026/03/hugo-quickstart-roadmap.svg)
```

- [ ] **Step 4: 更新 map-design.md 中的图片引用**

将：
```md
![实体图示意](/media/demo/entity-map.svg)
```
改为：
```md
![实体图示意](/media/2026/03/map-design-entity.svg)
```

- [ ] **Step 5: 删除空的 demo 目录**

```bash
rm -rf static/media/demo/
```

- [ ] **Step 6: 验证引用正确性**

```bash
grep -rn '/media/' content/posts/
```

Expected output 应只包含新路径，无 `demo/` 引用：
```
content/posts/hugo-quickstart.md:13:![学习路径示意](/media/2026/03/hugo-quickstart-roadmap.svg)
content/posts/map-design.md:13:![实体图示意](/media/2026/03/map-design-entity.svg)
```

- [ ] **Step 7: 验证构建正常**

```bash
npm run build
```

Expected: 构建成功，无错误。`public/media/2026/03/` 下有移动后的 SVG 文件。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "Migrate demo images to date-organized directories

Move static/media/demo/ → static/media/2026/03/ with slug-prefixed names.
Update image references in hugo-quickstart.md and map-design.md."
```

---

### Task 2: 更新 static/media/README.md 规范文档

**Files:**
- Modify: `static/media/README.md`

**Interfaces:**
- Consumes: 设计文档中的格式偏好和命名规则
- Produces: 更新后的 README，作为后续图片添加的参考规范

- [ ] **Step 1: 更新 README.md 内容**

将 `static/media/README.md` 替换为：

```markdown
## static/media 图片目录

该目录存放文章引用的图片资源，构建后由 Hugo 原样发布到 `public/media/**`。

### 目录结构

按年月组织：`static/media/<yyyy>/<mm>/<文件名>.<ext>`

示例：
```
static/media/
├── 2026/
│   ├── 03/
│   │   ├── hugo-quickstart-roadmap.svg
│   │   └── map-design-entity.svg
│   └── 07/
│       └── some-article-screenshot.webp
└── 2027/
    └── ...
```

### 命名规则

- 文件名 = `<文章slug>-<描述>.<ext>`
- 避免纯数字或无意义名称
- 同一文章多张图用不同描述后缀区分

示例：`hugo-quickstart-roadmap.svg`、`map-design-entity.svg`

### 格式偏好

| 优先级 | 格式 | 适用场景 |
|---|---|---|
| 1 | SVG | 架构图、流程图、示意图 |
| 2 | WebP | 截图、光栅图 |
| 3 | PNG | 必须透明背景时 |
| 4 | JPG | 照片（罕见场景） |

### 引用方式

Markdown 中使用绝对路径：

```md
![示例图](/media/2026/03/hugo-quickstart-roadmap.svg)
```

### Git 管理

图片纳入 Git 版本控制，不做 `.gitignore` 排除，不使用 Git LFS。备份时 `content/` + `static/media/` 一起备份即可。
```

- [ ] **Step 2: 验证 README 内容**

```bash
cat static/media/README.md
```

Expected: 内容与 Step 1 中一致。

- [ ] **Step 3: 提交**

```bash
git add static/media/README.md
git commit -m "Update media README with naming rules and format preferences"
```
