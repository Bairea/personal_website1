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
