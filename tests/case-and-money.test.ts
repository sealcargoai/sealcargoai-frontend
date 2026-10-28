// 28-a: the case in force across screens, explanatory equivalences, and order money
// (price basis, subtotal, budget) computed deterministically. Each rule is tested with
// the reported phrase AND with other wordings, orders, languages and limits.
import { describe, it, expect, beforeEach } from "vitest";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
(globalThis as Record<string, unknown>).sessionStorage = storage;
(globalThis as Record<string, unknown>).localStorage = storage;
(globalThis as Record<string, unknown>).window = globalThis;
const doc = { documentElement: { lang: "es" } };
(globalThis as { document?: unknown }).document = doc;

const chat = await import("../src/utils/chatReply");
const money = await import("../src/utils/orderMoney");
const cc = await import("../src/utils/caseContext");
const { replayConversation, nextSpec, buildReply, productChange, quantityInForce, replyKinds } = chat;
const { explain, readMoney, fmtMoney } = money;
const one = (t: string) => replayConversation([t])[0];
const en = <T,>(f: () => T): T => {
  doc.documentElement.lang = "en";
  try {
    return f();
  } finally {
    doc.documentElement.lang = "es";
  }
};

describe("explanatory equivalences are not orders", () => {
  const SHOES = [
    "Quiero 500 zapatos individuales, en cajas de 20 pares. Aclaro la equivalencia: 1 par = 2 zapatos. ¿Cuántas cajas necesito? Es un solo pedido.",
    "Quiero 500 zapatos individuales, en cajas de 20 pares. Un par equivale a 2 zapatos. ¿Cuántas cajas necesito?",
    "Quiero 500 zapatos individuales en cajas de 20 pares (1 par = 2 zapatos). ¿Cuántas cajas necesito?",
    "¿Cuántas cajas necesito? 500 zapatos sueltos, cada caja trae 20 pares; cada par son 2 zapatos.",
    "Necesito 500 zapatos individuales. Las cajas son de 20 pares y 2 zapatos hacen un par. ¿cuántas cajas? no es otro pedido",
    "500 zapatos individuales; cajas de 20 pares; la equivalencia es 1 par = 2 zapatos; cuántas cajas necesito",
  ];
  for (const t of SHOES)
    it(t, () => {
      const r = one(t);
      expect(r).toMatch(/Necesitarías 13 cajas: 520 zapatos, con 20 zapatos adicionales/);
      expect(r).toMatch(/40 zapatos por caja/);
      expect(r).not.toMatch(/250 pares|dos cantidades|Calculé cada pedido|1 cajas/);
    });
  it("English: 500 single shoes, boxes of 20 pairs, 1 pair = 2 shoes", () => {
    const r = en(() => one("I need 500 single shoes in boxes of 20 pairs. Just to clarify: 1 pair = 2 shoes. How many boxes do I need? It's a single order."));
    expect(r).toMatch(/13 boxes/);
    expect(r).toMatch(/520 shoes/);
  });
  it("an unusual equivalence is confirmed before calculating", () => {
    const r = one("Quiero 500 zapatos en cajas de 20 pares; 1 par = 3 zapatos. ¿Cuántas cajas?");
    expect(r).toMatch(/normalmente 1 par = 2/);
    expect(r).not.toMatch(/Necesitarías/);
  });
  it("a pack equivalence becomes the pack content", () => {
    expect(one("Necesito 500 lápices; 1 set = 12 lápices. ¿Cuántos sets necesito?")).toMatch(/Necesitarías 42 sets: 504 lápices/);
  });
  it("explain() removes only the explanation", () => {
    expect(explain("500 zapatos en cajas de 20 pares. Un par equivale a 2 zapatos.").text).toBe("500 zapatos en cajas de 20 pares.");
    expect(explain("cada caja trae 20 pares").removed).toEqual([]);
  });
  it("the same rule for dozens", () => {
    expect(one("Necesito 300 huevos en cajas de 2 docenas (1 docena = 12 huevos). ¿Cuántas cajas?")).toMatch(/Necesitarías 13 cajas: 312 huevos/);
  });
});

