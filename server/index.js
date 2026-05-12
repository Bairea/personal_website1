import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { connect } from "@lancedb/lancedb";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const VECTORS_DIR = path.join(ROOT, "vectors");
const SEARCH_DB_PATH = path.join(DATA_DIR, "search_lexical.db");
const FEEDBACK_DB_PATH = path.join(DATA_DIR, "feedback.db");
const VECTOR_DIM = 256;
const ART_DIR = path.join(PUBLIC_DIR, "artifacts");
const API_CONTRACT_VERSION = "2026-03-22";
const PUBLIC_GUIDE_PATH = path.join(DATA_DIR, "public-guide-graphs.json");
const MAX_PUBLIC_GUIDES = 32;
const ENTITY_RULES_PATH = path.join(DATA_DIR, "entity-graph-rules.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
ensureEntityRulesFile();

const feedbackDb = new Database(FEEDBACK_DB_PATH);
feedbackDb.pragma("journal_mode = WAL");
feedbackDb.exec(`
create table if not exists feedback_events (
  id integer primary key,
  ts integer not null,
  type text not null,
  q text,
  docId text,
  url text,
  nodeId text,
  kind text
);
create index if not exists idx_feedback_ts on feedback_events(ts);
create index if not exists idx_feedback_type on feedback_events(type);
`);

const searchDb = fs.existsSync(SEARCH_DB_PATH)
  ? new Database(SEARCH_DB_PATH, { readonly: true })
  : null;
let vectorDb = fs.existsSync(VECTORS_DIR) ? await connect(VECTORS_DIR) : null;
let vectorTable = null;
if (vectorDb) {
  try {
    vectorTable = await vectorDb.openTable("chunks");
  } catch {
    vectorTable = null;
  }
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function writeJsonFile(p, value) {
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
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
    readJsonIfExists(ENTITY_RULES_PATH) || defaultEntityRules(),
  );
}

function saveEntityRules(store) {
  writeJsonFile(ENTITY_RULES_PATH, normalizeEntityRules(store));
}

function ensureEntityRulesFile() {
  if (fs.existsSync(ENTITY_RULES_PATH)) return;
  saveEntityRules(defaultEntityRules());
}

const internalGraph = readJsonIfExists(
  path.join(ART_DIR, "graph-internal-links.json"),
);
const internalEdgeSet = new Set(
  internalGraph && Array.isArray(internalGraph.edges)
    ? internalGraph.edges.map((e) => `${e.source}>>${e.target}`)
    : [],
);

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

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t));
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

async function ensureVectorTable() {
  if (vectorTable) return vectorTable;
  const vectorPaths = [
    VECTORS_DIR,
    path.join(ROOT, "vectors_tmp"),
    path.join(ART_DIR, "export", "vectors"),
  ];
  for (const vectorPath of vectorPaths) {
    if (!fs.existsSync(vectorPath)) continue;
    try {
      vectorDb = await connect(vectorPath);
      vectorTable = await vectorDb.openTable("chunks");
      return vectorTable;
    } catch {
      vectorTable = null;
    }
  }
  return null;
}

async function vectorSearch(q, limit) {
  const table = await ensureVectorTable();
  if (!table) return [];
  try {
    const vec = hashEmbedding(q, VECTOR_DIM);
    const rows = await table.search(vec).limit(limit).toArray();
    return rows.map((r) => ({
      doc_id: r.doc_id,
      url: r.url,
      title: r.title,
      summary: r.summary,
      tags: parseTags(r.tags_json),
      chunk_id: r.chunk_id,
      text: r.text,
      distance: typeof r._distance === "number" ? r._distance : null,
    }));
  } catch {
    return [];
  }
}

