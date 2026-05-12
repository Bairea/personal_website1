import { byId, escapeHtml, sendFeedback } from "./common.js";

type Citation = {
  doc: { id: string; url: string; title: string };
  quote: { text: string };
};

type ReadingPathItem = {
  doc_id: string;
  url: string;
  title: string;
  reason: string;
};

type TempGraph = {
  nodes?: unknown[];
  edges?: unknown[];
};

type ChatResponse = {
  ok: boolean;
  error?: string;
  answer?: string;
  citations?: Citation[];
  reading_path?: ReadingPathItem[];
  temp_graph?: TempGraph | null;
};

type SaveGraphResponse = {
  ok: boolean;
  error?: string;
  id?: string;
};

const queryInput = byId<HTMLTextAreaElement>("q");
const submitButton = byId<HTMLButtonElement>("go");
const statusText = byId<HTMLElement>("status");
const answer = byId<HTMLElement>("answer");
const citationList = byId<HTMLOListElement>("cites");
const pathList = byId<HTMLOListElement>("path");
const unfamiliar = byId<HTMLInputElement>("unfamiliar");
const saveGraphButton = byId<HTMLButtonElement>("saveGraph");
const graphStatus = byId<HTMLElement>("graphStatus");
const graphMeta = byId<HTMLElement>("graphMeta");
let lastTempGraph: TempGraph | null = null;
let lastQuery = "";

function renderCitations(citations: Citation[], query: string): void {
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

function renderPath(path: ReadingPathItem[], query: string): void {
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

function renderTempGraph(graph: TempGraph | null): void {
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

async function savePublicGraph(): Promise<void> {
  if (!lastTempGraph) return;
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
  const data = (await response.json()) as SaveGraphResponse;
  if (!data.ok) throw new Error(data.error || "save graph failed");
  graphStatus.textContent = `已保存（${data.id || ""}）`;
  sendFeedback({ type: "chat_temp_graph_saved", q: lastQuery, graphId: data.id, ts: Date.now() });
}

async function ask(): Promise<void> {
  const query = queryInput.value.trim();
  if (!query) return;
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
  const data = (await response.json()) as ChatResponse;
  if (!data.ok) throw new Error(data.error || "chat failed");
  answer.textContent = data.answer || "";
  renderCitations(data.citations || [], query);
  renderPath(data.reading_path || [], query);
  renderTempGraph(data.temp_graph || null);
  statusText.textContent = "回答已生成";
}

submitButton.addEventListener("click", () => ask().catch((error: unknown) => (statusText.textContent = String(error))));
saveGraphButton.addEventListener("click", () => savePublicGraph().catch((error: unknown) => (graphStatus.textContent = String(error))));
