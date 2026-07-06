export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function byId<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element: #${id}`);
  return element as unknown as T;
}
