import { byId, escapeHtml, sendFeedback } from "./common.js";

type SearchHit = {
  id: string;
  url: string;
  title: string;
  summary?: string;
  snippet?: string;
  tags?: string[];
};

type SearchResponse = {
  ok: boolean;
  error?: string;
  hits?: SearchHit[];
};

const queryInput = byId<HTMLInputElement>("q");
const info = byId<HTMLElement>("info");
const results = byId<HTMLElement>("results");

function renderHits(query: string, hits: SearchHit[]): void {
  results.innerHTML = "";
  info.textContent = `共找到 ${hits.length} 条结果`;
  for (const hit of hits) {
    const item = document.createElement("div");
    item.className = "search-item";
    const tags = (hit.tags || []).map((tag) => `#${escapeHtml(tag)}`).join(" ");
    const snippet = hit.snippet ? `<div class="search-snippet">${escapeHtml(hit.snippet)}</div>` : "";
    item.innerHTML = `
      <div><a href="${escapeHtml(hit.url)}" data-doc="${escapeHtml(hit.id)}"><strong>${escapeHtml(hit.title)}</strong></a></div>
      <div class="tag-row">${tags}</div>
      <div>${escapeHtml(hit.summary || "")}</div>
      ${snippet}
    `;
    const anchor = item.querySelector("a");
    anchor?.addEventListener("click", () => {
      sendFeedback({ type: "search_click", q: query, docId: hit.id, url: hit.url, ts: Date.now() });
    });
    results.appendChild(item);
  }
}

async function runQuery(query: string): Promise<void> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as SearchResponse;
  if (!data.ok) throw new Error(data.error || "search failed");
  sendFeedback({ type: "search_query", q: query, ts: Date.now() });
  renderHits(query, data.hits || []);
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";
  queryInput.value = initialQuery;

  queryInput.addEventListener("keydown", async (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    const query = queryInput.value.trim();
    history.replaceState(null, "", query ? `?q=${encodeURIComponent(query)}` : "");
    if (!query) {
      info.textContent = "请输入关键词后再搜索。";
      results.innerHTML = "";
      return;
    }
    try {
      await runQuery(query);
    } catch (error) {
      info.textContent = "搜索失败：" + String(error);
    }
  });

  if (initialQuery.trim()) await runQuery(initialQuery.trim());
  else info.textContent = "请输入关键词后再搜索。";
}

main().catch((error: unknown) => {
  info.textContent = "初始化失败：" + String(error);
});
