# Obsidian 写作发布流程适配设计

**日期**：2026-07-14
**状态**：已确认
**范围**：将内容编辑流程适配到 Obsidian，使作者能用 Obsidian 原生方式（扁平时间戳笔记、直接粘贴图片）写作，并以一条命令发布，长期（10 年）低维护

## 背景

当前内容编辑流程是手写 Markdown：文章扁平放 `content/posts/*.md`，内链用相对 `.md` 路径，图片放 `static/media/<年>/<月>/<slug>-<描述>.<ext>` 并在正文用绝对路径 `/media/...` 引用。作者希望改用 Obsidian 编辑，以获得：粘贴图片自动落附件夹、实时预览、Dataview 可视化等能力，同时把"想英文 slug/标题、手动放图、手写路径"这类数字杂务降到最低。

核心矛盾：Obsidian 的粘贴图片（自动写链接、文件名可能含空格、链接是相对/vault 路径）与 Hugo 的"`/media/` 绝对路径 + 按年月组织"约定不兼容；`[[ ]]` 双链 Hugo Goldmark 不识别。

## 核心结论

**扁平时间戳笔记 + 单一附件文件夹 `static/media/` + 一个图片渲染钩子。** 作者用 Obsidian 相对路径原生写作（图片粘贴到 `static/media/`、文章互链用相对 `.md`），发布时只靠一个 Hugo `render-image` 钩子把图片链接在渲染时改写成 `/media/...`。**不复制图片、不改写源文件、文章互链零额外代码。**

- 图片：粘贴即落 `static/media/`（Hugo 本就会发布的目录），钩子在渲染时把 `static/media/` 之后的部分拼成 `/media/...`。文件无需移动。
- 文章互链：Obsidian"相对路径"格式产出 `[B](b.md)` / `[B](../2025/x.md)`，Hugo 原生解析（现有项目已验证），无需钩子。
- 双链：必须关闭（Goldmark 不认 `[[ ]]` 和 `![[ ]]`，会渲染坏），非偏好而是硬约束；可视化/找文章由 Dataview（查 front matter，与链接语法无关）提供。

## 方案对比

### 方案 A：扁平 + 单附件文件夹 + 图片渲染钩子（选定 ✅）

- 源文件永不被改写，Obsidian 始终能预览；图片不复制；只一个钩子。
- 文章互链走 Hugo 原生解析，零额外代码。
- 备份不变（`content/` + `static/media/`）。

### 方案 B：Page Bundle（每篇一个文件夹 `index.md` + 图片同目录）

- 图片相对路径 `![](img.png)` 一份 md 两头通吃，零转换。
- 被否决：作者坚持扁平化，不要每篇一个文件夹。

### 方案 C：构建期复制图片到 `static/media/` + 渲染钩子

- 每篇带 `assets/` 子文件夹，构建时复制到 `static/media/<年>/<月>/`。
- 被否决：作者要求省去复制操作。

### 方案 D：源文件被构建直接改写成 `/media/...` + 软链接让 Obsidian 预览

- 零钩子，但每次 build 改写源、且依赖 Obsidian 能解析 `/media/` 绝对路径（行为不确定）。
- 被否决：改写源不可控、预览有风险。

### 方案 E：保留 `[[ ]]` 双链 + 构建期转换脚本

- 保留反链图谱，但要维护转换脚本。
- 被否决：与"减少杂务"相悖，且 Dataview 已覆盖可视化需求。

## 设计详情

### 1. 内容结构

扁平时间戳笔记，按年分子目录：

```
content/posts/
├── _index.md                  # 文章列表页（不变）
├── 2026/
│   ├── 202607141450.md        # 时间戳 = 笔记 ID，标题只在 front matter
│   ├── 202607151030.md
│   └── ...
└── 2027/...
static/media/                  # 全站唯一附件文件夹，Git 管理
├── Pasted image 20260714154456.png
├── 202607141450-diagram.svg   # 手动加的图，约定 <时间戳>-<描述> 命名
└── 2026/                      # 现有按年月组织的旧图，保留
    └── 03/hugo-quickstart-roadmap.svg
```

