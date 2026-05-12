import { byId, escapeHtml, sendFeedback } from "./common.js";
const svg = d3.select("#graph");
const sideTitle = byId("title");
const sideMeta = byId("meta");
const sideSummary = byId("summary");
const sideOut = byId("out");
const sideRelations = byId("relations");
const ruleMode = byId("ruleMode");
const ruleAction = byId("ruleAction");
const ruleEntity = byId("ruleEntity");
const ruleDocId = byId("ruleDocId");
const ruleNodeId = byId("ruleNodeId");
const ruleNodeLabel = byId("ruleNodeLabel");
const ruleEdgeSource = byId("ruleEdgeSource");
const ruleEdgeTarget = byId("ruleEdgeTarget");
const ruleStatus = byId("ruleStatus");
const submitRule = byId("submitRule");
const graphKind = byId("graphKind");
const tagFilter = byId("tagFilter");
const edgeTypeFilter = byId("edgeTypeFilter");
const minWeight = byId("minWeight");
const minWeightValue = byId("minWeightValue");
const resetView = byId("resetView");
let currentKind = "links";
let selectedNodeId = "";
let hoveredNodeId = "";
let selectedNode = null;
let rawGraph = null;
let renderedNodes = [];
let renderedLinks = [];
let nodeSelection = null;
let linkSelection = null;
let currentNodeMap = new Map();
let neighborMap = new Map();
let edgeMap = new Map();
let activeSimulation = null;
let simulationStopTimer = 0;
let zoomBehavior = null;
const graphCache = new Map();
const LARGE_GRAPH_EDGE_LIMIT = 1800;
const graphKindLabels = {
    links: "内容网络",
    tags: "主题网络",
    entity: "实体网络",
    public: "导览网络",
    entity_map: "实体网络",
    entity_map_subgraph: "实体网络"
};
function kindLabel(kind) {
    return graphKindLabels[kind] || kind || "网络";
}
function endpointId(value) {
    return typeof value === "object" ? String(value.id || "") : String(value || "");
}
function nodeColor(id) {
    const text = String(id || "");
    if (text.startsWith("tag:"))
        return "#2563eb";
    if (text.startsWith("entity:"))
        return "#ea580c";
    if (text.startsWith("guide:") || text.startsWith("manual:"))
        return "#059669";
    return "#0f172a";
}
async function loadGraph(kind) {
    if (graphCache.has(kind))
        return graphCache.get(kind);
    const url = `/api/graph?kind=${encodeURIComponent(kind)}`;
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`load failed: ${url}`);
    const data = (await response.json());
    if (!data.ok)
        throw new Error(data.error || "graph failed");
    graphCache.set(kind, data.graph);
    return data.graph;
}
function clearSelectionWhenHidden(nodes) {
    if (!selectedNodeId)
        return;
    const exists = nodes.some((node) => String(node.id) === selectedNodeId);
    if (exists)
        return;
    selectedNodeId = "";
    selectedNode = null;
    sideTitle.innerHTML = "<strong>尚未选择节点</strong>";
    sideMeta.textContent = "";
    sideSummary.textContent = "";
    sideOut.innerHTML = "";
}
function syncFilterOptions(data) {
    const tags = new Set();
    for (const node of data.nodes || []) {
        if (String(node.id || "").startsWith("tag:"))
            tags.add(String(node.id).slice(4));
        if (Array.isArray(node.tags))
            for (const tag of node.tags)
                tags.add(String(tag));
    }
    const prevTag = tagFilter.value || "all";
    tagFilter.innerHTML = `<option value="all">全部</option>${[...tags].sort((a, b) => a.localeCompare(b)).map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
    tagFilter.value = tags.has(prevTag) ? prevTag : "all";
    const edgeKinds = new Set((data.edges || []).map((edge) => String(edge.kind || "unknown")));
    const prevEdge = edgeTypeFilter.value || "all";
    edgeTypeFilter.innerHTML = `<option value="all">全部</option>${[...edgeKinds].sort((a, b) => a.localeCompare(b)).map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind)}</option>`).join("")}`;
    edgeTypeFilter.value = edgeKinds.has(prevEdge) ? prevEdge : "all";
    const maxWeight = Math.max(1, ...((data.edges || []).map((edge) => Number(edge.weight) || 1)));
    minWeight.max = String(Math.max(1, Math.ceil(maxWeight)));
    if (Number(minWeight.value) > Number(minWeight.max))
        minWeight.value = minWeight.max;
    minWeightValue.textContent = String(minWeight.value);
}
function buildFilteredGraph(data) {
    const minW = Number(minWeight.value || 1);
    const edgeKind = edgeTypeFilter.value || "all";
    const tag = tagFilter.value || "all";
    const allNodes = Array.isArray(data.nodes) ? data.nodes : [];
    const allEdges = Array.isArray(data.edges) ? data.edges : [];
    const tagMatched = new Set();
    if (tag !== "all") {
        for (const node of allNodes) {
            const id = String(node.id || "");
            const nodeTags = Array.isArray(node.tags) ? node.tags.map((text) => String(text)) : [];
            const byTagField = nodeTags.includes(tag);
            const byTagNode = id.startsWith("tag:") && id.slice(4) === tag;
            if (byTagField || byTagNode)
                tagMatched.add(id);
        }
    }
    let edges = allEdges.filter((edge) => {
        const weight = Number(edge.weight) || 1;
        if (weight < minW)
            return false;
        if (edgeKind !== "all" && String(edge.kind || "unknown") !== edgeKind)
            return false;
        if (tag === "all")
            return true;
        const source = endpointId(edge.source);
        const target = endpointId(edge.target);
        return tagMatched.has(source) || tagMatched.has(target);
    });
    if (edges.length > LARGE_GRAPH_EDGE_LIMIT) {
        edges = [...edges].sort((a, b) => (Number(b.weight) || 1) - (Number(a.weight) || 1)).slice(0, LARGE_GRAPH_EDGE_LIMIT);
    }
    const ids = new Set();
    for (const edge of edges) {
        ids.add(endpointId(edge.source));
        ids.add(endpointId(edge.target));
    }
    if (tag !== "all")
        for (const id of tagMatched)
            ids.add(id);
    if (!ids.size && allNodes.length && !allEdges.length)
        for (const node of allNodes)
            ids.add(String(node.id));
    const nodes = allNodes.filter((node) => ids.has(String(node.id)));
    return { kind: data.kind, nodes, edges };
}
function buildRelationshipIndex(nodes, links) {
    currentNodeMap = new Map(nodes.map((node) => [String(node.id), node]));
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
        if (!neighborMap.has(source))
            neighborMap.set(source, new Set());
        if (!neighborMap.has(target))
            neighborMap.set(target, new Set());
        neighborMap.get(source).add(target);
        neighborMap.get(target).add(source);
        if (!edgeMap.has(source))
            edgeMap.set(source, []);
        if (!edgeMap.has(target))
            edgeMap.set(target, []);
        edgeMap.get(source).push(edge);
        edgeMap.get(target).push(edge);
    }
}
function renderRelations(node) {
    if (!node) {
        sideRelations.innerHTML = `<div class="meta">选择节点后可查看邻居与关系类型</div>`;
        return;
    }
    const id = String(node.id || "");
    const neighbors = [...(neighborMap.get(id) || new Set())].map((neighborId) => currentNodeMap.get(neighborId)).filter(Boolean);
    const edgeTypes = new Map();
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
    sideRelations.querySelectorAll("[data-node-id]").forEach((element) => {
        element.addEventListener("click", () => {
            const nextId = String(element.getAttribute("data-node-id") || "");
            const nextNode = currentNodeMap.get(nextId);
            if (!nextNode)
                return;
            selectedNodeId = nextId;
            selectedNode = nextNode;
            updateSide(nextNode);
            applyFocusState();
            centerOnNode(nextNode);
        });
    });
}
function updateSide(node) {
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
    if (String(node.id || "").startsWith("entity:"))
        ruleEntity.value = String(node.id).slice("entity:".length);
    if (String(node.id || "").startsWith("doc:"))
        ruleDocId.value = String(node.id).slice("doc:".length);
}
function applyFocusState() {
    if (!nodeSelection || !linkSelection)
        return;
    const activeCenters = new Set([selectedNodeId, hoveredNodeId].filter(Boolean));
    if (!activeCenters.size) {
        nodeSelection
            .attr("opacity", 1)
            .attr("r", (datum) => {
            const id = String(datum.id || "");
            return id.startsWith("tag:") ? 6 : 5;
        })
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.4);
        linkSelection.attr("stroke-opacity", 0.62).attr("stroke-width", (datum) => Math.min(6, 1 + (Number(datum.weight) || 1)));
        return;
    }
    const focused = new Set(activeCenters);
    for (const id of activeCenters) {
        for (const neighbor of neighborMap.get(id) || [])
            focused.add(neighbor);
    }
    nodeSelection
        .attr("opacity", (datum) => (focused.has(String(datum.id)) ? 1 : 0.16))
        .attr("r", (datum) => {
        const id = String(datum.id);
        if (activeCenters.has(id))
            return 8.6;
        if (focused.has(id))
            return 6.8;
        return id.startsWith("tag:") ? 5.5 : 4.8;
    })
        .attr("stroke", (datum) => (activeCenters.has(String(datum.id)) ? "#f59e0b" : "#fff"))
        .attr("stroke-width", (datum) => (activeCenters.has(String(datum.id)) ? 2.3 : 1.4));
    linkSelection
        .attr("stroke-opacity", (datum) => {
        const source = endpointId(datum.source);
        const target = endpointId(datum.target);
        return activeCenters.has(source) || activeCenters.has(target) ? 0.95 : focused.has(source) && focused.has(target) ? 0.35 : 0.06;
    })
        .attr("stroke-width", (datum) => {
        const source = endpointId(datum.source);
        const target = endpointId(datum.target);
        const boost = activeCenters.has(source) || activeCenters.has(target) ? 1.2 : 0;
        return Math.min(7, 1 + (Number(datum.weight) || 1) + boost);
    });
}
function centerOnNode(node) {
    if (!node || !zoomBehavior)
        return;
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const current = d3.zoomTransform(svg.node());
    const scale = current.k || 1;
    const target = d3.zoomIdentity.translate(width / 2 - (node.x || 0) * scale, height / 2 - (node.y || 0) * scale).scale(scale);
    svg.transition().duration(260).call(zoomBehavior.transform, target);
}
function render(data) {
    currentKind = data.kind || currentKind;
    const filtered = buildFilteredGraph(data);
    rawGraph = data;
    renderedNodes = (filtered.nodes || []).map((node) => ({ ...node }));
    renderedLinks = (filtered.edges || []).map((edge) => ({ ...edge }));
    clearSelectionWhenHidden(renderedNodes);
    if (activeSimulation)
        activeSimulation.stop();
    if (simulationStopTimer)
        clearTimeout(simulationStopTimer);
    svg.selectAll("*").remove();
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    svg.attr("viewBox", [0, 0, width, height]);
    const viewport = svg.append("g");
    zoomBehavior = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => {
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
        .attr("stroke-width", (datum) => Math.min(6, 1 + (Number(datum.weight) || 1)));
    const node = viewport.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.4)
        .selectAll("circle")
        .data(renderedNodes)
        .join("circle")
        .attr("r", (datum) => (String(datum.id).startsWith("tag:") ? 6 : 5))
        .attr("fill", (datum) => nodeColor(datum.id))
        .call(d3.drag()
        .on("start", (event, datum) => {
        if (!event.active && activeSimulation)
            activeSimulation.alphaTarget(0.25).restart();
        datum.fx = datum.x;
        datum.fy = datum.y;
    })
        .on("drag", (event, datum) => {
        datum.fx = event.x;
        datum.fy = event.y;
    })
        .on("end", (event, datum) => {
        if (!event.active && activeSimulation)
            activeSimulation.alphaTarget(0);
        datum.fx = null;
        datum.fy = null;
    }));
    buildRelationshipIndex(renderedNodes, renderedLinks);
    nodeSelection = node;
    linkSelection = link;
    const nodeCount = renderedNodes.length;
    const linkDistance = nodeCount > 220 ? 42 : 72;
    const charge = nodeCount > 220 ? -95 : -145;
    const alphaDecay = nodeCount > 220 ? 0.11 : 0.08;
    const simulation = d3.forceSimulation(renderedNodes)
        .force("link", d3.forceLink(renderedLinks).id((datum) => datum.id).distance(linkDistance).strength(0.62))
        .force("charge", d3.forceManyBody().strength(charge))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .alphaDecay(alphaDecay)
        .velocityDecay(0.34);
    activeSimulation = simulation;
    let rafPending = false;
    simulation.on("tick", () => {
        if (rafPending)
            return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            link
                .attr("x1", (datum) => datum.source.x)
                .attr("y1", (datum) => datum.source.y)
                .attr("x2", (datum) => datum.target.x)
                .attr("y2", (datum) => datum.target.y);
            node
                .attr("cx", (datum) => datum.x)
                .attr("cy", (datum) => datum.y);
            if (selectedNodeId && currentNodeMap.has(selectedNodeId))
                selectedNode = currentNodeMap.get(selectedNodeId);
            applyFocusState();
        });
    });
    simulationStopTimer = window.setTimeout(() => simulation.stop(), nodeCount > 220 ? 3200 : 5200);
    node.on("click", (_event, datum) => {
        selectedNodeId = String(datum.id || "");
        selectedNode = datum;
        updateSide(datum);
        applyFocusState();
        centerOnNode(datum);
        sendFeedback({ type: "graph_node_click", nodeId: datum.id, kind: filtered.kind, ts: Date.now() });
    });
    node.on("dblclick", (_event, datum) => {
        if (!datum.url)
            return;
        sendFeedback({ type: "graph_node_open", nodeId: datum.id, url: datum.url, kind: filtered.kind, ts: Date.now() });
        location.href = datum.url;
    });
    node.on("mouseenter", (_event, datum) => {
        hoveredNodeId = String(datum.id || "");
        applyFocusState();
    });
    node.on("mouseleave", () => {
        hoveredNodeId = "";
        applyFocusState();
    });
    node.append("title").text((datum) => datum.title || datum.label || datum.id);
    if (selectedNodeId && currentNodeMap.has(selectedNodeId)) {
        selectedNode = currentNodeMap.get(selectedNodeId);
        updateSide(selectedNode);
    }
    else {
        selectedNode = null;
        updateSide(null);
    }
    applyFocusState();
    sideMeta.textContent = `${kindLabel(filtered.kind || currentKind)} · 节点 ${renderedNodes.length} · 边 ${renderedLinks.length}`;
}
function refreshRuleFields() {
    const mode = ruleMode.value;
    const showEntity = mode === "whitelist" || mode === "blacklist";
    const showNode = mode === "manual_node";
    const showEdge = mode === "manual_edge";
    ruleEntity.style.display = showEntity ? "" : "none";
    ruleDocId.style.display = showEntity ? "" : "none";
    ruleNodeId.style.display = showNode ? "" : "none";
    ruleNodeLabel.style.display = showNode ? "" : "none";
    ruleEdgeSource.style.display = showEdge ? "" : "none";
    ruleEdgeTarget.style.display = showEdge ? "" : "none";
}
async function submitGraphRule() {
    if (currentKind !== "entity_map_subgraph" && currentKind !== "entity_map" && currentKind !== "entity") {
        ruleStatus.textContent = "请先切换到实体网络，再提交纠错";
        return;
    }
    const mode = ruleMode.value;
    const action = ruleAction.value;
    const payload = { kind: "entity", mode, action };
    if (mode === "whitelist" || mode === "blacklist") {
        payload.entity = ruleEntity.value.trim();
        payload.doc_id = ruleDocId.value.trim();
        if (!payload.entity) {
            ruleStatus.textContent = "实体词不能为空。";
            return;
        }
    }
    if (mode === "manual_node") {
        const nodeId = ruleNodeId.value.trim() || (selectedNode && selectedNode.id ? String(selectedNode.id) : "");
        const nodeLabel = ruleNodeLabel.value.trim() || (selectedNode && (selectedNode.title || selectedNode.label) ? String(selectedNode.title || selectedNode.label) : "");
        if (!nodeId) {
            ruleStatus.textContent = "人工节点 ID 不能为空。";
            return;
        }
        payload.node = { id: nodeId, label: nodeLabel, kind: "manual" };
    }
    if (mode === "manual_edge") {
        const source = ruleEdgeSource.value.trim();
        const target = ruleEdgeTarget.value.trim();
        if (!source || !target) {
            ruleStatus.textContent = "人工边需要同时填写起点和终点。";
            return;
        }
        payload.edge = { source, target, kind: "manual_edge", weight: 1 };
    }
    ruleStatus.textContent = "正在提交…";
    const response = await fetch("/api/graph/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = (await response.json());
    if (!data.ok)
        throw new Error(data.error || "提交失败");
    sendFeedback({
        type: "graph_rule_submit",
        kind: "entity",
        nodeId: selectedNode && selectedNode.id ? selectedNode.id : "",
        q: JSON.stringify({ mode, action }),
        ts: Date.now()
    });
    ruleStatus.textContent = "规则已保存。请执行 npm run build 后刷新实体关系图。";
}
async function main() {
    const showKind = async (kind) => {
        graphKind.value = kind;
        const data = await loadGraph(kind);
        data.kind = kind;
        syncFilterOptions(data);
        render(data);
    };
    graphKind.onchange = () => showKind(graphKind.value).catch((error) => {
        sideTitle.innerHTML = "<strong>加载失败</strong>";
        sideSummary.textContent = String(error);
    });
    tagFilter.onchange = () => rawGraph && render(rawGraph);
    edgeTypeFilter.onchange = () => rawGraph && render(rawGraph);
    minWeight.oninput = () => {
        minWeightValue.textContent = String(minWeight.value);
        if (rawGraph)
            render(rawGraph);
    };
    resetView.onclick = () => {
        if (!zoomBehavior)
            return;
        svg.transition().duration(240).call(zoomBehavior.transform, d3.zoomIdentity);
    };
    ruleMode.onchange = refreshRuleFields;
    submitRule.onclick = () => submitGraphRule().catch((error) => {
        ruleStatus.textContent = String(error);
    });
    refreshRuleFields();
    renderRelations(null);
    await showKind(graphKind.value || "links");
}
main().catch((error) => {
    sideTitle.innerHTML = "<strong>加载失败</strong>";
    sideSummary.textContent = String(error);
});
