// v2026.10.26-n: zero packs, packs measured by weight/volume/length, negatives,
// decimals, minimums and multiples, the client's own unit words, ES / EN, and
// answers that stay tied to their own question in a multi-turn conversation.
import { describe, it, expect, afterEach } from "vitest";
import { replayConversation } from "../src/utils/chatReply";

const setLang = (lang: "es" | "en") => {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
};
afterEach(() => setLang("es"));

const Q = {
  zero: "Necesito 0 cajas de 12 unidades. ¿Cuántas unidades recibiré?",
  one: "Necesito 1 caja de 12 unidades. ¿Cuántas unidades recibiré?",
  kg: "Necesito 2,5 kg en bolsas de 1 kg, solo venden bolsas completas. ¿Cuántas bolsas necesito?",
  neg: "Necesito -2 cajas de 12 unidades. ¿Cuántas unidades recibiré?",
  shoes40: "Necesito 200 pares de zapatos. Cada caja trae 40 zapatos individuales. El mínimo es 15 cajas. ¿Cuántos pares recibo?",
  lot200: "Necesito 200 pares. Cada caja trae 20 pares. Mínimo 15 cajas y venden en múltiplos de 6. ¿Cuántas cajas?",
  lot301: "Necesito 301 pares. Cada caja trae 20 pares. Mínimo 15 cajas y venden en múltiplos de 6. ¿Cuántas cajas?",
};

type Check = { must: RegExp[]; not?: RegExp[] };
const ES: Record<keyof typeof Q, Check> = {
  zero: { must: [/0 cajas × 12 unidades por caja = 0 unidades/, /mayor que cero/], not: [/cu[aá]ntas? (unidades|piezas) (necesitas|quieres)/i, /piezas/] },
  one: { must: [/1 caja de 12 son 12 unidades/], not: [/piezas/] },
  kg: { must: [/3 bolsas/, /3 kg/, /0\.5 kg/, /Supone que el contenido neto de cada bolsa/], not: [/mayor que 1/] },
  neg: { must: [/negativ/i], not: [/-24|−24/] },
  shoes40: { must: [/15 cajas/, /600 zapatos/, /300 pares/, /100 pares/, /pares compatibles|formen pares|compatib/i] },
  lot200: { must: [/18 cajas/, /360 pares/, /160 pares/] },
  lot301: { must: [/18 cajas/, /360 pares/, /59 pares/] },
};
const EN: Record<keyof typeof Q, Check> = {
  zero: { must: [/0 boxes × 12 units per box = 0 units/, /above zero/], not: [/cajas|unidades/] },
  one: { must: [/12 units/], not: [/cajas|unidades/] },
  kg: { must: [/3 whole bags/, /3 kg/, /0\.5 kg/], not: [/bolsas/] },
  neg: { must: [/negative/i], not: [/-24|−24/] },
  shoes40: { must: [/15 boxes/, /600 shoes|600 zapatos/, /300 pairs/, /100 pairs/], not: [/ pares\b/] },
  lot200: { must: [/18 boxes/, /360 pairs/, /160 pairs/], not: [/ pares\b/] },
  lot301: { must: [/18 boxes/, /360 pairs/, /59 pairs/], not: [/ pares\b/] },
};
const check = (reply: string, c: Check) => {
  for (const re of c.must) expect(reply, `${reply}\n  must ${re}`).toMatch(re);
  for (const re of c.not || []) expect(reply, `${reply}\n  must not ${re}`).not.toMatch(re);
};
const keys = Object.keys(Q) as (keyof typeof Q)[];

describe("cases 1–7, each in a new conversation (ES)", () => {
  for (const k of keys) it(k, () => check(replayConversation([Q[k]])[0], ES[k]));
});

describe("cases 1–7 in one multi-turn conversation: no data from earlier messages", () => {
  it("same answers as in a new conversation", () => {
    const multi = replayConversation(keys.map((k) => Q[k]));
    keys.forEach((k, i) => check(multi[i], ES[k]));
  });
  it("reverse order too", () => {
    const rev = [...keys].reverse();
    const multi = replayConversation(rev.map((k) => Q[k]));
    rev.forEach((k, i) => check(multi[i], ES[k]));
  });
  it("zero after a big order does not reuse the earlier quantity", () => {
    const r = replayConversation([Q.lot301, Q.zero]);
    check(r[1], ES.zero);
    expect(r[1]).not.toMatch(/301|360|18 cajas/);
  });
});

describe("case 8: alternating ES / EN gives the same figures in each language", () => {
  for (const k of keys)
    it(k, () => {
      setLang("es");
      check(replayConversation([Q[k]])[0], ES[k]);
      setLang("en");
      check(replayConversation([Q[k]])[0], EN[k]);
      setLang("es");
      check(replayConversation([Q[k]])[0], ES[k]);
    });
});