function uniqueBy(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    const k = keyFn(it);
    if (k === null || k === undefined) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function makeRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sendOk(res, payload = {}, status = 200) {
  res.status(status).json({
    ok: true,
    contract_version: API_CONTRACT_VERSION,
    request_id: res.locals.requestId || "",
    ...payload,
  });
}

function sendErr(res, status, error, detail = "") {
  const body = {
    ok: false,
    contract_version: API_CONTRACT_VERSION,
    request_id: res.locals.requestId || "",
    error,
  };
  if (detail) body.detail = detail;
  res.status(status).json(body);
}

function evidenceFromChunkHit(q, hit) {
  const quoteText = String(hit.text || "").slice(0, 280);
  return {
    evidence_id: `${hit.chunk_id}:${fnv1a32(q)}`,
    doc: {
      id: hit.doc_id,
      title: hit.title,
      url: hit.url,
      date_published: "",
      date_updated: "",
    },
    chunk: {
      id: hit.chunk_id,
      index:
        Number(
          String(hit.chunk_id || "")
            .split("#")
            .pop(),
        ) || 0,
      heading_path: [hit.title],
      char_start: 0,
      char_end: 0,
    },
    quote: {
      text: quoteText,
      md_excerpt: quoteText,
    },
    retrieval: {
      source: "vector",
      score: hit.distance === null ? 0 : 1 / (1 + hit.distance),
      query: q,
    },
    provenance: {
      generated_at: nowIso(),
      pipeline_version: "mvp",
      model: process.env.EMBEDDING_PROVIDER || "hash",
    },
  };
}

function runLexicalSearch(q, limit = 30) {
  if (!searchDb) return [];
  return searchDb
    .prepare(
      `
      select
        d.doc_id as id,
        d.url as url,
        d.title as title,
        d.summary as summary,
        d.tags_json as tags_json,
        snippet(docs_fts, 5, '', '', ' … ', 16) as snippet,
        bm25(docs_fts) as bm25
      from docs_fts
      join docs d on d.doc_id = docs_fts.doc_id
      where docs_fts match ?
      order by bm25(docs_fts)
      limit ?
      `,
    )
    .all(q, limit);
}

function evidenceFromLexicalHit(q, hit, idx) {
  const quoteText = String(hit.snippet || hit.summary || "").slice(0, 280);
  const bm25 = typeof hit.bm25 === "number" ? hit.bm25 : 0;
  const score = 1 / (1 + Math.max(0, bm25));
  return {
    evidence_id: `${hit.id || "lexical"}:lexical:${idx}:${fnv1a32(q)}`,
    doc: {
      id: hit.id,
      title: hit.title,
      url: hit.url,
      date_published: "",
      date_updated: "",
    },
    chunk: {
      id: `${hit.id}#lexical_${idx}`,
      index: idx,
      heading_path: [hit.title],
      char_start: 0,
      char_end: 0,
    },
    quote: {
      text: quoteText,
      md_excerpt: quoteText,
    },
    retrieval: {
      source: "lexical",
      score,
      query: q,
    },
    provenance: {
      generated_at: nowIso(),
      pipeline_version: "mvp",
      model: "fts5",
    },
  };
}

function makeTempSubgraph(docMetas) {
  const nodes = docMetas.map((d) => ({
    id: d.id,
    title: d.title,
    url: d.url,
    summary: d.summary,
    tags: d.tags,
  }));

  const edges = [];
  const byId = new Map(docMetas.map((d) => [d.id, d]));
  const ids = docMetas.map((d) => d.id);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (
        internalEdgeSet.has(`${a}>>${b}`) ||
        internalEdgeSet.has(`${b}>>${a}`)
      ) {
        edges.push({ source: a, target: b, kind: "internal_link", weight: 1 });
        continue;
      }
      const ta = new Set(byId.get(a)?.tags || []);
      const tb = new Set(byId.get(b)?.tags || []);
      let shared = 0;
      for (const t of ta) if (tb.has(t)) shared++;
      if (shared > 0)
        edges.push({
          source: a,
          target: b,
          kind: "shared_tag",
          weight: shared,
        });
    }
  }

  return { kind: "temp_subgraph", nodes, edges };
}

