# Obsidian 写作发布流程适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让作者能用 Obsidian 原生方式（扁平时间戳笔记、粘贴图片到 `static/media/`）写作，发布时由一个 Hugo `render-image` 钩子自动改写图片链接，文章互链走 Hugo 原生相对路径，无需复制图片或改写源文件。

**Architecture:** 内容扁平放 `content/posts/<年>/<时间戳>.md`；图片统一进 `static/media/`（Obsidian 附件文件夹）；新增一个 `render-image.html` 渲染钩子，把正文里指向 `static/media/` 的图片链接在渲染时改写成 `/media/...`；文章互链用相对 `.md` 路径由 Hugo 原生解析；Obsidian 侧用 Templater 一键建文、Dataview 看板放 `_obsidian/`（Hugo 不处理）。

**Tech Stack:** Hugo 0.152.2（PaperMod 主题，git submodule）、Pagefind 客户端搜索、Obsidian + Templater/Dataview 社区插件。

## Global Constraints

- 内容与 UI 字符串均为中文（zh-CN），Hugo `languageCode = "zh-CN"`。
- Hugo Goldmark `unsafe = false`，Markdown 中禁止原始 HTML。
- 主题 PaperMod 为 git submodule，构建前须 `git submodule update --init --recursive`。
- `static/media/` 纳入 Git 管理，不使用 Git LFS，不 `.gitignore`。
- Express 仅监听 `127.0.0.1`，不直接暴露公网。
- 代码中禁止 Emoji；所有文件 UTF-8 编码。
- Git commit message：英文单句，Conventional Commits 格式（`type(scope): summary`），不得添加正文、脚注或协作者信息，严禁出现 `Claude`/`AI`/`Co-Authored-By`/`Generated with` 等字样。
- 构建命令：`npm run build:site`（`hugo --cleanDestinationDir`）、`npm run dev`（`hugo server --buildDrafts --bind 127.0.0.1`）、`npm run build`（前端 TS + Hugo + Pagefind 全量）。

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `layouts/_default/_markup/render-image.html` | 把指向 `static/media/` 的图片链接渲染时改写为 `/media/...` | 新建 |
| `content/posts/2026/*.md` | 现有 6 篇示例文章迁入年份子目录 | 移动 |
| `_obsidian/templates/post.md` | Templater 新文章 front matter 模板 | 新建 |
| `_obsidian/scripts/new-post.js` | Templater 用户脚本：一键生成 `content/posts/<年>/<时间戳>.md` | 新建 |
| `_obsidian/dashboard.md` | Dataview 写作看板 | 新建 |
| `CLAUDE.md` | 新增 Obsidian 写作流程章节；更新图片存储约定 | 修改 |
| `static/media/README.md` | 更新为扁平附件文件夹约定 | 修改 |
| `docs/superpowers/specs/2026-07-06-image-storage-design.md` | 标注被部分取代 | 修改 |

`_obsidian/` 在 `content/` 之外，Hugo 不处理；模板与脚本随仓库 Git 管理，跨克隆可复现。

---

## Task 1: 图片渲染钩子

**Files:**
- Create: `layouts/_default/_markup/render-image.html`
- Test（临时，验证后删除）: `content/posts/2026/ztest-hook.md`、`static/media/zztest.svg`、`static/media/zz test.svg`

**Interfaces:**
- Produces: 对所有 `![alt](dest)` 图片，若 `dest` 含 `static/media/` 则输出 `/media/<之后部分>`，否则原样放行（覆盖 Hugo 默认图片渲染；PaperMod 无 `_markup` 钩子，无冲突）。

- [ ] **Step 1: 创建渲染钩子**

写入 `layouts/_default/_markup/render-image.html`：

```html
{{- $src := .Destination -}}
{{- $parts := split .Destination "static/media/" -}}
{{- if gt (len $parts) 1 -}}
  {{- $src = printf "/media/%s" (index $parts 1) -}}
{{- end -}}
<img src="{{ $src }}" alt="{{ .PlainText }}"{{ with .Title }} title="{{ . }}"{{ end }} />
```

逻辑：`split` 按 `static/media/` 切分；若存在该子串则取第二段、前拼 `/media/`；`%20` 等编码原样保留；已是 `/media/`、`http` 等不含该子串的放行。`.PlainText` 取纯文本 alt。

