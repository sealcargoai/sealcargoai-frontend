// ACCEPTANCE MATRIX — fixed regression matrix for the case state (see ACCEPTANCE.md).
// Run: npm run test:acceptance
//
// Every case checks the STATE, not the wording of a reply: the saved case (utils/caseStore),
// what the form opens with, the "talk to SEAL" summary, the exact body sent to SEAL (fetch
// mocked: nothing is sent) and the values the chat reply states. A case passes only when all
// surfaces agree. Do not edit expected values to make a run pass.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
const g = globalThis as Record<string, unknown>;
g.sessionStorage = storage;
g.localStorage = storage;
g.window = globalThis;
const doc = { documentElement: { lang: "es" } };
g.document = doc;
const sent: Record<string, unknown>[] = [];
let failNext = false;
g.fetch = async (url: string, opt?: { body?: string }) => {
  if (/\/api\/email\/quote/.test(String(url))) {
    if (failNext) {
      failNext = false;
      return { ok: false, status: 500, json: async () => ({}) };
    }
    sent.push(JSON.parse(String(opt?.body || "{}")));
    return { ok: true, status: 200, json: async () => ({ id: "SEAL-TEST-000001" }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

const c = await import("../src/utils/chatReply");
const { applyChatMessage } = await import("../src/utils/chatCase");
const { currentCase, caseForSeal, formStart, leadingNumber } = await import("../src/utils/caseStore");
const { DRAFT_KEY, saveProduct, clearDraft } = await import("../src/utils/draft");
const { sendToSeal, setCaseScenario, SCENARIO_KEYS, switchCaseProduct, caseContext } = await import("../src/utils/caseContext");
const { fieldError } = await import("../src/utils/formValidation");

const D = "compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros, libres de aceite";
type Exp = { product: string; quantity?: number; budget?: number };

// ── harness ────────────────────────────────────────────────────────────────
/** The client typed the case in the form (the form saves its draft as it is typed). */
function formTyped(product: string, quantity = "", budget = "", step = 2) {
  store[DRAFT_KEY] = JSON.stringify({ formData: { productType: product, quantity, budget, destination: "GT", volumeCbm: "", weightKg: "" }, step, prev: null });
  saveProduct(product);
}
function reset(lang: "es" | "en" = "es") {
  for (const k of Object.keys(store)) delete store[k];
  sent.length = 0;
  doc.documentElement.lang = lang;
}
/** The chat page: messages are applied and their replies kept, as seal_chat keeps them. */
function chat(messages: string[], specs: c.ReplySpec[] = []) {
  const replies: string[] = [];
  for (const text of messages) {
    const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
    const spec = applyChatMessage(text, specs, { currentProduct: lastNamed?.newProduct || lastNamed?.mentioned || currentCase().product, currentQuantity: c.quantityInForce(specs) });
    // what the page stores and re-renders after a reload
    specs.push(JSON.parse(JSON.stringify(spec)));
    replies.push(c.buildReply(spec));
  }
  return { specs, replies, reply: replies[replies.length - 1] };
}
/** The values a reply states: "producto «…»; cantidad N; presupuesto de compra US$X". */
function stated(reply: string): Exp | null {
  const m =
    reply.match(/producto «(.+?)»; cantidad ([\d,]+|sin indicar); presupuesto de compra (US\$[\d,.]+|sin indicar)/) ||
    reply.match(/product "(.+?)"; quantity ([\d,]+|not given); purchase budget (US\$[\d,.]+|not given)/);
  if (!m) return null;
  return { product: m[1], quantity: leadingNumber(m[2]), budget: leadingNumber(m[3]) };
}
async function surfaces() {
  const saved = currentCase();
  const f = formStart("").formData;
  const form: Exp = { product: f.productType, quantity: leadingNumber(f.quantity), budget: leadingNumber(f.budget) };
  const sum = caseForSeal({});
  const summary: Exp = { product: String(sum.product || ""), quantity: leadingNumber(sum.quantity), budget: leadingNumber(sum.budget) };
  sent.length = 0;
  await sendToSeal({ requestType: "QA", source: "chat", name: "PRUEBA QA", email: "qa-prueba@example.com" });
  const b = sent[0] || {};
  const payload: Exp = { product: String(b.product || ""), quantity: leadingNumber(b.quantity), budget: leadingNumber(b.budget) };
  return { saved, form, summary, payload, body: b };
}
const clean = (e: Exp) => ({ product: e.product, quantity: e.quantity, budget: e.budget });
/** All surfaces (and the last reply, when it states the case) hold exactly `exp`. */
async function expectCase(exp: Exp, reply?: string) {
  const s = await surfaces();
  for (const [where, v] of Object.entries({ saved: s.saved, form: s.form, summary: s.summary, payload: s.payload })) expect(clean(v as Exp), where).toEqual(clean(exp));
  if (reply !== undefined) {
    const st = stated(reply);
    if (st) expect(clean(st), "chat reply").toEqual(clean(exp));
  }
  return s;
}
const withTank = (l: string) => D.replace("500 litros", l);

// ── A. field updates ───────────────────────────────────────────────────────
describe("A · field updates change only the field asked", () => {
  beforeEach(() => {
    reset();
    formTyped(D, "3", "4500.01");
  });
  it("A1 tank 500→300 L keeps 3 units, US$4,500.01 and every other spec", async () => {
    const { reply } = chat(["Mantengo los mismos compresores y las demás especificaciones. Solo cambia la capacidad del tanque: 300 litros en lugar de 500 litros. La cantidad sigue siendo 3."]);
    await expectCase({ product: withTank("300 litros"), quantity: 3, budget: 4500.01 }, reply);
  });
  it("A2 quantity 3→4 keeps the full description and the budget", async () => {
    const { reply } = chat(["Cambia únicamente la cantidad del pedido de 3 a 4 compresores. No modifiques las especificaciones ni el presupuesto."]);
    await expectCase({ product: D, quantity: 4, budget: 4500.01 }, reply);
  });
  it("A3 budget → US$5,000 keeps the description and 3 units", async () => {
    const { reply } = chat(["Solo actualiza el presupuesto de compra a US$5,000. La cantidad solicitada es 3 unidades y las especificaciones del compresor no cambian."]);
    await expectCase({ product: D, quantity: 3, budget: 5000 }, reply);
  });
  it("A4 chained: tank 300 → qty 4 → budget 5,000 → tank 250 (the production run of 28-n)", async () => {
    const steps: [string, Exp][] = [
      ["Solo cambia la capacidad del tanque a 300 litros.", { product: withTank("300 litros"), quantity: 3, budget: 4500.01 }],
      ["Ahora cambia la cantidad de 3 a 4.", { product: withTank("300 litros"), quantity: 4, budget: 4500.01 }],
      ["Actualiza el presupuesto de compra a US$5,000.", { product: withTank("300 litros"), quantity: 4, budget: 5000 }],
      ["Cambia el tanque de 300 a 250 litros.", { product: withTank("250 litros"), quantity: 4, budget: 5000 }],
    ];
    const specs: c.ReplySpec[] = [];
    for (const [msg, exp] of steps) await expectCase(exp, chat([msg], specs).reply);
  });
  it("A5 voltage only: phase, frequency and tank stay", async () => {
    const { reply } = chat(["Solo cambia el voltaje a 440 V"]);
    await expectCase({ product: D.replace("220 V", "440 V"), quantity: 3, budget: 4500.01 }, reply);
  });
  it("A6 another product: the previous quantity, budget and estimate are not current; history marked as not current", async () => {
    setCaseScenario({ supplierName: "Proveedor A", price: "US$1,200.00 / unidad", totalCostText: "Q30,000 (US$3,800)", scenarioFor: { product: D, quantity: 3, budget: 4500.01 } }, SCENARIO_KEYS);
    const { reply } = chat(["Cambio de producto: ahora quiero importar sillas plásticas apilables para restaurante, color blanco, 200 unidades"]);
    const s = await expectCase({ product: "sillas plásticas apilables para restaurante, color blanco", quantity: 200 });
    expect(reply).toMatch(/cantidad 200/);
    for (const k of ["supplierName", "price", "totalCostText"]) expect(s.body[k], k).toBeUndefined();
    expect(String((s.body.earlier as string[]).join(" | "))).toMatch(/compresores industriales de tornillo/);
    // the form shows the compressors' data only as previous data
    expect(formStart("").stale).toMatchObject({ product: D, quantity: "3", budget: "4500.01" });
  });
});

// ── B. numbers, units, ambiguity ───────────────────────────────────────────
describe("B · numbers and units go to their own field; ambiguity changes nothing", () => {
  beforeEach(() => {
    reset();
    formTyped(D, "3", "4500.01");
  });
  it("B1 'cambia de 500 a 300 litros; sigo pidiendo 3 unidades'", async () => {
    const { reply } = chat(["Cambia de 500 a 300 litros; sigo pidiendo 3 unidades"]);
    await expectCase({ product: withTank("300 litros"), quantity: 3, budget: 4500.01 }, reply);
  });
  const units: [string, Exp][] = [
    ["Que el tanque sea de 300 L", { product: withTank("300 L"), quantity: 3, budget: 4500.01 }],
    ["Cambia el voltaje de 220 a 440 V", { product: D.replace("220 V", "440 V"), quantity: 3, budget: 4500.01 }],
    ["Cambia a 50 Hz", { product: D.replace("60 Hz", "50 Hz"), quantity: 3, budget: 4500.01 }],
    ["El presupuesto es de 6 mil dólares", { product: D, quantity: 3, budget: 6000 }],
    ["Presupuesto: US$4,500.50", { product: D, quantity: 3, budget: 4500.5 }],
    ["Mi presupuesto es de US$ 5.000", { product: D, quantity: 3, budget: 5000 }],
    ["Cambia la cantidad a 1,500", { product: D, quantity: 1500, budget: 4500.01 }],
    ["¿Cuántas cajas de 12 necesito para 500 lápices?", { product: D, quantity: 3, budget: 4500.01 }],
    ["El proveedor vende en cajas de 10 unidades", { product: D, quantity: 3, budget: 4500.01 }],
  ];
  for (const [i, [msg, exp]] of units.entries())
    it(`B2.${i + 1} ${msg}`, async () => {
      await expectCase(exp, chat([msg]).reply);
    });
  const ambiguous: [string, RegExp][] = [
    ["Cambia a 300", /¿«300» es la nueva cantidad/],
    ["Agrega 2 más", /pasa de 3 a 5\?/],
    ["Cambia la cantidad a 3.5", /número entero/],
    ["Cambia la cantidad a 0", /al menos 1/],
    ["Cambia la cantidad a 20000000", /10,000,000/],
    ["La cantidad sigue siendo 5", /¿Cuál es la correcta\?/],
    ["Mi presupuesto ahora es Q40,000", /US\$/],
  ];
  for (const [i, [msg, ask]] of ambiguous.entries())
    it(`B3.${i + 1} ambiguous/invalid '${msg}' asks and changes nothing`, async () => {
      const { reply } = chat([msg]);
      expect(reply).toMatch(ask);
      await expectCase({ product: D, quantity: 3, budget: 4500.01 }, reply);
    });
});

// ── C. hypothetical calculations and packing ───────────────────────────────
describe("C · calculations are answered and never change the case", () => {
  beforeEach(() => {
    reset();
    formTyped(D, "3", "4500.01");
  });
  const calcs: [string, RegExp[]][] = [
    ["Necesito 500 lápices; vienen 12 por caja. ¿Cuántas cajas necesito?", [/42 cajas/, /504 lápices/, /4 lápices adicionales/]],
    ["Necesito 1,001 lápices; vienen en cajas de 100 y solo venden cajas completas. ¿Cuántas cajas?", [/11 cajas/, /1,100/]],
    ["2,000 guantes a US$0.03 cada uno, presupuesto US$59.99. ¿Cuál es el subtotal y cuánto me falta?", [/US\$60\.00/, /US\$0\.01/]],
    ["¿Cuánto costarían 4 compresores a US$1,250.50 cada uno?", [/US\$5,002\.00/]],
    ["¿Y si fueran 6 compresores?", [/hipotética/]],
    ["Si el tanque fuera de 200 litros, ¿cambia algo?", [/hipotética/]],
    ["Suponiendo un presupuesto de US$6,000, ¿me alcanza?", []],
  ];
  for (const [i, [msg, must]] of calcs.entries())
    it(`C${i + 1} ${msg}`, async () => {
      const before = await surfaces();
      const { reply } = chat([msg]);
      for (const re of must) expect(reply).toMatch(re);
      const after = await expectCase({ product: D, quantity: 3, budget: 4500.01 });
      expect(clean(after.saved)).toEqual(clean(before.saved));
    });
});

// ── D. persistence and navigation ──────────────────────────────────────────
describe("D · persistence, navigation, new case, error and retry", () => {
  beforeEach(() => reset());
  it("D1 chat → form → back → chat → form, with reloads: every surface agrees", async () => {
    formTyped(D, "3", "4500.01");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad de 3 a 4"], specs);
    // form opens (navigation carries quantity 4 from the chat)
    let f = formStart("", 4).formData;
    expect([f.productType, f.quantity, f.budget]).toEqual([D, "4", "4500.01"]);
    // the client edits the budget in the form (the form saves its draft)
    store[DRAFT_KEY] = JSON.stringify({ formData: { ...f, budget: "5200" }, step: 2, prev: null });
    // back to the chat; the page reloads and re-renders the stored replies
    const reloaded: c.ReplySpec[] = JSON.parse(JSON.stringify(specs));
    const { reply } = chat(["Solo cambia el tanque a 300 litros"], reloaded);
    await expectCase({ product: withTank("300 litros"), quantity: 4, budget: 5200 }, reply);
    // form again, reloaded with the old navigation state (quantity 4): the draft wins
    store[DRAFT_KEY] = JSON.stringify({ ...JSON.parse(store[DRAFT_KEY]), formData: { ...JSON.parse(store[DRAFT_KEY]).formData, quantity: "6" } });
    f = formStart("", 4).formData;
    expect(f.quantity).toBe("6");
    await expectCase({ product: withTank("300 litros"), quantity: 6, budget: 5200 });
  });
  it("D2 a new case inherits nothing (draft, chat, case, product)", async () => {
    formTyped(D, "3", "4500.01");
    chat(["Actualiza el presupuesto de compra a US$5,000"]);
    clearDraft(); // the start page does this for a new query
    expect(currentCase()).toEqual({ product: "" });
    expect(formStart("sillas plásticas apilables").formData).toMatchObject({ productType: "sillas plásticas apilables" });
    expect(formStart("sillas plásticas apilables").formData.quantity).toBeUndefined();
    expect(caseContext()).toEqual({});
    const s = await surfaces();
    expect(s.body.quantity).toBeUndefined();
    expect(s.body.budget).toBeUndefined();
  });
  it("D3 a failed send keeps the case and the retry sends the same values", async () => {
    formTyped(D, "3", "4500.01");
    chat(["Cambia la cantidad de 3 a 4"]);
    failNext = true;
    const r1 = await sendToSeal({ requestType: "QA", source: "chat", name: "PRUEBA QA", email: "qa-prueba@example.com" });
    expect(r1.ok).toBe(false);
    await expectCase({ product: D, quantity: 4, budget: 4500.01 });
  });
  it("D4 a failed search keeps the draft (the form reopens with it); no estimate is kept", async () => {
    formTyped(D, "3", "4500.01", 3);
    setCaseScenario({ supplierName: "Viejo", totalCostText: "Q1", scenarioFor: { product: D, quantity: 3, budget: 4500.01 } }, SCENARIO_KEYS);
    // what the form does when a search starts (ProductQualification handleSubmit)
    switchCaseProduct(D);
    setCaseScenario({}, SCENARIO_KEYS);
    const s = await expectCase({ product: D, quantity: 3, budget: 4500.01 });
    expect(s.body.supplierName).toBeUndefined();
    expect(formStart("").step).toBe(3);
  });
  it("D5 an estimate made before a change is not sent as current", async () => {
    formTyped(D, "3", "4500.01", 3);
    setCaseScenario({ supplierName: "Proveedor A", price: "US$1,200.00 / unidad", totalCostText: "Q30,000 (US$3,800)", assumptions: ["dentro de tu presupuesto"], scenarioFor: { product: D, quantity: 3, budget: 4500.01 } }, SCENARIO_KEYS);
    chat(["Cambia la cantidad de 3 a 4"]);
    const s = await expectCase({ product: D, quantity: 4, budget: 4500.01 });
    expect(s.body.totalCostText).toBeUndefined();
    expect(s.body.assumptions).toBeUndefined();
    expect((s.body.earlier as string[]).join(" ")).toMatch(/Estimación anterior \(ya no vigente\).*cantidad 3.*Q30,000/);
    // the same with a change typed in the form instead of the chat
    reset();
    formTyped(D, "3", "4500.01", 3);
    setCaseScenario({ supplierName: "Proveedor A", totalCostText: "Q30,000 (US$3,800)", scenarioFor: { product: D, quantity: 3, budget: 4500.01 } }, SCENARIO_KEYS);
    formTyped(D, "5", "4500.01");
    const s2 = await expectCase({ product: D, quantity: 5, budget: 4500.01 });
    expect(s2.body.totalCostText).toBeUndefined();
  });
  it("D7 from the report page after a change: no old total, category follows the product, history not duplicated", async () => {
    formTyped("guantes de nitrilo talla M", "2000", "", 3);
    setCaseScenario({ supplierName: "G", totalCostText: "Q500", scenarioFor: { product: "guantes de nitrilo talla M", quantity: 2000 } }, SCENARIO_KEYS);
    chat(["Cambio de producto: ahora quiero importar sillas plásticas apilables para restaurante, 200 unidades"]);
    sent.length = 0;
    // what FinalCTA sends (navigation state of the old estimate)
    await sendToSeal({ requestType: "QA", source: "informe", name: "PRUEBA QA", email: "qa-prueba@example.com", totalCost: 63, totalCostText: "Q500", productType: "ppe", productDescription: "guantes de nitrilo talla M", quantity: "2,000 unidades", supplierName: "G" });
    const b = sent[0];
    expect(b).toMatchObject({ product: "sillas plásticas apilables para restaurante", quantity: "200" });
    for (const k of ["totalCost", "totalCostText", "supplierName"]) expect(b[k], k).toBeUndefined();
    expect(b.productType).not.toBe("ppe");
    const lines = (b.earlier as string[]).filter((x) => x.includes("Q500"));
    expect(lines.length).toBe(1);
  });
  it("D8 an emptied product field is no product: no stored quantity reappears", async () => {
    formTyped(D, "3", "4500.01");
    chat(["Cambia la cantidad de 3 a 9"]);
    formTyped("", "3", "");
    expect(currentCase()).toEqual({ product: "" });
    const s = await surfaces();
    expect(s.summary.quantity === undefined || s.summary.quantity === 3).toBe(true);
  });
  it("D9 a quantity typed as '1.000' (not yet cleaned on blur) is 1000 everywhere", async () => {
    formTyped(D, "1.000", "");
    await expectCase({ product: D, quantity: 1000 });
  });
  it("D10 a new case also forgets the previous case number", () => {
    store.seal_last_case = "SEAL-OLD";
    clearDraft();
    expect(store.seal_last_case).toBeUndefined();
  });
  it("D6 the estimate in force keeps its own wording ('42 sets de 12 piezas…') and totals", async () => {
    formTyped(D, "500", "", 3);
    const screen = { productDescription: D, quantity: "42 sets de 12 piezas c/u = 504 piezas", totalCostText: "Q9,999", supplierName: "P", scenarioFor: { product: D, quantity: 500 } };
    const body = caseForSeal(screen);
    expect(body.quantity).toBe(screen.quantity);
    expect(body.totalCostText).toBe("Q9,999");
  });
});

// ── E. messages and limits ─────────────────────────────────────────────────
const CORPUS = [
  "Mantengo los mismos compresores y las demás especificaciones. Solo cambia la capacidad del tanque: 300 litros en lugar de 500 litros. La cantidad sigue siendo 3.",
  "Cambia únicamente la cantidad del pedido de 3 a 4 compresores. No modifiques las especificaciones ni el presupuesto.",
  "Solo actualiza el presupuesto de compra a US$5,000. La cantidad solicitada es 3 unidades y las especificaciones del compresor no cambian.",
  "Cambia de 500 a 300 litros; sigo pidiendo 3 unidades",
  "Déjalo en 5 unidades", "En total 5 compresores", "Son 3 compresores de 300 litros", "Quita el presupuesto", "Presupuesto 6k",
  "Voltaje 220 V monofásico", "Mantén todo igual pero con tanque de 300 litros y 4 unidades", "Cambia el presupuesto a 5000 y la cantidad a 4",
  "Cambia a 300", "Agrega 2 más", "¿Y si fueran 6 compresores?", "¿El proveedor es confiable?", "¿Me garantizan que pasa la aduana?",
  "¿Cuál es la partida arancelaria?", "¿En cuántos días llega?", "Quiero hablar con un ejecutivo", "¿Pueden pasar mi caso a Courier o DLZ?",
];
const PROMISE = /\b(?:garantizamos|te garantizo|le garantizo|está verificado|es auténtico|proveedor (?:confiable|seguro) garantizado|la partida (?:correcta|definitiva) es|clasificación definitiva es|llega en \d+ días|despacho en \d+|liberación garantizada|aprobado por la SAT|we guarantee|is verified|is authentic)\b/i;
/** A promise, not its negation ("nothing here is verified", "no garantizamos…"). */
const promises = (text: string) =>
  [...text.matchAll(new RegExp(PROMISE.source, "gi"))].filter((m) => !/\b(?:no|not|nothing(?:\s+here)?|never|ni|nunca|sin|nadie)\b[^.;]{0,25}$/i.test(text.slice(Math.max(0, (m.index ?? 0) - 40), m.index)));
describe("E · replies state the saved case and keep the commercial limits", () => {
  for (const [i, msg] of CORPUS.entries())
    it(`E1.${i + 1} reply = saved state, no promises: ${msg.slice(0, 60)}`, async () => {
      reset();
      formTyped(D, "3", "4500.01");
      const { reply } = chat([msg]);
      expect(promises(reply).map((m) => m[0])).toEqual([]);
      const st = stated(reply);
      if (st) expect(clean(st)).toEqual(clean(currentCase()));
      expect(reply).not.toMatch(/undefined|NaN|null/);
    });
  it("E2 nothing in the app's text promises authenticity, guarantees, final classification or times", () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(tsx?|json)$/.test(f) && files.push(join(d, f))));
    walk("src");
    const hits = files.flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, n) => [f, n + 1, l] as const)).filter(([, , l]) => promises(l).length > 0);
    expect(hits).toEqual([]);
  });
  it("E3 SEAL first: nothing in the app sends case data to other companies", () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) && files.push(join(d, f))));
    walk("src");
    const calls = files.flatMap((f) => (readFileSync(f, "utf8").match(/fetch\(\s*[`"'][^`"']*/g) || []).map((x) => `${f}: ${x}`));
    for (const call of calls) expect(call, call).not.toMatch(/courier|importaguate|dlz|mailto/i);
    expect(sent.every((b) => !Object.keys(b).some((k) => /transfer|derivar|forward/i.test(k)))).toBe(true);
  });
  it("E4 English: the four partial updates reply in English with the saved values", async () => {
    const cases: [string, Exp][] = [
      ["Keep the same compressors and specs. Only change the tank capacity: 300 liters instead of 500 liters. The quantity is still 3.", { product: withTank("300 liters"), quantity: 3, budget: 4500.01 }],
      ["Keep the same compressors and specs. Only change the tank capacity: 200 liters instead of 500 liters. The quantity is still 3.", { product: withTank("200 liters"), quantity: 3, budget: 4500.01 }],
      ["Only change the order quantity from 3 to 4 units. Don't change the specs or the budget.", { product: D, quantity: 4, budget: 4500.01 }],
      ["Only update the purchase budget to US$5,000. The requested quantity is 3 units and the specs don't change.", { product: D, quantity: 3, budget: 5000 }],
    ];
    for (const [msg, exp] of cases) {
      reset("en");
      formTyped(D, "3", "4500.01");
      const { reply } = chat([msg]);
      expect(reply, msg).toMatch(/^Updated:/);
      expect(stated(reply), msg).not.toBeNull();
      await expectCase(exp, reply);
    }
    expect(fieldError("quantity", "2.5")).toMatch(/whole number/);
  });
});

// ── F. form validation ─────────────────────────────────────────────────────
describe("F · form validation explains how to fix and never accepts invalid data", () => {
  const bad: [string, string, RegExp][] = [
    ["quantity", "", /obligatoria/],
    ["quantity", "0", /mayor a 0/],
    ["quantity", "-3", /número entero/],
    ["quantity", "2.5", /número entero/],
    ["quantity", "10000001", /Máximo 10,000,000/],
    ["quantity", "tres", /número entero/],
    ["budget", "0", /al menos US\$1/],
    ["budget", "-5", /solo el número/],
    ["budget", "100000001", /Máximo US\$100,000,000/],
    ["budget", "50.000", /sin puntos de miles/],
    ["productType", "", /./],
    ["productType", "silla", /./],
    ["volumeCbm", "0", /mayor a 0/],
    ["weightKg", "-1", /solo el número/],
  ];
  for (const [field, value, msg] of bad)
    it(`F ${field}='${value}' is rejected with an explanation`, () => {
      doc.documentElement.lang = "es";
      expect(fieldError(field, value)).toMatch(msg);
    });
  const good: [string, string][] = [["quantity", "3"], ["quantity", "10000000"], ["budget", ""], ["budget", "4500.01"], ["productType", D]];
  for (const [field, value] of good) it(`F ${field}='${value}' is valid`, () => expect(fieldError(field, value)).toBe(""));
  it("F the chat never saves a value the form would reject", async () => {
    reset();
    formTyped(D, "3", "4500.01");
    for (const msg of ["Cambia la cantidad a 0", "Cambia la cantidad a 3.5", "Cambia la cantidad a 20000000", "Presupuesto de US$0"]) chat([msg]);
    const s = currentCase();
    expect(fieldError("quantity", String(s.quantity))).toBe("");
    expect(fieldError("budget", String(s.budget ?? ""))).toBe("");
  });
});

// ── G. what SEAL receives ──────────────────────────────────────────────────
describe("G · the request to SEAL carries exactly the case in force (fetch mocked: nothing is sent)", () => {
  beforeEach(() => {
    reset();
    formTyped(D, "3", "4500.01");
  });
  it("G1 after chained changes the body has the final values and no stale estimate", async () => {
    chat(["Solo cambia la capacidad del tanque a 300 litros.", "Ahora cambia la cantidad de 3 a 4.", "Actualiza el presupuesto de compra a US$5,000."]);
    const s = await expectCase({ product: withTank("300 litros"), quantity: 4, budget: 5000 });
    expect(s.body.budget).toBe("US$5,000");
    expect(s.body.quantity).toBe("4");
  });
  it("G2 from the costs page: the estimate on screen goes with the case it was computed for", async () => {
    const screen = { productDescription: D, quantity: "3 unidades", budget: "US$4,500.01", supplierName: "Proveedor A", totalCostText: "Q30,000", scenarioFor: { product: D, quantity: 3, budget: 4500.01 } };
    sent.length = 0;
    await sendToSeal({ ...screen, requestType: "QA", source: "costos", name: "PRUEBA QA", email: "qa-prueba@example.com" });
    expect(sent[0]).toMatchObject({ product: D, quantity: "3 unidades", budget: "US$4,500.01", totalCostText: "Q30,000", supplierName: "Proveedor A" });
    expect(sent[0].scenarioFor).toBeUndefined();
  });
});

describe("G · estimates in sets or boxes", () => {
  it("G3 a report in sets for the same product is not taken as an old estimate", async () => {
    reset();
    formTyped(D, "500", "", 3);
    sent.length = 0;
    await sendToSeal({ requestType: "QA", source: "informe", name: "PRUEBA QA", email: "qa-prueba@example.com", totalCost: 10, totalCostText: "Q80", productDescription: D, quantity: "42 sets" });
    expect(sent[0]).toMatchObject({ totalCost: 10, totalCostText: "Q80", product: D });
  });
});
