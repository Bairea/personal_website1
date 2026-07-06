import fs from "node:fs";
import path from "node:path";
import express from "express";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const ART_DIR = path.join(PUBLIC_DIR, "artifacts");

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
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

function makeRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sendOk(res, payload = {}, status = 200) {
  res.status(status).json({
    ok: true,
    request_id: res.locals.requestId || "",
    ...payload,
  });
}

function sendErr(res, status, error, detail = "") {
  const body = {
    ok: false,
    request_id: res.locals.requestId || "",
    error,
  };
  if (detail) body.detail = detail;
  res.status(status).json(body);
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

function getStaticGraph(kind) {
  const file =
    kind === "tags"
      ? path.join(ART_DIR, "graph-tag-cooccurrence.json")
      : kind === "links"
        ? path.join(ART_DIR, "graph-internal-links.json")
        : "";
  if (!file) return null;
  const data = readJsonIfExists(file);
  return normalizeGraph(data || { kind, nodes: [], edges: [] });
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

app.get("/api/graph", (req, res) => {
  const kind = String(req.query.kind || "links");
  if (!["links", "tags"].includes(kind))
    return sendErr(res, 400, "invalid_kind", "supported kinds: links, tags");

  const graph = getStaticGraph(kind);
  if (!graph) return sendErr(res, 404, "graph_not_found");

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
    available_kinds: ["links", "tags"],
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, "0.0.0.0", () => {
  console.log(`http://localhost:${port}`);
});
