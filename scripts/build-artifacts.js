import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import Database from "better-sqlite3";
import { connect } from "@lancedb/lancedb";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "posts");
const PUBLIC_DIR = path.join(ROOT, "public");
const ART_DIR = path.join(PUBLIC_DIR, "artifacts");
const EXPORT_DIR = path.join(ART_DIR, "export");
const DATA_DIR = path.join(ROOT, "data");
const SEARCH_DB_PATH = path.join(DATA_DIR, "search_lexical.db");
const AI_CACHE_PATH = path.join(DATA_DIR, "ai_cache.json");
const VECTORS_DIR = path.join(ROOT, "vectors");
const EXPORT_DB_PATH = path.join(EXPORT_DIR, "search_lexical.db");
const EXPORT_VECTORS_DIR = path.join(EXPORT_DIR, "vectors");
const EXPORT_AI_CACHE_PATH = path.join(EXPORT_DIR, "ai_cache.json");
const EXPORT_MANIFEST_PATH = path.join(EXPORT_DIR, "manifest.json");
const EXPORT_HASHES_PATH = path.join(EXPORT_DIR, "doc-hashes.json");
const ENTITY_RULES_PATH = path.join(DATA_DIR, "entity-graph-rules.json");
const VECTOR_DIM = 256;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const PIPELINE_VERSION = "task3-v1";
const EMBEDDING_STRATEGY = "title_summary_then_body_chunk";
const EMBEDDING_MODEL = "hash/v1";

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

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords))
    return keywords.map((t) => String(t)).filter(Boolean);
  if (keywords === undefined || keywords === null) return [];
  return [String(keywords)].filter(Boolean);
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

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashEmbedding(text, dims) {
  const vec = new Array(dims).fill(0);
  const tokens = String(text || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  for (const tok of tokens) {
    const h = fnv1a32(tok);
    const idx = h % dims;
    const s = (fnv1a32(`${tok}!`) & 1) === 1 ? 1 : -1;
    vec[idx] += s;
  }

  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
  return vec;
}

function sha256(text) {
  return createHash("sha256")
    .update(String(text || ""))
    .digest("hex");
}

function chunkText(text, size, overlap) {
  const t = String(text || "");
  if (!t.trim()) return [];
  const out = [];
  const step = Math.max(1, size - overlap);
  for (let i = 0, idx = 0; i < t.length; i += step, idx++) {
    const chunk = t.slice(i, i + size).trim();
    if (!chunk) continue;
    out.push({ index: idx, text: chunk });
  }
  return out;
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function normalizeEntityTerm(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\p{Script=Han}a-z0-9_+\-./#]/gu, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 64);
}

function defaultEntityRules() {
  return {
    updated_at: "",
    whitelist: {
      entities: [],
      doc_entity_pairs: [],
    },
    blacklist: {
      entities: [],
      doc_entity_pairs: [],
    },
    manual: {
      nodes: [],
      edges: [],
    },
  };
}

function normalizeEntityRules(raw) {
  const base = defaultEntityRules();
  if (!raw || typeof raw !== "object") return base;
  const whitelist =
    raw.whitelist && typeof raw.whitelist === "object" ? raw.whitelist : {};
  const blacklist =
    raw.blacklist && typeof raw.blacklist === "object" ? raw.blacklist : {};
  const manual = raw.manual && typeof raw.manual === "object" ? raw.manual : {};
  return {
    updated_at: raw.updated_at ? String(raw.updated_at) : "",
    whitelist: {
      entities: Array.isArray(whitelist.entities) ? whitelist.entities : [],
      doc_entity_pairs: Array.isArray(whitelist.doc_entity_pairs)
        ? whitelist.doc_entity_pairs
        : [],
    },
    blacklist: {
      entities: Array.isArray(blacklist.entities) ? blacklist.entities : [],
      doc_entity_pairs: Array.isArray(blacklist.doc_entity_pairs)
        ? blacklist.doc_entity_pairs
        : [],
    },
    manual: {
      nodes: Array.isArray(manual.nodes) ? manual.nodes : [],
      edges: Array.isArray(manual.edges) ? manual.edges : [],
    },
  };
}

function loadEntityRules() {
  return normalizeEntityRules(
    readJsonIfExists(ENTITY_RULES_PATH, defaultEntityRules()),
  );
}

function ensureEntityRulesFile() {
  if (fs.existsSync(ENTITY_RULES_PATH)) return;
  writeJson(ENTITY_RULES_PATH, defaultEntityRules());
}

function pairKey(docId, entity) {
  return `${docId}|${entity}`;
}

function docEntityCandidates(doc) {
  const fromKeywords = Array.isArray(doc.keywords) ? doc.keywords : [];
  const fromTags = Array.isArray(doc.tags) ? doc.tags : [];
  const fromTitleSummary = topTokens(`${doc.title} ${doc.summary}`, 6);
  return uniqStrings([...fromKeywords, ...fromTags, ...fromTitleSummary])
    .map((v) => normalizeEntityTerm(v))
    .filter((v) => {
      if (!v) return false;
      const hasHan = /[\p{Script=Han}]/u.test(v);
      if (hasHan) return v.length >= 2;
      return v.length >= 3;
    })
    .slice(0, 16);
}

function normalizeAiCache(raw) {
  const base = {
    pipeline_version: PIPELINE_VERSION,
    embedding_strategy: EMBEDDING_STRATEGY,
    embedding_model: EMBEDDING_MODEL,
    updated_at: "",
    docs: {},
  };
  if (!raw || typeof raw !== "object") return base;
  const docs = raw.docs && typeof raw.docs === "object" ? raw.docs : {};
  return {
    ...base,
    ...raw,
    docs,
  };
}

function uniqStrings(items) {
  return [...new Set(items.map((v) => String(v || "").trim()).filter(Boolean))];
}

function topTokens(text, limit) {
  const counts = new Map();
  const matches =
    String(text || "")
      .toLowerCase()
      .match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/gu) || [];
  for (const tok of matches) counts.set(tok, (counts.get(tok) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tok]) => tok);
}

