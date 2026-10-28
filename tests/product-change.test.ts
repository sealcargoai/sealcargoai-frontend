// 28-d: an explicit product change is recognised wherever it sits in the message (with a
// contact request, a quantity, plurals and negations), keeps EVERY characteristic the client
// wrote, and a real doubt is asked instead of silently keeping the previous product.
import { describe, it, expect, beforeEach } from "vitest";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
(globalThis as Record<string, unknown>).sessionStorage = storage;
(globalThis as Record<string, unknown>).localStorage = storage;
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as { document?: unknown }).document = { documentElement: { lang: "es" } };

const c = await import("../src/utils/chatReply");
const cc = await import("../src/utils/caseContext");
const { descriptionIsDetailed } = await import("../src/utils/descriptionCheck");
const MOLINO = "molino industrial trifásico 220 V para maíz";
const REPORTED = "Cambio definitivo de producto: ahora quiero importar 3 compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros y libres de aceite. Ya tengo proforma y necesito que SEAL la revise. No son guantes ni molinos.";

describe("explicit product change", () => {
  it("the reported message: new product with every spec, quantity 3, contact still offered", () => {
    const s = c.nextSpec(REPORTED, [], MOLINO, 0);
    expect(s.newProduct).toBe("compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros y libres de aceite");
    for (const spec of ["220 V", "60 Hz", "500 litros", "libres de aceite", "tornillo", "trifásicos"]) expect(s.newProduct).toContain(spec);
    expect(s.newQuantity).toBe(3);
    expect(c.replyKinds(REPORTED)).toContain("contact");
    const r = c.buildReply(s);
    expect(r).toMatch(/ahora es «compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros y libres de aceite», cantidad 3/);
    expect(r).toMatch(/Enviar mi caso a SEAL/);
    expect(descriptionIsDetailed(s.newProduct!)).toBe(true);
  });
  const VARIANTS: [string, RegExp, number?][] = [
    ["Mi producto es un compresor industrial de tornillo trifásico 220 V, 60 Hz, tanque de 500 litros, libre de aceite", /^compresor industrial de tornillo trifásico 220 V, 60 Hz, tanque de 500 litros, libre de aceite$/],
    ["Ya no son molinos. Ahora son 3 compresores de tornillo de 220 V y 60 Hz, tengo proforma", /^compresores de tornillo de 220 V y 60 Hz$/, 3],
    ["No es un molino sino un compresor de tornillo libre de aceite", /^compresor de tornillo libre de aceite$/],
    ["No es un molino, es un compresor de aire de 100 litros", /^compresor de aire de 100 litros$/],
    ["Olvida el molino: necesito importar compresores de tornillo, 220 V, 60 Hz", /^compresores de tornillo, 220 V, 60 Hz$/],
    ["En vez del molino, ahora quiero 2 secadoras de granos de 380 V", /^secadoras de granos de 380 V$/, 2],
    ["cambiamos el producto a 10 bombas sumergibles de 2 HP, 220 V monofásicas. Quiero hablar con un ejecutivo", /^bombas sumergibles de 2 HP, 220 V monofásicas$/, 10],
    ["I want to import 3 oil-free screw compressors, 220 V, 60 Hz. I already have a proforma.", /^oil-free screw compressors, 220 V, 60 Hz$/, 3],
    ["Quiero comprar 2,000 guantes de nitrilo talla M en cajas de 100, a US$3 la caja. ¿Cuántas cajas y cuánto es?", /^guantes de nitrilo talla M en cajas de 100$/, 2000],
  ];
  for (const [t, desc, qty] of VARIANTS)
    it(t, () => {
      const s = c.nextSpec(t, [], MOLINO, 0);
      expect(s.newProduct).toMatch(desc);
      if (qty) expect(s.newQuantity).toBe(qty);
    });
  it("what it says it is NOT is never taken as the product", () => {
    expect(c.nextSpec("No es un molino, es un compresor de aire", [], MOLINO, 0).newProduct).toBe("compresor de aire");
    expect(c.negatedProducts(REPORTED)).toEqual(expect.arrayContaining(["guant", "molin"]));
  });
  it("a trifásico molino and a trifásico compresor are different products (nouns, not adjectives)", () => {
    expect(c.sameProduct("molino industrial trifásico", "compresores industriales de tornillo, trifásicos 220 V")).toBe(false);
    expect(c.sameProduct("guantes de nitrilo talla M", "Guantes de nitrilo desechables para uso industrial")).toBe(true);
    expect(c.sameProduct("Lápices de grafito para escuela, 500 unidades", "lápices escolares")).toBe(true);
    expect(c.sameProduct("air compressor", "screw compressors 220 V")).toBe(true);
  });
  it("successive changes keep the latest product and quantity", () => {
    const specs: ReturnType<typeof c.nextSpec>[] = [];
    let cur = MOLINO;
    for (const t of ["Quiero 2000 en vez de 500", REPORTED, "Corrijo: el voltaje es 440 V, no 220 V", "Mejor 5 en lugar de 3"]) {
      const s = c.nextSpec(t, specs, cur, c.quantityInForce(specs));
      specs.push(s);
      if (s.newProduct) cur = s.newProduct;
    }
    expect(cur).toBe("compresores industriales de tornillo, trifásicos 440 V, 60 Hz, tanque de 500 litros y libres de aceite");
    expect(c.quantityInForce(specs)).toBe(5);
  });
});

