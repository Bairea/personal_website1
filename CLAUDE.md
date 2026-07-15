# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

**用户文档见 [README.md](README.md)。** 本文件记录开发约束和实现细节。

## 开发约束

- **语言**：中文（zh-CN）。UI 字符串、错误消息和内容均为中文。
- **无自动生成内容**：所有元数据来自 front matter，缺失时默认为空。
- **Git commit message**：英文单句，Conventional Commits 格式，不得添加正文、脚注或协作者信息，严禁出现 `Claude`/`AI`/`Co-Authored-By`/`Generated with` 等字样。
- **代码中禁止 Emoji**。
- **Hugo Goldmark**：`unsafe = false`，禁止 Markdown 中嵌入原始 HTML。
- **Express 绑定**：仅监听 `127.0.0.1`，不直接暴露公网。
- **图片纳入 Git**：不使用图床或 Git LFS。

## 构建命令

```bash
npm run build              # 全量构建
npm run dev                # Hugo 本地预览（端口 1313）
npm run start              # 启动服务器（端口 8787）
```

## 关键实现细节

### Hugo 模板覆盖

- `layouts/_default/single.html` — 覆盖 PaperMod，添加 Pagefind 数据属性和 taxonomy 链接
- `layouts/_default/_markup/render-image.html` — 图片渲染钩子，把 `static/media/` 路径改写为 `/media/...`
- `layouts/<taxonomy>/list.html` / `term.html` — Taxonomy 列表页和详情页

### Pagefind

构建时扫描 HTML 中的 `data-pagefind-body`/`data-pagefind-meta`/`data-pagefind-filter` 属性生成索引。中文分词通过 `--force-language zh` 启用。

### 深色模式

PaperMod 深色模式默认对比度不足，在 `assets/css/extended/extended.css` 中通过 `:root[data-theme="dark"]` 提亮。修改时须验证 WCAG AA 对比度。

### Pagefind CSS 覆盖

`pagefind-ui.css` 的 `:root` 默认值会覆盖主题变量。通过 `layouts/partials/extend_head.html` 中的内联 `<style>` 块（位于 pagefind-ui.css 之后）确保覆盖生效。

### 安全响应头

Express 中间件设置 CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy。Nginx 对静态文件也设置相同安全头，集中在 `deploy/snippets/security-headers.conf`（部署时须复制到 `/etc/nginx/snippets/`）。

速率限制：Express 120 次/分钟/IP（静态资源防滥用）。

### 部署约定

- 部署路径：`/srv/personal-website/`
- Node 路径：`/usr/local/bin/node`
- systemd 服务：`deploy/personal-website.service`
- 主题为 git submodule，部署时须先 `git submodule update --init --recursive`

### Obsidian 写作流程

见 [README.md](README.md) "使用 Obsidian" 章节。关键点：

- 附件默认位置：`static/media`
- Wiki 链接：关闭
- 新链接格式：相对路径
- 文章互链：使用 `{{< relref "other.md" >}}` 或绝对路径 `/posts/<slug>/`

### 备份

仅需备份 `content/` 和 `static/media/`。其余均可通过 `npm run build` 完全重建。