- [ ] **Step 2: 创建临时测试素材**

```bash
mkdir -p content/posts/2026
cp static/media/2026/03/hugo-quickstart-roadmap.svg static/media/zztest.svg
cp static/media/2026/03/hugo-quickstart-roadmap.svg "static/media/zz test.svg"
```

写入 `content/posts/2026/ztest-hook.md`：

```markdown
---
title: "ZTest Hook"
date: "2026-07-14"
slug: "ztest-hook"
categories: ["技术"]
tags: []
description: "hook test"
---

relative: ![rel](../../../static/media/zztest.svg)
absolute: ![abs](/media/2026/03/hugo-quickstart-roadmap.svg)
space: ![sp](../../../static/media/zz%20test.svg)
```

- [ ] **Step 3: 构建**

Run: `npm run build:site`
Expected: 无报错退出。

- [ ] **Step 4: 验证改写结果**

Run:
```bash
grep -o '<img[^>]*>' public/posts/ztest-hook/index.html
```
Expected（三行，逐字匹配）：
```
<img src="/media/zztest.svg" alt="rel" />
<img src="/media/2026/03/hugo-quickstart-roadmap.svg" alt="abs" />
<img src="/media/zz%20test.svg" alt="sp" />
```
- 第一行：相对路径被改写为 `/media/...`。
- 第二行：已是 `/media/`，原样放行。
- 第三行：`%20` 保留。

若第三行出现字面空格（`zz test.svg`）而非 `%20`，说明当前 Hugo 把目标解码了——在钩子输出前对 `$src` 做空格转义：把 `<img src="{{ $src }}"` 改为 `<img src="{{ (replace $src " " "%20") }}"`。本版本（0.152.2）实测保留 `%20`，无需此改动。

- [ ] **Step 5: 删除临时测试素材**

```bash
rm -f content/posts/2026/ztest-hook.md
rmdir content/posts/2026 2>/dev/null || true
rm -f static/media/zztest.svg "static/media/zz test.svg"
npm run build:site > /dev/null 2>&1
```

- [ ] **Step 6: 提交**

```bash
git add layouts/_default/_markup/render-image.html
git commit -m "feat(layouts): add render-image hook to rewrite static/media paths"
```

---

## Task 2: 迁移现有文章到年份子目录

**Files:**
- Move: `content/posts/{feedback-iteration,fts5-search,hello,hugo-quickstart,lancedb-rag,map-design}.md` -> `content/posts/2026/`
- Keep: `content/posts/_index.md`（文章列表页，留在 `content/posts/`）

**Interfaces:**
- Consumes: Task 1 的渲染钩子（现有文章图片用绝对 `/media/...`，钩子放行，不受影响）。
- Produces: 文章扁平放 `content/posts/<年>/`；URL 经 `[permalinks] posts = "/posts/:slug/"` 扁平化为 `/posts/<slug>/`（已验证不出现 `/2026/`）；同年份内相对 `.md` 互链保持有效。

- [ ] **Step 1: 移动文章**

```bash
mkdir -p content/posts/2026
git mv content/posts/feedback-iteration.md content/posts/2026/
git mv content/posts/fts5-search.md content/posts/2026/
git mv content/posts/hello.md content/posts/2026/
git mv content/posts/hugo-quickstart.md content/posts/2026/
git mv content/posts/lancedb-rag.md content/posts/2026/
git mv content/posts/map-design.md content/posts/2026/
```

`content/posts/_index.md` 保留原位。

- [ ] **Step 2: 构建**

Run: `npm run build:site`
Expected: 无报错。

- [ ] **Step 3: 验证 URL 扁平化（无 /2026/）**

Run: `ls public/posts/`
Expected: 列出 6 篇文章目录（`feedback-iteration`、`fts5-search`、`hello`、`hugo-quickstart`、`lancedb-rag`、`map-design`）+ `index.html`/`index.xml`/`page`，**不**出现 `2026` 目录。若出现 `public/posts/2026/`，说明 permalink 未扁平化——检查 `hugo.toml` 中 `[permalinks] posts = "/posts/:slug/"` 是否生效（实测本版本生效）。

- [ ] **Step 4: 验证文章互链（同年份相对路径）**

