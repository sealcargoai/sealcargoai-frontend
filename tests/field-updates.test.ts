// Partial updates of the current case: a message that changes one field (tank capacity,
// quantity, budget, voltage…) changes only that field. Every test checks the field that
// changed AND the fields that must stay intact, in the reply and in the saved case
// (form draft and case sent to SEAL), the same data the form, the summary and the email use.
import { describe, it, expect, beforeEach } from "vitest";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
(globalThis as Record<string, unknown>).sessionStorage = storage;
(globalThis as Record<string, unknown>).localStorage = storage;
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as { document?: unknown }).document = { documentElement: { lang: "es" } };

const c = await import("../src/utils/chatReply");
const { applyChatMessage } = await import("../src/utils/chatCase");
const { DRAFT_KEY, draftFacts, saveProduct, clearDraft } = await import("../src/utils/draft");
const { caseContext, rememberCase } = await import("../src/utils/caseContext");

const D = "compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros, libres de aceite";
const SPECS = ["compresores industriales de tornillo", "trifásicos", "220 V", "60 Hz", "libres de aceite"];

/** The initial case of the report: typed in the form (product, 3 units, US$4,500.01), then the chat. */
function startCase(product = D, quantity = "3", budget = "4500.01") {
  for (const k of Object.keys(store)) delete store[k];
  store[DRAFT_KEY] = JSON.stringify({ formData: { productType: product, quantity, budget, destination: "GT" }, step: 2, prev: null });
  saveProduct(product);
  rememberCase({ product, quantity, budget: `US$${Number(budget).toLocaleString("en-US", { minimumFractionDigits: 2 })}` });
}
/** The chat page, message by message, with the same code the page runs. */
function chat(messages: string[]) {
  const specs: c.ReplySpec[] = [];
  const replies: string[] = [];
  for (const text of messages) {
    const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
    const spec = applyChatMessage(text, specs, { currentProduct: lastNamed?.newProduct || lastNamed?.mentioned || D, currentQuantity: c.quantityInForce(specs), startQuery: D });
    specs.push(spec);
    replies.push(c.buildReply(spec));
  }
  return { specs, replies, last: specs[specs.length - 1], reply: replies[replies.length - 1] };
}
const product = () => draftFacts().product || "";

describe("the four reported cases (reset between tests)", () => {
  beforeEach(() => startCase());
  for (const liters of ["300", "200"]) {
    it(`tank ${liters} L: quantity stays 3, the tank is ${liters} L, the rest intact`, () => {
      const { last, reply } = chat([`Mantengo los mismos compresores y las demás especificaciones. Solo cambia la capacidad del tanque: ${liters} litros en lugar de 500 litros. La cantidad sigue siendo 3.`]);
      expect(last.newQuantity).toBeUndefined();
      expect(last.caseNow?.quantity).toBe(3);
      expect(draftFacts().quantity).toBe("3");
      expect(product()).toBe(D.replace("500 litros", `${liters} litros`));
      for (const s of SPECS) expect(product()).toContain(s);
      expect(product()).not.toContain("500 litros");
      expect(draftFacts().budget).toBe("4500.01");
      expect(caseContext().quantity).toBe("3");
      expect(caseContext().product).toBe(product());
      expect(reply).toMatch(new RegExp(`«500 litros» ahora es «${liters} litros»`));
      expect(reply).toMatch(/cantidad 3;/);
      expect(reply).toMatch(/presupuesto de compra US\$4,500\.01/);
      expect(reply).not.toMatch(new RegExp(`cantidad ${liters}\\b`));
    });
  }
  it("'de 3 a 4 compresores': 4 units, full description, budget unchanged", () => {
    const { last, reply } = chat(["Cambia únicamente la cantidad del pedido de 3 a 4 compresores. No modifiques las especificaciones ni el presupuesto."]);
    expect(last.newQuantity).toBe(4);
    expect(last.newProduct).toBeUndefined();
    expect(last.mentioned).toBeUndefined();
    expect(product()).toBe(D);
    expect(draftFacts().quantity).toBe("4");
    expect(draftFacts().budget).toBe("4500.01");
    expect(caseContext().quantity).toBe("4");
    expect(caseContext().product).toBe(D);
    expect(reply).toMatch(/cantidad 3 → 4/);
    expect(reply).toContain(`«${D}»`);
    expect(reply).toMatch(/presupuesto de compra US\$4,500\.01/);
  });
  it("budget US$5,000: 3 units, full description, budget 5,000", () => {
    const { last, reply } = chat(["Solo actualiza el presupuesto de compra a US$5,000. La cantidad solicitada es 3 unidades y las especificaciones del compresor no cambian."]);
    expect(last.newBudget).toBe(5000);
    expect(last.newQuantity).toBeUndefined();
    expect(last.newProduct).toBeUndefined();
    expect(product()).toBe(D);
    expect(draftFacts().quantity).toBe("3");
    expect(draftFacts().budget).toBe("5000");
    expect(caseContext().budget).toBe("US$5,000");
    expect(caseContext().quantity).toBe("3");
    expect(reply).toMatch(/presupuesto de compra US\$4,500\.01 → US\$5,000/);
    expect(reply).toMatch(/cantidad 3;/);
    expect(reply).toContain(`«${D}»`);
  });
});