function generateAgentMetadata(title, body) {
  const cleanBody = String(body || "").trim();
  const summary = cleanBody ? cleanBody.slice(0, 120) : String(title || "");
  const keywords = topTokens(`${title} ${cleanBody}`, 8);
  const tags = topTokens(`${title} ${cleanBody}`, 4);
  return {
    summary,
    keywords,
    tags,
  };
}

function toDocContentHash(doc) {
  return sha256(
    JSON.stringify({
      slug: doc.slug,
      title: doc.title,
      summary: doc.summary,
      tags: doc.tags,
      keywords: doc.keywords,
      content: doc.content,
    }),
  );
}

function makeChunkRows(doc) {
  const tagsJson = JSON.stringify(doc.tags);
  const rows = [];
  const titleSummaryText = `${doc.title}\n${doc.summary}`.trim();
  rows.push({
    chunk_id: `${doc.id}#title_summary`,
    doc_id: doc.id,
    url: doc.url,
    title: doc.title,
    summary: doc.summary,
    tags_json: tagsJson,
    text: titleSummaryText,
    vector: hashEmbedding(titleSummaryText, VECTOR_DIM),
    embedding_stage: "title_summary",
    content_hash: doc.contentHash,
  });
  const chunks = chunkText(doc.body, CHUNK_SIZE, CHUNK_OVERLAP);
  for (const c of chunks) {
    rows.push({
      chunk_id: `${doc.id}#${c.index}`,
      doc_id: doc.id,
      url: doc.url,
      title: doc.title,
      summary: doc.summary,
      tags_json: tagsJson,
      text: c.text,
      vector: hashEmbedding(c.text, VECTOR_DIM),
      embedding_stage: "body_chunk",
      content_hash: doc.contentHash,
    });
  }
  return rows;
}

function copyDirSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

ensureDir(ART_DIR);
ensureDir(DATA_DIR);
ensureDir(PUBLIC_DIR);
ensureDir(VECTORS_DIR);
ensureDir(EXPORT_DIR);
ensureEntityRulesFile();

const aiCache = normalizeAiCache(readJsonIfExists(AI_CACHE_PATH, {}));

const files = walkFiles(CONTENT_DIR);
const docs = [];
let reusedDocCount = 0;
let rebuiltDocCount = 0;