Run:
```bash
grep -o 'href="/posts/fts5-search/"' public/posts/hugo-quickstart/index.html
grep -o 'href="/posts/lancedb-rag/"' public/posts/hugo-quickstart/index.html
```
Expected: 两条命令各输出 `href="/posts/fts5-search/"`、`href="/posts/lancedb-rag/"`。说明同年份内 `[文字](fts5-search.md)` 被解析为目标页 permalink。

- [ ] **Step 5: 验证图片链接放行**

Run: `grep -o '/media/2026/03/hugo-quickstart-roadmap.svg' public/posts/hugo-quickstart/index.html`
Expected: 输出 `/media/2026/03/hugo-quickstart-roadmap.svg`（绝对路径原样放行）。

- [ ] **Step 6: 验证文章列表页仍聚合全部文章**

Run: `grep -c 'class="post-title"' public/posts/index.html` 或 `grep -o '/posts/hugo-quickstart/' public/posts/index.html`
Expected: 至少能匹配到 `hugo-quickstart` 等文章链接（说明 `content/posts/_index.md` 列表页仍列出嵌套文章）。

- [ ] **Step 7: 提交**

```bash
git add -A content/posts
git commit -m "chore(content): move existing posts into year subfolder"
```

---

## Task 3: Obsidian 写作脚手架（模板、建文脚本、看板）

**Files:**
- Create: `_obsidian/templates/post.md`
- Create: `_obsidian/scripts/new-post.js`
- Create: `_obsidian/dashboard.md`

**Interfaces:**
- Produces: Templater 模板与用户脚本（仓库内，跨克隆复现）；Dataview 看板查询 `content/posts` 的 front matter。
- 注意：Obsidian 侧配置（设置项、热键绑定）无法在 CLI 验证，本任务用人工验证步骤；脚本基于 Obsidian 稳定 Vault API（`app.vault`）。

- [ ] **Step 1: 创建 Templater 新文章模板**

写入 `_obsidian/templates/post.md`：

```markdown
---
title: 
date: <% tp.date.now("YYYY-MM-DD") %>
categories: ["技术"]
tags: []
description: 
slug: 
---

```

用途：作者对一个已存在的空笔记套用此模板时填好 front matter 骨架（`date` 自动填当天）。

- [ ] **Step 2: 创建一键建文用户脚本**

写入 `_obsidian/scripts/new-post.js`：

```javascript
async function newPost(tp) {
  const ts = tp.date.now("YYYYMMDDHHmm");
  const year = tp.date.now("YYYY");
  const folder = `content/posts/${year}`;
  const path = `${folder}/${ts}.md`;
  const content = [
    "---",
    "title: ",
    `date: ${tp.date.now("YYYY-MM-DD")}`,
    'categories: ["技术"]',
    "tags: []",
    "description: ",
    "slug: ",
    "---",
    "",
    ""
  ].join("\n");
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }
  const file = await app.vault.create(path, content);
  await app.workspace.getLeaf(false).openFile(file);
}
module.exports = newPost;
```

逻辑：生成 `YYYYMMDDHHmm` 时间戳与年份；在 `content/posts/<年>/` 下创建 `<时间戳>.md`（目录不存在则建）；写入 front matter 骨架；打开该文件。`app` 为 Obsidian 全局对象，`tp` 为 Templater 注入对象。

- [ ] **Step 3: 创建 Dataview 看板**

写入 `_obsidian/dashboard.md`：

````markdown
# 写作看板

## 最近 30 天编辑

```dataview
TABLE date AS 发布日期, categories AS 分类, tags AS 标签
FROM "content/posts"
WHERE !contains(file.name, "_index") AND file.mtime >= date(today) - dur(30 days)
SORT file.mtime DESC
```

## 全部文章（按发布日期倒序）

```dataview
TABLE WITHOUT ID file.link AS 标题, date AS 日期, categories AS 分类
FROM "content/posts"
WHERE !contains(file.name, "_index")
SORT date DESC
```

## 缺 description 的文章

```dataview
LIST
FROM "content/posts"
WHERE !contains(file.name, "_index") AND (!description OR description = "")
```

## 按分类统计

```dataview
TABLE length(rows) AS 篇数
FROM "content/posts"
WHERE !contains(file.name, "_index")
FLATTEN categories AS cat
GROUP BY cat
SORT cat ASC
```
````

- [ ] **Step 4: 人工验证（需在 Obsidian 中操作，无法 CLI 验证）**