describe("other wordings and values", () => {
  beforeEach(() => startCase());
  const cases: [string, { tank?: string; qty: string; budget: string; volt?: string; hz?: string; ask?: boolean }][] = [
    ["Cambia el tanque a 300 litros", { tank: "300 litros", qty: "3", budget: "4500.01" }],
    ["La capacidad del tanque es de 250 litros, no de 500", { tank: "250 litros", qty: "3", budget: "4500.01" }],
    ["Cambia la capacidad a 300", { tank: "300 litros", qty: "3", budget: "4500.01" }],
    ["Tanque de 300 litros en vez de 500; misma cantidad", { tank: "300 litros", qty: "3", budget: "4500.01" }],
    ["Cambia la cantidad a 7", { qty: "7", budget: "4500.01" }],
    ["Mejor 4 compresores en lugar de 3", { qty: "4", budget: "4500.01" }],
    ["Sube el pedido de 3 a 5", { qty: "5", budget: "4500.01" }],
    ["Son 4 compresores, no 3", { qty: "4", budget: "4500.01" }],
    ["Ahora necesito 6 compresores", { qty: "6", budget: "4500.01" }],
    ["Ahora son 4 unidades", { qty: "4", budget: "4500.01" }],
    ["Change the quantity from 3 to 4", { qty: "4", budget: "4500.01" }],
    ["Presupuesto: US$6,250.50", { qty: "3", budget: "6250.5" }],
    ["El presupuesto es de 5000 dólares", { qty: "3", budget: "5000" }],
    ["Update the budget to $5,000", { qty: "3", budget: "5000" }],
    ["Solo cambia el voltaje a 440 V", { volt: "440 V", hz: "60 Hz", qty: "3", budget: "4500.01" }],
    ["Cambia el voltaje a 380", { volt: "380 V", hz: "60 Hz", qty: "3", budget: "4500.01" }],
    ["Cambia el voltaje de 220 a 440 V y la frecuencia a 50 Hz", { volt: "440 V", hz: "50 Hz", qty: "3", budget: "4500.01" }],
    ["Ya no quiero 500 litros, ahora 300 litros y la cantidad 6", { tank: "300 litros", qty: "6", budget: "4500.01" }],
    ["cambia a 300", { qty: "3", budget: "4500.01", ask: true }],
  ];
  for (const [msg, want] of cases)
    it(msg, () => {
      const { last, reply } = chat([msg]);
      expect(draftFacts().quantity, "quantity").toBe(want.qty);
      expect(draftFacts().budget, "budget").toBe(want.budget);
      const p = product();
      expect(p).toContain(want.tank || "500 litros");
      expect(p).toContain(want.volt || "220 V");
      expect(p).toContain(want.hz || "60 Hz");
      for (const s of ["compresores industriales de tornillo", "trifásicos", "libres de aceite"]) expect(p).toContain(s);
      // the reply confirms exactly what was saved
      expect(reply).toContain(`«${p}»`);
      expect(reply).toContain(`cantidad ${Number(want.qty).toLocaleString("en-US")}`);
      expect(reply).toContain(`presupuesto de compra ${c.fmtBudget(Number(want.budget))}`);
      if (want.ask) {
        expect(last.askNumber).toBe(300);
        expect(reply).toMatch(/¿«300» es la nueva cantidad/);
      }
    });
  it("budget in quetzales is asked in US$, nothing changes", () => {
    const { reply } = chat(["Mi presupuesto ahora es Q40,000"]);
    expect(draftFacts().budget).toBe("4500.01");
    expect(reply).toMatch(/No cambié el presupuesto.*US\$/);
  });
  it("'la cantidad sigue siendo 5' with 3 in force is asked, not applied", () => {
    const { reply } = chat(["La cantidad sigue siendo 5"]);
    expect(draftFacts().quantity).toBe("3");
    expect(reply).toMatch(/¿Cuál es la correcta\?/);
  });
});

