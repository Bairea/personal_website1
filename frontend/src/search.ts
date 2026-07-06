declare class PagefindUI {
  constructor(options: {
    element: string;
    showSubResults?: boolean;
    showFilters?: boolean;
    autofocus?: boolean;
  });
}

const container = document.getElementById("search");

async function main(): Promise<void> {
  // Pagefind is loaded via <script> in extend_head.html
  // @ts-expect-error — pagefind is a runtime-only asset
  const pagefind = await import("/pagefind/pagefind.js");
  pagefind.init();

  new PagefindUI({
    element: "#search",
    showSubResults: true,
    showFilters: true,
    autofocus: true,
  });

  // 支持 URL 参数 ?q=
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q");
  if (initialQuery) {
    const input = container?.querySelector("input");
    if (input) {
      input.value = initialQuery;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

main().catch((error: unknown) => {
  if (container) container.textContent = "搜索初始化失败：" + String(error);
});
