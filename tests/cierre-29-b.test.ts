// CIERRE 29-b — traceable matrix (see CIERRE-29-B.md). Each `describe` carries the requirement id.
// Environment: local, integration with mocks (sessionStorage in memory, fetch mocked: nothing is sent).
// Every case checks the STATE on every surface (saved case, form, SEAL summary, exact payload) and
// the values the chat reply states — never only the wording.
import { describe, it, expect } from "vitest";

const store: Record<string, string> = {};
const base = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = String(v)), removeItem: (k: string) => void delete store[k] };
const storage = { ...base };
const g = globalThis as Record<string, unknown>;
g.sessionStorage = storage;
g.localStorage = storage;
g.window = globalThis;
const doc = { documentElement: { lang: "es" } };
g.document = doc;
const sent: Record<string, unknown>[] = [];
let net: "ok" | "down" | "500" = "ok";
g.fetch = async (url: string, opt?: { body?: string }) => {
  if (/\/api\/email\/quote/.test(String(url))) {
    if (net === "down") throw new TypeError("Failed to fetch");
    if (net === "500") return { ok: false, status: 500, json: async () => ({ error: "x" }) };
    sent.push(JSON.parse(String(opt?.body || "{}")));
    return { ok: true, status: 200, json: async () => ({ id: "SEAL-TEST-000001", test: true }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

const c = await import("../src/utils/chatReply");
const { applyChatMessage } = await import("../src/utils/chatCase");
const cs = await import("../src/utils/caseStore");
const { currentCase, caseForSeal, formStart, leadingNumber, caseVersion, saveFormDraft, writeCaseTx, readPending, repairCase } = cs;
const { DRAFT_KEY, PENDING_KEY, saveProduct, clearDraft } = await import("../src/utils/draft");
const { sendToSeal, caseContext, setCaseScenario } = await import("../src/utils/caseContext");
const { fieldError } = await import("../src/utils/formValidation");
const { requestFacts } = await import("../src/utils/requestFacts");

const C = "compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros, libres de aceite";
const withTank = (l: string) => C.replace("500 litros", l);
type Exp = { product: string; quantity?: number; budget?: number };

function reset(lang: "es" | "en" = "es") {
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(storage, base);
  sent.length = 0;
  net = "ok";
  doc.documentElement.lang = lang;
}
function formTyped(product: string, quantity = "", budget = "", step = 2) {
  const r = saveFormDraft({ productType: product, quantity, budget, destination: "GT", volumeCbm: "", weightKg: "" }, step, null);
  expect(r.ok).toBe(true);
}
function startCase(qty = "4", budget = "5000", product = C, lang: "es" | "en" = "es") {
  reset(lang);
  formTyped(product, qty, budget);
}
function chat(messages: string[], specs: c.ReplySpec[] = []) {
  const replies: string[] = [];
  for (const text of messages) {
    const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
    const spec = applyChatMessage(text, specs, { currentProduct: lastNamed?.newProduct || lastNamed?.mentioned || currentCase().product, currentQuantity: c.quantityInForce(specs) });
    specs.push(JSON.parse(JSON.stringify(spec)));
    replies.push(c.buildReply(spec));
  }
  return { specs, replies, reply: replies[replies.length - 1], last: specs[specs.length - 1] };
}
function stated(reply: string): Exp | null {
  const m =
    reply.match(/producto «(.+?)»; cantidad ([\d,]+|sin indicar); presupuesto de compra (US\$[\d,.]+|sin indicar)/) ||
    reply.match(/product "(.+?)"; quantity ([\d,]+|not given); purchase budget (US\$[\d,.]+|not given)/);
  if (!m) return null;
  return { product: m[1], quantity: leadingNumber(m[2]), budget: leadingNumber(m[3]) };
}
const clean = (e: Exp) => ({ product: e.product, quantity: e.quantity, budget: e.budget });
async function surfaces() {
  const saved = currentCase();
  const f = formStart("").formData;
  const form: Exp = { product: f.productType, quantity: leadingNumber(f.quantity), budget: leadingNumber(f.budget) };
  const sum = caseForSeal({});
  const summary: Exp = { product: String(sum.product || ""), quantity: leadingNumber(sum.quantity), budget: leadingNumber(sum.budget) };
  // the stored case SEAL's request is built from (mirror) must hold the same values
  const sc = caseContext();
  const mirror: Exp = { product: String(sc.product || ""), quantity: leadingNumber(sc.quantity), budget: leadingNumber(sc.budget) };
  sent.length = 0;
  const r = await sendToSeal({ requestType: "QA", source: "chat", name: "PRUEBA QA", email: "qa-prueba@example.com" });
  expect(r.ok).toBe(true);
  const b = sent[0] || {};
  const payload: Exp = { product: String(b.product || ""), quantity: leadingNumber(b.quantity), budget: leadingNumber(b.budget) };
  return { saved, form, summary, mirror, payload, body: b };
}
async function expectCase(exp: Exp, reply?: string) {
  const s = await surfaces();
  for (const [where, v] of Object.entries({ saved: s.saved, form: s.form, summary: s.summary, mirror: s.mirror, payload: s.payload })) expect(clean(v as Exp), where).toEqual(clean(exp));
  if (reply !== undefined) {
    const st = stated(reply);
    if (st) expect(clean(st), "chat reply").toEqual(clean(exp));
  }
  return s;
}
const S1 = "La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.";
const S2 = "Corrijo: serán 10,000,001 compresores; actualiza solo la cantidad.";
const MATH = "Necesito 500 lápices en cajas de 12, ¿cuántas cajas necesito?";

describe("R01 · quantities 1 and 10,000,000 are accepted (chat and form)", () => {
  for (const [msg, q] of [
    ["Cambia la cantidad a 1", 1],
    ["La cantidad es 10,000,000", 10_000_000],
    ["La cantidad es 10.000.000", 10_000_000],
    ["Change the quantity to 10,000,000", 10_000_000],
  ] as const)
    it(msg, async () => {
      startCase();
      await expectCase({ product: C, quantity: q, budget: 5000 }, chat([msg]).reply);
    });
  it("form: 1 and 10000000 valid", () => {
    expect(fieldError("quantity", "1")).toBe("");
    expect(fieldError("quantity", "10000000")).toBe("");
  });
});

describe("R02 · 0, -1, 3.5 and 10,000,001 are rejected, nothing changes, nothing is rounded", () => {
  for (const msg of ["Cambia la cantidad a 0", "Cambia la cantidad a -1", "Cambia la cantidad a 3.5", "Cambia la cantidad a 10,000,001", "Change the quantity to 3.5", "Serán 10000001 compresores"])
    it(msg, async () => {
      startCase();
      const v0 = caseVersion();
      const { reply } = chat([msg]);
      expect(reply).not.toMatch(/Actualizado|Updated/);
      await expectCase({ product: C, quantity: 4, budget: 5000 }, reply);
      expect(caseVersion().rev).toBe(v0.rev);
    });
  it("form rejects them too", () => {
    for (const v of ["0", "-1", "3.5", "10000001"]) expect(fieldError("quantity", v)).not.toBe("");
  });
  it("writeCaseTx itself refuses out-of-range values (no caller can bypass the chat validation)", async () => {
    startCase();
    for (const q of [0, -1, 3.5, 10_000_001, NaN, Infinity]) expect(writeCaseTx({ quantity: q }).ok).toBe(false);
    for (const b of [0, -5, 100_000_001, NaN]) expect(writeCaseTx({ budget: b }).ok).toBe(false);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

describe("R03 · empty, ambiguous, ranges, scientific notation, ES/EN formats", () => {
  const rows: [string, "es" | "en", number, RegExp][] = [
    ["Cambia la cantidad a", "es", 4, /No indicaste la nueva cantidad/],
    ["Serán 5 o 6 compresores", "es", 4, /no es una cantidad exacta/],
    // (the chat's range answer, documented in tests/audit-2026-10-29: "Escribiste un rango…")
    ["Necesito entre 5 y 10 unidades", "es", 4, /no es una cantidad exacta|rango/],
    ["La cantidad serán unos 8 compresores", "es", 4, /no es una cantidad exacta/],
    ["Cambia la cantidad a 5e2", "es", 4, /notación/],
    ["Cambia la cantidad a 1e3 unidades", "es", 4, /notación/],
    ["Serán 5E2 compresores", "es", 4, /notación/],
    ["La cantidad es 10^3", "es", 4, /notación/],
    ["Change the quantity to 5e2", "en", 4, /notation/],
    ["Cambia la cantidad a 1,000", "es", 1000, /4 → 1,000/],
    ["Cambia la cantidad a 1.000", "es", 1000, /4 → 1,000/],
    ["Change the quantity to 1,000", "en", 1000, /4 → 1,000/],
    ["Cambia la cantidad a 3,5", "es", 4, /fraccionarias/],
  ];
  for (const [msg, lang, q, re] of rows)
    it(`${msg} → ${q}`, async () => {
      startCase("4", "5000", C, lang);
      const { reply } = chat([msg]);
      expect(reply).toMatch(re);
      await expectCase({ product: C, quantity: q, budget: 5000 }, reply);
    });
  it("budget in notation is not read partially", async () => {
    startCase();
    const { reply } = chat(["Cambia el presupuesto a 5e3"]);
    expect(reply).toMatch(/notación/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("an empty message changes nothing", async () => {
    startCase();
    chat([""]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

describe("R04/R05/R06 · single-field corrections keep everything else literally", () => {
  it("R04 quantity 3 → 4", async () => {
    startCase("3");
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad de 3 a 4"]).reply);
  });
  it("R05 budget → US$5,000", async () => {
    startCase("3", "4500");
    await expectCase({ product: C, quantity: 3, budget: 5000 }, chat(["Solo actualiza el presupuesto a US$5,000"]).reply);
  });
  it("R06 tank 500 → 300 L, nothing else", async () => {
    startCase("3");
    await expectCase({ product: withTank("300 litros"), quantity: 3, budget: 5000 }, chat(["Cambia la capacidad del tanque de 500 a 300 litros"]).reply);
  });
  it("voltage, capacity, price or packing numbers are never the order quantity", async () => {
    startCase();
    for (const m of ["Solo cambia el voltaje a 440 V", "¿Cuánto cuesta cada uno a US$1,200?", "Vienen 2 por caja"]) chat([m]);
    const s = currentCase();
    expect(s.quantity).toBe(4);
    expect(s.budget).toBe(5000);
  });
});

describe("R07 · consecutive and rejected corrections", () => {
  it("valid → invalid → valid: each builds on the saved case; a rejection changes nothing", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad a 4"], specs).reply);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad a 4.5"], specs).reply);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, chat(["Cambia la cantidad a 5e2"], specs).reply);
    await expectCase({ product: C, quantity: 4, budget: 6000 }, chat(["Actualiza el presupuesto a US$6,000"], specs).reply);
    await expectCase({ product: withTank("300 litros"), quantity: 4, budget: 6000 }, chat(["Solo cambia el tanque a 300 litros"], specs).reply);
    await expectCase({ product: withTank("300 litros"), quantity: 7, budget: 6000 }, chat(["Cambia la cantidad a 7"], specs).reply);
  });
});

describe("R08 · prohibitions, hypotheses, confirmation before/after (defects 1, 2)", () => {
  it("D1 'Cambia la cantidad a 7, pero pídeme confirmación antes de cambiarla' → pending, not applied; 'sí' applies 7", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    const r1 = chat(["Cambia la cantidad a 7, pero pídeme confirmación antes de cambiarla"], specs).reply;
    expect(r1).toMatch(/no cambié nada/i);
    expect(r1).toMatch(/cantidad 7/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, r1);
    expect(readPending()?.proposal.quantity).toBe(7);
    const r2 = chat(["Sí, aplícalo"], specs).reply;
    expect(r2).toMatch(/cantidad 4 → 7/);
    await expectCase({ product: C, quantity: 7, budget: 5000 }, r2);
    expect(readPending()).toBeNull();
  });
  for (const msg of [
    "Cambia la cantidad a 7, pero antes confírmame",
    "Cambia la cantidad a 7; pedime confirmación primero",
    "Cambia la cantidad a 7, no lo apliques sin mi confirmación",
    "Change the quantity to 7 but ask me before changing it",
    "Set the quantity to 7, wait for my confirmation",
  ])
    it(`confirm-first variant: ${msg}`, async () => {
      startCase();
      chat([msg]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
      expect(readPending()?.proposal.quantity).toBe(7);
    });
  it("a pending proposal is not applied by an unrelated message, nor by a late 'sí'", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    chat(["¿Qué documentos necesito?"], specs);
    expect(readPending()).toBeNull();
    chat(["sí"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("R24 confirmation after the case changed elsewhere (form): asked again, not applied", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    // the client changes the budget in the form meanwhile
    const f = formStart("").formData;
    formTyped(f.productType, f.quantity, "8000");
    const r = chat(["sí"], specs).reply;
    expect(r).toMatch(/cambió desde que te propuse/);
    await expectCase({ product: C, quantity: 4, budget: 8000 }, r);
    // confirmed again on the new state: applied
    const r2 = chat(["sí, aplícalo"], specs).reply;
    await expectCase({ product: C, quantity: 7, budget: 8000 }, r2);
  });
  it("a proposal of another case (new case started) is never applied", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    // stale pending record left by an older page version, bound to another case id
    const p = readPending()!;
    clearDraft();
    formTyped("termos de acero inoxidable 304 de 500 ml", "10", "300");
    store[PENDING_KEY] = JSON.stringify(p);
    chat(["sí"], specs);
    await expectCase({ product: "termos de acero inoxidable 304 de 500 ml", quantity: 10, budget: 300 });
  });
  it("'sí, pero cambia la cantidad a 9' after a proposal: a new instruction (9), not the old proposal", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    await expectCase({ product: C, quantity: 9, budget: 5000 }, chat(["Sí, pero cambia la cantidad a 9"], specs).reply);
    expect(readPending()).toBeNull();
  });
  for (const msg of ["Cambia la cantidad a 7 sin preguntarme", "Change the quantity to 7 without asking me"])
    it(`"without asking me" applies directly: ${msg}`, async () => {
      startCase();
      await expectCase({ product: C, quantity: 7, budget: 5000 }, chat([msg]).reply);
    });
  it("'no lo apliques sin mi confirmación' / \"don't apply it without my approval\" → pending", async () => {
    for (const msg of ["Cambia la cantidad a 7 y no lo apliques sin mi confirmación", "Change the quantity to 7 and don't apply it without my approval"]) {
      startCase();
      chat([msg]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
      expect(readPending()?.proposal.quantity).toBe(7);
    }
  });
  for (const [msg, lang] of [
    ["Do not update the quantity to 8", "en"],
    ["Don't change the quantity to 8", "en"],
    ["No cambies la cantidad a 8", "es"],
    ["No quiero que cambies la cantidad a 8", "es"],
    ["No pongas 8 en la cantidad", "es"],
    ["Never set the quantity to 8", "en"],
  ] as const)
    it(`D2 prohibition: ${msg}`, async () => {
      startCase("4", "5000", C, lang);
      const { reply } = chat([msg]);
      expect(reply).toMatch(lang === "en" ? /As you asked, I didn't change/ : /Como pediste, no cambié/);
      await expectCase({ product: C, quantity: 4, budget: 5000 }, reply);
      expect(readPending()).toBeNull();
    });
  it("a prohibition on one field does not block a requested change on another", async () => {
    startCase();
    await expectCase({ product: C, quantity: 6, budget: 5000 }, chat(["Cambia la cantidad a 6, no cambies el presupuesto"]).reply);
    startCase();
    const r = chat(["Actualiza el presupuesto a US$7,000 pero no cambies la cantidad a 9"]).reply;
    expect(r).toMatch(/no cambié la cantidad/);
    await expectCase({ product: C, quantity: 4, budget: 7000 }, r);
  });
  it("'no cambies nada más' keeps the rest; the named field changes", async () => {
    startCase();
    await expectCase({ product: C, quantity: 6, budget: 5000 }, chat(["Actualiza la cantidad a 6 y no cambies nada más"]).reply);
  });
  for (const msg of ["¿Y si fueran 8 compresores?", "Suponiendo un presupuesto de US$9,000, ¿alcanza?", "What if I ordered 9 units?", "¿El tanque de 300 litros sirve?"])
    it(`hypothesis/question changes nothing: ${msg}`, async () => {
      startCase();
      chat([msg]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
});

describe("R09 · the two original messages, exact", () => {
  it("S1 then S2 alone", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    const a = chat([S1], specs).reply;
    expect(a).toMatch(/fraccionarias/);
    expect(a).not.toMatch(/Actualizado|→ 5|cantidad 5/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, a);
    expect(readPending()).toBeNull();
    const b = chat([S2], specs).reply;
    expect(b).toMatch(/10,000,000/);
    expect(b).not.toMatch(/Actualizado|lápices|cajas/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, b);
  });
});

describe("R10 · math, then a correction of the case", () => {
  it("pencils math, then S2: rejected by the maximum; the math is not reused", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    expect(chat([MATH], specs).reply).toMatch(/42 cajas/);
    const b = chat([S2], specs).reply;
    expect(b).toMatch(/10,000,000/);
    expect(b).not.toMatch(/lápices|cajas|Necesitarías/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, b);
  });
  it("pencils math, then a valid correction applies to the case", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat([MATH], specs);
    const r = chat(["Corrijo: serán 6 compresores; actualiza solo la cantidad."], specs).reply;
    expect(r).not.toMatch(/lápices|cajas/);
    await expectCase({ product: C, quantity: 6, budget: 5000 }, r);
  });
});

describe("R11 · hypothetical and real product change (defect 4)", () => {
  it("D4 '¿Y si cambio de producto: ahora quiero importar bombas industriales?' changes nothing", async () => {
    startCase();
    const { reply } = chat(["¿Y si cambio de producto: ahora quiero importar bombas industriales?"]);
    expect(reply).toMatch(/hipotética/);
    await expectCase({ product: C, quantity: 4, budget: 5000 }, reply);
  });
  it("EN hypothesis: 'What if I switch products: now I want to import industrial pumps?'", async () => {
    startCase("4", "5000", C, "en");
    chat(["What if I switch products: now I want to import industrial pumps?"]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("a real change does not inherit incompatible attributes, quantity or budget", async () => {
    startCase();
    const { reply } = chat(["Ahora quiero importar bombas industriales"]);
    expect(reply).toMatch(/bombas industriales/);
    const s = await expectCase({ product: "bombas industriales" });
    expect(String(s.body.product)).not.toMatch(/500 litros|220 V/);
    // the previous product's data is history, never current
    expect((s.body.earlier as string[] | undefined)?.join(" ") || "").toMatch(/compresores/);
  });
  it("prohibited product change: 'no cambies el producto' keeps it", async () => {
    startCase();
    chat(["No cambies el producto a bombas industriales"]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

describe("R12 · two independent conversations / new case", () => {
  it("a new case starts without the previous case's data, pending proposal or history", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7", "Cambia el presupuesto a 9000, pero pídeme confirmación antes"], specs);
    const id1 = caseVersion().caseId;
    clearDraft();
    expect(readPending()).toBeNull();
    formTyped("termos de acero inoxidable 304 de 500 ml", "", "");
    expect(caseVersion().caseId).not.toBe(id1);
    const r = chat(["sí"], []);
    expect(r.reply).not.toMatch(/compresor|cantidad 7|9,000/);
    const s = await expectCase({ product: "termos de acero inoxidable 304 de 500 ml" });
    expect(JSON.stringify(s.body)).not.toMatch(/compresor/);
  });
});

describe("R13 · rapid messages and out-of-order rendering", () => {
  it("rapid consecutive messages each build on the saved case", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 4", "Actualiza el presupuesto a US$6,000", "Cambia la cantidad a 9.5", "Cambia la cantidad a 5", "No cambies la cantidad a 8"], specs);
    await expectCase({ product: C, quantity: 5, budget: 6000 });
  });
  it("re-rendering stored replies later (out of order / reload) states each turn's saved case, never newer data", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    const { replies } = chat(["Cambia la cantidad a 3.5", "Cambia la cantidad a 6", "Cambia el presupuesto a US$7,000"], specs);
    const shuffled = [2, 0, 1].map((i) => c.buildReply(JSON.parse(JSON.stringify(specs[i]))));
    expect(shuffled).toEqual([replies[2], replies[0], replies[1]]);
    expect(replies[0]).toMatch(/cantidad 4;/);
  });
  it("a write based on an old version is refused (compare-and-set)", async () => {
    startCase();
    const v = caseVersion().rev;
    expect(writeCaseTx({ quantity: 6 }, { expectRev: v }).ok).toBe(true);
    const late = writeCaseTx({ quantity: 9 }, { expectRev: v });
    expect(late.ok).toBe(false);
    expect(late.conflict).toBe(true);
    await expectCase({ product: C, quantity: 6, budget: 5000 });
  });
});

describe("R14 · duplicates and network errors", () => {
  it("the same message applied twice is idempotent (no double change)", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 6", "Cambia la cantidad a 6"], specs);
    await expectCase({ product: C, quantity: 6, budget: 5000 });
    expect(c.buildReply(specs[1])).not.toMatch(/→ 6/);
  });
  it("network down / server 500: no case number, no conversion, the case stays intact", async () => {
    startCase();
    for (const mode of ["down", "500"] as const) {
      net = mode;
      const r = await sendToSeal({ requestType: "QA", source: "chat", name: "PRUEBA QA", email: "qa-prueba@example.com" });
      expect(r.ok).toBe(false);
      expect(r.id).toBeUndefined();
      expect(store.seal_last_case).toBeUndefined();
    }
    net = "ok";
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

describe("R16 · damaged history and drafts", () => {
  for (const [label, raw] of [
    ["draft not JSON", "{oops"],
    ["draft array", "[1,2]"],
    ["formData string", JSON.stringify({ formData: "abc", step: 2 })],
    ["quantity as object", JSON.stringify({ formData: { productType: C, quantity: { n: 4 }, budget: "5000" }, step: 2 })],
  ] as const)
    it(`${label}: no crash, nothing invented`, () => {
      reset();
      store[DRAFT_KEY] = raw;
      expect(() => currentCase()).not.toThrow();
      expect(() => formStart("")).not.toThrow();
      const cur = currentCase();
      expect(cur.quantity === undefined || cur.quantity === 4).toBe(true);
      expect(JSON.stringify(cur)).not.toMatch(/object Object/);
      // the chat can still write a valid case over it
      chat(["Quiero importar compresores industriales de tornillo de 220 V"]);
      expect(currentCase().product).toMatch(/compresores/);
    });
  it("damaged stored case / pending record: ignored, rebuilt from the draft", async () => {
    startCase();
    store.seal_case = '["x"]';
    store[PENDING_KEY] = "{bad";
    expect(readPending()).toBeNull();
    repairCase();
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("stale mirror (interrupted older write): repairCase realigns it with the draft", async () => {
    startCase();
    const sc = JSON.parse(store.seal_case);
    store.seal_case = JSON.stringify({ ...sc, quantity: "99", rev: 0 });
    repairCase();
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});

describe("R17 · partial and total storage failures (defect 6)", () => {
  it("D6 partial: the draft write succeeds and the case for SEAL fails → everything rolled back, no success announced", async () => {
    startCase();
    const v0 = caseVersion();
    const draft0 = store[DRAFT_KEY];
    storage.setItem = (k: string, v: string) => {
      if (k === "seal_case") throw new Error("QuotaExceededError");
      store[k] = v;
    };
    const { reply } = chat(["Cambia la cantidad a 6"]);
    Object.assign(storage, base);
    expect(reply).toMatch(/No pude guardar/);
    expect(reply).not.toMatch(/Actualizado/);
    expect(store[DRAFT_KEY]).toBe(draft0);
    expect(caseVersion()).toEqual(v0);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("partial on the product pointer: rolled back too", async () => {
    startCase();
    storage.setItem = (k: string, v: string) => {
      if (k === "seal_product") throw new Error("quota");
      store[k] = v;
    };
    const { reply } = chat(["Ahora quiero importar bombas industriales"]);
    Object.assign(storage, base);
    expect(reply).toMatch(/No pude guardar/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("silent write loss (setItem returns but value not stored) is detected by read-back", async () => {
    startCase();
    storage.setItem = (k: string, v: string) => {
      if (k !== "seal_case") store[k] = v;
    };
    const { reply } = chat(["Cambia la cantidad a 6"]);
    Object.assign(storage, base);
    expect(reply).toMatch(/No pude guardar/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("total failure (all writes throw): nothing announced, case unchanged", async () => {
    startCase();
    storage.setItem = () => {
      throw new Error("blocked");
    };
    const { reply } = chat(["Cambia la cantidad a 6"]);
    Object.assign(storage, base);
    expect(reply).toMatch(/No pude guardar/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("storage unreadable: reads never throw", () => {
    reset();
    storage.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(() => currentCase()).not.toThrow();
    expect(() => caseVersion()).not.toThrow();
    expect(writeCaseTx({ product: C, quantity: 4 }).ok).toBe(false);
    Object.assign(storage, base);
  });
  it("a pending proposal that cannot be stored is not offered", () => {
    startCase();
    storage.setItem = (k: string, v: string) => {
      if (k === PENDING_KEY) throw new Error("quota");
      store[k] = v;
    };
    const { reply } = chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"]);
    Object.assign(storage, base);
    expect(reply).not.toMatch(/sí, aplícalo/);
    expect(currentCase().quantity).toBe(4);
  });
});

describe("R18/R19/R25 · chat → form → chat, reload, new case, stale screens", () => {
  it("chat → form → chat with reload keeps exactly the saved case", async () => {
    startCase("3");
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 4"], specs);
    const f = formStart("").formData;
    formTyped(f.productType, f.quantity, "7000");
    const reloaded = JSON.parse(JSON.stringify(specs));
    const r = chat(["Cambia la cantidad a 2.5"], reloaded).reply;
    await expectCase({ product: C, quantity: 4, budget: 7000 }, r);
    const r2 = chat(["Cambia la cantidad a 5"], reloaded).reply;
    await expectCase({ product: C, quantity: 5, budget: 7000 }, r2);
  });
  it("R25 a stale form (loaded before a chat change) cannot overwrite the newer case", async () => {
    startCase();
    const loadedRev = caseVersion().rev;
    chat(["Cambia la cantidad a 6"]);
    const stale = saveFormDraft({ productType: C, quantity: "4", budget: "5000", destination: "GT", volumeCbm: "", weightKg: "" }, 2, null, loadedRev);
    expect(stale.ok).toBe(false);
    expect(stale.conflict).toBe(true);
    await expectCase({ product: C, quantity: 6, budget: 5000 });
  });
  it("new case after clearDraft: version and id restart; nothing inherited", () => {
    startCase();
    const id = caseVersion().caseId;
    clearDraft();
    expect(currentCase()).toEqual({ product: "" });
    formTyped("guantes de nitrilo talla M", "2000", "");
    expect(caseVersion().caseId).not.toBe(id);
    expect(currentCase()).toEqual({ product: "guantes de nitrilo talla M", quantity: 2000 });
  });
});

describe("R20 · visible summary = payload", () => {
  it("after a mixed sequence, summary, mirror and payload match field by field; no internal counters leak", async () => {
    startCase();
    chat(["Cambia la cantidad a 6", "Cambia la cantidad a 3.5", "Actualiza el presupuesto a US$7,000", "No cambies la cantidad a 9"]);
    const s = await expectCase({ product: C, quantity: 6, budget: 7000 });
    expect(s.body.rev).toBeUndefined();
    expect(s.body.caseId).toBeUndefined();
    const sum = caseForSeal({});
    for (const k of ["product", "quantity", "budget"]) expect(s.body[k]).toEqual(sum[k]);
  });
  it("an estimate made for other values goes as history, not as current", async () => {
    startCase();
    setCaseScenario({ supplierName: "Proveedor X", price: "US$900", totalCostText: "US$4,100", scenarioFor: { product: C, quantity: 4, budget: 5000 } }, [
      "supplierName",
      "price",
      "totalCostText",
      "scenarioFor",
    ]);
    chat(["Cambia la cantidad a 6"]);
    const s = await expectCase({ product: C, quantity: 6, budget: 5000 });
    expect(s.body.totalCostText).toBeUndefined();
    expect(String((s.body.earlier as string[]).join(" "))).toMatch(/ya no vigente/);
  });
});

describe("R22/R23 · ES/EN coherence and no unproven promises", () => {
  const PROMISES =
    /garantiz|garantía de|clasificaci[oó]n definitiva|verificad[oa] por SEAL|proveedor verificado|liberaci[oó]n asegurada|costo final|permiso aprobado|guarantee|guaranteed|verified supplier|final cost/i;
  const MSGS = [
    S1,
    S2,
    "Do not update the quantity to 8",
    "Cambia la cantidad a 7, pero pídeme confirmación antes de cambiarla",
    "Cambia la cantidad a 5e2",
    "¿Y si cambio de producto: ahora quiero importar bombas industriales?",
    "Cambia la cantidad a 6",
  ];
  it("Spanish replies stay Spanish; English stay English; none promises", () => {
    for (const lang of ["es", "en"] as const)
      for (const m of MSGS) {
        startCase("4", "5000", C, lang);
        const r = chat([m]).reply;
        expect(r).not.toMatch(PROMISES);
        if (lang === "en") expect(r, m).not.toMatch(/\b(?:No cambié|Tu caso|cantidad \d|presupuesto de compra|Actualizado)\b/);
        else expect(r, m).not.toMatch(/\b(?:I didn't|Your case|Updated:)\b/);
      }
  });
  it("the chat itself never sends anything to SEAL (only the explicit button does)", () => {
    startCase();
    sent.length = 0;
    chat([...MSGS, "Quiero hablar con un ejecutivo de SEAL"]);
    expect(sent.length).toBe(0);
  });
});

describe("R27 · independent adversarial review (29-b): every reported bypass, as a permanent test", () => {
  const applied: [string, number][] = [
    ["Cambia la cantidad a siete", 7],
    ["Cambia la cantidad a ocho", 8],
    ["Cambia la cantidad a tres", 3],
    ["Cambia la cantidad a diez", 10],
    ["Change the quantity to seven", 7],
    // false positives found by the review: legitimate requests must apply
    ["Cambia la cantidad a 8 sin cambiar nada más", 8],
    ["Cambia la cantidad a 7 si es posible", 7],
    ["Cambiá la cantidad a 7 y si podés mandame la cotización", 7],
    ["¿Puedes cambiar la cantidad a 6?", 6],
  ];
  for (const [msg, q] of applied)
    it(`applied: ${msg} → ${q}`, async () => {
      startCase();
      await expectCase({ product: C, quantity: q, budget: 5000 }, chat([msg]).reply);
    });
  const unchanged = [
    "Cambia la cantidad a 10 000 001",
    "Cambia la cantidad a 10'000,001",
    "Cambia la cantidad a 15/2",
    "Cambia la cantidad a 7½",
    "Cambia la cantidad a 7-8",
    "Cambia la cantidad a 7 a 8",
    "Cambia la cantidad a 7 u 8",
    "Cambia la cantidad a 7~8",
    "Cambia la cantidad a 7+",
    "Cambia la cantidad a 7 aprox",
    "Cambia la cantidad a 5·10²",
    "No quiero 8 compresores",
    "Ni se te ocurra poner 8 unidades",
    "8 compresores no",
    "Nada de 8 unidades",
    "Evita cambiar la cantidad a 8",
    "Avoid changing the quantity to 8",
    "Not 8 units, please",
    "Imaginemos que son 8 compresores",
    "Digamos que son 8 compresores",
    "Supón 8 unidades",
    "En caso de que fueran 8 compresores, ¿cambia algo?",
    "Let's say the quantity is 8",
    "Hypothetically 8 units",
    "¿Serán 8 compresores?",
    "Cambia la cantidad a 300 litros",
    "Cambia el presupuesto a 5000-6000",
  ];
  for (const msg of unchanged)
    it(`not applied: ${msg}`, async () => {
      startCase();
      const { reply } = chat([msg]);
      expect(reply).not.toMatch(/Actualizado/);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  it("hypothetical product change in another wording keeps the product", async () => {
    startCase();
    chat(["Pensando en cambiar de producto: ahora quiero importar bombas centrífugas, ¿conviene?"]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  const pending = [
    "Cambia la cantidad a 7, pero antes de cambiarla avisame",
    "Cambia la cantidad a 7, pero esperá mi confirmación",
    "Cambia la cantidad a 7 pero quiero confirmarlo antes",
    "Cambia la cantidad a 7, pero avisame antes de aplicarlo",
    "Cambia la cantidad a 7, avísame antes",
    "Cambia la cantidad a 7. Primero confirmame.",
    "Cambia la cantidad a 7 pero quiero aprobarlo yo",
    "Cambia la cantidad a 7 pero no sin antes preguntarme",
    "Change the quantity to 7, pending my approval",
    "Change the quantity to 7 once I confirm",
    "Cambia la cantidad a 7 pero no lo apliques todavía",
  ];
  for (const msg of pending)
    it(`proposed, not applied: ${msg}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat([msg], specs);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
      expect(readPending()?.proposal.quantity).toBe(7);
      await expectCase({ product: C, quantity: 7, budget: 5000 }, chat(["sí, aplícalo"], specs).reply);
    });
  it("a prohibition on one characteristic does not block another: tank changes, voltage kept", async () => {
    startCase();
    await expectCase({ product: withTank("300 litros"), quantity: 4, budget: 5000 }, chat(["Cambia el tanque a 300 litros, no cambies el voltaje"]).reply);
    startCase();
    chat(["Cambia el voltaje a 440 V, no cambies el voltaje"]);
    expect(currentCase().product).toBe(C);
  });
});

describe("R28 · second adversarial pass (29-b)", () => {
  for (const msg of [
    "No quiero 8 compresores",
    "Nada de 8 unidades",
    "Evita cambiar la cantidad a 8",
    "Not 8 units, please",
    "Quizás 8 compresores",
    "Maybe 8 units",
    "¿Serán 8 compresores?",
    "Creo que serán 8 compresores",
    "Could be 8 units",
  ])
    it(`refusal / doubt is never applied, not even by a later "sí": ${msg}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat([msg], specs);
      expect(readPending()).toBeNull();
      chat(["sí"], specs);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  it("'En realidad son 7 unidades, no 4' is a quantity correction, never a product named «unidades, no 4»", async () => {
    startCase();
    chat(["En realidad son 7 unidades, no 4"]);
    const cur = currentCase();
    expect(cur.product).toBe(C);
    expect(cur.budget).toBe(5000);
    expect([4, 7]).toContain(cur.quantity);
  });
  it("a conditional after a proposal is not a confirmation", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    chat(["si no es mucha molestia"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  for (const yes of ["dale", "ok", "va, aplícalo", "sí", "Sí, aplícalo", "yes", "listo"])
    it(`Guatemalan / common confirmation applies a pending proposal: ${yes}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
      await expectCase({ product: C, quantity: 7, budget: 5000 }, chat([yes], specs).reply);
    });
  it("product change with confirm-first is asked; 'sí' applies it", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Ahora quiero importar bombas centrífugas, pero confirmame antes"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
    chat(["sí"], specs);
    expect(currentCase().product).toMatch(/^bombas centrífugas/);
  });
  it("'Corrijo: no son 4 sino 7 compresores': 7, or asked with nothing changed — never another value", async () => {
    startCase();
    chat(["Corrijo: no son 4 sino 7 compresores"]);
    const cur = currentCase();
    expect([4, 7]).toContain(cur.quantity);
    await expectCase({ product: C, quantity: cur.quantity, budget: 5000 });
  });
  it("'de 7 a 8' when the case has 4: asked, not applied", async () => {
    startCase();
    const { reply } = chat(["Cambia la cantidad de 7 a 8"]);
    expect(reply).toMatch(/tu caso tiene 4/);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  const ok: [string, Exp][] = [
    ["No, la cantidad es 7", { product: C, quantity: 7, budget: 5000 }],
    ["No, serán 7 compresores", { product: C, quantity: 7, budget: 5000 }],
    ["¿Me cambiás la cantidad a 7?", { product: C, quantity: 7, budget: 5000 }],
    ["Cambia la cantidad a 7, ¿ok?", { product: C, quantity: 7, budget: 5000 }],
    ["Cambiá la cantidad a 7 cuando puedas", { product: C, quantity: 7, budget: 5000 }],
    ["Cambia la cantidad a 7, no necesito más", { product: C, quantity: 7, budget: 5000 }],
    ["Change the quantity to 7, no rush", { product: C, quantity: 7, budget: 5000 }],
    ["Subí el presupuesto a 6000, no a 7000", { product: C, quantity: 4, budget: 6000 }],
    ["Cambia el tanque a 300 litros pero no el voltaje", { product: withTank("300 litros"), quantity: 4, budget: 5000 }],
    ["Cambia el tanque a 300 litros, el voltaje no", { product: withTank("300 litros"), quantity: 4, budget: 5000 }],
    ["Cambia el tanque a 300 litros sin tocar el voltaje", { product: withTank("300 litros"), quantity: 4, budget: 5000 }],
    ["Cambia la cantidad a 7 sin tocar el presupuesto", { product: C, quantity: 7, budget: 5000 }],
    ["Cambia la cantidad a 7 y no a 8", { product: C, quantity: 7, budget: 5000 }],
  ];
  for (const [msg, exp] of ok)
    it(`legitimate request applies: ${msg}`, async () => {
      startCase();
      await expectCase(exp, chat([msg]).reply);
    });
});

describe("R29 · third adversarial pass (29-b): safety", () => {
  const never = [
    "A lo mejor 8 compresores",
    "Puede que sean 8 compresores",
    "Igual 8 compresores",
    "Podrían ser 8 compresores",
    "Deberían ser 8 compresores",
    "Habría que pedir 8 compresores",
    "Ojalá fueran 8 compresores",
    "8 compresores (tentativo)",
    "Cantidad: 8 (tentativa)",
    "Para el próximo pedido serán 8 compresores",
    "El año que viene serán 8 compresores",
    "Antes eran 8 compresores",
    "La vez pasada fueron 8 compresores",
    "Tenía 8 compresores",
    "Otro cliente pidió 8 compresores",
    "Olvidate de los 8 compresores",
    "Cancelá lo de 8 compresores",
    "No 8, no 9 compresores",
    "Menos de 8 compresores",
    "Más de 8 compresores",
    "Máximo 8 compresores",
    "Mínimo 8 compresores",
    "8 compresores o menos",
    "~8 units",
    "Cantidad: 8, 9",
    "Cantidad 8 9",
    "Cantidad: 8 lotes",
    "Cantidad: 2 contenedores",
    "Hasta 8 compresores",
    "Cuando sean 8 compresores avisame",
  ];
  for (const msg of never)
    it(`never applied (not even after "sí"): ${msg}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat([msg], specs);
      chat(["sí"], specs);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  for (const not of ["sí?", "sí, aunque espera", "si no es mucha molestia", "sí, 7", "sí claro, pero mejor no"])
    it(`not a plain confirmation: ${not}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
      chat([not], specs);
      expect(currentCase().quantity).toBe(4);
    });
  it("'Quizás bombas centrífugas' + 'sí': product unchanged", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Quizás bombas centrífugas", "sí"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  it("confirm-first product change: the confirmed product is only the product name", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Ahora quiero importar bombas centrífugas, pero confirmame antes", "sí"], specs);
    expect(currentCase().product).toBe("bombas centrífugas");
  });
  it("'Olvida el molino: necesito importar…' still changes the product (a product correction)", () => {
    startCase();
    chat(["Olvida el molino: necesito importar bombas centrífugas de 5 HP"]);
    expect(currentCase().product).toMatch(/^bombas centrífugas/);
  });
});

describe("R30 · fourth adversarial pass (29-b): applied only when fully understood", () => {
  const never = [
    "Cambia la cantidad a 7 o a 8",
    "Cambia la cantidad a 7 o sea 8",
    "Cambia la cantidad a 7 digo 8",
    "Cambia la cantidad a 7, perdón 8",
    "Cambia la cantidad a 7 o algo así",
    "Cambia la cantidad a 7 o lo que sea",
    "Cambia la cantidad a 7 como mucho",
    "Cambia la cantidad a 7, máximo",
    "Cambia la cantidad a 7 a lo sumo",
    "Cambia la cantidad a 7 mañana",
    "Cambia la cantidad a 7, era broma",
    "Cambia la cantidad a 7 — nah, dejalo en 4",
    "Cambia la cantidad a 7 (2 de repuesto)",
    "Cambia la cantidad a 7 por 2",
    "Change the quantity to 7, roughly",
    "Change the quantity to 7, just kidding",
    "Si alcanza, cambia la cantidad a 7",
    "Si el precio baja, cambia la cantidad a 7",
    "En ese caso, cambia la cantidad a 7",
    "Si alcanza, cambia el tanque a 300 litros",
    "Si me prestan, el presupuesto será 7000",
    "Mi socio quiere 7 compresores",
    "Mi cliente necesita 7 compresores",
    "Mi hermano compró 7 compresores",
    "Un amigo importó 7 compresores",
    "My boss wants 7 units",
    "El otro año serán 7 compresores",
    "En diciembre serán 7 compresores",
    "Más adelante serán 7 compresores",
    "El presupuesto es unos 7000",
    "El presupuesto es 7000 o algo así",
    "El presupuesto es 7000 máximo",
    "El presupuesto es 7000 como mucho",
    "El presupuesto es 7000 o a 8000",
    "El presupuesto es 7000 digo 8000",
    "El presupuesto es 7000, era broma",
    "The budget is about 7000",
    "El presupuesto es 7000 euros",
    "El presupuesto es 7000 pesos",
    "El presupuesto es 7000 MXN",
    "Budget: 7000 CAD",
    "El presupuesto es 7000 por unidad",
    "El presupuesto es 1500 por compresor",
    "El presupuesto es 7000 al mes",
    "Mi socio tiene un presupuesto de 7000",
    "Cambia el tanque a 300 litros o 400 litros",
    "Cambia el voltaje a 440 V o 220 V",
  ];
  for (const msg of never)
    it(`not applied: ${msg}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat([msg, "sí"], specs);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  const junkProducts = [
    "Ahora quiero importar bombas centrífugas, ¿cuánto pagan de DAI?",
    "Ahora quiero importar bombas centrífugas jaja",
    "Ahora quiero importar bombas centrífugas, era broma",
    "Ahora quiero importar bombas centrífugas, mi correo es a@b.com",
    "Ahora quiero importar bombas centrífugas https://alibaba.com/x",
    "Ahora quiero importar bombas centrífugas mañana",
    "También necesito bombas centrífugas",
    "Ahora quiero importar xxx",
    "Ahora quiero importar otro",
    "Cambia el producto a 300 litros",
    "Cambia el producto a bombas o compresores",
    "Si sale más barato, ahora quiero importar bombas centrífugas",
    "Mi socio quiere importar bombas centrífugas",
    "My partner wants centrifugal pumps",
  ];
  for (const msg of junkProducts)
    it(`product never saved with junk or from someone else / a condition: ${msg}`, async () => {
      startCase();
      const specs: c.ReplySpec[] = [];
      chat([msg, "sí"], specs);
      const cur = currentCase();
      expect(cur.product === C || cleanName(cur.product)).toBe(true);
      if (cur.product !== C) expect(cur.product).not.toMatch(/[?¿@]|https?:|jaja|broma|mañana|^litros$|\so\s/);
    });
  it("'sí, pero de 5 HP' is not a plain confirmation of a product proposal", () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Ahora quiero importar bombas centrífugas, pero confirmame antes", "sí, pero de 5 HP"], specs);
    expect(currentCase().product).not.toBe("bombas centrífugas");
  });
  it("a stored proposal that the previous reply did not offer (its removal failed) is never applied", async () => {
    startCase();
    const specs: c.ReplySpec[] = [];
    chat(["Cambia la cantidad a 7, pero pídeme confirmación antes"], specs);
    const kept = store[PENDING_KEY];
    chat(["¿Qué documentos necesito?"], specs);
    store[PENDING_KEY] = kept; // as if removeItem had thrown
    chat(["sí"], specs);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
});
const cleanName = (n: string) => c.cleanProductName(n);

describe("R31 · fifth adversarial pass (29-b): only orders, no retractions, no conflicting restatements", () => {
  const never = [
    "Cambiaría la cantidad a 7",
    "Cambiaríamos la cantidad a 7",
    "Pondría 7 unidades",
    "Cambié la cantidad a 7",
    "Cambiaste la cantidad a 7",
    "Cambió la cantidad a 7",
    "Cambiaron la cantidad a 7",
    "Subiría el presupuesto a 7000",
    "Bajaron el presupuesto a 4000",
    "Bajaría el tanque a 300 litros",
    "Cambiaron el tanque a 300 litros",
    "Cambia la cantidad a 7. Mentira.",
    "Cambia la cantidad a 7. Ocho.",
    "Cambia la cantidad a 7. Mejor 8",
    "Cambia la cantidad a 7. Ah, eso era otro pedido.",
    "El presupuesto es 7000. Mentira.",
    "Cambia el tanque a 300 litros. Mejor 400 litros.",
    "Change the quantity to 7. Kidding.",
    "Son 7 compresores con aceite",
    "Son 7 compresores de aceite",
    "Son 7 compresores de tornillo y de aceite",
    "Son 7 compresores de 2",
    "Son 7 compresores de 22",
    "Son 7 compresores de i",
    "I need 7 units of 20 v",
  ];
  for (const msg of never)
    it(`not applied: ${msg}`, async () => {
      startCase();
      chat([msg, "sí"]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  it("'Importaría bombas centrífugas' (conditional) does not change the product", async () => {
    startCase();
    chat(["Importaría bombas centrífugas", "sí"]);
    await expectCase({ product: C, quantity: 4, budget: 5000 });
  });
  for (const [msg, q] of [
    ["Son 7 compresores de tornillo", 7],
    ["Son 7 compresores de 220 V", 7],
    ["Cambiá la cantidad a 7", 7],
    ["Cámbiala a 7 unidades", 7],
    ["Pon la cantidad en 7", 7],
    ["Poné 7 unidades", 7],
  ] as const)
    it(`order still applies: ${msg}`, async () => {
      startCase();
      await expectCase({ product: C, quantity: q, budget: 5000 }, chat([msg]).reply);
    });
});

describe("R32 · sixth adversarial pass (29-b): increments are not totals; no zero characteristics", () => {
  const never = [
    "Sube 3 unidades",
    "Subí 3 unidades",
    "Aumenta 3 unidades",
    "Increase 3 units",
    "Baja 2 unidades",
    "Bajale 2 unidades",
    "Reduce 2 unidades",
    "Raise the quantity 3",
    "Aumenta el presupuesto en 2000",
    "Sube el presupuesto en 2000",
    "Subí el presupuesto 2000",
    "Increase the budget 2000",
    "Reduce el presupuesto en 1000",
    "Baja el tanque en 100 litros",
    "Sube el tanque en 100 litros",
    "Cambia el tanque a 0 litros",
    "Son 7 compresores de 0 hz",
    "Son 7 compresores de 0 litros",
    "Y 7 unidades",
  ];
  for (const msg of never)
    it(`not applied: ${msg}`, async () => {
      startCase();
      chat([msg, "sí"]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  for (const [msg, exp] of [
    ["Sube la cantidad a 7", { product: C, quantity: 7, budget: 5000 }],
    ["Sube el presupuesto a 7000", { product: C, quantity: 4, budget: 7000 }],
    ["Reduce el presupuesto a US$4,000", { product: C, quantity: 4, budget: 4000 }],
    ["Baja el tanque a 300 litros", { product: withTank("300 litros"), quantity: 4, budget: 5000 }],
  ] as [string, Exp][])
    it(`a moving verb with "a" sets the value: ${msg}`, async () => {
      startCase();
      await expectCase(exp, chat([msg]).reply);
    });
});

describe("R33 · seventh adversarial pass (29-b, 2,200-message grid)", () => {
  const msgs: string[] = [];
  for (const pre of ["Ahora", "Mejor"])
    for (const core of ["son 7 compresores", "quiero 7 compresores", "son 4 compresores de 300 litros", "son 4 compresores de 440 V"])
      for (const suf of [", gracias", " (aprox)", " para el otro pedido"]) msgs.push(`${pre} ${core}${suf}`);
  for (const core of ["Ayer tanque de 300 litros", "Ayer voltaje 440 V"]) for (const suf of ["", ", gracias", " por favor", "!"]) msgs.push(core + suf);
  for (const msg of msgs)
    it(`specs never lost, nothing from another time or order: ${msg}`, async () => {
      startCase();
      chat([msg, "sí"]);
      const cur = currentCase();
      expect(cur.product).toBe(C);
      expect(cur.budget).toBe(5000);
      if (/para el otro pedido|aprox|Ayer/.test(msg)) expect(cur.quantity).toBe(4);
    });
});

describe("R34 · eighth adversarial pass (29-b, 10,800-message grid)", () => {
  const never = [
    "Son 7 compresores, ¿verdad?",
    "Corrijo: el presupuesto es 7000, ¿verdad?",
    "Corrijo: tanque de 300 litros, ¿verdad?",
    "Mejor voltaje 440 V, ¿verdad?",
    "Cambia la cantidad a 7, ¿verdad?",
    "Según el proveedor tanque de 300 litros",
    "The supplier says voltaje 440 V",
    "Según el proveedor tanque de 300 litros, gracias",
    "The supplier says voltaje 440 V si se puede",
  ];
  for (const msg of never)
    it(`not applied: ${msg}`, async () => {
      startCase();
      chat([msg, "sí"]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
});

describe("R35 · ninth adversarial pass (29-b, 12,150-message grid)", () => {
  for (const msg of [
    "Dale, la cantidad es 7 🤔",
    "Porfa cambia el presupuesto a 7000 🤔",
    "👍 son 4 compresores de 440 V 🤔",
    "Supuestamente tanque de 300 litros xfa",
    "SUPUESTAMENTE VOLTAJE 440 V 🙏",
    "Cambia la cantidad a 7 😅",
  ])
    it(`not applied: ${msg}`, async () => {
      startCase();
      chat([msg, "sí"]);
      await expectCase({ product: C, quantity: 4, budget: 5000 });
    });
  it("thanks / OK emojis do not block a clear order", async () => {
    startCase();
    await expectCase({ product: C, quantity: 7, budget: 5000 }, chat(["Cambia la cantidad a 7 🙏"]).reply);
  });
});

// ── REGRESIÓN-PRODUCCIÓN 2026-10-30 · los tres casos reportados en v2026.10.28-n ──────────────────
// 1) Con 4 compresores, «La compra será de 3.5 compresores. No cambies nada hasta confirmar…» → 4 → 5.
// 2) «serían 10,000,001 compresores» aceptado y presente en el resumen para SEAL.
// 3) Presupuesto US$5,000 indicado al inicio: no quedó en el formulario ni en el resumen.
describe("R36 · regresión de producción (v2026.10.28-n): los tres casos reportados", () => {
  const START = "Quiero importar 4 compresores industriales de tornillo de 220 V con un presupuesto de US$5,000";
  const S1 = "La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.";
  const S2 = "serían 10,000,001 compresores";
  const P = "compresores industriales de tornillo de 220 V";
  /** what the start page does with the request (LandingPage handleStartAnalysis) */
  function startFromRequest(request: string) {
    reset();
    clearDraft();
    const f = requestFacts(request);
    expect(writeCaseTx({ product: f.product, quantity: f.quantity ?? null, budget: f.budget ?? null }).ok).toBe(true);
    return f;
  }
  it("3) el presupuesto y la cantidad del pedido inicial quedan en el caso, el formulario y el resumen", async () => {
    const f = startFromRequest(START);
    expect(f).toEqual({ product: P, quantity: 4, budget: 5000, issues: [] });
    await expectCase({ product: P, quantity: 4, budget: 5000 });
  });
  it("1) con 4 compresores, S1 no modifica nada (ni cantidad ni presupuesto)", async () => {
    startFromRequest(START);
    const r = chat([S1]).reply;
    expect(r).not.toMatch(/→ 5|cantidad 5|Actualizado/);
    expect(r).toMatch(/fraccionarias/);
    await expectCase({ product: P, quantity: 4, budget: 5000 }, r);
  });
  it("2) «serían 10,000,001 compresores» no se acepta ni aparece en el resumen para SEAL", async () => {
    startFromRequest(START);
    const r = chat([S2]).reply;
    expect(r).not.toMatch(/Actualizado/);
    const s = await expectCase({ product: P, quantity: 4, budget: 5000 });
    expect(JSON.stringify(s.body)).not.toMatch(/10,?000,?001/);
    expect(JSON.stringify(caseForSeal({}))).not.toMatch(/10,?000,?001/);
  });
  it("secuencia completa como en producción: inicio → S1 → S2 → chat, formulario, resumen y payload coinciden (4, US$5,000)", async () => {
    startFromRequest(START);
    const specs: c.ReplySpec[] = [];
    const { replies } = chat([S1, S2, "serán 10,000,001 compresores", "Cambia la cantidad a 3.5"], specs);
    for (const r of replies) expect(r).not.toMatch(/Actualizado/);
    await expectCase({ product: P, quantity: 4, budget: 5000 }, replies[replies.length - 1]);
  });
  it("variantes del pedido inicial: valores inválidos no entran al caso y se informan; el presupuesto válido sí", async () => {
    for (const [req, exp, issue] of [
      ["Quiero importar 3.5 compresores de tornillo con presupuesto de US$5,000", { product: "compresores de tornillo", budget: 5000 }, "quantity"],
      ["Quiero importar 10,000,001 compresores de tornillo, presupuesto US$5,000", { product: "compresores de tornillo", budget: 5000 }, "quantity"],
      ["Quiero importar 4 compresores de tornillo con presupuesto de unos 5000", { product: "compresores de tornillo", quantity: 4 }, "budget"],
      ["Quiero importar 4 compresores de tornillo, presupuesto Q40,000", { product: "compresores de tornillo", quantity: 4 }, "budget"],
      ["Compresores industriales de tornillo 220 V, 4 unidades, presupuesto US$5,000", { product: "Compresores industriales de tornillo 220 V", quantity: 4, budget: 5000 }, ""],
      ["I want to import 200 stainless steel thermos 500 ml, budget US$1,500", { product: "stainless steel thermos 500 ml", quantity: 200, budget: 1500 }, ""],
    ] as [string, Exp, string][]) {
      const f = startFromRequest(req);
      if (issue)
        expect(
          f.issues.map((x) => x.field),
          req,
        ).toContain(issue);
      else expect(f.issues, req).toEqual([]);
      await expectCase(exp);
    }
  });
  it("un presupuesto dicho junto con un producto nuevo en el chat se conserva", async () => {
    startCase();
    await expectCase({ product: "bombas centrífugas de 5 HP", quantity: 10, budget: 3000 }, chat(["Ahora quiero importar 10 bombas centrífugas de 5 HP con un presupuesto de US$3,000"]).reply);
  });
});

describe("R37 · formulario: una descripción normal del producto es válida (encontrado en la prueba de navegador 2026-10-30)", () => {
  for (const d of ["termos de acero inoxidable para cafetería", "compresores industriales de tornillo de 220 V", "guantes de nitrilo talla M sin polvo"])
    it(d, () => expect(fieldError("productType", d)).toBe(""));
  it("las demasiado cortas siguen pidiendo detalle", () => {
    expect(fieldError("productType", "abc")).not.toBe("");
    expect(fieldError("productType", "aaaa bbbb")).not.toBe("");
  });
});