describe("successive corrections: capacity → quantity → budget → voltage", () => {
  beforeEach(() => startCase());
  it("each step changes only its field; the reply always matches the saved case", () => {
    const { replies } = chat([
      "Solo cambia la capacidad del tanque a 300 litros.",
      "Ahora cambia la cantidad de 3 a 4.",
      "Actualiza el presupuesto de compra a US$5,000.",
      "Solo cambia el voltaje a 440 V; lo demás igual.",
    ]);
    const final = "compresores industriales de tornillo, trifásicos 440 V, 60 Hz, tanque de 300 litros, libres de aceite";
    expect(product()).toBe(final);
    expect(draftFacts().quantity).toBe("4");
    expect(draftFacts().budget).toBe("5000");
    expect(caseContext()).toMatchObject({ product: final, quantity: "4", budget: "US$5,000" });
    expect(replies[0]).toMatch(/cantidad 3; presupuesto de compra US\$4,500\.01/);
    expect(replies[1]).toMatch(/tanque de 300 litros.*cantidad 4; presupuesto de compra US\$4,500\.01/);
    expect(replies[2]).toMatch(/tanque de 300 litros.*cantidad 4; presupuesto de compra US\$5,000/);
    expect(replies[3]).toContain(`«${final}»; cantidad 4; presupuesto de compra US$5,000`);
  });
  it("without a form draft (chat only) the chat keeps the same case", () => {
    for (const k of Object.keys(store)) delete store[k];
    saveProduct(D);
    const { replies } = chat(["La cantidad es 3", "Cambia la cantidad de 3 a 4", "Presupuesto de compra US$5,000", "Cambia el tanque a 200 litros"]);
    expect(product()).toBe(D.replace("500", "200"));
    expect(draftFacts()).toMatchObject({ quantity: "4", budget: "5000" });
    expect(replies[3]).toMatch(/tanque de 200 litros.*cantidad 4; presupuesto de compra US\$5,000/);
  });
});

describe("questions about another scenario never change the order", () => {
  beforeEach(() => startCase());
  for (const msg of ["¿Y si fueran 5 compresores?", "Si el tanque fuera de 200 litros, ¿cambia algo?", "¿Cuánto costarían 4 compresores a US$1,500 cada uno?", "Suponiendo un presupuesto de US$6,000, ¿me alcanza?"])
    it(msg, () => {
      const { last } = chat([msg]);
      expect(last.newQuantity).toBeUndefined();
      expect(last.newBudget).toBeUndefined();
      expect(last.attrFix).toBeUndefined();
      expect(last.newProduct).toBeUndefined();
      expect(product()).toBe(D);
      expect(draftFacts()).toMatchObject({ quantity: "3", budget: "4500.01" });
    });
  it("the price calculation is still answered", () => {
    expect(chat(["¿Cuánto costarían 4 compresores a US$1,500 cada uno?"]).reply).toMatch(/4 compresores × US\$1,500\.00 = US\$6,000\.00/);
  });
});

describe("a new case does not inherit", () => {
  beforeEach(() => startCase());
  it("another product: quantity and budget of the compressors are not reused", () => {
    const { last } = chat(["Cambia únicamente la cantidad del pedido de 3 a 4 compresores.", "Ahora quiero importar sillas plásticas apilables"]);
    expect(last.newProduct).toBe("sillas plásticas apilables");
    expect(c.quantityInForce([last])).toBe(0);
    expect(caseContext().quantity).toBeUndefined();
    expect(caseContext().budget).toBeUndefined();
    // the draft stays typed for the compressors: the form shows it as previous data, not current
    expect(draftFacts().product).toBe(D);
  });
  it("a new analysis clears the draft and the case", () => {
    chat(["Actualiza el presupuesto de compra a US$5,000"]);
    clearDraft();
    expect(draftFacts()).toEqual({});
    expect(caseContext()).toEqual({});
  });
});

describe("quantity and budget readers in isolation", () => {
  it("numbers with units or currency are never a quantity", () => {
    for (const t of ["300 litros en lugar de 500 litros", "440 V en vez de 220 V", "cambia a 60 Hz", "US$5,000 en vez de US$4,500", "Cambia la capacidad a 300 litros"]) expect(c.quantityChange(t), t).toBeNull();
  });
  it("'de 3 a 4' is 4", () => {
    expect(c.quantityChange("Cambia la cantidad del pedido de 3 a 4 compresores")).toMatchObject({ qty: 4, before: 3 });
    expect(c.quantityChange("de 220 a 440 V")).toBeNull();
    expect(c.quantityChange("un precio de 3 a 4 dólares")).toBeNull();
  });
  it("a budget is never a quantity, and the budget reader reads money", () => {
    expect(c.quantityChange("Solo actualiza el presupuesto de compra a US$5,000")).toBeNull();
    expect(c.budgetChange("Solo actualiza el presupuesto de compra a US$5,000")).toEqual({ value: 5000, currency: "USD" });
    expect(c.budgetChange("No modifiques el presupuesto")).toBeNull();
    expect(c.budgetChange("presupuesto de Q40,000")).toEqual({ value: 40000, currency: "GTQ" });
  });
});
