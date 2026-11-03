// 02-11k — Verificación de correo, token del caso y conversiones (frontend). Fetch simulado; datos ficticios.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
(globalThis as Record<string, unknown>).sessionStorage = storage;
(globalThis as Record<string, unknown>).localStorage = storage;
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as { document?: unknown }).document = { documentElement: { lang: "es" } };

const { sendToSeal, receiptText, caseAuthList } = await import("../src/utils/caseContext");
const { startVerification, confirmVerification, verifiedSessionFor } = await import("../src/utils/verifiedEmail");
const L = (es: string) => es;
const TOK = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
type Call = { url: string; body: Record<string, unknown> };

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as { dataLayer?: unknown[] }).dataLayer = [];
});

describe("caso: token del enlace", () => {
  it("un caso nuevo guarda «ID:token» y el siguiente envío lo manda (el titular actualiza sin duplicar)", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", async (url: string, opt: { body: string }) => {
      calls.push({ url, body: JSON.parse(opt.body) });
      if (!url.endsWith("/quote")) return new Response(null, { status: 204 });
      return calls.filter((c) => c.url.endsWith("/quote")).length === 1
        ? new Response(JSON.stringify({ id: "SEAL-20261102-ABC123", duplicate: false, notified: true, caseUrl: `https://api.example.test/api/leads/case/SEAL-20261102-ABC123?t=${TOK}` }), { status: 200 })
        : new Response(JSON.stringify({ id: "SEAL-20261102-ABC123", duplicate: true, updated: true, notified: true }), { status: 200 });
    });
    const a = await sendToSeal({ requestType: "x", source: "formulario", name: "Ana", email: "ana@cliente-ficticio.test" });
    expect(a.ok).toBe(true);
    expect(caseAuthList()).toEqual([`SEAL-20261102-ABC123:${TOK}`]);
    const quotes = () => calls.filter((c) => c.url.endsWith("/quote"));
    expect(quotes()[0].body.caseAuth).toBeUndefined();
    const b = await sendToSeal({ requestType: "x", source: "formulario", name: "Ana", email: "ana@cliente-ficticio.test", phone: "+502 5555 0000" });
    expect(quotes()[1].body.caseAuth).toEqual([`SEAL-20261102-ABC123:${TOK}`]);
    expect(receiptText(b, L)).toMatch(/Ya teníamos tu caso SEAL-20261102-ABC123: lo actualizamos/);
  });

  it("repetido sin token: cuenta como recibido, sin número ni enlace, y no se registra como conversión", async () => {
    const events: string[] = [];
    vi.stubGlobal("fetch", async (url: string, opt: { body: string }) => {
      if (url.endsWith("/api/events")) events.push(JSON.parse(opt.body).event);
      return url.endsWith("/quote") ? new Response(JSON.stringify({ success: true, duplicate: true, unchanged: true }), { status: 200 }) : new Response(null, { status: 204 });
    });
    const r = await sendToSeal({ requestType: "x", source: "formulario", name: "Otro", email: "ana@cliente-ficticio.test" });
    expect(r.ok).toBe(true);
    expect(r.id).toBeUndefined();
    expect(r.caseUrl).toBeUndefined();
    const msg = receiptText(r, L);
    expect(msg).toMatch(/No se creó un caso nuevo ni se cambió ninguno/);
    expect(msg).not.toMatch(/SEAL-\d|@/);
    expect(events).not.toContain("solicitud_enviada");
    expect(caseAuthList()).toEqual([]);
  });

  it("valores guardados que no tienen forma de «ID:token» no se envían", () => {
    store.seal_case_auth = JSON.stringify(["SEAL-1:corto", "<script>", 5, `SEAL-2:${TOK}`]);
    expect(caseAuthList()).toEqual([`SEAL-2:${TOK}`]);
  });
});

describe("verificación del correo", () => {
  it("código correcto: guarda la sesión de ESE correo y devuelve la autorización de un uso", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", async (url: string, opt: { body: string }) => {
      calls.push({ url, body: JSON.parse(opt.body) });
      if (url.endsWith("/verify/start")) return new Response(JSON.stringify({ sent: true }), { status: 200 });
      return new Response(JSON.stringify({ verified: true, session: "s".repeat(43), reportGrant: "g".repeat(43), sessionSeconds: 43200, grantSeconds: 1800 }), { status: 200 });
    });
    expect(await startVerification("Pedro@Cliente-Ficticio.test", "es")).toBe("sent");
    const v = await confirmVerification("Pedro@Cliente-Ficticio.test", " abcde-23456 ");
    expect(v).toEqual({ ok: true, reportGrant: "g".repeat(43) });
    expect(calls[1].body).toEqual({ email: "Pedro@Cliente-Ficticio.test", code: "ABCDE23456" });
    expect(verifiedSessionFor("pedro@cliente-ficticio.test")).toBe("s".repeat(43));
    expect(verifiedSessionFor("otra@cliente-ficticio.test")).toBe("");
  });
  it("respuestas del servidor → motivo sin datos del caso", async () => {
    for (const [status, body, want] of [
      [429, { error: "verify_limit" }, "limit"],
      [400, { error: "email_not_supported" }, "not_supported"],
      [400, { error: "invalid email" }, "invalid"],
      [500, {}, "error"],
    ] as const) {
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));
      expect(await startVerification("x@cliente-ficticio.test", "es")).toBe(want);
    }
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "code_invalid" }), { status: 403 }));
    expect(await confirmVerification("x@cliente-ficticio.test", "AAAAA22222")).toEqual({ ok: false, reason: "wrong" });
    expect(await confirmVerification("x@cliente-ficticio.test", "ABCD2345")).toEqual({ ok: false, reason: "format" }); // 02-11n: the 8-character form of 02-11m
    expect(await confirmVerification("x@cliente-ficticio.test", "ABCDE!2345")).toEqual({ ok: false, reason: "format" });
    expect(verifiedSessionFor("x@cliente-ficticio.test")).toBe("");
  });
  it("una sesión vencida no se usa", () => {
    store.seal_verified_session = JSON.stringify({ email: "a@cliente-ficticio.test", session: "s", exp: Date.now() - 1 });
    expect(verifiedSessionFor("a@cliente-ficticio.test")).toBe("");
  });
});

describe("pantalla del informe (código fuente)", () => {
  const src = readFileSync(new URL("../src/app/components/FinalCTA.tsx", import.meta.url), "utf8");
  const pq = readFileSync(new URL("../src/app/components/ProductQualification.tsx", import.meta.url), "utf8");
  it("el envío lleva la autorización verificada y ningún destinatario ni nombre libre", () => {
    const body = src.slice(src.indexOf("/api/email/report"), src.indexOf("const refusalError"));
    expect(body).toMatch(/reportGrant: v\.reportGrant/);
    expect(body).toMatch(/requesterEmail: emailRecipient\.trim\(\)/);
    expect(body).not.toMatch(/recipientEmail|recipientName|reportToken/);
  });
  it("un repetido sin token no muestra «Solicitud enviada»; /quota lleva la sesión en encabezado, no en la URL", () => {
    expect(src).toMatch(/res\.unchanged \? receiptText\(res, L\)/);
    expect(pq).toMatch(/"X-Verified-Session": verifiedSessionFor/);
    expect(pq).not.toMatch(/quota\?[^`]*session/i);
  });
  it("ya no se usa el token de la búsqueda", () => {
    expect(src + pq).not.toMatch(/seal_report_token|reportToken/);
    expect(pq).toMatch(/verifiedSession: verifiedSessionFor\(userEmail\)/);
  });
});