describe("one characteristic corrected, the rest kept", () => {
  it("voltage", () => {
    const s = c.nextSpec("Corrijo: el voltaje es 440 V, no 220 V", [], MOLINO, 0);
    expect(s.newProduct).toBe("molino industrial trifásico 440 V para maíz");
    expect(c.buildReply(s)).toMatch(/«220 V» ahora es «440 V»/);
  });
  it("frequency and capacity, other wordings", () => {
    const comp = "compresor de tornillo trifásico 220 V, 60 Hz, tanque de 500 litros, libre de aceite";
    expect(c.attributeCorrection("perdón, es de 50 Hz y no de 60 Hz", comp)?.description).toBe("compresor de tornillo trifásico 220 V, 50 Hz, tanque de 500 litros, libre de aceite");
    expect(c.attributeCorrection("en realidad el tanque es de 300 litros", comp)?.description).toBe("compresor de tornillo trifásico 220 V, 60 Hz, tanque de 300 litros, libre de aceite");
    expect(c.attributeCorrection("Perdón, es monofásico, no trifásico", comp)?.description).toBe("compresor de tornillo monofásico 220 V, 60 Hz, tanque de 500 litros, libre de aceite");
  });
  it("no cue word, no correction (a new quantity is not a voltage)", () => {
    expect(c.attributeCorrection("necesito 3", MOLINO)).toBeNull();
    expect(c.attributeCorrection("¿qué DAI paga un molino de 220 V?", MOLINO)).toBeNull();
  });
});

describe("a real doubt is asked", () => {
  it("the current product ruled out with nothing in its place", () => {
    const s = c.nextSpec("ya no quiero el molino", [], MOLINO, 0);
    expect(s.newProduct).toBeUndefined();
    expect(c.buildReply(s)).toMatch(/¿Cuál es el producto ahora\?/);
  });
  it("another product named in a request to SEAL: confirm, then 'sí' changes it", () => {
    const s1 = c.nextSpec("Tengo una proforma de 500 compresores, ¿me ayudan?", [], MOLINO, 0);
    expect(s1.confirmProduct).toBe("compresores");
    expect(c.buildReply(s1)).toMatch(/¿Tu producto ahora es «compresores»\?/);
    expect(c.buildReply(s1)).toMatch(/Enviar mi caso a SEAL/);
    const s2 = c.nextSpec("sí", [s1], MOLINO, 0);
    expect(s2.newProduct).toBe("compresores");
    const s3 = c.nextSpec("no", [s1], MOLINO, 0);
    expect(s3.newProduct).toBeUndefined();
  });
  it("the same product in a request is not a doubt", () => {
    expect(c.nextSpec("Tengo proforma del molino, quiero que la revisen", [], MOLINO, 0).confirmProduct).toBeUndefined();
  });
});

describe("the case follows: same product updates the description, another moves data to history", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });
  it("a corrected characteristic replaces the description everywhere (no stale 220 V)", () => {
    cc.setCaseScenario({ productDescription: MOLINO, quantity: "4" }, ["productDescription", "quantity"]);
    cc.switchCaseProduct("molino industrial trifásico 440 V para maíz");
    expect(cc.caseContext()).toMatchObject({ product: "molino industrial trifásico 440 V para maíz", productDescription: "molino industrial trifásico 440 V para maíz", quantity: "4" });
  });
  it("molino → compresor: quantity of the molino goes to history", () => {
    cc.setCaseScenario({ productDescription: MOLINO, quantity: "4" }, ["productDescription", "quantity"]);
    const old = cc.switchCaseProduct("compresores industriales de tornillo, trifásicos 220 V, 60 Hz");
    expect(old?.quantity).toBe("4");
    expect(cc.caseContext().quantity).toBeUndefined();
    expect(cc.caseContext().earlier?.[0]).toMatch(/^molino industrial trifásico 220 V para maíz · cantidad 4/);
  });
});

describe("protected calculations (must keep passing)", () => {
  const one = (t: string) => c.replayConversation([t])[0];
  it("1,001 lápices, cajas de 100 a US$2.49, presupuesto US$27.39 → 11 cajas, exact", () => {
    for (const t of [
      "Necesito 1,001 lápices, cajas de 100 a US$2.49 y presupuesto US$27.39. ¿Cuántas cajas, cuánto y me alcanza?",
      "1001 lápices; cada caja de 100 cuesta US$2.49; tengo US$27.39. ¿cuántas cajas y alcanza?",
      "Quiero 1001 lápices. Vienen 100 por caja a 2.49 dólares la caja. Tengo 27.39 dólares. ¿Alcanza?",
    ]) {
      const r = one(t);
      expect(r, t).toMatch(/Necesitarías 11 cajas: 1,100 lápices/);
      expect(r, t).toMatch(/11 cajas × US\$2\.49 = US\$27\.39/);
      expect(r, t).toMatch(/sí te alcanza exacto/);
    }
  });
  it("new numbers: 2,501 tornillos, bolsas de 250 a US$1.99, presupuesto US$21.88 → 11 bolsas, US$21.89, short US$0.01", () => {
    const r = one("Necesito 2,501 tornillos, bolsas de 250 a US$1.99, presupuesto US$21.88. ¿Cuántas bolsas y me alcanza?");
    expect(r).toMatch(/11 bolsas × US\$1\.99 = US\$21\.89/);
    expect(r).toMatch(/te faltan US\$0\.01/);
  });
  it("a price with no basis is still asked", () => {
    expect(one("Necesito 500 lápices en cajas de 100; el precio es US$4. ¿Cuántas cajas y cuánto es?")).toMatch(/no queda claro a qué corresponde/);
  });
});
