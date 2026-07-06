import { byId, escapeHtml } from "./common.js";

declare const d3: any;

type GraphNode = {
  id: string;
  title?: string;
  label?: string;
  url?: string;
  summary?: string;
  tags?: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: unknown;
};

type GraphEdge = {
  source: GraphNode | string;
  target: GraphNode | string;
  weight?: number;
  kind?: string;
  [key: string]: unknown;
};

type GraphData = {
  kind?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
};

const svg = d3.select("#graph");
const sideTitle = byId<HTMLElement>("title");
const sideMeta = byId<HTMLElement>("meta");
const sideSummary = byId<HTMLElement>("summary");
const sideOut = byId<HTMLElement>("out");
const sideRelations = byId<HTMLElement>("relations");
const graphKind = byId<HTMLSelectElement>("graphKind");
const tagFilter = byId<HTMLSelectElement>("tagFilter");
const edgeTypeFilter = byId<HTMLSelectElement>("edgeTypeFilter");
const minWeight = byId<HTMLInputElement>("minWeight");
const minWeightValue = byId<HTMLElement>("minWeightValue");
const resetView = byId<HTMLButtonElement>("resetView");
let currentKind = "links";
let selectedNodeId = "";
let hoveredNodeId = "";
let selectedNode: GraphNode | null = null;
let rawGraph: GraphData | null = null;
let renderedNodes: GraphNode[] = [];
let renderedLinks: GraphEdge[] = [];
let nodeSelection: any = null;
let linkSelection: any = null;
let currentNodeMap = new Map<string, GraphNode>();
let neighborMap = new Map<string, Set<string>>();
let edgeMap = new Map<string, GraphEdge[]>();
let activeSimulation: any = null;
let simulationStopTimer = 0;
let zoomBehavior: any = null;
const graphCache = new Map<string, GraphData>();
const LARGE_GRAPH_EDGE_LIMIT = 1800;
const graphKindLabels: Record<string, string> = {
  links: "内容网络",
  tags: "主题网络",
};

function kindLabel(kind: string): string {
  return graphKindLabels[kind] || kind || "网络";
}

function endpointId(value: GraphNode | string): string {
  return typeof value === "object" ? String(value.id || "") : String(value || "");
}

function nodeColor(id: string): string {
  const text = String(id || "");
  if (text.startsWith("tag:")) return "#2563eb";
  return "#0f172a";
}

