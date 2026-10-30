// Test sandbox (Vercel preview deployments, and local builds with APP_SANDBOX=1).
//
// A preview build is tested by people and by automated browsers, but its VITE_API_URL points at
// the PRODUCTION backend. Remembering "not to press the button" is not a safeguard, so in a
// sandbox build every request that could create a lead, send an email, count a funnel event or
// spend a free search is answered HERE, in the browser, and never leaves it:
//   POST /api/email/*            → simulated answer (case number SEAL-SANDBOX-…), payload kept in
//                                  window.__sealSandbox.sent for inspection
//   POST /api/events             → dropped
//   GET  /api/suppliers/quota    → simulated (3 free searches)
//   POST /api/suppliers/search   → 503 "not available in the test environment"
//   any other non-GET /api/*     → 503
// Read-only GETs (exchange/freight rates) still go to the backend: they change nothing.
// Google Tag Manager is not included in sandbox builds (vite.config.ts), so no analytics either.
// Production builds (VERCEL_ENV=production) are not affected: __APP_SANDBOX__ is false there.
declare const __APP_SANDBOX__: boolean;
export const SANDBOX = typeof __APP_SANDBOX__ === "boolean" ? __APP_SANDBOX__ : false;

type Sent = { url: string; body: unknown; at: number };
type SandboxState = { sent: Sent[]; blocked: string[] };

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export function sandboxResponse(url: string, method: string, body: unknown, state: SandboxState): Response | null {
  let path = "";
  try {
    path = new URL(url, "http://x").pathname;
  } catch {
    return null;
  }
  if (!/^\/(?:api\/|health\b)/.test(path)) return null;
  const m = method.toUpperCase();
  if (/^\/api\/email\//.test(path)) {
    state.sent.push({ url: path, body, at: Date.now() });
    if (path === "/api/email/quote") return json({ success: true, id: `SEAL-SANDBOX-${String(state.sent.length).padStart(6, "0")}`, duplicate: false, notified: true, test: true });
    return json({ success: true, delivered: false });
  }
  if (path === "/api/events") {
    state.blocked.push(path);
    return new Response(null, { status: 204 });
  }
  if (path === "/api/suppliers/quota") return json({ limit: 3, remaining: 3, reason: "" });
  if (m !== "GET") {
    state.blocked.push(path);
    return json({ error: "sandbox", message: "No disponible en el entorno de prueba." }, 503);
  }
  return null; // read-only GET (rates): allowed
}

export function installSandbox(): void {
  if (!SANDBOX || typeof window === "undefined") return;
  const w = window as unknown as { __sealSandbox?: SandboxState; fetch: typeof fetch };
  if (w.__sealSandbox) return;
  const state: SandboxState = { sent: [], blocked: [] };
  w.__sealSandbox = state;
  const real = w.fetch.bind(window);
  w.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || (typeof input === "object" && "method" in input ? (input as Request).method : "GET");
    let body: unknown = undefined;
    try {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    } catch {
      body = init?.body;
    }
    const r = sandboxResponse(url, method, body, state);
    return r || real(input as RequestInfo, init);
  }) as typeof fetch;
  // navigator.sendBeacon is not used by the site; it is blocked too in case a library tries
  try {
    navigator.sendBeacon = () => false;
  } catch {
    /* read-only in some browsers */
  }
}