describe("combined questions: packs, conditions, price, budget", () => {
  it("A: 2,000 guantes en cajas de 100 a US$3 la caja → 20 cajas, US$60", () => {
    const r = one("Necesito 2,000 guantes en cajas de 100. Cada caja cuesta US$3. ¿Cuántas cajas necesito y cuál es el subtotal?");
    expect(r).toMatch(/Necesitarías 20 cajas/);
    expect(r).toMatch(/20 cajas × US\$3\.00 = US\$60\.00 de producto/);
    expect(r).not.toMatch(/Puedo prepararte una estimación preliminar/);
  });
  it("A, other order and wording", () => {
    for (const t of [
      "¿Cuántas cajas y cuánto pago? Precio: US$3 por caja, cajas de 100 guantes, necesito 2000 guantes",
      "2000 guantes, vienen 100 por caja, la caja a 3 dólares. ¿cuántas cajas y cuál es el total?",
      "necesito 2 mil guantes; cada caja trae 100 y cuesta US$ 3. cuantas cajas ocupo y cuanto es el subtotal",
    ]) {
      const r = one(t);
      expect(r, t).toMatch(/20 cajas/);
      expect(r, t).toMatch(/US\$60\.00 de producto/);
    }
  });
  it("B: minimum 7, multiples of 3, US$4 per box, budget US$35 → 9 cajas, 900, 400 extra, US$36, short US$1", () => {
    const r = one("Necesito 500 lápices. Cada caja trae 100. El mínimo es 7 cajas y solo venden múltiplos de 3 cajas. Cada caja cuesta US$4. Mi presupuesto de compra es US$35. ¿Cuántas cajas debo pedir, cuánto cuestan y me alcanza?");
    expect(r).toMatch(/debes pedir 9 cajas = 900 lápices, y te sobrarían 400 lápices/);
    expect(r).toMatch(/9 cajas × US\$4\.00 = US\$36\.00/);
    expect(r).toMatch(/no te alcanza: te faltan US\$1\.00/);
  });
  it("B with the budget enough and exact", () => {
    expect(one("Necesito 500 lápices, cada caja trae 100, mínimo 7 cajas, múltiplos de 3, US$4 por caja, presupuesto US$40. ¿Me alcanza?")).toMatch(/sí te alcanza: te quedan US\$4\.00/);
    expect(one("Necesito 500 lápices, cada caja trae 100, mínimo 7 cajas, múltiplos de 3, US$4 por caja, presupuesto US$36. ¿Me alcanza?")).toMatch(/sí te alcanza exacto/);
  });
  it("C: 2,000 × US$0.03 = US$60, budget 59.99 → short US$0.01 (no float error)", () => {
    const r = one("2,000 guantes a US$0.03 cada uno, presupuesto US$59.99. ¿Cuál es el subtotal y cuánto me falta?");
    expect(r).toMatch(/2,000 guantes × US\$0\.03 = US\$60\.00/);
    expect(r).toMatch(/te faltan US\$0\.01/);
  });
  it("C variants", () => {
    expect(one("Si compro 2000 guantes, el precio es US$0.03 por unidad y tengo US$59.99, ¿cuánto me falta?")).toMatch(/te faltan US\$0\.01/);
    expect(one("333 piezas a US$0.035 cada una, ¿cuál es el total?")).toMatch(/= US\$11\.655 de producto/);
    expect(one("3 piezas a US$0.10 cada una, presupuesto US$0.30, ¿me alcanza?")).toMatch(/sí te alcanza exacto/);
  });
  it("D: the valid order needs 9 boxes and stock is 8, although 8 cover the quantity", () => {
    const r = one("Necesito 500 lápices. Cada set trae 12 y cada caja 10 sets. Mínimo 7 cajas, múltiplos de 3 y disponibilidad de 8 cajas.");
    expect(r).toMatch(/Con las 8 cajas disponibles sí cubres 500 lápices/);
    expect(r).toMatch(/el pedido tendría que ser de 9 cajas y el proveedor solo tiene 8/);
  });
  it("D with a price per set: 9 boxes = 90 sets", () => {
    const r = one("Necesito 500 lápices. Cada set trae 12 y cada caja 10 sets. Mínimo 7 cajas, múltiplos de 3 y disponibilidad de 8 cajas. Cada set cuesta US$1.50. ¿Cuánto cuesta?");
    expect(r).toMatch(/90 sets × US\$1\.50 = US\$135\.00/);
    expect(r).toMatch(/aunque hoy el proveedor no tenga existencias suficientes/);
  });
  it("price per pair with shoes counted in pieces", () => {
    expect(one("500 zapatos individuales en cajas de 20 pares, a US$5 el par. ¿Cuántas cajas y cuánto es?")).toMatch(/260 pares × US\$5\.00 = US\$1,300\.00/);
  });
  it("a price with no basis is asked, not guessed", () => {
    const r = one("Necesito 500 lápices en cajas de 100 a US$4. ¿Cuántas cajas y cuánto es?");
    expect(r).toMatch(/no queda claro a qué corresponde/);
    expect(r).not.toMatch(/= US\$/);
  });
  it("zero, negative and two prices are asked", () => {
    expect(one("Necesito 500 lápices, cajas de 100, cada caja cuesta US$0. ¿Cuántas cajas y cuánto es?")).toMatch(/mayor a cero/);
    expect(one("Necesito 500 lápices, cajas de 100, cada caja cuesta US$4 y cada caja cuesta US$5. ¿Cuánto es?")).toMatch(/dos precios distintos/);
  });
  it("budget in quetzales and price in dollars are not compared", () => {
    expect(one("Necesito 500 lápices, cajas de 100, US$4 por caja, presupuesto Q300. ¿Me alcanza?")).toMatch(/otra moneda/);
  });
  it("an import budget is told apart from a purchase budget", () => {
    expect(one("Necesito 500 lápices, cajas de 100, US$4 por caja, presupuesto total de importación US$100. ¿Me alcanza?")).toMatch(/comparo solo el valor del producto/);
  });
  it("budget alone asks for the price", () => {
    expect(one("Necesito 500 lápices en cajas de 100, mi presupuesto es US$50. ¿Cuántas cajas y me alcanza?")).toMatch(/necesito el precio/);
  });
  it("English combined question", () => {
    const r = en(() => one("I need 2,000 gloves in boxes of 100. Each box costs US$3. How many boxes and what is the subtotal?"));
    expect(r).toMatch(/20 boxes × US\$3\.00 = US\$60\.00 of product/);
  });
  it("fmtMoney keeps exact cents and sub-cents", () => {
    expect(fmtMoney(600000, "USD")).toBe("US$60.00");
    expect(fmtMoney(100, "USD")).toBe("US$0.01");
    expect(fmtMoney(116550, "USD")).toBe("US$11.655");
    expect(fmtMoney(12345600, "GTQ")).toBe("Q1,234.56");
  });
  it("readMoney: basis and budget", () => {
    expect(readMoney("cada caja cuesta us$3").price).toMatchObject({ e4: 30000, basis: "caja" });
    expect(readMoney("a us$0.03 cada uno").price).toMatchObject({ e4: 300, basis: "unit" });
    expect(readMoney("us$4/caja").price).toMatchObject({ basis: "caja" });
    expect(readMoney("presupuesto de compra es us$35").budget).toMatchObject({ e4: 350000, scope: "compra" });
    expect(readMoney("presupuesto 1,200.50 dólares").budget).toMatchObject({ e4: 12005000 });
  });
});

