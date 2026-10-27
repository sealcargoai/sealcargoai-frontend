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

describe("the scenario on screen replaces the stored one (nothing inherited)", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });
  it("machine with electric warnings, then gloves without warnings: the gloves case has none", async () => {
    const { setCaseScenario, SCENARIO_KEYS } = await import("../src/utils/caseContext");
    const keys = ["productDescription", "quantity", "budget", "destination", ...SCENARIO_KEYS];
    setCaseScenario({ productDescription: "Molino trifásico 220 V 60 Hz", quantity: "1 unidad", budget: "US$3,000", supplierName: "Mill Co", price: "US$350.00 / unidad", priceSource: "publicado", warnings: ["Esta publicación indica monofásico; solicitaste trifásico", "50 Hz"], assumptions: ["a"] }, keys as never);
    setCaseScenario({ productDescription: "Guantes de nitrilo", quantity: "100 cajas", supplierName: "Gloves Co", price: "US$0.05 / caja", priceSource: "usuario", publishedPrice: "US$0.04 / caja", warnings: [], assumptions: ["b"] }, keys as never);
    const c = caseContext();
    expect(c.warnings).toBeUndefined();
    expect(c.budget).toBeUndefined();
    expect(c).toMatchObject({ productDescription: "Guantes de nitrilo", supplierName: "Gloves Co", priceSource: "usuario", publishedPrice: "US$0.04 / caja", assumptions: ["b"] });
    expect(JSON.stringify(c)).not.toMatch(/Molino|Mill Co|monofásico|50 Hz|US\$3,000/);
  });
  it("new results clear the supplier and estimate of the earlier search", async () => {
    const { setCaseScenario, SCENARIO_KEYS } = await import("../src/utils/caseContext");
    setCaseScenario({ supplierName: "Old Co", price: "US$1", warnings: ["w"], totalCostText: "Q1" }, SCENARIO_KEYS);
    setCaseScenario({ productDescription: "Nuevo" }, ["productDescription", ...SCENARIO_KEYS]);
    expect(caseContext()).toEqual({ productDescription: "Nuevo" });
  });
  it("a test record is not pushed as a commercial lead", async () => {
    (globalThis as { dataLayer?: unknown[] }).dataLayer = [];
    vi.stubGlobal("fetch", async (url: string) => (url.endsWith("/quote") ? new Response(JSON.stringify({ id: "SEAL-QA", duplicate: false, notified: true, test: true }), { status: 200 }) : new Response(null, { status: 204 })));
    const r = await sendToSeal({ requestType: "x", source: "costos", name: "PRUEBA — NO ATENDER", email: "qa@example.com" });
    expect(r.test).toBe(true);
    const ev = (globalThis as { dataLayer: { event: string; seal_qa?: boolean }[] }).dataLayer;
    expect(ev.map((x) => x.event)).toContain("seal_lead_qa");
    expect(ev.map((x) => x.event)).not.toContain("seal_lead_recibido");
  });
});