for (const fp of files) {
  const raw = fs.readFileSync(fp, "utf-8");
  const { data, content } = matter(raw);

  const slug = data.slug ? String(data.slug) : slugFromFilePath(fp);
  const title = data.title ? String(data.title) : slug;
  const url = data.url ? String(data.url) : urlFromSlug(slug);
  const body = stripMd(content);
  const frontSummary = data.summary ? String(data.summary) : "";
  const frontTags = normalizeTags(data.tags);
  const frontKeywords = normalizeKeywords(data.keywords);
  const outlinks = extractLinks(content)
    .map((href) => resolveInternalMdLink(slug, href))
    .filter(Boolean);
  const contentHash = toDocContentHash({
    slug,
    title,
    summary: frontSummary,
    tags: frontTags,
    keywords: frontKeywords,
    content,
  });
  const cached = aiCache.docs[slug];
  const shouldReuse = Boolean(
    cached &&
    cached.content_hash === contentHash &&
    cached.generated_meta &&
    Array.isArray(cached.chunk_rows) &&
    cached.chunk_rows.length > 0,
  );
  const generatedMeta = shouldReuse
    ? cached.generated_meta
    : generateAgentMetadata(title, body);
  const summary = frontSummary || generatedMeta.summary || "";
  const tags =
    frontTags.length > 0 ? frontTags : uniqStrings(generatedMeta.tags || []);
  const keywords =
    frontKeywords.length > 0
      ? frontKeywords
      : uniqStrings(generatedMeta.keywords || []);
  const contentForChunk = {
    id: slug,
    url,
    title,
    summary,
    tags,
    body,
    contentHash,
  };
  const chunkRows = shouldReuse
    ? cached.chunk_rows
    : makeChunkRows(contentForChunk);
  aiCache.docs[slug] = {
    doc_id: slug,
    url,
    content_hash: contentHash,
    source: {
      summary: frontSummary ? "front_matter" : "agent_generated",
      tags: frontTags.length > 0 ? "front_matter" : "agent_generated",
      keywords: frontKeywords.length > 0 ? "front_matter" : "agent_generated",
    },
    generated_meta: generatedMeta,
    resolved_meta: { summary, tags, keywords },
    embedding: {
      strategy: EMBEDDING_STRATEGY,
      model: EMBEDDING_MODEL,
      dims: VECTOR_DIM,
    },
    chunk_rows: chunkRows,
    updated_at: new Date().toISOString(),
  };
  if (shouldReuse) reusedDocCount += 1;
  else rebuiltDocCount += 1;

  docs.push({
    id: slug,
    slug,
    url,
    title,
    summary,
    tags,
    keywords,
    body,
    content,
    outlinks,
    contentHash,
    chunkRows,
  });
}

const liveDocIds = new Set(docs.map((d) => d.id));
for (const id of Object.keys(aiCache.docs)) {
  if (!liveDocIds.has(id)) delete aiCache.docs[id];
}
aiCache.pipeline_version = PIPELINE_VERSION;
aiCache.embedding_strategy = EMBEDDING_STRATEGY;
aiCache.embedding_model = EMBEDDING_MODEL;
aiCache.updated_at = new Date().toISOString();
writeJson(AI_CACHE_PATH, aiCache);

