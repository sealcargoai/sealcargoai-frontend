// Fixes from the independent review (v2026.10.26-p): tiny prices, the atypical-price
// warning in the language in use, listings priced per meter / kilo / ton
import { describe, it, expect, afterEach } from "vitest";
import { formatUSD, formatUnitUSD, formatUnitQ, formatQ } from "../src/utils/costCalculator";
import { flagPrices, priceIssue } from "../src/utils/priceCheck";
import { saleUnitInfo } from "../src/utils/saleUnit";

const setLang = (lang: "es" | "en") => {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
};
afterEach(() => setLang("es"));

describe("tiny prices are never shown as 0.00", () => {
  it("US$0.00004", () => {
    expect(formatUnitUSD(0.00004)).toBe("US$0.00004");
    expect(formatUSD(0.00004, 2)).not.toBe("US$0.00");
    expect(formatUnitQ(0.00004, 7.8)).not.toMatch(/^Q0\.00$/);
    expect(formatQ(0.00001, 7.8, 2)).not.toMatch(/^Q0\.00$/);
  });
  it("normal prices keep their usual decimals", () => {
    expect(formatUnitUSD(2.425)).toBe("US$2.425");
    expect(formatUnitUSD(0.035)).toBe("US$0.035");
    expect(formatUSD(1234.5, 2)).toBe("US$1,234.50");
  });
});

describe("atypical price warning follows the language", () => {
  it("flag made in Spanish, read in English on the cost page", () => {
    setLang("es");
    const [s] = flagPrices([{ price: 1, priceRange: "US$1", productName: "Industrial mixer" }], "machinery");
    expect(s.priceFlag).toMatch(/parece simbólico/);
    setLang("en");
    expect(priceIssue(s, [], "machinery")).toMatch(/looks symbolic/);
    expect(priceIssue(s, [], "machinery")).not.toMatch(/precio/);
  });
  it("a price far below the others keeps its figures in both languages", () => {
    setLang("es");
    const list = flagPrices([{ price: 0.5 }, { price: 10 }, { price: 12 }, { price: 11 }], "other");
    expect(list[0].priceFlag).toMatch(/muy por debajo/);
    setLang("en");
    expect(priceIssue(list[0])).toMatch(/far below.*US\$0\.50.*US\$11/);
  });
});

describe("listings priced per meter, kilo or ton are not packs", () => {
  for (const u of ["meter", "kilogram", "ton"])
    it(u, () => {
      const info = saleUnitInfo({ saleUnit: u, productName: "Cotton fabric 150cm wide" }, "textiles");
      expect(info.multi).toBe(false);
      expect(info.unit).toBe(u);
    });
});

import { resolveScenario } from "../src/utils/scenario";
describe("scenario with a listing priced per meter or kilo", () => {
  const sc = (supplier: Record<string, unknown>, description: string, qty: number) =>
    resolveScenario(supplier, {}, { requestedQty: qty, productType: "", description });
  it("500 metros de tela: no unit question, 500 meters", () => {
    const r = sc({ saleUnit: "meter", productName: "Cotton fabric", price: 2, moq: 100 }, "500 metros de tela de algodón", 500);
    expect(r.needsUnitDecision).toBe(false);
    expect(r.quantity).toBe(500);
    expect(r.notes.join(" ")).not.toMatch(/vende por metro/);
  });
  it("a request in pieces against a price per kilo says how it was read", () => {
    const r = sc({ saleUnit: "kilogram", productName: "Coffee beans", price: 5, moq: 100 }, "1000 bolsas de café", 1000);
    expect(r.needsUnitDecision).toBe(false);
    expect(r.notes.join(" ")).toMatch(/vende por kilo: tomamos tu cantidad como 1,000 kilos/);
  });
});

describe("measure words are not found inside other words", () => {
  it("'no uso médico' is not a quantity in meters", () => {
    const r = resolveScenario({ saleUnit: "meter", productName: "Coated fabric", price: 2, moq: 1 }, {}, { requestedQty: 1000, productType: "", description: "Guantes de nitrilo, no uso médico, cajas de 100" });
    expect(r.notes.join(" ")).toMatch(/vende por metro/);
  });
});

import { calculateCosts, DEFAULT_RATES } from "../src/utils/costCalculator";
describe("SEAL's fixed amounts already include IVA: no IVA is added on top", () => {
  it("the IVA line is computed on CIF + DAI only", () => {
    const c = calculateCosts({ price: 2, quantity: 1000, volumeCbm: 0, weightKg: 0, saleUnit: "" }, DEFAULT_RATES);
    expect(c.taxes).toBeCloseTo((c.cif + c.importDuties) * DEFAULT_RATES.vatRate, 6);
  });
});