describe("the product in force (chat)", () => {
  const CHANGES: [string, string][] = [
    ["Ahora el producto es un molino. Quiero que revisen mi proforma.", "molino"],
    ["Cambio el producto: ya no son guantes, es un molino de maíz. Necesito revisión de proforma.", "molino de maíz"],
    ["Ya no quiero guantes, ahora son compresores de aire y quiero hablar con un ejecutivo", "compresores de aire"],
    ["cambio el producto a compresores de aire, tengo proforma", "compresores de aire"],
    ["Ya no son guantes sino compresores", "compresores"],
    ["El producto ahora es un molino de martillos", "molino de martillos"],
    ["The product is now an air compressor and I want to talk to someone", "air compressor"],
  ];
  for (const [t, p] of CHANGES) it(`${t} → ${p}`, () => expect(productChange(t)).toBe(p));
  it("no change in ordinary sentences", () => {
    for (const t of ["¿El producto es confiable?", "Quiero 2000 en vez de 500", "Necesito 200 pares; cada caja trae 20 pares", "Tengo proforma", "¿Cuál es el DAI de los guantes?"]) expect(productChange(t), t).toBeNull();
  });
  it("a contact request with a product change carries the new product and asks the stale quantity again", () => {
    const s = nextSpec("Ahora el producto es un molino. Quiero que revisen mi proforma.", [], "guantes de nitrilo", 2000);
    expect(s.newProduct).toBe("molino");
    expect(replyKinds(s.text)).toContain("contact");
    s.stale = { product: "guantes de nitrilo", quantity: "2000", budget: "60" };
    const r = buildReply(s);
    expect(r).toMatch(/Anotado el cambio de producto: ahora es «molino» \(antes «guantes de nitrilo»\)/);
    expect(r).toMatch(/Enviar mi caso a SEAL/);
    expect(r).toMatch(/Los datos que tenías para «guantes de nitrilo» \(cantidad 2,000, presupuesto US\$60\) quedan como historial/);
  });
  it("a quantity given for the earlier product doesn't carry over", () => {
    const specs = [] as ReturnType<typeof nextSpec>[];
    for (const t of ["Quiero 2000 en vez de 500", "Ahora el producto es un molino, quiero contratar"]) specs.push(nextSpec(t, specs, specs.length ? "guantes" : "guantes", 0));
    expect(quantityInForce(specs)).toBe(0);
    specs.push(nextSpec("Quiero 3 en vez de 2000", specs, "molino", 0));
    expect(quantityInForce(specs)).toBe(3);
  });
  it("successive changes: guantes → molino → compresores", () => {
    const r = replayConversation(["Quiero importar guantes de nitrilo", "Ahora el producto es un molino. Quiero que revisen mi proforma.", "Cambio el producto a compresores de aire. Quiero hablar con un ejecutivo."]);
    expect(r[1]).toMatch(/«molino»/);
    expect(r[2]).toMatch(/«compresores de aire»/);
  });
});

