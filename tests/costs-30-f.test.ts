// 30-f · desglose de costos: las filas impresas (PDF, Excel, pantalla) suman exactamente el total impreso.
import { describe, it, expect } from "vitest";
const g = globalThis as Record<string, unknown>;
g.document = { documentElement: { lang: "es" } };
const { calculateCosts, DEFAULT_RATES, qCents, linesTotalQ, formatQCents, formatQTotal } = await import("../src/utils/costCalculator");

const fx = DEFAULT_RATES.exchangeRate;
const printedSum = (c: ReturnType<typeof calculateCosts>) => Math.round(c.lines.filter((l) => !(l.key === "freight" && c.freightPending)).reduce((a, l) => a + qCents(l.amount, fx), 0) * 100) / 100;

describe("R42 · total impreso = suma de las filas impresas (antes: Q15,533.22 con filas que suman Q15,533.23)", () => {
  it("caso de producción: 750 × US$0.30, sin flete", () => {
    const c = calculateCosts({ price: 0.3, quantity: 750 });
    expect(c.freightPending).toBe(true);
    expect(c.lines.map((l) => (l.key === "freight" ? "pend" : formatQCents(l.amount, fx)))).toEqual(["Q1,777.50", "pend", "Q1,975.00", "Q562.88", "Q517.85", "Q1,200.00", "Q9,500.00"]);
    expect(linesTotalQ(c, fx)).toBe(15533.23);
    expect(formatQTotal(c, fx)).toBe("Q15,533.23");
    // the unrounded total differs by less than a centavo per line
    expect(Math.abs(c.totalCost * fx - 15533.23)).toBeLessThan(0.01 * c.lines.length);
  });
  it("con flete (volumen) el flete entra en la suma", () => {
    const c = calculateCosts({ price: 2.425, quantity: 1234, volumeCbm: 3.3 });
    expect(c.freightPending).toBe(false);
    expect(linesTotalQ(c, fx)).toBe(printedSum(c));
  });
  it("propiedad: 2,000 escenarios al azar, filas y total siempre cuadran", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 2000; i++) {
      const price = Math.round(rnd() * 5000) / 1000 + 0.001;
      const quantity = 1 + Math.floor(rnd() * 50000);
      const volumeCbm = rnd() < 0.5 ? 0 : Math.round(rnd() * 8000) / 100;
      const c = calculateCosts({ price, quantity, volumeCbm });
      const total = linesTotalQ(c, fx);
      expect(total).toBe(printedSum(c));
      expect(Math.abs(total - c.totalCost * fx)).toBeLessThan(0.05);
    }
  });
  it("sin filas (datos antiguos) usa el total redondeado", () => {
    expect(linesTotalQ({ totalCost: 100, lines: [] }, fx)).toBe(790);
  });
});
