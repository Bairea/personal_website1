import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Vercel Serverless Function for /api/graph
// Replaces the Express endpoint for Vercel deployment.
//
// Graph JSON files are pre-built at deploy time.
// Vercel includes files from the project root that are referenced by the function,
// but the output directory (public/) contents are served as static files and
// NOT accessible from serverless functions via the filesystem.
//
// Strategy: try multiple paths to find the artifacts directory.
// - Vercel: artifacts may be at process.cwd()/artifacts or /var/task/artifacts
// - Local:  public/artifacts

const ROOT = process.cwd();

function findArtifactsDir() {
  const candidates = [
    path.join(ROOT, "artifacts"),           // Vercel: output dir promoted to root
    path.join(ROOT, "public", "artifacts"), // Local / Express
    path.join("/var/task", "artifacts"),     // Vercel Lambda root
    path.join("/var/task", "public", "artifacts"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function makeRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
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
  const artDir = findArtifactsDir();
  if (!artDir) return normalizeGraph({ kind, nodes: [], edges: [] });

  const file =
    kind === "tags"
      ? path.join(artDir, "graph-tag-cooccurrence.json")
      : kind === "links"
        ? path.join(artDir, "graph-internal-links.json")
        : "";
  if (!file) return null;
  const data = readJsonIfExists(file);
  return normalizeGraph(data || { kind, nodes: [], edges: [] });
}

export default function handler(req, res) {
  const requestId = makeRequestId();

  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      request_id: requestId,
      error: "method_not_allowed",
    });
  }

  const kind = String(req.query.kind || "links");
  if (!["links", "tags"].includes(kind)) {
    return res.status(400).json({
      ok: false,
      request_id: requestId,
      error: "invalid_kind",
      detail: "supported kinds: links, tags",
    });
  }

  const graph = getStaticGraph(kind);
  if (!graph) {
    return res.status(404).json({
      ok: false,
      request_id: requestId,
      error: "graph_not_found",
    });
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

  return res.status(200).json({
    ok: true,
    request_id: requestId,
    kind,
    graph: picked,
    available_kinds: ["links", "tags"],
  });
}