在 Obsidian 中：
1. 安装并启用社区插件 Templater、Dataview。
2. Templater 设置：User Scripts Folder = `_obsidian/scripts`；Template Folder Location = `_obsidian/templates`。
3. 为 `new-post.js` 绑定一个命令/热键（Templater: User Scripts 下应出现 `newPost`）。
4. 触发该命令，确认：在 `content/posts/<当年>/` 下生成 `<时间戳>.md`，front matter 含 `date` 且 `title`/`description`/`slug` 为空待填。
5. 打开 `_obsidian/dashboard.md`，确认 Dataview 查询渲染出文章列表。

若 `newPost` 在 Templater 命令列表未出现，检查 User Scripts Folder 路径是否正确、脚本是否 `module.exports` 导出。

- [ ] **Step 5: 提交**

```bash
git add _obsidian
git commit -m "feat: add Obsidian authoring scaffold, templates, and dashboard"
```

---

## Task 4: 更新文档与约定

**Files:**
- Modify: `CLAUDE.md`（新增 Obsidian 写作流程章节；更新图片存储与模板覆盖约定）
- Modify: `static/media/README.md`（扁平附件文件夹约定）
- Modify: `docs/superpowers/specs/2026-07-06-image-storage-design.md`（标注被部分取代）

**Interfaces:**
- Consumes: Task 1–3 的产物（钩子、年份目录、`_obsidian/`）。
- Produces: 文档与代码现状一致；旧图片存储设计标注为部分取代。

- [ ] **Step 1: 更新 `static/media/README.md`**

将“目录结构”“命名规则”“引用方式”三节替换为反映新约定。把现有 README 中按 `/<yyyy>/<mm>/<slug>-<desc>` 组织的描述，更新为：

```markdown
## static/media 图片目录

全站唯一的图片附件文件夹，同时也是 Hugo 发布的静态目录。Obsidian 附件默认位置设为此文件夹。

### 写入方式

- 在 Obsidian 中直接粘贴图片，文件落入本目录（Obsidian 自动命名为 `Pasted image <时间戳>.<ext>`）。
- 正文写的是相对路径（如 `![](../../../static/media/xxx.png)`），由 `layouts/_default/_markup/render-image.html` 在构建时改写为 `/media/xxx.png`。**无需手动改写图片链接。**
- 手动添加的图片（如 SVG）用 `<时间戳>-<描述>.<ext>` 命名以避免与粘贴图撞名。

### 旧图

历史按 `2026/03/<slug>-<desc>.<ext>` 组织的图片保留原位，其绝对路径 `/media/2026/03/...` 由渲染钩子原样放行。

### 格式偏好

| 优先级 | 格式 | 适用场景 |
|---|---|---|
| 1 | SVG | 架构图、流程图、示意图 |
| 2 | WebP | 截图、光栅图 |
| 3 | PNG | 必须透明背景时 |
| 4 | JPG | 照片（罕见场景） |

### Git 管理

图片纳入 Git 版本控制，不排除、不使用 Git LFS。备份 `content/` + `static/media/`。
```

- [ ] **Step 2: 更新 `CLAUDE.md` 图片存储约定**

定位 CLAUDE.md 中“重要约定”下的 `**图片存储**` 条目，把“按 `/<yyyy>/<mm>/<slug>-<desc>.<ext>` 组织…Markdown 中用绝对路径 `/media/...` 引用”一句，替换为：

```
- **图片存储**：图片统一放 `static/media/`（Obsidian 附件文件夹，扁平存放）。Obsidian 粘贴后正文写相对路径 `![](../../../static/media/x.png)`，由 `layouts/_default/_markup/render-image.html` 在构建时改写为 `/media/x.png`，作者无需手动改写。手动加的图用 `<时间戳>-<描述>.<ext>` 命名。历史按 `<年>/<月>/` 组织的旧图保留，其 `/media/<年>/<月>/...` 绝对路径由钩子放行。格式优先级 SVG > WebP > PNG > JPG。图片纳入 Git，不用 LFS。详见 `static/media/README.md` 与 `docs/superpowers/specs/2026-07-14-obsidian-authoring-design.md`。
```

- [ ] **Step 3: 在 `CLAUDE.md` 增加 Obsidian 写作流程章节**

在 `## 内容编写` 章节之后、`## 重要约定` 之前，新增一节：

