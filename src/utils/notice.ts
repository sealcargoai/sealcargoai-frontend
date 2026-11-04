// Small on-screen confirmation (e.g. "Report downloaded"), without React wiring.
// 02-11w: on a phone the notice sat at the bottom, above everything, and covered the verification-code field
// of the report window when the keyboard was open (seen in the local mobile run). Now it never takes taps,
// it goes to the top when a window (dialog) is open or the keyboard is up, and it disappears as soon as the
// person starts typing in a field.
export function showNotice(text: string, ms = 5000): void {
  try {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("data-notice", "");
    el.textContent = text;
    const vv = (window as Window & { visualViewport?: { height: number } }).visualViewport;
    const keyboardUp = !!vv && vv.height < window.innerHeight * 0.75;
    const dialogOpen = !!document.querySelector('[aria-modal="true"]');
    const place = keyboardUp || dialogOpen ? "top:12px" : "bottom:24px";
    el.style.cssText =
      `position:fixed;left:50%;${place};transform:translateX(-50%);z-index:9999;max-width:min(92vw,520px);pointer-events:none;` +
      "background:#0B3C5D;color:#fff;padding:12px 18px;border-radius:12px;font:500 14px/1.4 system-ui,sans-serif;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center";
    document.body.appendChild(el);
    const done = () => {
      el.remove();
      document.removeEventListener("focusin", onFocus);
    };
    const onFocus = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) done();
    };
    document.addEventListener("focusin", onFocus);
    setTimeout(done, ms);
  } catch {
    /* no DOM */
  }
}