describe("the case SEAL receives follows the product in force", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });
  it("chat change after a search: old quantity, budget, supplier and estimate become history", () => {
    cc.setCaseScenario({ productDescription: "guantes de nitrilo", quantity: "2000", budget: "US$60", destination: "Guatemala", supplierName: "Ningbo X", price: "US$0.03", totalCostText: "Q5,000", warnings: ["w"] }, ["productDescription", "quantity", "budget", "destination", "product", ...cc.SCENARIO_KEYS]);
    const old = cc.switchCaseProduct("molino");
    expect(old).toMatchObject({ product: "guantes de nitrilo", quantity: "2000", budget: "US$60" });
    const c = cc.caseContext();
    expect(c.product).toBe("molino");
    expect(c.quantity).toBeUndefined();
    expect(c.budget).toBeUndefined();
    expect(c.supplierName).toBeUndefined();
    expect(c.warnings).toBeUndefined();
    expect(c.productDescription).toBeUndefined();
    expect(c.destination).toBe("Guatemala");
    expect(c.earlier).toEqual(["guantes de nitrilo · cantidad 2,000 · presupuesto US$60 · proveedor Ningbo X · precio US$0.03 · estimación Q5,000"]);
    // a second change keeps both earlier products as history
    cc.switchCaseProduct("compresores de aire");
    expect(cc.caseContext().earlier).toHaveLength(2);
    expect(cc.caseContext().product).toBe("compresores de aire");
  });
  it("form draft only (no search yet): the draft's quantity and budget are the previous product's", () => {
    const old = cc.switchCaseProduct("molino", { product: "guantes", quantity: "2000", budget: "60" });
    expect(old).toMatchObject({ product: "guantes", quantity: "2000", budget: "60" });
  });
  it("the same product said again changes nothing", () => {
    cc.setCaseScenario({ productDescription: "guantes de nitrilo", quantity: "2000" }, ["productDescription", "quantity"]);
    expect(cc.switchCaseProduct("guantes")).toBeNull();
    expect(cc.caseContext().quantity).toBe("2000");
  });
  it("a new case from the start clears everything", async () => {
    cc.switchCaseProduct("molino", { product: "guantes", quantity: "2000" });
    const { clearDraft } = await import("../src/utils/draft");
    clearDraft();
    expect(cc.caseContext()).toEqual({});
  });
});

