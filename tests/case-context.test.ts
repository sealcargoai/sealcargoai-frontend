// The request to SEAL carries the whole case; a lead is counted only when the server registered it.
import { describe, it, expect, beforeEach, vi } from "vitest";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
(globalThis as Record<string, unknown>).sessionStorage = storage;
(globalThis as Record<string, unknown>).localStorage = storage;
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as { document?: unknown }).document = { documentElement: { lang: "es" } };

const { rememberCase, caseContext, sendToSeal, receiptText, clearCase } = await import("../src/utils/caseContext");
const L = (es: string) => es;

describe("case context", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    (globalThis as { dataLayer?: unknown[] }).dataLayer = [];
  });
  it("adds data screen by screen; empty values never erase", () => {
    rememberCase({ productDescription: "Termos 500 ml", quantity: "2000" });
    rememberCase({ supplierName: "Ningbo X", price: "US$2.10 / pieza", quantity: "", assumptions: [] , warnings: ["acero 201"] });
    expect(caseContext()).toEqual({ productDescription: "Termos 500 ml", quantity: "2000", supplierName: "Ningbo X", price: "US$2.10 / pieza", warnings: ["acero 201"] });
    clearCase();
    expect(caseContext()).toEqual({});
  });
  it("sends the stored case plus this screen's data; counts the lead only with a case number", async () => {
    rememberCase({ productDescription: "Termos", supplierName: "Ningbo X", assumptions: ["LCL"], warnings: ["acero 201"] });
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, opt: { body: string }) => {
      calls.push({ url, body: JSON.parse(opt.body) });
      return url.endsWith("/api/email/quote")
        ? new Response(JSON.stringify({ success: true, id: "SEAL-20261027-ABC123", duplicate: false, notified: true }), { status: 200 })
        : new Response(null, { status: 204 });
    });
    const r = await sendToSeal({ requestType: "Contacto directo con SEAL", source: "chat", intent: "proforma", name: "Ana", email: "ana@empresa.gt", chat: ["Tengo proforma"], supplierName: "" });
    expect(r).toMatchObject({ ok: true, id: "SEAL-20261027-ABC123", duplicate: false });
    const q = calls.find((c) => c.url.endsWith("/api/email/quote"))!.body;
    expect(q).toMatchObject({ productDescription: "Termos", supplierName: "Ningbo X", assumptions: ["LCL"], warnings: ["acero 201"], chat: ["Tengo proforma"], intent: "proforma", source: "chat", lang: "es" });
    const dl = (globalThis as { dataLayer: { event: string }[] }).dataLayer.map((x) => x.event);
    expect(dl).toContain("seal_lead_recibido");
    expect(receiptText(r, L)).toMatch(/número de caso es SEAL-20261027-ABC123/);
  });
  it("a failed or duplicate send is not a new lead", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    const r = await sendToSeal({ requestType: "x", source: "chat", name: "Ana", email: "ana@empresa.gt" });
    expect(r.ok).toBe(false);
    vi.stubGlobal("fetch", async (url: string) => (url.endsWith("/quote") ? new Response(JSON.stringify({ id: "SEAL-1", duplicate: true, notified: true }), { status: 200 }) : new Response(null, { status: 204 })));
    const d = await sendToSeal({ requestType: "x", source: "chat", name: "Ana", email: "ana@empresa.gt" });
    expect(receiptText(d, L)).toMatch(/Ya teníamos tu caso SEAL-1/);
    expect((globalThis as { dataLayer: { event: string }[] }).dataLayer.map((x) => x.event)).not.toContain("seal_lead_recibido");
  });
});