async function loadGraph(kind: string): Promise<GraphData> {
  if (graphCache.has(kind)) return graphCache.get(kind) as GraphData;
  const url = `/api/graph?kind=${encodeURIComponent(kind)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`load failed: ${url}`);
  const data = (await response.json()) as { ok: boolean; error?: string; graph: GraphData };
  if (!data.ok) throw new Error(data.error || "graph failed");
  graphCache.set(kind, data.graph);
  return data.graph;
}

function clearSelectionWhenHidden(nodes: GraphNode[]): void {
  if (!selectedNodeId) return;
  const exists = nodes.some((node: GraphNode) => String(node.id) === selectedNodeId);
  if (exists) return;
  selectedNodeId = "";
  selectedNode = null;
  sideTitle.innerHTML = "<strong>尚未选择节点</strong>";
  sideMeta.textContent = "";
  sideSummary.textContent = "";
  sideOut.innerHTML = "";
}

function syncFilterOptions(data: GraphData): void {
  const tags = new Set<string>();
  for (const node of data.nodes || []) {
    if (String(node.id || "").startsWith("tag:")) tags.add(String(node.id).slice(4));
    if (Array.isArray(node.tags)) for (const tag of node.tags) tags.add(String(tag));
  }
  const prevTag = tagFilter.value || "all";
  tagFilter.innerHTML = `<option value="all">全部</option>${[...tags].sort((a, b) => a.localeCompare(b)).map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  tagFilter.value = tags.has(prevTag) ? prevTag : "all";

  const edgeKinds = new Set((data.edges || []).map((edge: GraphEdge) => String(edge.kind || "unknown")));
  const prevEdge = edgeTypeFilter.value || "all";
  edgeTypeFilter.innerHTML = `<option value="all">全部</option>${[...edgeKinds].sort((a, b) => a.localeCompare(b)).map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind)}</option>`).join("")}`;
  edgeTypeFilter.value = edgeKinds.has(prevEdge) ? prevEdge : "all";

  const maxWeight = Math.max(1, ...((data.edges || []).map((edge: GraphEdge) => Number(edge.weight) || 1)));
  minWeight.max = String(Math.max(1, Math.ceil(maxWeight)));
  if (Number(minWeight.value) > Number(minWeight.max)) minWeight.value = minWeight.max;
  minWeightValue.textContent = String(minWeight.value);
}

function buildFilteredGraph(data: GraphData): GraphData {
  const minW = Number(minWeight.value || 1);
  const edgeKind = edgeTypeFilter.value || "all";
  const tag = tagFilter.value || "all";
  const allNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const allEdges = Array.isArray(data.edges) ? data.edges : [];

  const tagMatched = new Set<string>();
  if (tag !== "all") {
    for (const node of allNodes) {
      const id = String(node.id || "");
      const nodeTags = Array.isArray(node.tags) ? node.tags.map((text) => String(text)) : [];
      const byTagField = nodeTags.includes(tag);
      const byTagNode = id.startsWith("tag:") && id.slice(4) === tag;
      if (byTagField || byTagNode) tagMatched.add(id);
    }
  }

  let edges = allEdges.filter((edge: GraphEdge) => {
    const weight = Number(edge.weight) || 1;
    if (weight < minW) return false;
    if (edgeKind !== "all" && String(edge.kind || "unknown") !== edgeKind) return false;
    if (tag === "all") return true;
    const source = endpointId(edge.source);
    const target = endpointId(edge.target);
    return tagMatched.has(source) || tagMatched.has(target);
  });

  if (edges.length > LARGE_GRAPH_EDGE_LIMIT) {
    edges = [...edges].sort((a: GraphEdge, b: GraphEdge) => (Number(b.weight) || 1) - (Number(a.weight) || 1)).slice(0, LARGE_GRAPH_EDGE_LIMIT);
  }

  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(endpointId(edge.source));
    ids.add(endpointId(edge.target));
  }
  if (tag !== "all") for (const id of tagMatched) ids.add(id);
  if (!ids.size && allNodes.length && !allEdges.length) for (const node of allNodes) ids.add(String(node.id));
  const nodes = allNodes.filter((node) => ids.has(String(node.id)));
  return { kind: data.kind, nodes, edges };
}

function buildRelationshipIndex(nodes: GraphNode[], links: GraphEdge[]): void {
  currentNodeMap = new Map(nodes.map((node: GraphNode) => [String(node.id), node]));
  neighborMap = new Map();
  edgeMap = new Map();
  for (const node of nodes) {
    const id = String(node.id);
    neighborMap.set(id, new Set());
    edgeMap.set(id, []);
  }
  for (const edge of links) {
    const source = endpointId(edge.source);
    const target = endpointId(edge.target);
    if (!neighborMap.has(source)) neighborMap.set(source, new Set());
    if (!neighborMap.has(target)) neighborMap.set(target, new Set());
    (neighborMap.get(source) as Set<string>).add(target);
    (neighborMap.get(target) as Set<string>).add(source);
    if (!edgeMap.has(source)) edgeMap.set(source, []);
    if (!edgeMap.has(target)) edgeMap.set(target, []);
    (edgeMap.get(source) as GraphEdge[]).push(edge);
    (edgeMap.get(target) as GraphEdge[]).push(edge);
  }
}

function renderRelations(node: GraphNode | null): void {
  if (!node) {
    sideRelations.innerHTML = `<div class="meta">选择节点后可查看邻居与关系类型</div>`;
    return;
  }
  const id = String(node.id || "");
  const neighbors = [...(neighborMap.get(id) || new Set<string>())].map((neighborId) => currentNodeMap.get(neighborId)).filter(Boolean) as GraphNode[];
  const edgeTypes = new Map<string, number>();
  for (const edge of edgeMap.get(id) || []) {
    const kind = String(edge.kind || "unknown");
    edgeTypes.set(kind, (edgeTypes.get(kind) || 0) + 1);
  }
  const typeHtml = [...edgeTypes.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => `<span class="pill">${escapeHtml(kind)} × ${count}</span>`).join("");
  const neighborsHtml = neighbors.slice(0, 60).map((neighbor) => `<button class="node-quick" data-node-id="${escapeHtml(neighbor.id)}">${escapeHtml(neighbor.title || neighbor.label || neighbor.id)}</button>`).join("");
  sideRelations.innerHTML = `
    <div class="meta">邻居：${neighbors.length}</div>
    <div style="margin-top:8px;">${typeHtml || '<span class="meta">暂无关系类型</span>'}</div>
    <div style="margin-top:8px;">${neighborsHtml || '<span class="meta">暂无邻居</span>'}</div>
  `;
  sideRelations.querySelectorAll("[data-node-id]").forEach((element: Element) => {
    element.addEventListener("click", () => {
      const nextId = String(element.getAttribute("data-node-id") || "");
      const nextNode = currentNodeMap.get(nextId);
      if (!nextNode) return;
      selectedNodeId = nextId;
      selectedNode = nextNode;
      updateSide(nextNode);
      applyFocusState();
      centerOnNode(nextNode);
    });
  });
}

function updateSide(node: GraphNode | null): void {
  if (!node) {
    sideTitle.innerHTML = "<strong>尚未选择节点</strong>";
    sideMeta.textContent = "";
    sideSummary.textContent = "";
    sideOut.innerHTML = "";
    renderRelations(null);
    return;
  }
  sideTitle.innerHTML = `<strong>${escapeHtml(node.title || node.label || node.id)}</strong>`;
  sideMeta.textContent = String(node.url || "");
  sideSummary.textContent = String(node.summary || "");
  sideOut.innerHTML = node.url ? `<p><a href="${escapeHtml(node.url)}">打开文章</a></p>` : "";
  renderRelations(node);
}

function applyFocusState(): void {
  if (!nodeSelection || !linkSelection) return;
  const activeCenters = new Set([selectedNodeId, hoveredNodeId].filter(Boolean));
  if (!activeCenters.size) {
    nodeSelection
      .attr("opacity", 1)
      .attr("r", (datum: GraphNode) => {
        const id = String(datum.id || "");
        return id.startsWith("tag:") ? 6 : 5;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.4);
    linkSelection.attr("stroke-opacity", 0.62).attr("stroke-width", (datum: GraphEdge) => Math.min(6, 1 + (Number(datum.weight) || 1)));
    return;
  }

  const focused = new Set(activeCenters);
  for (const id of activeCenters) {
    for (const neighbor of neighborMap.get(id) || []) focused.add(neighbor);
  }

  nodeSelection
    .attr("opacity", (datum: GraphNode) => (focused.has(String(datum.id)) ? 1 : 0.16))
    .attr("r", (datum: GraphNode) => {
      const id = String(datum.id);
      if (activeCenters.has(id)) return 8.6;
      if (focused.has(id)) return 6.8;
      return id.startsWith("tag:") ? 5.5 : 4.8;
    })
    .attr("stroke", (datum: GraphNode) => (activeCenters.has(String(datum.id)) ? "#f59e0b" : "#fff"))
    .attr("stroke-width", (datum: GraphNode) => (activeCenters.has(String(datum.id)) ? 2.3 : 1.4));

  linkSelection
    .attr("stroke-opacity", (datum: GraphEdge) => {
      const source = endpointId(datum.source);
      const target = endpointId(datum.target);
      return activeCenters.has(source) || activeCenters.has(target) ? 0.95 : focused.has(source) && focused.has(target) ? 0.35 : 0.06;
    })
    .attr("stroke-width", (datum: GraphEdge) => {
      const source = endpointId(datum.source);
      const target = endpointId(datum.target);
      const boost = activeCenters.has(source) || activeCenters.has(target) ? 1.2 : 0;
      return Math.min(7, 1 + (Number(datum.weight) || 1) + boost);
    });
}

function centerOnNode(node: GraphNode): void {
  if (!node || !zoomBehavior) return;
  const width = (svg.node() as SVGSVGElement).clientWidth;
  const height = (svg.node() as SVGSVGElement).clientHeight;
  const current = d3.zoomTransform(svg.node());
  const scale = current.k || 1;
  const target = d3.zoomIdentity.translate(width / 2 - (node.x || 0) * scale, height / 2 - (node.y || 0) * scale).scale(scale);
  svg.transition().duration(260).call(zoomBehavior.transform, target);
}

function render(data: GraphData): void {
  currentKind = data.kind || currentKind;
  const filtered = buildFilteredGraph(data);
  rawGraph = data;
  renderedNodes = (filtered.nodes || []).map((node: GraphNode) => ({ ...node }));
  renderedLinks = (filtered.edges || []).map((edge: GraphEdge) => ({ ...edge }));
  clearSelectionWhenHidden(renderedNodes);

  if (activeSimulation) activeSimulation.stop();
  if (simulationStopTimer) clearTimeout(simulationStopTimer);

  svg.selectAll("*").remove();
  const width = (svg.node() as SVGSVGElement).clientWidth;
  const height = (svg.node() as SVGSVGElement).clientHeight;
  svg.attr("viewBox", [0, 0, width, height]);
  const viewport = svg.append("g");
  zoomBehavior = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event: any) => {
    viewport.attr("transform", event.transform);
  });
  svg.call(zoomBehavior).on("dblclick.zoom", null);

  const link = viewport.append("g")
    .attr("stroke", "#94a3b8")
    .attr("stroke-opacity", 0.62)
    .attr("pointer-events", "none")
    .selectAll("line")
    .data(renderedLinks)
    .join("line")
    .attr("stroke-width", (datum: GraphEdge) => Math.min(6, 1 + (Number(datum.weight) || 1)));

  const node = viewport.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.4)
    .selectAll("circle")
    .data(renderedNodes)
    .join("circle")
    .attr("r", (datum: GraphNode) => (String(datum.id).startsWith("tag:") ? 6 : 5))
    .attr("fill", (datum: GraphNode) => nodeColor(datum.id))
    .call(d3.drag()
      .on("start", (event: any, datum: GraphNode) => {
        if (!event.active && activeSimulation) activeSimulation.alphaTarget(0.25).restart();
        datum.fx = datum.x;
        datum.fy = datum.y;
      })
      .on("drag", (event: any, datum: GraphNode) => {
        datum.fx = event.x;
        datum.fy = event.y;
      })
      .on("end", (event: any, datum: GraphNode) => {
        if (!event.active && activeSimulation) activeSimulation.alphaTarget(0);
        datum.fx = null;
        datum.fy = null;
      })
    );

  buildRelationshipIndex(renderedNodes, renderedLinks);
  nodeSelection = node;
  linkSelection = link;

  const nodeCount = renderedNodes.length;
  const linkDistance = nodeCount > 220 ? 42 : 72;
  const charge = nodeCount > 220 ? -95 : -145;
  const alphaDecay = nodeCount > 220 ? 0.11 : 0.08;
  const simulation = d3.forceSimulation(renderedNodes)
    .force("link", d3.forceLink(renderedLinks).id((datum: GraphNode) => datum.id).distance(linkDistance).strength(0.62))
    .force("charge", d3.forceManyBody().strength(charge))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .alphaDecay(alphaDecay)
    .velocityDecay(0.34);
  activeSimulation = simulation;

  let rafPending = false;
  simulation.on("tick", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      link
        .attr("x1", (datum: any) => datum.source.x)
        .attr("y1", (datum: any) => datum.source.y)
        .attr("x2", (datum: any) => datum.target.x)
        .attr("y2", (datum: any) => datum.target.y);
      node
        .attr("cx", (datum: GraphNode) => datum.x)
        .attr("cy", (datum: GraphNode) => datum.y);
      if (selectedNodeId && currentNodeMap.has(selectedNodeId)) selectedNode = currentNodeMap.get(selectedNodeId) as GraphNode;
      applyFocusState();
    });
  });
  simulationStopTimer = window.setTimeout(() => simulation.stop(), nodeCount > 220 ? 3200 : 5200);

  node.on("click", (_event: any, datum: GraphNode) => {
    selectedNodeId = String(datum.id || "");
    selectedNode = datum;
    updateSide(datum);
    applyFocusState();
    centerOnNode(datum);
  });

  node.on("dblclick", (_event: any, datum: GraphNode) => {
    if (!datum.url) return;
    location.href = datum.url;
  });

  node.on("mouseenter", (_event: any, datum: GraphNode) => {
    hoveredNodeId = String(datum.id || "");
    applyFocusState();
  });
  node.on("mouseleave", () => {
    hoveredNodeId = "";
    applyFocusState();
  });

  node.append("title").text((datum: GraphNode) => datum.title || datum.label || datum.id);
  if (selectedNodeId && currentNodeMap.has(selectedNodeId)) {
    selectedNode = currentNodeMap.get(selectedNodeId) as GraphNode;
    updateSide(selectedNode);
  } else {
    selectedNode = null;
    updateSide(null);
  }
  applyFocusState();
  sideMeta.textContent = `${kindLabel(filtered.kind || currentKind)} · 节点 ${renderedNodes.length} · 边 ${renderedLinks.length}`;
}

async function main(): Promise<void> {
  const showKind = async (kind: string): Promise<void> => {
    graphKind.value = kind;
    const data = await loadGraph(kind);
    data.kind = kind;
    syncFilterOptions(data);
    render(data);
  };
  graphKind.onchange = () => showKind(graphKind.value).catch((error: unknown) => {
    sideTitle.innerHTML = "<strong>加载失败</strong>";
    sideSummary.textContent = String(error);
  });
  tagFilter.onchange = () => rawGraph && render(rawGraph);
  edgeTypeFilter.onchange = () => rawGraph && render(rawGraph);
  minWeight.oninput = () => {
    minWeightValue.textContent = String(minWeight.value);
    if (rawGraph) render(rawGraph);
  };
  resetView.onclick = () => {
    if (!zoomBehavior) return;
    svg.transition().duration(240).call(zoomBehavior.transform, d3.zoomIdentity);
  };
  renderRelations(null);
  await showKind(graphKind.value || "links");
}

main().catch((error: unknown) => {
  sideTitle.innerHTML = "<strong>加载失败</strong>";
  sideSummary.textContent = String(error);
});
