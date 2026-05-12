import { byId, escapeHtml, sendFeedback } from "./common.js";
const queryInput = byId("q");
const submitButton = byId("go");
const statusText = byId("status");
const answer = byId("answer");
const citationList = byId("cites");
const pathList = byId("path");
const unfamiliar = byId("unfamiliar");
const saveGraphButton = byId("saveGraph");
const graphStatus = byId("graphStatus");
const graphMeta = byId("graphMeta");
let lastTempGraph = null;
let lastQuery = "";
function renderCitations(citations, query) {
    citationList.innerHTML = "";
    for (const citation of citations || []) {
        const li = document.createElement("li");
        li.innerHTML = `<div><a href="${escapeHtml(citation.doc.url)}" target="_blank" rel="noreferrer">${escapeHtml(citation.doc.title)}</a></div><div class="meta">${escapeHtml(citation.quote.text)}</div>`;
        const anchor = li.querySelector("a");
        anchor?.addEventListener("click", () => {
            sendFeedback({ type: "chat_citation_click", q: query, url: citation.doc.url, docId: citation.doc.id, ts: Date.now() });
        });
        citationList.appendChild(li);
    }
}
function renderPath(path, query) {
    pathList.innerHTML = "";
    for (const item of path || []) {
        const li = document.createElement("li");
        li.innerHTML = `<div><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></div><div class="meta">${escapeHtml(item.reason)}</div>`;
        const anchor = li.querySelector("a");
        anchor?.addEventListener("click", () => {
            sendFeedback({ type: "chat_path_click", q: query, url: item.url, docId: item.doc_id, ts: Date.now() });
        });
        pathList.appendChild(li);
    }
}
function renderTempGraph(graph) {
    lastTempGraph = graph && Array.isArray(graph.nodes) ? graph : null;
    if (!lastTempGraph) {
        graphMeta.textContent = "暂未生成";
        saveGraphButton.disabled = true;
        return;
    }
    const nodeCount = Array.isArray(lastTempGraph.nodes) ? lastTempGraph.nodes.length : 0;
    const edgeCount = Array.isArray(lastTempGraph.edges) ? lastTempGraph.edges.length : 0;
    graphMeta.textContent = `节点 ${nodeCount} / 边 ${edgeCount}`;
    saveGraphButton.disabled = nodeCount === 0;
}
async function savePublicGraph() {
    if (!lastTempGraph)
        return;
    graphStatus.textContent = "正在保存…";
    const title = `公共导览图：${lastQuery}`.slice(0, 80);
    const response = await fetch("/api/graph/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            title,
            source: { type: "chat", q: lastQuery },
            graph: lastTempGraph
        })
    });
    const data = (await response.json());
    if (!data.ok)
        throw new Error(data.error || "save graph failed");
    graphStatus.textContent = `已保存（${data.id || ""}）`;
    sendFeedback({ type: "chat_temp_graph_saved", q: lastQuery, graphId: data.id, ts: Date.now() });
}
async function ask() {
    const query = queryInput.value.trim();
    if (!query)
        return;
    lastQuery = query;
    statusText.textContent = "正在生成答案…";
    answer.textContent = "";
    citationList.innerHTML = "";
    pathList.innerHTML = "";
    graphStatus.textContent = "";
    renderTempGraph(null);
    sendFeedback({ type: "chat_query", q: query, ts: Date.now() });
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: query, unfamiliar: unfamiliar.checked })
    });
    const data = (await response.json());
    if (!data.ok)
        throw new Error(data.error || "chat failed");
    answer.textContent = data.answer || "";
    renderCitations(data.citations || [], query);
    renderPath(data.reading_path || [], query);
    renderTempGraph(data.temp_graph || null);
    statusText.textContent = "回答已生成";
}
submitButton.addEventListener("click", () => ask().catch((error) => (statusText.textContent = String(error))));
saveGraphButton.addEventListener("click", () => savePublicGraph().catch((error) => (graphStatus.textContent = String(error))));
