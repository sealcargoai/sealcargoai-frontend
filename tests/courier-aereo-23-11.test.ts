import { describe, it, expect } from "vitest";
import { calculateCosts, calculateAirFreight, DEFAULT_RATES, linesTotalQ, qCents, sanitizeRates, scenarioVariables } from "../src/utils/costCalculator";

const fx = DEFAULT_RATES.exchangeRate;
const freightLine = (c: ReturnType<typeof calculateCosts>) => c.lines.find((l) => l.key === "freight")!;

describe("23-11 · courier aéreo para carga pequeña", () => {
  it("fórmula de la hoja: libras × 12.88 + 5.60 + 1.51 + 10.14 + 50", () => {
    const a = calculateAirFreight(0, 10, DEFAULT_RATES); // 10 kg = 22.05 lb → 23 lb
    expect(a.mode).toBe("AIR");
    expect(a.chargeableLb).toBe(23);
    const expectedQ = Math.round((Math.round(12.88 * fx * 100) / 100 * 23 + Math.round(67.25 * fx * 100) / 100) * 100) / 100;
    expect(qCents(a.amount, fx)).toBeCloseTo(expectedQ, 2);
    expect(a.detail).toMatch(/Courier aéreo • 23 lb × Q101\.75\/lb \+ Q531\.28/);
  });

  it("cobra el mayor entre peso real y volumétrico (÷5,000 → 200 kg por m³)", () => {
    const a = calculateAirFreight(0.1, 5, DEFAULT_RATES); // 0.1 m³ = 20 kg vol > 5 kg real → 44.09 lb → 45
    expect(a.chargeableLb).toBe(45);
    expect(a.detail).toContain("peso volumétrico");
  });

  it("carga pequeña: el escenario usa aéreo, honorario SEAL US$200, DAI e IVA sobre CIF con el flete aéreo", () => {
    const c = calculateCosts({ price: 10, quantity: 20, weightKg: 8 });
    expect(c.freightMode).toBe("AIR");
    expect(c.customsFees).toBe(200);
    expect(c.cif).toBeCloseTo(200 + c.shipping, 6);
    expect(c.importDuties).toBeCloseTo(c.cif * 0.15, 6);
    expect(c.taxes).toBeCloseTo((c.cif + c.importDuties) * 0.12, 6);
    expect(freightLine(c).label).toMatch(/aéreo/);
    expect(scenarioVariables(c).join(" ")).toMatch(/courier aéreo/);
  });

  it("carga grande: sigue marítimo cuando sale más barato", () => {
    const c = calculateCosts({ price: 10, quantity: 1000, volumeCbm: 3, weightKg: 600 });
    expect(c.freightMode).toBe("LCL");
    expect(c.customsFees).toBeCloseTo(1200 / fx, 6);
  });

  it("siempre escoge el total menor", () => {
    for (const kg of [1, 20, 50, 70, 80, 100, 150, 300]) {
      const c = calculateCosts({ price: 5, quantity: 100, weightKg: kg });
      const ocean = calculateCosts({ price: 5, quantity: 100, weightKg: kg }, { ...DEFAULT_RATES, airPerLb: 0 });
      expect(linesTotalQ(c, fx)).toBeLessThanOrEqual(linesTotalQ(ocean, fx));
    }
  });

  it("sin peso ni volumen el flete sigue por cotizar; airPerLb 0 apaga el aéreo", () => {
    expect(calculateCosts({ price: 10, quantity: 5 }).freightPending).toBe(true);
    expect(calculateCosts({ price: 10, quantity: 5, weightKg: 2 }, { ...DEFAULT_RATES, airPerLb: 0 }).freightMode).toBe("LCL");
    expect(sanitizeRates({ airPerLb: "13.50", airVolDivisor: 0 }).airPerLb).toBe(13.5);
    expect(sanitizeRates({ airVolDivisor: 0 }).airVolDivisor).toBe(5000);
  });
});
