// Víctor's review of v2026.10.26-o: requirements that must hold together.
// 1. Phase and voltage are separate: a 220 V single-phase listing is not "the requested supply"
//    for a 220 V three-phase request, even when the client excludes single-phase in words.
// 2. Packs inside packs: the order is rounded in the pack that is actually sold.
// 3. Stock: never recommend more boxes than the supplier has.
import { describe, it, expect, afterEach } from "vitest";
import { matchElectric } from "../src/utils/electricMatch";
import { replayConversation } from "../src/utils/chatReply";

const setLang = (lang: "es" | "en") => {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
};
afterEach(() => setLang("es"));

describe("1. phase and voltage are checked separately", () => {
  const asked = [
    "Molino trifásico de 220 V, excluyendo expresamente los monofásicos",
    "molino de arroz 220v trifásico, no monofásico",
    "molino 220 V trifásico",
    "rice mill 220V three phase, no single phase",
  ];
  for (const d of asked) {
    it(`"${d}" vs a single-phase 220 V listing`, () => {
      const m = matchElectric(d, "single phase 220v electric rice mill")!;
      expect(m.status).toBe("other");
      expect(m.text).toMatch(/Esta publicación indica monofásico; solicitaste trifásico|This listing states single-phase; you asked for three-phase/);
      expect(m.text).not.toMatch(/Indica la alimentación pedida/);
    });
    it(`"${d}" vs a three-phase 220 V listing is a match`, () => {
      expect(matchElectric(d, "three phase 220v rice mill")!.status).toBe("match");
    });
    it(`"${d}" vs a listing without phase asks to confirm it`, () => {
      const m = matchElectric(d, "electric rice mill 220v")!;
      expect(m.status).toBe("unknown");
      expect(m.text).toMatch(/no indica la fase|does not state the phase/);
    });
  }
  it("the voltage matching is said, but does not hide the phase", () => {
    expect(matchElectric(asked[0], "single phase 220v electric rice mill")!.text).toMatch(/el voltaje \(220 V\) coincide, pero la fase no/);
  });
  it("in English", () => {
    setLang("en");
    expect(matchElectric(asked[0], "single phase 220v electric rice mill")!.text).toMatch(/This listing states single-phase; you asked for three-phase/);
  });
});

describe("2. packs inside packs: rounded in the pack that is sold", () => {
  const q = "Necesito 500 lápices. Cada set trae 12 lápices y cada caja trae 10 sets. Solo venden cajas completas. ¿Cuántas cajas necesito, cuántos lápices recibiré y cuántos sobran?";
  it("Víctor's case, in a new conversation", () => {
    const r = replayConversation([q])[0];
    expect(r).toMatch(/120 lápices/);
    expect(r).toMatch(/5 cajas/);
    expect(r).toMatch(/600 lápices/);
    expect(r).toMatch(/100 lápices adicionales/);
    expect(r).not.toMatch(/^Necesitarías 42 sets/);
    expect(r).not.toMatch(/sueltos, bastarían/); // only whole boxes are sold
  });
  it("Víctor's case after other messages", () => {
    const r = replayConversation(["Necesito 500 piezas en cajas de 24", "¿el proveedor es confiable?", q]);
    expect(r[2]).toMatch(/5 cajas/);
    expect(r[2]).toMatch(/600 lápices/);
  });
  it("without 'solo cajas completas' the loose-set reading is shown as an alternative", () => {
    const r = replayConversation(["Necesito 500 lápices. Cada set trae 12 lápices y cada caja trae 10 sets. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/^Cada caja trae 10 sets de 12 lápices = 120 lápices\. Necesitarías 5 cajas \(50 sets\)/);
    expect(r).toMatch(/bastarían 42 sets = 504 lápices/);
  });
  for (const w of [
    "Necesito 500 lápices en sets de 12, los sets vienen en cajas de 10. ¿Cuántas cajas?",
    "Necesito 500 lápices, 12 lápices por set, 10 sets por caja. ¿Cuántas cajas?",
    "Necesito 500 lápices en sets de 12, cajas de 10 sets. ¿Cuántas cajas?",
  ])
    it(w, () => {
      const r = replayConversation([w])[0];
      expect(r).toMatch(/5 cajas/);
      expect(r).toMatch(/600 lápices/);
    });
  it("with a minimum in boxes", () => {
    const r = replayConversation(["Necesito 1300 lápices, sets de 12, cajas de 10 sets, mínimo 20 cajas. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/20 cajas = 2,400 lápices/);
  });
  it("English", () => {
    setLang("en");
    const r = replayConversation(["I need 500 pencils. Each set has 12 pencils and each box holds 10 sets. Only full boxes. How many boxes?"])[0];
    expect(r).toMatch(/5 boxes/);
    expect(r).toMatch(/600 pencils/);
  });
});

describe("3. stock limits the order", () => {
  const q = "Necesito 200 pares. Cada caja trae 20 pares. El mínimo es 15 cajas, pero el proveedor solo tiene 12 disponibles. ¿Puedo cubrir el pedido y cumplir el mínimo?";
  it("Víctor's case: covers the pairs, can't meet the minimum", () => {
    const r = replayConversation([q])[0];
    expect(r).toMatch(/12 cajas disponibles sí cubres 200 pares/);
    expect(r).toMatch(/240 pares/);
    expect(r).toMatch(/no alcanzan para cumplir/);
    expect(r).toMatch(/mínimo del proveedor es 15 cajas/);
    expect(r).toMatch(/repondrá existencias|acepta 12 cajas/);
    expect(r).not.toMatch(/debes pedir 15 cajas/);
  });
  it("in a conversation, and a follow-up keeps the stock", () => {
    const r = replayConversation(["hola", q, "¿y para 300?"]);
    expect(r[1]).toMatch(/no alcanzan para cumplir/);
    expect(r[2]).toMatch(/Necesitarías 15 cajas/);
    expect(r[2]).toMatch(/solo tiene 12 cajas disponibles \(240 pares\): no alcanzan, te faltarían 60 pares/);
  });
  it("stock that does not even cover the quantity", () => {
    const r = replayConversation(["Necesito 200 pares. Cada caja trae 20 pares. El proveedor solo tiene 8 cajas disponibles. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/solo tiene 8 cajas disponibles \(160 pares\): no alcanzan, te faltarían 40 pares/);
  });
  it("enough stock is said, the order stands", () => {
    const r = replayConversation(["Necesito 200 pares. Cada caja trae 20 pares. Hay 30 cajas en stock, mínimo 15 cajas. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/debes pedir 15 cajas/);
    expect(r).toMatch(/30 cajas disponibles alcanzan/);
  });
  it("'cada caja tiene 20 pares' is a content, not stock", () => {
    expect(replayConversation(["Necesito 200 pares. Cada caja tiene 20 pares. ¿Cuántas cajas?"])[0]).toMatch(/^Necesitarías 10 cajas/);
  });
  it("English", () => {
    setLang("en");
    const r = replayConversation(["I need 200 pairs, 20 pairs per box, minimum 15 boxes, only 12 boxes in stock. Can I cover it?"])[0];
    expect(r).toMatch(/With the 12 boxes available you do cover 200 pairs/);
    expect(r).not.toMatch(/you should order 15 boxes/);
  });
});
