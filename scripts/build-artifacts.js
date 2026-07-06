import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "posts");
const PUBLIC_DIR = path.join(ROOT, "public");
const ART_DIR = path.join(PUBLIC_DIR, "artifacts");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p));
    else if (ent.isFile() && p.endsWith(".md") && !ent.name.startsWith("_"))
      out.push(p);
  }
  return out;
}

function stripMd(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\(([^)]+)\)/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(md) {
  const links = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(md))) links.push(m[1]);
  return links;
}

function toPosix(p) {
  return p.replaceAll(path.sep, "/");
}

function slugFromFilePath(fp) {
  return toPosix(path.relative(CONTENT_DIR, fp)).replace(/\.md$/, "");
}

function urlFromSlug(slug) {
  return `/posts/${slug}.html`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t)).filter(Boolean);
  if (tags === undefined || tags === null) return [];
  return [String(tags)].filter(Boolean);
}

function resolveInternalMdLink(sourceSlug, href) {
  const raw = String(href || "");
  if (!raw) return null;
  const cleaned = raw.split("#")[0].split("?")[0];
  if (!cleaned.endsWith(".md")) return null;
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://"))
    return null;
  if (cleaned.startsWith("mailto:")) return null;

  const sourceDir = path.posix.dirname(sourceSlug);
  const target = cleaned.replace(/^\.\//, "");
  const resolved = path.posix.normalize(path.posix.join(sourceDir, target));
  const slug = resolved.replace(/\.md$/, "").replace(/^\/+/, "");
  if (!slug || slug === ".") return null;
  return slug;
}

ensureDir(ART_DIR);

const files = walkFiles(CONTENT_DIR);
const docs = [];

for (const fp of files) {
  const raw = fs.readFileSync(fp, "utf-8");
  const { data, content } = matter(raw);

  const slug = data.slug ? String(data.slug) : slugFromFilePath(fp);
  const title = data.title ? String(data.title) : slug;
  const url = data.url ? String(data.url) : urlFromSlug(slug);
  const summary = data.summary ? String(data.summary) : "";
  const tags = normalizeTags(data.tags);
  const outlinks = extractLinks(content)
    .map((href) => resolveInternalMdLink(slug, href))
    .filter(Boolean);

  docs.push({ id: slug, slug, url, title, summary, tags, outlinks });
}

// Internal links graph
const internalNodes = docs.map((d) => ({
  id: d.id,
  title: d.title,
  url: d.url,
  summary: d.summary,
  tags: d.tags,
}));

const slugSet = new Set(docs.map((d) => d.id));
const internalEdges = [];
for (const d of docs) {
  for (const t of d.outlinks) {
    if (!slugSet.has(t)) continue;
    internalEdges.push({
      source: d.id,
      target: t,
      kind: "internal_link",
      weight: 1,
    });
  }
}

fs.writeFileSync(
  path.join(ART_DIR, "graph-internal-links.json"),
  JSON.stringify(
    { kind: "internal_links", nodes: internalNodes, edges: internalEdges },
    null,
    2,
  ),
  "utf-8",
);

// Tag co-occurrence graph
const tagNodes = new Map();
const tagEdges = new Map();

for (const d of docs) {
  const ts = [...new Set(d.tags)].sort();
  for (const t of ts)
    tagNodes.set(t, { id: `tag:${t}`, label: t, kind: "tag" });
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i];
      const b = ts[j];
      const k = `${a}|${b}`;
      tagEdges.set(k, (tagEdges.get(k) || 0) + 1);
    }
  }
}

const coNodes = [...tagNodes.values()];
const coEdges = [...tagEdges.entries()].map(([k, w]) => {
  const [a, b] = k.split("|");
  return {
    source: `tag:${a}`,
    target: `tag:${b}`,
    kind: "tag_cooccurrence",
    weight: w,
  };
});

fs.writeFileSync(
  path.join(ART_DIR, "graph-tag-cooccurrence.json"),
  JSON.stringify(
    { kind: "tag_cooccurrence", nodes: coNodes, edges: coEdges },
    null,
    2,
  ),
  "utf-8",
);

console.log(`Built graph artifacts for ${docs.length} docs`);
