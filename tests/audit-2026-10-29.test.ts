// AUDIT 2026-10-29 — permanent regression suite for the case mutations of SmartTrade AI.
// Opened by two production defects: "3.5 compresores… no cambies nada" saved 5, and
// "10,000,001 compresores" saved 10,000,001 (or answered with an earlier pencils calculation).
// Every case checks the STATE on every surface (saved case, form, SEAL summary, exact payload
// with fetch mocked — nothing is sent) and the values the chat reply states.
// Run: npm run test:audit
import { describe, it, expect, beforeEach } from "vitest";

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


const C = D; // compresores industriales…, the case of the audit
function startCase(qty = "4", budget = "5000", product = C) {
  reset();
  formTyped(product, qty, budget);
}

// ── AUDIT-0 · the two exact sequences that opened the audit (2026-10-29) ───
describe("AUDIT-0 · the two reported sequences", () => {
  const S1 = "La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.";
  const S2 = "Corrijo: serán 10,000,001 compresores; actualiza solo la cantidad.";
  for (const before of [[], ["Necesito 500 lápices en cajas de 24, ¿cuántas cajas?"], ["¿Cuántas cajas necesito para 1,000 lápices si vienen 12 por caja?"]])
    it(`Error A then Error B${before.length ? ` after a calculation (${before[0].slice(0, 25)}…)` : ""}: nothing changes, nothing is reused`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      if (before.length) chat(before, specs);
      const a = chat([S1], specs).reply;
      expect(a).not.toMatch(/Actualizado|→ 5|cantidad 5/);
      expect(a).toMatch(/fraccionarias/);
      expect(a).toMatch(/no cambié nada/i);
      expect(a).toMatch(/número entero/);
      await expectCase({ product: C, quantity: 4, budget: 5000 }, a);
      const b = chat([S2], specs).reply;
      expect(b).toMatch(/10,000,000/);
      expect(b).toMatch(/10,000,001/);
      expect(b).not.toMatch(/Actualizado|lápices|cajas|Necesitarías/);
      await expectCase({ product: C, quantity: 4, budget: 5000 }, b);
    });
});

