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