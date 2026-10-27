// Property checks: for many random combinations of quantity, unit, pack content,
// minimum order and multiples, the chat's order must be the fewest whole packs
// that cover the need AND meet the minimum AND are a multiple of the lot.
import { describe, it, expect, afterEach } from "vitest";
import { packMath, replayConversation } from "../src/utils/chatReply";

const f = (n: number) => n.toLocaleString("en-US");
// deterministic pseudo-random numbers
let seed = 20261026;
const rnd = (a: number, b: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return a + (seed % (b - a + 1));
};

describe("order = ceil(max(need, minimum) / multiple) × multiple", () => {
  for (let i = 0; i < 300; i++) {
    const unit = ["pares", "piezas", "lápices"][i % 3];
    const wanted = rnd(1, 5000);
    const per = rnd(2, 60);
    const min = i % 4 === 0 ? 0 : rnd(1, 120);
    const lot = i % 5 === 0 ? 0 : rnd(1, 12);
    const pack = ["cajas", "paquetes", "sets"][i % 3];
    const one = { cajas: "caja", paquetes: "paquete", sets: "set" }[pack]!;
    const text =
      `Necesito ${wanted} ${unit}. Cada ${one} trae ${per} ${unit}.` +
      (min ? ` El mínimo del proveedor es ${min} ${pack}.` : "") +
      (lot ? ` Solo venden en múltiplos de ${lot} ${pack}.` : "") +
      ` ¿Cuántos ${pack} debo pedir?`;
    const need = Math.ceil(wanted / per);
    let expected = Math.max(need, min);
    if (lot) expected = Math.ceil(expected / lot) * lot;
    it(text, () => {
      const m = packMath(text)!;
      expect(m, "parsed").toBeTruthy();
      expect(m.packs).toBe(expected);
      expect(m.total).toBe(expected * per);
      expect(m.extra).toBe(expected * per - wanted);
      const reply = replayConversation([text])[0];
      expect(reply).toContain(`${f(expected)} ${expected === 1 ? one : pack}`);
      if (expected * per - wanted > 0) expect(reply).toContain(f(expected * per - wanted));
    });
  }
});

describe("pairs counted against single pieces never halve the order", () => {
  for (let i = 0; i < 100; i++) {
    const pairs = rnd(1, 3000);
    const pieces = rnd(2, 80);
    const min = i % 2 ? rnd(1, 60) : 0;
    const text = `Necesito ${pairs} pares de zapatos. Cada caja trae ${pieces} zapatos individuales.${min ? ` El mínimo es ${min} cajas.` : ""} ¿Cuántas cajas?`;
    const expected = Math.max(Math.ceil((pairs * 2) / pieces), min);
    it(text, () => {
      const m = packMath(text)!;
      expect(m.packs).toBe(expected);
      expect(m.total).toBe(expected * pieces);
      const reply = replayConversation([text])[0];
      expect(reply).toMatch(/pares completos/);
    });
  }
});

describe("English replies keep the same numbers and warnings", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });
  const cases: [string, RegExp[]][] = [
    ["I need 200 pairs. Each box holds 20 pairs. The minimum is 15 boxes and they only sell in multiples of 6 boxes. How many boxes?", [/18 boxes/, /360 pairs/, /160 pairs/, /multiples of 6 boxes/]],
    ["I need 200 pairs of shoes. Each box has 40 single shoes, not 40 pairs. The supplier's minimum is 15 boxes. How many pairs will I get?", [/15 boxes/, /600 shoes \(300 pairs\)/, /200 shoes \(100 pairs\)/, /complete, matching pairs/]],
    ["Can I be sure that 40 single shoes per box make 20 sellable pairs?", [/can't be sure/, /left/]],
    ["I need -200 pairs, boxes of 20 pairs. How many boxes?", [/negative/]],
  ];
  for (const [q, res] of cases)
    it(q, () => {
      (globalThis as { document?: unknown }).document = { documentElement: { lang: "en" } };
      const r = replayConversation([q])[0];
      for (const re of res) expect(r).toMatch(re);
      expect(r).not.toMatch(/Necesitarías|Confirma con/);
    });
});