// ── AUDIT-Q · quantities ──────────────────────────────────────────────────
describe("AUDIT-Q · quantity values (chat), 4 in force", () => {
  const cases: [string, number, RegExp][] = [
    ["Cambia la cantidad a 1", 1, /cantidad 4 → 1/],
    ["La cantidad es 10,000,000", 10_000_000, /cantidad 4 → 10,000,000/],
    ["La cantidad es 10.000.000", 10_000_000, /→ 10,000,000/],
    ["Change the quantity to 7", 7, /quantity|cantidad/],
    ["Cambia la cantidad a 0", 4, /al menos 1/],
    ["Cambia la cantidad a -1", 4, /al menos 1/],
    ["Serán -1 compresores", 4, /al menos 1/],
    ["Cambia la cantidad a 3.5", 4, /número entero/],
    ["Cambia la cantidad a 3,5", 4, /número entero/],
    ["Serán 2.75 unidades", 4, /número entero/],
    ["Cambia la cantidad a 10,000,001", 4, /10,000,000/],
    ["Serán 10000001 compresores", 4, /10,000,000/],
    ["Cambia la cantidad a", 4, /No indicaste la nueva cantidad/],
    ["Serán 5 o 6 compresores", 4, /no es una cantidad exacta/],
    ["Necesito entre 5 y 10 unidades", 4, /no es una cantidad exacta|rango/],
    ["La cantidad serán unos 8 compresores", 4, /no es una cantidad exacta/],
  ];
  for (const [msg, qty, re] of cases)
    it(`${msg} → ${qty}`, async () => {
      startCase();
      const { reply } = chat([msg]);
      expect(reply).toMatch(re);
      await expectCase({ product: C, quantity: qty, budget: 5000 }, reply);
    });
  it("English: invalid quantity is explained in English, no Spanish mixed in", async () => {
    reset("en");
    formTyped(C, "4", "5000");
    const { reply } = chat(["Change the quantity to 3.5"]);
    expect(reply).toMatch(/whole number/);
    expect(reply).not.toMatch(/cantidad|número|No cambié/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("a capacity, voltage or budget is never read as a quantity", async () => {
    startCase();
    await expectCase({ product: withTank("3.5 litros"), quantity: 4, budget: 5000 }, chat(["Cambia el tanque a 3.5 litros"]).reply);
    startCase();
    await expectCase({ product: C.replace("220 V", "440 V"), quantity: 4, budget: 5000 }, chat(["Solo cambia el voltaje a 440 V"]).reply);
    startCase();
    await expectCase({ product: C, quantity: 4, budget: 6000 }, chat(["Actualiza el presupuesto a US$6,000"]).reply);
  });
  it("a question about a value never changes the case (found in the self-review)", async () => {
    for (const q of ["¿Un tanque de 300 litros sería suficiente?", "¿El tanque de 300 litros sirve?", "¿Tienen tanque de 300 litros?", "¿Funciona a 440 V?", "¿Con 6 compresores me alcanza el presupuesto?"]) {
      startCase();
      chat([q]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    }
  });
  it("a polite question that asks for a change does change it", async () => {
    startCase();
    await expectCase({ product: C, quantity: 6, budget: 5000 }, chat(["¿Puedes cambiar la cantidad a 6?"]).reply);
  });
});

// ── AUDIT-H · explicit instructions not to change ─────────────────────────
describe("AUDIT-H · 'no cambies nada' blocks every change; a confirmation applies it", () => {
  it("a valid value with a hold is proposed, not applied; 'sí, aplícalo' applies exactly it", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    const r1 = chat(["Serán 6 compresores, pero no cambies nada todavía."], specs).reply;
    expect(r1).toMatch(/no cambié nada/i);
    expect(r1).toMatch(/cantidad 6/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, r1);
    const r2 = chat(["Sí, aplícalo"], specs).reply;
    expect(r2).toMatch(/cantidad 4 → 6/);
    await expectCase({ product: C, quantity: 6, budget: 5000 }, r2);
  });
  it("a hold on the budget, then an unrelated message: the proposal expires", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["El presupuesto sería US$7,000; no lo actualices hasta que te confirme."], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
    chat(["¿Qué documentos necesito?"], specs);
    chat(["sí"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("English hold: don't change anything yet", async () => {
    reset("en");
    formTyped(C, "4", "5000");
    const { reply } = chat(["It will be 9 units, but don't change anything yet."]);
    expect(reply).toMatch(/didn't change anything/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("'no cambies el presupuesto' is NOT a hold: the quantity still changes", async () => {
    startCase("3");
    const { reply } = chat(["Cambia la cantidad a 5, no cambies el presupuesto."]);
    await expectCase({ product: C, quantity: 5, budget: 5000 }, reply);
  });
  it("an invalid value and a valid one in the same message: all or nothing", async () => {
    startCase();
    const { reply } = chat(["Cambia la cantidad a 3.5 y el presupuesto a US$6,000"]);
    expect(reply).toMatch(/ningún otro dato/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, reply);
  });
});

// ── AUDIT-F · field corrections ───────────────────────────────────────────
describe("AUDIT-F · corrections change only their field", () => {
  it("quantity 3 → 4", async () => {
    startCase("3");
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad de 3 a 4"]).reply);
  });
  it("budget → US$5,000", async () => {
    startCase("3", "4500");
    await expectCase({ product: C, quantity: 3, budget: 5000 }, chat(["Solo actualiza el presupuesto a US$5,000"]).reply);
  });
  it("tank 500 → 300 L, nothing else", async () => {
    startCase("3");
    await expectCase({ product: withTank("300 litros"), quantity: 3, budget: 5000 }, chat(["Cambia la capacidad del tanque de 500 a 300 litros"]).reply);
  });
  it("consecutive corrections with a rejected one in the middle", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad a 4"], specs).reply);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad a 4.5"], specs).reply);
    await expectCase({ product: C, quantity: 4, budget: 6000 }, chat(["Actualiza el presupuesto a US$6,000"], specs).reply);
    await expectCase({ product: withTank("300 litros"), quantity: 4, budget: 6000 }, chat(["Solo cambia el tanque a 300 litros"], specs).reply);
  });
  it("budget out of range is not applied", async () => {
    startCase();
    chat(["Actualiza el presupuesto a US$200,000,000"]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

// ── AUDIT-X · context ─────────────────────────────────────────────────────
describe("AUDIT-X · context never leaks between questions or cases", () => {
  it("math question, then a case correction: the correction applies to the case", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Necesito 500 lápices en cajas de 24, ¿cuántas cajas?"], specs);
    const r = chat(["Corrijo: serán 6 compresores; actualiza solo la cantidad."], specs).reply;
    expect(r).not.toMatch(/lápices|cajas/);
    await expectCase({ product: C, quantity: 6, budget: 5000 }, r);
  });
  it("a follow-up that names another item is not a follow-up of the calculation", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Necesito 500 lápices en cajas de 24, ¿cuántas cajas?"], specs);
    const r = chat(["Perdón, son 300 cuadernos"], specs).reply;
    expect(r).not.toMatch(/300 lápices|13 cajas: 312 lápices/);
  });
  it("a real follow-up of the calculation still works (references the history explicitly)", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Necesito 500 lápices en cajas de 24, ¿cuántas cajas?"], specs);
    // 30-b: with a case open, a bare number after a calculation is ambiguous (calculation or case?) and is
    // asked, never answered from the calculation; naming the calculation's items is the explicit reference.
    expect(chat(["¿Y si fueran 600?"], specs).reply).toMatch(/cálculo anterior/);
    expect(chat(["¿Y si fueran 600 lápices?"], specs).reply).toMatch(/25 cajas/);
  });
  it("correction followed by a hypothetical: the hypothetical changes nothing", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 4"], specs);
    chat(["¿Y si fueran 8 compresores?"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("two independent conversations (new case) do not share data", async () => {
    startCase();
    chat(["Cambia la cantidad a 7"]);
    clearDraft();
    formTyped("termos de acero inoxidable 304 de 500 ml", "", "");
    const r = chat(["¿Qué documentos necesito?"]);
    expect(r.reply).not.toMatch(/compresor|cantidad 7/);
    await expectCase({ product: "termos de acero inoxidable 304 de 500 ml" });
  });
  it("rapid consecutive messages: each builds on the previous saved case", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 4", "Actualiza el presupuesto a US$6,000", "Cambia la cantidad a 9.5", "Cambia la cantidad a 5"], specs);
    await expectCase({ product: C, quantity: 5, budget: 6000 });
  });
  it("a reply re-rendered later (out of order / after reload) states the saved case of its own turn", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    const { replies } = chat(["Cambia la cantidad a 3.5", "Cambia la cantidad a 6"], specs);
    // stored specs re-render identically (the page re-builds replies from them)
    expect(specs.map((s) => c.buildReply(JSON.parse(JSON.stringify(s))))).toEqual(replies);
    expect(replies[0]).toMatch(/cantidad 4;/);
    expect(replies[1]).toMatch(/cantidad 4 → 6/);
  });
});

// ── AUDIT-P · persistence ─────────────────────────────────────────────────
describe("AUDIT-P · persistence and read-back", () => {
  it("storage that refuses writes: the chat never announces the change", async () => {
    startCase();
    const orig = storage.setItem;
    storage.setItem = () => {
      throw new Error("quota");
    };
    try {
      const { reply } = chat(["Cambia la cantidad a 6"]);
      expect(reply).not.toMatch(/Actualizado/);
      expect(reply).toMatch(/No pude guardar/);
    } finally {
      storage.setItem = orig;
    }
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("an invalid quantity typed in the form is not the case's quantity in the saved case, the summary or the payload", async () => {
    for (const typed of ["3.5", "0", "10000001"]) {
      reset();
      formTyped(C, typed, "5000");
      const s = await surfaces();
      for (const v of [s.saved, s.summary, s.payload]) expect(clean(v)).toEqual(clean({ product: C, budget: 5000 }));
      // the form keeps what the client typed and shows why it can't be used
      expect(formStart("").formData.quantity).toBe(typed);
      expect(fieldError("quantity", typed)).not.toBe("");
    }
  });
  it("navigation state with an invalid quantity is not used by the form", () => {
    reset();
    formTyped(C, "", "");
    expect(formStart(C, "10000001").formData.quantity).toBe("");
    expect(formStart(C, "3.5").formData.quantity).toBe("");
    expect(formStart(C, "6").formData.quantity).toBe("6");
  });
  it("chat → form → chat with reload keeps exactly the saved case", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 4"], specs);
    // form opens, the client changes the budget there, comes back (reload re-reads storage)
    const f = formStart("").formData;
    formTyped(f.productType, f.quantity, "7000");
    const reloaded = JSON.parse(JSON.stringify(specs));
    const r = chat(["Cambia la cantidad a 2.5"], reloaded).reply;
    await expectCase({ product: C, quantity: 4, budget: 7000 }, r);
  });
});

// ── AUDIT-S · communication and safety ────────────────────────────────────
describe("AUDIT-S · commercial limits", () => {
  const PROMISES = /garantiz|garantía de|clasificaci[oó]n definitiva|verificad[oa] por SEAL|liberaci[oó]n asegurada|costo final|aprobado|guarantee|guaranteed/i;
  it("rejection replies make no promises and do not route to third parties", () => {
    startCase();
    for (const msg of ["La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.", "Corrijo: serán 10,000,001 compresores; actualiza solo la cantidad.", "Serán 5 o 6 compresores"]) {
      const r = chat([msg]).reply;
      expect(r).not.toMatch(PROMISES);
      expect(r).not.toMatch(/otra empresa|otro agente|we will refer|te refiero/i);
    }
  });
  it("nothing is sent to SEAL by the chat itself (only the explicit button sends)", () => {
    startCase();
    sent.length = 0;
    chat(["Cambia la cantidad a 6", "Cambia la cantidad a 3.5", "Quiero hablar con un ejecutivo de SEAL"]);
    expect(sent.length).toBe(0);
  });
});

// ── AUDIT-R · variants found in the independent review (Ciclo F) ─────────
describe("AUDIT-R · review variants: invalid values in other wordings never change the case", () => {
  const rows: [string, "es" | "en", number, number, RegExp][] = [
    ["Serán 3,5 compresores", "es", 4, 5000, /fraccionarias/],
    ["Cambia a 3.5", "es", 4, 5000, /fraccionarias/],
    ["Ponle 2.5", "es", 4, 5000, /fraccionarias/],
    ["La compra será de 3 1/2 compresores", "es", 4, 5000, /«3 1\/2»/],
    ["Serán tres compresores y medio", "es", 4, 5000, /fraccionarias/],
    ["Agrega 0.5 más", "es", 4, 5000, /fraccionarias/],
    ["Mejor 2.5 en lugar de 4", "es", 4, 5000, /fraccionarias/],
    ["Serán 11 millones de compresores", "es", 4, 5000, /10,000,000/],
    ["Corrijo: serán 10,000,001; actualiza solo la cantidad", "es", 4, 5000, /10,000,000/],
    ["Quantity: 10,000,001", "en", 4, 5000, /maximum quantity is 10,000,000/],
    ["We'll buy 3.5 compressors. Don't change anything until you confirm whether fractional quantities are accepted.", "en", 4, 5000, /As you asked, I didn't change anything\. Fractional quantities are not accepted/],
    ["No cambies nada, solo dime si aceptan 3.5", "es", 4, 5000, /Como pediste, no cambié nada\. No se aceptan cantidades fraccionarias/],
    ["Ahora quiero 3.5 tanques de acero de 300 litros", "es", 4, 5000, /fraccionarias/],
    ["Cambia el presupuesto a US$0", "es", 4, 5000, /mayor a US\$0/],
    ["El presupuesto es -500", "es", 4, 5000, /mayor a US\$0/],
    ["Actualiza el presupuesto a US$200,000,000", "es", 4, 5000, /máximo es US\$100,000,000/],
    // "no cambies nada más" keeps the rest: the named field DOES change
    ["Cambia el presupuesto a 5500, no cambies nada más", "es", 4, 5500, /US\$5,000 → US\$5,500/],
    ["Actualiza la cantidad a 6 y no cambies nada más", "es", 6, 5000, /cantidad 4 → 6/],
    ["Serán 4.000 compresores", "es", 4000, 5000, /4 → 4,000/],
  ];
  for (const [msg, lang, q, b, re] of rows)
    it(`${msg} → qty ${q}, budget ${b}`, async () => {
      reset(lang);
      formTyped(C, "4", "5000");
      const { reply } = chat([msg]);
      expect(reply).toMatch(re);
      if (lang === "en") expect(reply).not.toMatch(/No cambié|cantidad|presupuesto de compra/);
      await expectCase({ product: C, quantity: q, budget: b }, reply);
    });
});
