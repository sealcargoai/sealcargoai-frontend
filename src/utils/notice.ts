// Small on-screen confirmation (e.g. "Report downloaded"), without React wiring.
export function showNotice(text: string, ms = 5000): void {
  try {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,520px);" +
      "background:#0B3C5D;color:#fff;padding:12px 18px;border-radius:12px;font:500 14px/1.4 system-ui,sans-serif;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  } catch {
    /* no DOM */
  }
}