describe("round 2: cases designed to break the rules", () => {
  it("stock written before the number ('Disponibles 2 cajas') is stock, and the price applies to the full order", () => {
    const r = one("Necesito 120 piezas en cajas de 50. La caja vale 10 dólares. Disponibles 2 cajas. ¿Cuántas cajas y cuánto?");
    expect(r).toMatch(/Necesitarías 3 cajas/);
    expect(r).toMatch(/solo tiene 2 cajas disponibles/);
    expect(r).toMatch(/3 cajas × US\$10\.00 = US\$30\.00/);
  });
  it("a price without currency is money, not a pack content, and the assumption is said", () => {
    const r = one("Necesito 2000 guantes en cajas de 100; precio 3 por caja; ¿subtotal?");
    expect(r).toMatch(/20 cajas × US\$3\.00 = US\$60\.00/);
    expect(r).toMatch(/Tomé el precio en dólares/);
    expect(r).not.toMatch(/contenidos distintos/);
  });
  it("a price 'per bag' is not counted as a second order", () => {
    const r = en(() => one("I need 1,000 screws, 250 per bag, US$2.75 per bag, budget US$11. Is it enough?"));
    expect(r).not.toMatch(/more than one calculation/);
    expect(r).toMatch(/4 bags × US\$2\.75 = US\$11\.00/);
    expect(r).toMatch(/is enough exactly/);
  });
  it("minimum above the quantity raises the order and its cost", () => {
    const r = one("Necesito 1,200 tazas. Cada caja trae 24 tazas y cuesta US$18. Mínimo 60 cajas. Presupuesto US$1,000. ¿Cuántas cajas, cuánto y me alcanza?");
    expect(r).toMatch(/debes pedir 60 cajas = 1,440 tazas/);
    expect(r).toMatch(/US\$1,080\.00/);
    expect(r).toMatch(/te faltan US\$80\.00/);
  });
  it("pairs counted in pairs, price per pack", () => {
    expect(one("Quiero 750 pares de calcetines, paquetes de 6 pares a US$2.40 el paquete. ¿cuántos paquetes y total?")).toMatch(/125 paquetes × US\$2\.40 = US\$300\.00/);
  });
  it("a product change with its packing keeps only the product name", () => {
    const r = replayConversation(["Quiero importar molinos", "ya no es molino, ahora necesito 300 compresores de aire en cajas de 10. ¿Cuántas cajas?"])[1];
    expect(r).toMatch(/«compresores de aire»/);
    expect(r).toMatch(/Necesitarías 30 cajas/);
  });
  it("negative and decimal quantities are asked", () => {
    expect(one("Necesito -50 guantes en cajas de 10, US$1 por caja, ¿cuántas cajas?")).toMatch(/negativo/);
    expect(one("Necesito 10.5 cajas de guantes de 100, ¿cuántos guantes son?")).not.toMatch(/= US\$/);
  });
});
