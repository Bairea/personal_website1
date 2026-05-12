export function sendFeedback(payload) {
    try {
        navigator.sendBeacon("/api/feedback", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    }
    catch { }
}
export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
export function byId(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`missing element: #${id}`);
    return element;
}