```markdown
## Obsidian 写作流程

仓库根即 Obsidian vault 根。用 Obsidian 编辑 `content/posts/` 下文章。

### Obsidian 设置（一次性）

- 附件默认位置：Vault 文件夹 = `static/media`。
- 使用 `[[ ]]` Wiki 链接：关闭（Hugo Goldmark 不识别 `[[ ]]` 与 `![[ ]]`）。
- 新链接格式：相对路径（Relative path to file）。
- 文件树排除：`node_modules`、`public`、`themes`（**不排除** `static/`，需查看/管理 `static/media/`）。
- Templater：User Scripts Folder = `_obsidian/scripts`，Template Folder = `_obsidian/templates`，为 `newPost` 绑定热键。
- Dataview：看板见 `_obsidian/dashboard.md`。

### 写文 -> 发文

1. 热键建文（Templater `newPost` 生成 `content/posts/<年>/<时间戳>.md` + front matter 骨架）。
2. 填 `title`/`date`/`categories`/`tags`/`description`（`slug` 可选，省略则 URL = `/posts/<时间戳>/`）。
3. 写正文；粘贴图片自动进 `static/media/`，链接由 Obsidian 写好（构建时钩子改写）。
4. 文章互链用相对路径：同年 `[文字](<时间戳>.md)`，跨年 `[文字](../<年>/<时间戳>.md)`，Hugo 原生解析。
5. `npm run build`（Hugo + 钩子改写图片链接 + Pagefind 索引）-> 部署。
```

- [ ] **Step 4: 在 `CLAUDE.md` 模板覆盖约定补充渲染钩子**

定位 CLAUDE.md `**Hugo 模板覆盖**` 条目，在 `layouts/_default/single.html` 描述后追加一句：

```
另：`layouts/_default/_markup/render-image.html` 覆盖图片渲染，把指向 `static/media/` 的相对图片链接改写为 `/media/...`，供 Obsidian 粘贴图片流程使用。
```

- [ ] **Step 5: 标注旧设计文档被部分取代**

在 `docs/superpowers/specs/2026-07-06-image-storage-design.md` 顶部“状态”行后追加一行：

```
**注**：图片组织与引用方式已被 `2026-07-14-obsidian-authoring-design.md` 部分取代（改为扁平存 `static/media/` + 渲染钩子改写链接）。本文件的“不放图床、Git 管理、备份策略”等结论仍然有效。
```

- [ ] **Step 6: 构建并冒烟验证**

Run: `npm run build`
Expected: 全量构建无报错（前端 TS + Hugo + Pagefind）。

- [ ] **Step 7: 提交**

```bash
git add CLAUDE.md static/media/README.md docs/superpowers/specs/2026-07-06-image-storage-design.md
git commit -m "docs: document Obsidian authoring workflow and flat media convention"
```

---

## Self-Review 结果

**1. Spec 覆盖**：
- 扁平时间戳笔记结构 -> Task 2（迁入年份目录）+ Task 3（建文脚本生成时间戳文件名）。
- 单一附件文件夹 `static/media` -> Task 1（钩子）+ Task 4（README/CLAUDE 约定）。
- `render-image` 钩子取 `static/media/` 之后拼 `/media/` -> Task 1（已实测三场景通过）。
- 文章互链走 Hugo 原生相对路径 -> Task 2 Step 4 验证；Task 4 文档说明。
- Dataview 看板放 `_obsidian/` -> Task 3。
- Templater 建文模板 -> Task 3。
- 标题在 front matter / URL 默认时间戳可选 slug -> Task 3 模板 + Task 4 文档。
- 推翻旧图片组织约定 -> Task 4 Step 5。
- 待验证项（钩子拿到原始路径、`%20` 透传、嵌套 URL 扁平化、相对互链解析）-> Task 1 Step 4、Task 2 Step 3/4 已实测通过；PaperMod 无 `_markup` 钩子已确认。

**2. 占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码；Obsidian 侧不可 CLI 验证处已标注人工验证步骤并给出排错提示。

**3. 类型一致性**：`render-image.html` 中 `$src`/`$parts` 变量在钩子内自洽；Task 1 实测输出与 Task 4 文档描述一致；脚本 `newPost` 导出名与 Task 4 文档引用一致。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-obsidian-authoring.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