- **时间戳**：笔记文件名 = `YYYYMMDDHHmm`，由 Templater 生成，天然唯一、可排序。
- **按年分子目录**：解决 10 年后几百上千篇难找问题；Obsidian 文件树按年折叠，git 仓库清晰。
- **URL 扁平**：`hugo.toml` 已有 `[permalinks] posts = "/posts/:slug/"`，无 `slug` 时 `:slug` 回退到文件名（时间戳），URL = `/posts/202607141450/`，年份目录不影响线上地址（实施时验证嵌套场景）。
- **标题**：front matter `title` 是页面显示标题、搜索结果、列表页、Pagefind 索引标题、浏览器标签的来源；时间戳仅作文件 ID 与默认 URL，不在前端露面。

### 2. Obsidian 配置（一次性）

仓库根作为 vault 根。

| 设置 | 值 | 作用 |
|---|---|---|
| 附件默认位置 | Vault 文件夹 = `static/media` | 粘贴图片全落 `static/media/`，Hugo 本就发布此目录 |
| 使用 `[[ ]]` Wiki 链接 | 关闭 | Goldmark 不认 `[[ ]]`/`![[ ]]`，必须用标准 markdown |
| 新链接格式 | 相对路径（Relative path to file） | 文章互链产出 `b.md`/`../2025/x.md`，Hugo 原生解析 |
| Templater 新建文章命令 | 一键生成 `content/posts/<年>/<时间戳>.md` + front matter 骨架 | 消除"想标题建文件"的杂务 |
| 文件树排除 | `node_modules`、`public`、`themes` | 文件树清爽；**不排除 `static/`**（要看到/管理 `static/media/`） |

粘贴图片后的实际效果（作者已实测确认）：文件落 `static/media/Pasted image <时间戳>.png`，正文写 `![](../../../static/media/Pasted%20image%20<时间戳>.png)`（相对路径、空格 `%20` 编码）。Obsidian 能预览（相对路径 + 文件就在）。

> 说明：相对路径格式下图片链接形如 `../../../static/media/...`（比绝对路径的 `static/media/...` 长），但这是 Obsidian 自动生成、作者从不手敲也不看的，仅影响发布，而发布由钩子统一处理，与链接长短无关。选相对路径是为让**文章互链走 Hugo 原生解析**（绝对路径会产出 `content/posts/.../b.md`，Hugo 无法原生解析，需额外链接钩子）。

### 3. 图片渲染钩子

新增 `layouts/_default/_markup/render-image.html`（PaperMod 无 `_markup` 目录、项目也无覆盖，故为全新钩子，无冲突）。

**逻辑**：取 `.Destination` 中 `static/media/` 之后的部分，前面拼 `/media/`；已是 `/media/...` 或外部 URL（`http`/`https`）的放行。`%20` 等百分号编码原样保留。

```
../../../static/media/Pasted%20image%2020260714154456.png
  -> 取 "Pasted%20image%2020260714154456.png"
  -> /media/Pasted%20image%2020260714154456.png   ✓
```

- Hugo 把 `static/` 发布到根路径，故 `static/media/x` 对应 URL `/media/x`；钩子做的就是把作者写的相对路径改写成这个根绝对路径。
- `%20` 保留：浏览器解码 `%20` -> 空格 -> 匹配 `static/media/` 下带空格的真实文件名。
- 现有文章的 `/media/2026/03/...` 绝对链接：已以 `/` 开头，钩子放行，不受影响。
- `npm run dev` 同样生效：文件已在 `static/media/`，钩子在 dev 也改写链接，故本地预览能直接显示图片。

### 4. 文章互链

走 Hugo 原生解析，无钩子：

- 同年：`[B](b.md)`（`b` 为目标笔记文件名/时间戳）
- 跨年：`[B](../2025/x.md)`

现有项目已用相对 `.md` 链接并工作，沿用即可。实施时验证年份子目录下的跨年相对链接解析。