if (fs.existsSync(SEARCH_DB_PATH)) fs.rmSync(SEARCH_DB_PATH);
const db = new Database(SEARCH_DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
create table docs (
  doc_id text primary key,
  url text not null,
  title text not null,
  summary text not null,
  tags_json text not null,
  keywords_json text not null,
  content_hash text not null,
  ai_meta_json text not null
);

create virtual table docs_fts using fts5(
  doc_id unindexed,
  title,
  summary,
  tags,
  keywords,
  body
);
`);

const insertDoc = db.prepare(`
  insert into docs (doc_id, url, title, summary, tags_json, keywords_json, content_hash, ai_meta_json)
  values (@doc_id, @url, @title, @summary, @tags_json, @keywords_json, @content_hash, @ai_meta_json)
`);

const insertFts = db.prepare(`
  insert into docs_fts (doc_id, title, summary, tags, keywords, body)
  values (@doc_id, @title, @summary, @tags, @keywords, @body)
`);

const tx = db.transaction((rows) => {
  for (const d of rows) {
    insertDoc.run({
      doc_id: d.id,
      url: d.url,
      title: d.title,
      summary: d.summary,
      tags_json: JSON.stringify(d.tags),
      keywords_json: JSON.stringify(d.keywords),
      content_hash: d.contentHash,
      ai_meta_json: JSON.stringify(aiCache.docs[d.id] || {}),
    });
    insertFts.run({
      doc_id: d.id,
      title: d.title,
      summary: d.summary,
      tags: d.tags.join(" "),
      keywords: d.keywords.join(" "),
      body: d.body,
    });
  }
});

tx(docs);

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

const entityRules = loadEntityRules();
const whitelistEntities = new Set(
  (entityRules.whitelist.entities || [])
    .map((v) => normalizeEntityTerm(v))
    .filter(Boolean),
);
const blacklistEntities = new Set(
  (entityRules.blacklist.entities || [])
    .map((v) => normalizeEntityTerm(v))
    .filter(Boolean),
);
const whitelistPairs = new Set(
  (entityRules.whitelist.doc_entity_pairs || [])
    .map((it) => ({
      docId: it && it.doc_id ? String(it.doc_id) : "",
      entity: normalizeEntityTerm(it && it.entity ? it.entity : ""),
    }))
    .filter((it) => it.docId && it.entity)
    .map((it) => pairKey(it.docId, it.entity)),
);
const blacklistPairs = new Set(
  (entityRules.blacklist.doc_entity_pairs || [])
    .map((it) => ({
      docId: it && it.doc_id ? String(it.doc_id) : "",
      entity: normalizeEntityTerm(it && it.entity ? it.entity : ""),
    }))
    .filter((it) => it.docId && it.entity)
    .map((it) => pairKey(it.docId, it.entity)),
);

const entityNodes = new Map();
const entityEdgesDoc = [];
const entityCoEdgeWeights = new Map();

for (const d of docs) {
  const docNodeId = `doc:${d.id}`;
  entityNodes.set(docNodeId, {
    id: docNodeId,
    title: d.title,
    url: d.url,
    summary: d.summary,
    tags: d.tags,
    kind: "doc",
  });

  const selected = new Set();
  for (const term of docEntityCandidates(d)) {
    const key = pairKey(d.id, term);
    if (blacklistPairs.has(key) && !whitelistPairs.has(key)) continue;
    if (
      blacklistEntities.has(term) &&
      !whitelistEntities.has(term) &&
      !whitelistPairs.has(key)
    )
      continue;
    selected.add(term);
  }

  for (const key of whitelistPairs) {
    const [docId, entity] = key.split("|");
    if (docId === d.id && entity) selected.add(entity);
  }

  const terms = [...selected];
  for (const term of terms) {
    const entityNodeId = `entity:${term}`;
    if (!entityNodes.has(entityNodeId)) {
      entityNodes.set(entityNodeId, {
        id: entityNodeId,
        label: term,
        kind: "entity",
      });
    }
    entityEdgesDoc.push({
      source: docNodeId,
      target: entityNodeId,
      kind: "doc_entity",
      weight: 1,
    });
  }

  const sortedIds = terms.map((term) => `entity:${term}`).sort();
  for (let i = 0; i < sortedIds.length; i++) {
    for (let j = i + 1; j < sortedIds.length; j++) {
      const a = sortedIds[i];
      const b = sortedIds[j];
      const k = `${a}|${b}`;
      entityCoEdgeWeights.set(k, (entityCoEdgeWeights.get(k) || 0) + 1);
    }
  }
}

const entityEdgesCo = [...entityCoEdgeWeights.entries()].map(([k, w]) => {
  const [source, target] = k.split("|");
  return {
    source,
    target,
    kind: "entity_cooccurrence",
    weight: w,
  };
});

for (const n of entityRules.manual.nodes || []) {
  if (!n || !n.id) continue;
  const id = String(n.id).slice(0, 256);
  if (!id) continue;
  entityNodes.set(id, {
    id,
    title: n.title ? String(n.title).slice(0, 160) : undefined,
    label: n.label ? String(n.label).slice(0, 160) : undefined,
    url: n.url ? String(n.url).slice(0, 512) : undefined,
    summary: n.summary ? String(n.summary).slice(0, 1000) : undefined,
    tags: Array.isArray(n.tags)
      ? n.tags.map((t) => String(t).slice(0, 64)).slice(0, 20)
      : [],
    kind: n.kind ? String(n.kind).slice(0, 64) : "manual",
  });
}

const manualEdges = [];
for (const e of entityRules.manual.edges || []) {
  const source = e && e.source ? String(e.source).slice(0, 256) : "";
  const target = e && e.target ? String(e.target).slice(0, 256) : "";
  if (!source || !target) continue;
  if (!entityNodes.has(source))
    entityNodes.set(source, { id: source, label: source, kind: "manual" });
  if (!entityNodes.has(target))
    entityNodes.set(target, { id: target, label: target, kind: "manual" });
  manualEdges.push({
    source,
    target,
    kind: e.kind ? String(e.kind).slice(0, 64) : "manual_edge",
    weight: Number.isFinite(e.weight) ? Number(e.weight) : 1,
  });
}

fs.writeFileSync(
  path.join(ART_DIR, "graph-entity-map.json"),
  JSON.stringify(
    {
      kind: "entity_map",
      nodes: [...entityNodes.values()],
      edges: [...entityEdgesDoc, ...entityEdgesCo, ...manualEdges],
    },
    null,
    2,
  ),
  "utf-8",
);

const docsExport = docs.map(({ id, url, title, summary, tags, keywords }) => ({
  id,
  url,
  title,
  summary,
  tags,
  keywords,
  content_hash: aiCache.docs[id] ? aiCache.docs[id].content_hash : "",
}));

writeJson(path.join(ART_DIR, "docs.json"), docsExport);
writeJson(path.join(ART_DIR, "ai-cache-public.json"), {
  pipeline_version: aiCache.pipeline_version,
  embedding_strategy: aiCache.embedding_strategy,
  embedding_model: aiCache.embedding_model,
  updated_at: aiCache.updated_at,
  docs: docs.map((d) => ({
    id: d.id,
    url: d.url,
    content_hash: d.contentHash,
    source: aiCache.docs[d.id] ? aiCache.docs[d.id].source : {},
  })),
});

const chunkRows = docs.flatMap((d) => d.chunkRows);

const vdb = await connect(VECTORS_DIR);
try {
  await vdb.dropTable("chunks");
} catch {}
await vdb.createTable("chunks", chunkRows);

fs.copyFileSync(SEARCH_DB_PATH, EXPORT_DB_PATH);
copyDirSync(VECTORS_DIR, EXPORT_VECTORS_DIR);
fs.copyFileSync(AI_CACHE_PATH, EXPORT_AI_CACHE_PATH);

writeJson(EXPORT_HASHES_PATH, {
  updated_at: new Date().toISOString(),
  doc_hashes: docs.map((d) => ({ id: d.id, hash: d.contentHash })),
});

writeJson(EXPORT_MANIFEST_PATH, {
  pipeline_version: PIPELINE_VERSION,
  embedding_strategy: EMBEDDING_STRATEGY,
  embedding_model: EMBEDDING_MODEL,
  vector_dim: VECTOR_DIM,
  chunk_size: CHUNK_SIZE,
  chunk_overlap: CHUNK_OVERLAP,
  total_docs: docs.length,
  total_chunks: chunkRows.length,
  reused_docs: reusedDocCount,
  rebuilt_docs: rebuiltDocCount,
  generated_at: new Date().toISOString(),
  files: {
    docs: "docs.json",
    graph_internal_links: "graph-internal-links.json",
    graph_tag_cooccurrence: "graph-tag-cooccurrence.json",
    graph_entity_map: "graph-entity-map.json",
    ai_cache_public: "ai-cache-public.json",
    export_db: "export/search_lexical.db",
    export_vectors: "export/vectors",
    export_cache: "export/ai_cache.json",
    export_hashes: "export/doc-hashes.json",
  },
});

console.log(
  `Built artifacts for ${docs.length} docs, ${chunkRows.length} chunks (reused ${reusedDocCount}, rebuilt ${rebuiltDocCount})`,
);