function normalizeGraph(input) {
  const inGraph = input && typeof input === "object" ? input : {};
  const nodesRaw = Array.isArray(inGraph.nodes)
    ? inGraph.nodes
    : Array.isArray(inGraph.vertices)
      ? inGraph.vertices
      : [];
  const edgesRaw = Array.isArray(inGraph.edges)
    ? inGraph.edges
    : Array.isArray(inGraph.links)
      ? inGraph.links
      : [];

  const nodeIds = new Set();
  const nodes = [];
  for (const n of nodesRaw) {
    const idRaw =
      n && n.id !== undefined && n.id !== null
        ? n.id
        : n && n.node_id !== undefined && n.node_id !== null
          ? n.node_id
          : n && n.key !== undefined && n.key !== null
            ? n.key
            : n && n.name !== undefined && n.name !== null
              ? n.name
              : "";
    const id = String(idRaw || "").slice(0, 256);
    if (!id || nodeIds.has(id)) continue;
    nodeIds.add(id);
    const tags = Array.isArray(n.tags)
      ? n.tags.map((t) => String(t).slice(0, 64)).slice(0, 20)
      : [];
    nodes.push({
      id,
      title: n.title ? String(n.title).slice(0, 160) : undefined,
      label: n.label ? String(n.label).slice(0, 160) : undefined,
      url: n.url ? String(n.url).slice(0, 512) : undefined,
      summary: n.summary ? String(n.summary).slice(0, 1000) : undefined,
      tags,
    });
  }

  const edges = [];
  for (const e of edgesRaw) {
    const sourceRaw =
      e && e.source !== undefined && e.source !== null
        ? e.source
        : e && e.from !== undefined && e.from !== null
          ? e.from
          : "";
    const targetRaw =
      e && e.target !== undefined && e.target !== null
        ? e.target
        : e && e.to !== undefined && e.to !== null
          ? e.to
          : "";
    const source = String(sourceRaw || "").slice(0, 256);
    const target = String(targetRaw || "").slice(0, 256);
    if (!source || !target) continue;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({
      source,
      target,
      kind: e.kind ? String(e.kind).slice(0, 64) : undefined,
      weight: Number.isFinite(e.weight) ? Number(e.weight) : 1,
    });
  }

  return {
    kind: inGraph.kind ? String(inGraph.kind).slice(0, 64) : "graph",
    nodes,
    edges,
  };
}

function pickSubgraph(baseGraph, { nodeIds = [], maxNodes = 0 } = {}) {
  const graph = normalizeGraph(baseGraph);
  if (!nodeIds.length && (!Number.isFinite(maxNodes) || maxNodes <= 0))
    return graph;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  let selected = [];

  if (nodeIds.length) {
    selected = nodeIds.map((id) => String(id)).filter((id) => nodeMap.has(id));
  } else {
    selected = graph.nodes.slice(0, maxNodes).map((n) => n.id);
  }

  if (Number.isFinite(maxNodes) && maxNodes > 0)
    selected = selected.slice(0, maxNodes);
  const idSet = new Set(selected);
  const nodes = graph.nodes.filter((n) => idSet.has(n.id));
  const edges = graph.edges.filter(
    (e) => idSet.has(e.source) && idSet.has(e.target),
  );
  return { kind: `${graph.kind}_subgraph`, nodes, edges };
}

function loadPublicGuideStore() {
  const raw = readJsonIfExists(PUBLIC_GUIDE_PATH);
  if (!raw || typeof raw !== "object") return { updated_at: "", graphs: [] };
  const graphs = Array.isArray(raw.graphs) ? raw.graphs : [];
  return {
    updated_at: raw.updated_at ? String(raw.updated_at) : "",
    graphs,
  };
}

function savePublicGuideStore(store) {
  writeJsonFile(PUBLIC_GUIDE_PATH, store);
}

