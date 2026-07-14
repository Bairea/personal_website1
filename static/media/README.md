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