### 5. Dataview 看板

- 仓库根建 `_obsidian/`（在 `content/` 之外，Hugo 不处理）：放看板与模板。
  - `_obsidian/dashboard.md`：按专栏/分类聚合、最近编辑、缺 `description` 的文章、草稿等。
  - `_obsidian/templates/post.md`：新文章 front matter 模板。
- Dataview 查 front matter，与链接语法无关，故"关双链"下仍可用。示例：
  ````
  ```dataview
  TABLE date, categories, tags
  FROM "content/posts"
  WHERE file.mtime >= date(today) - dur(30 days)
  SORT date DESC
  ```
  ````
- 用结构化查询替代 `[[ ]]` 反链图来找相关文章。

### 6. 写文 -> 发文流程

1. 热键建文（Templater 生成 `content/posts/<年>/<时间戳>.md` + front matter 骨架）。
2. 填 front matter（`title`/`date`/`categories`/`tags`/`description`，`slug` 可选）。
3. 写正文，直接粘贴图片（自动进 `static/media/`，链接由 Obsidian 写好）。
4. `npm run build`（Hugo 构建 + 钩子改写图片链接 + Pagefind 索引）-> 部署。
5. 写作全局看 `_obsidian/dashboard.md`（Obsidian 实时渲染）。

### 7. Front matter 与 URL

- `title`（必填）：前端显示标题、搜索结果、列表、Pagefind 索引、浏览器标签全用它。
- `date`：发布日期。
- `categories`/`tags`/`projects`/`columns`：taxonomy，约定单选用数组。
- `description`：搜索结果摘要。
- `slug`（可选）：省略时 URL = `/posts/<时间戳>/`；填了则 URL = `/posts/<slug>/`（个别想分享/要可读地址的文章用）。

### 8. 已知语法差异与约定

- **Callout `> [!note]`**：Hugo/PaperMod 默认不渲染，显示成普通引用。约定用标题/普通引用；若需提示框，后续加一次性 blockquote 渲染钩子（非每篇杂务）。
- **脚注 `[^1]`**：Goldmark 原生支持，可用。
- **行内 `#标签`**：Hugo 不识别；约定标签只写 front matter `tags`，正文不写 `#`。
- **笔记嵌入 `![[note]]`**（transclusion）：不支持，会变链接；约定博客不用。
- **数学/Mermaid**：当前未配置；非本次范围。

## 当前需要做的变更

1. **新增图片渲染钩子** `layouts/_default/_markup/render-image.html`（核心，唯一新增代码）。
2. **新增 Templater 模板** `_obsidian/templates/post.md` 与"新建文章"命令配置说明。
3. **新增 Dataview 看板** `_obsidian/dashboard.md`（示例查询）。
4. **迁移现有 6 篇示例文章**到 `content/posts/2026/`（扁平，时间戳或保留现 slug 均可；其相对 `.md` 互链与 `/media/...` 图片链接不受影响）。
5. **更新文档**：`CLAUDE.md` 与 `static/media/README.md` 同步新约定（扁平 `static/media/`、时间戳笔记、图片钩子、Obsidian 配置）。
6. **推翻并标注** `2026-07-06-image-storage-design.md` 中"按 `<年>/<月>/<slug>-<描述>` 组织、`/media/` 绝对路径手写"的约定（新文用粘贴 + 钩子；旧图保留）。

## 待实施时验证

- `render-image` 钩子能拿到原始 `.Destination`（不被 Hugo 预解析/改写）。
- `%20` 百分号编码是否原样传入钩子（若被解码为空格，钩子需重新编码）。
- 相对路径文章互链在年份子目录下能否解析（`../2025/x.md`）。
- Obsidian "vault 文件夹 = `static/media`" 写入的相对图片链接格式与预览。
- `permalinks` 对嵌套 `content/posts/<年>/<时间戳>.md` 的 URL 扁平化。
- ~~PaperMod 是否自带 `render-image` 钩子~~（已确认：无 `_markup` 目录，新增钩子无冲突）。