function savePublicGuide({ title, graph, source }) {
  const normalizedGraph = normalizeGraph(graph);
  if (!normalizedGraph.nodes.length) throw new Error("empty_graph");

  const store = loadPublicGuideStore();
  const now = nowIso();
  const record = {
    id: `guide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(title || "公共导览图").slice(0, 80),
    created_at: now,
    source: {
      type: source && source.type ? String(source.type).slice(0, 32) : "manual",
      q: source && source.q ? String(source.q).slice(0, 256) : "",
    },
    graph: {
      ...normalizedGraph,
      kind: "public_guide",
    },
  };

  const prev = Array.isArray(store.graphs) ? store.graphs : [];
  store.graphs = [record, ...prev].slice(0, MAX_PUBLIC_GUIDES);
  store.updated_at = now;
  savePublicGuideStore(store);
  return record;
}

function getStaticGraph(kind) {
  const file =
    kind === "tags"
      ? path.join(ART_DIR, "graph-tag-cooccurrence.json")
      : kind === "links"
        ? path.join(ART_DIR, "graph-internal-links.json")
        : kind === "entity"
          ? path.join(ART_DIR, "graph-entity-map.json")
          : "";
  if (!file) return null;
  const data = readJsonIfExists(file);
  return normalizeGraph(data || { kind, nodes: [], edges: [] });
}

function upsertUnique(arr, value, keyFn) {
  const key = keyFn(value);
  if (!key) return arr;
  if (arr.some((it) => keyFn(it) === key)) return arr;
  return arr.concat([value]);
}

function removeByKey(arr, key, keyFn) {
  return arr.filter((it) => keyFn(it) !== key);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.locals.requestId = makeRequestId();
  res.setHeader("x-request-id", res.locals.requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

const API_KEY = process.env.API_KEY ? String(process.env.API_KEY) : "";

function getProvidedKey(req) {
  const k = req.get("x-api-key");
  if (k) return String(k);
  const auth = req.get("authorization");
  if (!auth) return "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const provided = getProvidedKey(req);
  if (provided !== API_KEY)
    return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
}

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || "unknown";
    const key = `${ip}:${req.path}`;
    const arr = hits.get(key) || [];
    const pruned = arr.filter((t) => now - t < windowMs);
    pruned.push(now);
    hits.set(key, pruned);
    if (pruned.length > max)
      return res.status(429).json({ ok: false, error: "rate_limited" });
    next();
  };
}

function createSemaphore(max) {
  let cur = 0;
  const queue = [];
  const acquire = () =>
    new Promise((resolve) => {
      const take = () => {
        cur++;
        resolve(() => {
          cur--;
          const n = queue.shift();
          if (n) n();
        });
      };
      if (cur < max) take();
      else queue.push(take);
    });
  return { acquire };
}

const CHAT_CONCURRENCY = process.env.CHAT_CONCURRENCY
  ? Number(process.env.CHAT_CONCURRENCY)
  : 2;
const chatSem = createSemaphore(
  Number.isFinite(CHAT_CONCURRENCY) && CHAT_CONCURRENCY > 0
    ? CHAT_CONCURRENCY
    : 2,
);

app.get(
  "/api/search",
  rateLimit({ windowMs: 60_000, max: 120 }),
  async (req, res) => {
    if (!searchDb) return sendErr(res, 503, "search_index_not_built");
    const q = String(req.query.q || "").trim();
    const mode = String(req.query.mode || "hybrid");
    if (!["hybrid", "lexical", "vector"].includes(mode))
      return sendErr(res, 400, "invalid_mode");
    if (!q) return sendOk(res, { q, mode, hits: [] });

    try {
      const rows = runLexicalSearch(q, 30);

      const lexical = rows.map((r, idx) => {
        const bm25 = typeof r.bm25 === "number" ? r.bm25 : null;
        const bm25Pos = bm25 === null ? null : Math.max(0, bm25);
        const lexicalScore = bm25Pos === null ? 0 : 1 / (1 + bm25Pos);
        const rankScore = 1 / (1 + idx);
        return {
          id: r.id,
          url: r.url,
          title: r.title,
          summary: r.summary,
          tags: parseTags(r.tags_json),
          snippet: r.snippet || "",
          why: { lexical: { bm25, index: idx } },
          score: lexicalScore * 0.7 + rankScore * 0.3,
        };
      });

      if (mode === "lexical") {
        return sendOk(res, { q, mode, hits: lexical });
      }

      const vecHitsRaw = await vectorSearch(q, 30);
      const bestVecByDoc = new Map();
      for (const h of vecHitsRaw) {
        if (!h.doc_id) continue;
        const d = typeof h.distance === "number" ? h.distance : 1e9;
        const prev = bestVecByDoc.get(h.doc_id);
        if (!prev || d < prev.distance) bestVecByDoc.set(h.doc_id, h);
      }

      const vecHits = [...bestVecByDoc.values()].map((h) => {
        const distance = typeof h.distance === "number" ? h.distance : null;
        const vecScore = distance === null ? 0 : 1 / (1 + distance);
        return {
          id: h.doc_id,
          url: h.url,
          title: h.title,
          summary: h.summary,
          tags: h.tags,
          snippet: "",
          why: { vector: { distance, chunk_id: h.chunk_id } },
          score: vecScore,
        };
      });

      if (mode === "vector") {
        return sendOk(res, { q, mode, hits: vecHits });
      }

      const merged = new Map();
      for (const h of lexical) merged.set(h.id, { ...h });
      for (const h of vecHits) {
        const prev = merged.get(h.id);
        if (!prev) {
          merged.set(h.id, { ...h });
        } else {
          merged.set(h.id, {
            ...prev,
            score: prev.score * 0.65 + h.score * 0.35,
            why: { ...prev.why, ...h.why },
          });
        }
      }

      const hits = [...merged.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      sendOk(res, { q, mode: "hybrid", hits });
    } catch (e) {
      sendErr(res, 400, "bad_query", String(e && e.message ? e.message : e));
    }
  },
);

app.get("/api/graph", rateLimit({ windowMs: 60_000, max: 120 }), (req, res) => {
  const kind = String(req.query.kind || "links");
  if (!["links", "tags", "public", "entity"].includes(kind))
    return sendErr(res, 400, "invalid_kind");

  let graph = null;
  let publicGraphId = "";
  if (kind === "public") {
    const id = String(req.query.id || "");
    const store = loadPublicGuideStore();
    const records = Array.isArray(store.graphs) ? store.graphs : [];
    const found = id ? records.find((r) => r && r.id === id) : records[0];
    if (!found) return sendErr(res, 404, "public_graph_not_found");
    graph = normalizeGraph(found.graph || {});
    publicGraphId = String(found.id || "");
  } else {
    graph = getStaticGraph(kind);
    if (!graph) return sendErr(res, 404, "graph_not_found");
  }

  const nodeIds = String(req.query.node_ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  const hasMaxNodes = req.query.max_nodes !== undefined;
  const maxNodesInput = hasMaxNodes ? Number(req.query.max_nodes) : 0;
  const maxNodes =
    Number.isFinite(maxNodesInput) && maxNodesInput > 0
      ? Math.max(1, Math.min(200, Math.floor(maxNodesInput)))
      : 0;
  const picked = pickSubgraph(graph, { nodeIds, maxNodes });

  sendOk(res, {
    kind,
    graph: picked,
    available_kinds: ["links", "tags", "public", "entity"],
    public_graph_id: publicGraphId || null,
  });
});

app.get("/api/graph/rules", requireApiKey, (req, res) => {
  const kind = String(req.query.kind || "entity");
  if (kind !== "entity") return sendErr(res, 400, "invalid_kind");
  sendOk(res, { kind, rules: loadEntityRules() });
});

app.post(
  "/api/graph/rules",
  rateLimit({ windowMs: 60_000, max: 60 }),
  requireApiKey,
  (req, res) => {
    const b = req.body || {};
    const kind = String(b.kind || "entity");
    if (kind !== "entity") return sendErr(res, 400, "invalid_kind");
    const mode = String(b.mode || "");
    const action = String(b.action || "add");
    if (!["add", "remove"].includes(action))
      return sendErr(res, 400, "invalid_action");
    if (
      !["whitelist", "blacklist", "manual_node", "manual_edge"].includes(mode)
    )
      return sendErr(res, 400, "invalid_mode");

    const store = loadEntityRules();
    const now = nowIso();

    if (mode === "whitelist" || mode === "blacklist") {
      const target = mode === "whitelist" ? store.whitelist : store.blacklist;
      const entity = normalizeEntityTerm(b.entity);
      const docId = b.doc_id ? String(b.doc_id).slice(0, 256) : "";
      if (!entity) return sendErr(res, 400, "missing_entity");

      if (docId) {
        const pair = { doc_id: docId, entity };
        const keyFn = (it) =>
          `${String(it?.doc_id || "")}|${normalizeEntityTerm(it?.entity)}`;
        const key = keyFn(pair);
        target.doc_entity_pairs =
          action === "add"
            ? upsertUnique(target.doc_entity_pairs, pair, keyFn)
            : removeByKey(target.doc_entity_pairs, key, keyFn);
      } else {
        target.entities =
          action === "add"
            ? upsertUnique(target.entities, entity, (it) =>
                normalizeEntityTerm(it),
              )
            : removeByKey(target.entities, entity, (it) =>
                normalizeEntityTerm(it),
              );
      }
    }

    if (mode === "manual_node") {
      const node = b.node && typeof b.node === "object" ? b.node : {};
      const id = node.id ? String(node.id).slice(0, 256) : "";
      if (!id) return sendErr(res, 400, "missing_node_id");
      const normalizedNode = {
        id,
        title: node.title ? String(node.title).slice(0, 160) : "",
        label: node.label ? String(node.label).slice(0, 160) : "",
        url: node.url ? String(node.url).slice(0, 512) : "",
        summary: node.summary ? String(node.summary).slice(0, 1000) : "",
        tags: Array.isArray(node.tags)
          ? node.tags.map((t) => String(t).slice(0, 64)).slice(0, 20)
          : [],
        kind: node.kind ? String(node.kind).slice(0, 64) : "manual",
      };
      const keyFn = (it) => String(it?.id || "");
      store.manual.nodes =
        action === "add"
          ? upsertUnique(store.manual.nodes, normalizedNode, keyFn)
          : removeByKey(store.manual.nodes, normalizedNode.id, keyFn);
    }

    if (mode === "manual_edge") {
      const edge = b.edge && typeof b.edge === "object" ? b.edge : {};
      const source = edge.source ? String(edge.source).slice(0, 256) : "";
      const target = edge.target ? String(edge.target).slice(0, 256) : "";
      if (!source || !target) return sendErr(res, 400, "missing_edge_nodes");
      const normalizedEdge = {
        source,
        target,
        kind: edge.kind ? String(edge.kind).slice(0, 64) : "manual_edge",
        weight: Number.isFinite(edge.weight) ? Number(edge.weight) : 1,
      };
      const keyFn = (it) =>
        `${String(it?.source || "")}|${String(it?.target || "")}|${String(it?.kind || "")}`;
      const key = keyFn(normalizedEdge);
      store.manual.edges =
        action === "add"
          ? upsertUnique(store.manual.edges, normalizedEdge, keyFn)
          : removeByKey(store.manual.edges, key, keyFn);
    }

    store.updated_at = now;
    saveEntityRules(store);
    sendOk(res, { kind, rules: store });
  },
);

app.get("/api/contract", (req, res) => {
  sendOk(res, {
    api: "discovery",
    endpoints: {
      search: {
        method: "GET",
        path: "/api/search",
        modes: ["lexical", "vector", "hybrid"],
      },
      chat: { method: "POST", path: "/api/chat" },
      feedback: { method: "POST", path: "/api/feedback" },
      graph: {
        method: "GET",
        path: "/api/graph",
        kinds: ["links", "tags", "public", "entity"],
      },
      graph_public: { method: "POST", path: "/api/graph/public" },
      graph_rules: { method: "POST", path: "/api/graph/rules" },
    },
  });
});

app.post(
  "/api/graph/public",
  rateLimit({ windowMs: 60_000, max: 30 }),
  requireApiKey,
  (req, res) => {
    const b = req.body || {};
    if (!b.graph) return sendErr(res, 400, "missing_graph");
    try {
      const record = savePublicGuide({
        title: b.title,
        graph: b.graph,
        source: b.source && typeof b.source === "object" ? b.source : {},
      });
      sendOk(
        res,
        {
          id: record.id,
          title: record.title,
          created_at: record.created_at,
          node_count: Array.isArray(record.graph?.nodes)
            ? record.graph.nodes.length
            : 0,
          edge_count: Array.isArray(record.graph?.edges)
            ? record.graph.edges.length
            : 0,
          graph: record.graph,
        },
        201,
      );
    } catch (e) {
      sendErr(
        res,
        400,
        "bad_graph_payload",
        String(e && e.message ? e.message : e),
      );
    }
  },
);

app.post(
  "/api/feedback",
  rateLimit({ windowMs: 60_000, max: 240 }),
  requireApiKey,
  (req, res) => {
    const b = req.body || {};
    const ts = Number.isFinite(b.ts) ? b.ts : Date.now();
    const type = String(b.type || "").slice(0, 64);
    if (!type) return sendErr(res, 400, "missing_type");

    feedbackDb
      .prepare(
        `
      insert into feedback_events (ts, type, q, docId, url, nodeId, kind)
      values (@ts, @type, @q, @docId, @url, @nodeId, @kind)
      `,
      )
      .run({
        ts,
        type,
        q: b.q ? String(b.q).slice(0, 256) : null,
        docId: b.docId ? String(b.docId).slice(0, 256) : null,
        url: b.url ? String(b.url).slice(0, 512) : null,
        nodeId: b.nodeId ? String(b.nodeId).slice(0, 256) : null,
        kind: b.kind ? String(b.kind).slice(0, 64) : null,
      });

    sendOk(res, { accepted: true });
  },
);

app.post(
  "/api/chat",
  rateLimit({ windowMs: 60_000, max: 30 }),
  requireApiKey,
  async (req, res) => {
    if (!searchDb) return sendErr(res, 503, "search_index_not_built");
    const b = req.body || {};
    const q = String(b.q || "").trim();
    if (!q) return sendErr(res, 400, "missing_q");

    const topK = Number.isFinite(b.topK)
      ? Math.max(1, Math.min(20, b.topK))
      : 6;
    const unfamiliar = Boolean(b.unfamiliar) || /不熟|不了解|从零|入门/.test(q);

    const release = await chatSem.acquire();
    let chunkHits = [];
    let citations = [];
    try {
      chunkHits = await vectorSearch(q, Math.max(12, topK));
      if (!chunkHits.length) {
        const lexicalRows = runLexicalSearch(q, Math.max(12, topK));
        chunkHits = lexicalRows.map((row, idx) => ({
          doc_id: row.id,
          url: row.url,
          title: row.title,
          summary: row.summary,
          tags: parseTags(row.tags_json),
          chunk_id: `${row.id}#lexical_${idx}`,
          text: row.snippet || row.summary || "",
          distance: null,
          bm25: typeof row.bm25 === "number" ? row.bm25 : null,
          snippet: row.snippet || "",
        }));
      }
      citations = uniqueBy(chunkHits, (h) => h.chunk_id)
        .slice(0, topK)
        .map((h, idx) =>
          h.distance === null && h.bm25 !== undefined
            ? evidenceFromLexicalHit(q, h, idx)
            : evidenceFromChunkHit(q, h),
        );
    } finally {
      release();
    }

    const docHits = uniqueBy(chunkHits, (h) => h.doc_id)
      .slice(0, unfamiliar ? 6 : 4)
      .map((h) => ({
        id: h.doc_id,
        url: h.url,
        title: h.title,
        summary: h.summary,
        tags: h.tags,
      }));

    const reading_path = docHits.map((d, idx) => ({
      doc_id: d.id,
      url: d.url,
      title: d.title,
      reason: idx === 0 ? "相关度最高的起点" : "与问题强相关的补充阅读",
    }));

    const temp_graph = makeTempSubgraph(docHits);
    const savePublicGraphRequested = Boolean(b.save_public_graph);
    const publicGraphTitle = b.public_graph_title
      ? String(b.public_graph_title).slice(0, 80)
      : "";
    let public_graph = null;
    let public_graph_error = "";

    let answer = "";
    const aiUrl = process.env.AI_CHAT_URL
      ? String(process.env.AI_CHAT_URL)
      : "";
    const aiKey = process.env.AI_CHAT_KEY
      ? String(process.env.AI_CHAT_KEY)
      : "";

    if (aiUrl) {
      const contextText = citations
        .map(
          (c, i) => `[${i + 1}] ${c.doc.title} ${c.doc.url}\n${c.quote.text}`,
        )
        .join("\n\n");

      const payload = {
        question: q,
        contexts: contextText,
        citations: citations.map((c, i) => ({
          index: i + 1,
          title: c.doc.title,
          url: c.doc.url,
        })),
      };

      try {
        const r = await fetch(aiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(aiKey ? { authorization: `Bearer ${aiKey}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        answer = String(data.answer || data.text || "");
      } catch (e) {
        answer = `AI 调用失败：${String(e && e.message ? e.message : e)}`;
      }
    } else {
      const titles = reading_path
        .map((d, i) => `${i + 1}. ${d.title}`)
        .join("\n");
      answer = `我从站内内容中找到了可能相关的材料，但当前未配置 AI_CHAT_URL。\n\n推荐阅读顺序：\n${titles}\n\n你也可以继续补充问题细节，我会给出更精确的引用片段。`;
    }

    if (savePublicGraphRequested && unfamiliar && temp_graph.nodes.length > 0) {
      try {
        const record = savePublicGuide({
          title: publicGraphTitle || `导览图：${q}`,
          graph: temp_graph,
          source: { type: "chat", q },
        });
        public_graph = {
          id: record.id,
          title: record.title,
          created_at: record.created_at,
          node_count: record.graph.nodes.length,
          edge_count: record.graph.edges.length,
        };
      } catch (e) {
        public_graph_error = String(e && e.message ? e.message : e);
      }
    }

    sendOk(res, {
      q,
      answer,
      citations,
      reading_path: unfamiliar ? reading_path : [],
      temp_graph: unfamiliar ? temp_graph : null,
      public_graph,
      public_graph_error,
    });
  },
);

app.get("/api/feedback/export.json", (req, res) => {
  const since = req.query.since ? Number(req.query.since) : 0;
  const until = req.query.until ? Number(req.query.until) : Date.now();
  const rows = feedbackDb
    .prepare(
      `select * from feedback_events where ts between ? and ? order by ts asc`,
    )
    .all(since, until);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify({ since, until, rows }, null, 2));
});

app.get("/api/feedback/export.csv", (req, res) => {
  const since = req.query.since ? Number(req.query.since) : 0;
  const until = req.query.until ? Number(req.query.until) : Date.now();
  const rows = feedbackDb
    .prepare(
      `select * from feedback_events where ts between ? and ? order by ts asc`,
    )
    .all(since, until);

  const header = ["id", "ts", "type", "q", "docId", "url", "nodeId", "kind"];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [header.join(",")]
    .concat(rows.map((r) => header.map((k) => esc(r[k])).join(",")))
    .join("\n");

  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.send(csv);
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, "0.0.0.0", () => {
  console.log(`http://localhost:${port}`);
});