describe("zero, negatives, decimals, measures, minimums, multiples (more wordings)", () => {
  const more: [string, RegExp[], RegExp[]?][] = [
    ["¿Cuántas piezas son 0 cajas de 24 piezas?", [/= 0 piezas/, /mayor que cero/]],
    ["0 paquetes de 10 unidades, ¿cuántas unidades son?", [/0 paquetes × 10 unidades por paquete = 0 unidades/]],
    ["¿Cuántas unidades son 3 cajas de 12 unidades?", [/36 unidades/]],
    ["¿Cuántas unidades son −3 cajas de 12?", [/negativ/i], [/-36|−36/]],
    ["¿Cuántas unidades son 2.5 cajas de 12?", [/2 cajas = 24 unidades o 3 cajas = 36 unidades/, /enteros/], [/2.5 cajas de 12 son 30/]],
    ["Necesito 500 gramos en bolsas de 1 kg, ¿cuántas bolsas?", [/1 bolsa/, /500 g|0\.5 kg/]],
    ["Necesito 10 litros, botellas de 2 l, ¿cuántas botellas?", [/5 botellas/, /10 l/]],
    ["Necesito 3 kg en bolsas de 1 kg, ¿cuántas bolsas?", [/3 bolsas/], [/más de lo que necesitas/]],
    ["Necesito 100 unidades en cajas de 12, mínimo 10 cajas. ¿Cuántas cajas?", [/10 cajas/, /120 unidades/, /20 unidades/]],
    ["Necesito 100 unidades en cajas de 12, en múltiplos de 4 cajas. ¿Cuántas cajas?", [/12 cajas/, /144 unidades/, /44 unidades/]],
    ["Necesito 100 unidades en cajas de 12, mínimo -5 cajas. ¿Cuántas cajas?", [/mínimo|múltiplo|condici/i], [/9 cajas/]],
    ["Necesito 100 unidades en cajas de 12, mínimo 2.5 cajas. ¿Cuántas cajas?", [/mínimo|condici/i]],
    ["Necesito 1000 kg en sacos de 45 kg, ¿cuántos sacos?", [/23 sacos completos/, /1,035 kg/, /35 kg más/]],
    ["¿Cuántos kg son 2,5 sacos de 25 kg?", [/2 sacos = 50 kg o 3 sacos = 75 kg/], [/62\.5/]],
    ["¿Cuántas piezas son 0,5 paquetes de 10?", [/1 paquete = 10 piezas/, /enteros/]],
    ["Necesito 0 sacos de 50 kg, ¿cuántos kg?", [/0 sacos × 50 kg = 0 kg/, /mayor que cero/]],
    ["Necesito 2500 g en bolsas de 1 kg, ¿cuántas bolsas?", [/2,500 g son 2\.5 kg/, /3 bolsas completas/]],
    ["Quiero 240 botellas, con una botella y tres tazas por set. ¿Cuántos sets necesito?", [/240 sets/, /720 tazas/]],
    ["Necesito 200 botellas de 600 ml, cajas de 24 botellas, ¿cuántas cajas?", [/9 cajas/, /216 botellas/]],
  ];
  for (const [q, must, not] of more) it(q, () => check(replayConversation([q])[0], { must, not }));
});

describe("the 'pero …' names only the condition that raises the order", () => {
  const c: [string, RegExp[], RegExp[]][] = [
    [Q.lot301, [/pero el proveedor solo vende en múltiplos de 6/, /también cumple el mínimo \(15 cajas\)/], [/pero el mínimo/]],
    [Q.lot200, [/pero el mínimo del proveedor es 15 cajas y solo vende en múltiplos de 6/], [/también cumple/]],
    ["Necesito 200 pares. Cada caja trae 20 pares. Mínimo 18 cajas y venden en múltiplos de 6. ¿Cuántas cajas?", [/pero el mínimo del proveedor es 18 cajas:/, /también cumple el múltiplo de 6/], [/pero el mínimo[^:]*múltiplos/]],
    ["Necesito 360 pares. Cada caja trae 20 pares. Mínimo 15 cajas y venden en múltiplos de 6. ¿Cuántas cajas?", [/Cumples el mínimo \(15 cajas\) y el múltiplo de 6/], [/pero/]],
    ["Necesito 2000 sets, cada set trae 1 botella y 3 tazas, mínimo 300 sets, múltiplos de 7 sets. ¿Cuántos sets?", [/Ojo: el proveedor solo vende en múltiplos de 7 sets/, /2,002 sets/], [/Ojo: el mínimo/]],
  ];
  for (const [q, must, not] of c) it(q, () => check(replayConversation([q])[0], { must, not }));
  it("EN", () => {
    setLang("en");
    check(replayConversation([Q.lot301])[0], { must: [/but the supplier only sells in multiples of 6/, /also meets the minimum \(15 boxes\)/], not: [/but the supplier's minimum/] });
  });
});
