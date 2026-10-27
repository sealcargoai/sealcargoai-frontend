// Funnel measurement: visits → started queries → results → requests received →
// qualified → quotes → clients. The first steps are counted here (once per
// browser and day on the server, no personal data) and pushed to GTM's
// dataLayer; requests are counted only when the server registered them with a
// case number. A WhatsApp click is measured apart: it does not prove a lead.
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
export type FunnelEvent = "visita" | "consulta_iniciada" | "resultados" | "contacto_abierto" | "whatsapp_clic" | "solicitud_enviada";

/** Anonymous id of this browser (random, not derived from the person). */
export function visitorId(): string {
  try {
    let v = localStorage.getItem("seal_vid") || "";
    if (!/^[a-z0-9-]{8,64}$/i.test(v)) {
      v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem("seal_vid", v);
    }
    return v;
  } catch {
    return "";
  }
}

export function pushDataLayer(data: Record<string, unknown>): void {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    (w.dataLayer = w.dataLayer || []).push(data);
  } catch {
    /* no window (tests) */
  }
}

// Same rule as the server: test words in the name or email (PRUEBA, test, demo, example.com…)
const TEST_RE = /\b(prueba|test|testing|ficticio|ficticia|demo|fake|ejemplo)\b|@(example|test|prueba|mailinator)\./i;
/** This browser is running a QA session (its events are counted apart, never as commercial data). */
export function isQaSession(): boolean {
  try {
    if (/[?&]qa=1\b/.test(window.location.search)) sessionStorage.setItem("seal_qa", "1");
    if (sessionStorage.getItem("seal_qa") === "1") return true;
    const d = JSON.parse(localStorage.getItem("sealcargo_user_data") || "null");
    return TEST_RE.test(String(d?.name || "")) || TEST_RE.test(String(d?.email || ""));
  } catch {
    return false;
  }
}

/** Records a funnel step (never blocks or breaks the page). */
export function track(event: FunnelEvent, extra: Record<string, unknown> = {}, qaOverride?: boolean): void {
  const qa = qaOverride ?? isQaSession();
  pushDataLayer({ event: `seal_${event}`, ...extra, ...(qa ? { seal_qa: true } : {}) });
  const vid = visitorId();
  if (!vid || typeof fetch === "undefined") return;
  try {
    fetch(`${API}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qa ? { event, vid, qa: true } : { event, vid }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* offline */
  }
}
