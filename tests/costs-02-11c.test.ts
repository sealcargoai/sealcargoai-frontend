// @vitest-environment jsdom
// 02-11c · Un solo total en todas las salidas. Caso de referencia: 4 unidades a US$1,250.50, sin volumen
// ni peso. Se generan de verdad el PDF (jsPDF) y el Excel (ExcelJS) y se leen sus textos y celdas.
import { describe, it, expect } from "vitest";
document.documentElement.lang = "es";
const cc = await import("../src/utils/costCalculator");
const { buildCostPdf } = await import("../src/utils/costPdf");
const { buildCostWorkbook } = await import("../src/utils/reportExports");
const { budgetNote } = await import("../src/utils/costNotes");

const fx = cc.DEFAULT_RATES.exchangeRate;
const costs = cc.calculateCosts({ price: 1250.5, quantity: 4 });
const money = (s: string) => Number(s.replace(/[Q,]/g, ""));

function pdfStrings(): string[] {
  const b64 = buildCostPdf({ title: "t", supplierName: "Proveedor ficticio", productDescription: "compresores de tornillo 220 V", quantity: 4, price: 1250.5, costs, disclaimer: "d", fileName: "x.pdf", saveFile: false, notes: [budgetNote(costs, 5000, () => "")] });
  const raw = Buffer.from(b64, "base64").toString("latin1");
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
}
function xlsRows(): unknown[][] {
  const wb = buildCostWorkbook({ reportTitle: "Escenario", supplierName: "Proveedor ficticio", productType: "machinery", destination: "Guatemala", quantity: 4, price: 1250.5, costs, vatRate: costs.vatRate, insuranceRate: costs.insuranceRate });
  const rows: unknown[][] = [];
  wb.worksheets[0].eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
  return rows;
}

describe("modelo: el escenario de referencia", () => {
  it("FOB US$5,002; seguro mínimo US$250; CIF provisional sin flete US$5,252; DAI 15%; IVA 12%; Q1,200; Q9,500", () => {
    const by = Object.fromEntries(costs.lines.map((l) => [l.key, l.amount]));
    expect(costs.freightPending).toBe(true);
    expect(by.product).toBeCloseTo(5002, 9);
    expect(by.insurance).toBeCloseTo(250, 9);
    expect(costs.cif).toBeCloseTo(5252, 9);
    expect(by.duties).toBeCloseTo(5252 * 0.15, 9);
    expect(by.vat).toBeCloseTo((5252 + 787.8) * 0.12, 9);
    expect(by.customs * fx).toBeCloseTo(1200, 9);
    expect(by.local * fx).toBeCloseTo(9500, 9);
    expect(costs.lines.map((l) => (l.key === "freight" ? "pendiente" : cc.formatQCents(l.amount, fx)))).toEqual(["Q39,515.80", "pendiente", "Q1,975.00", "Q6,223.62", "Q5,725.73", "Q1,200.00", "Q9,500.00"]);
  });
  it("total = suma exacta de las filas impresas = Q64,140.15; por unidad Q16,035.04; US$8,119.01", () => {
    expect(cc.linesTotalQ(costs, fx)).toBe(64140.15);
    expect(cc.formatQTotal(costs, fx)).toBe("Q64,140.15");
    expect(cc.perUnitQ(costs, fx)).toBe(16035.04);
    expect(cc.totalUSDText(costs, fx)).toBe("US$8,119.01");
    expect(cc.totalSummary(costs, fx, ", sin flete")).toBe("Q64,140.15 (US$8,119.01), sin flete");
    // the groups shown on the page add up to the same printed total
    const g = ["product", "duties", "vat", "insurance", "customs", "local"].map((k) => cc.groupQ(costs, [k], fx));
    expect(Math.round(g.reduce((a, b) => a + b, 0) * 100) / 100).toBe(64140.15);
    expect(cc.groupQ(costs, ["freight"], fx)).toBe(0);
  });
  it("porcentajes por fila suman 100.0, sin el flete pendiente", () => {
    expect(cc.lineShares(costs, fx, 1)).toEqual([61.6, null, 3.1, 9.7, 8.9, 1.9, 14.8]);
  });
  it("la nota de presupuesto usa las mismas cifras impresas (Q64,140.15 − Q39,515.80 = Q24,624.35)", () => {
    expect(budgetNote(costs, 5000, () => "")).toMatch(/suma aparte Q24,624\.35 en seguro, impuestos y gastos/);
  });
});

describe("PDF generado: mismas filas, mismo total y mismo redondeo que la pantalla", () => {
  const s = pdfStrings();
  const all = s.join("\n");
  it("filas en centavos, flete «Por cotizar», total Q64,140.15 y suma exacta", () => {
    for (const v of ["Q39,515.80", "Q1,975.00", "Q6,223.62", "Q5,725.73", "Q1,200.00", "Q9,500.00"]) expect(s).toContain(v);
    expect(s).toContain("Por cotizar");
    expect(s).toContain("Q64,140.15");
    const rows = ["Q39,515.80", "Q1,975.00", "Q6,223.62", "Q5,725.73", "Q1,200.00", "Q9,500.00"].reduce((a, v) => a + money(v), 0);
    expect(Math.round(rows * 100) / 100).toBe(64140.15);
  });
  it("el resumen del PDF dice Q64,140.15 (US$8,119.01) y Q16,035.04 por unidad; nunca «Q64,140 »", () => {
    expect(all).toMatch(/Estimaci.n parcial, sin flete: Q64,140\.15 \(US\$8,119\.01\) - Q16,035\.04 por unidad/);
    expect(all).not.toMatch(/Q64,140(?!\.15)/);
  });
  it("porcentajes del PDF iguales a la pantalla y suman 100", () => {
    const pcts = s.filter((x) => /^\d+\.\d%$/.test(x)).map((x) => Number(x.replace("%", "")));
    expect(pcts).toEqual([61.6, 3.1, 9.7, 8.9, 1.9, 14.8]);
    expect(Math.round(pcts.reduce((a, b) => a + b, 0) * 10) / 10).toBe(100);
  });
});

describe("Excel generado: mismas filas, mismo total, mismos porcentajes", () => {
  const rows = xlsRows();
  const lineRows = rows.filter((r) => typeof r[3] === "number" && /%$/.test(String(r[4])));
  it("montos en centavos y total = suma de filas = 64,140.15", () => {
    const amounts = lineRows.map((r) => r[3]);
    expect(amounts).toEqual([39515.8, 1975, 6223.62, 5725.73, 1200, 9500, 64140.15]);
    expect(Math.round((amounts.slice(0, -1) as number[]).reduce((a, b) => a + b, 0) * 100) / 100).toBe(64140.15);
  });
  it("flete «Por cotizar» y fuera del reparto; porcentajes suman 100", () => {
    expect(rows.some((r) => r[0] === "Flete marítimo" && r[3] === "Por cotizar" && r[4] === "—")).toBe(true);
    const p = lineRows.slice(0, -1).map((r) => Number(String(r[4]).replace("%", "")));
    expect(p).toEqual([61.6, 3.1, 9.7, 8.9, 1.9, 14.8]);
  });
  it("costo por unidad 16,035.04 (del total impreso)", () => {
    expect(rows.find((r) => String(r[0]).startsWith("COSTO ESTIMADO POR UNIDAD"))?.[3]).toBe(16035.04);
  });
});

describe("pantalla y resumen del caso usan las mismas funciones (sin fórmulas propias de total)", () => {
  it("las vistas no muestran el total con Q(costs.totalCost) ni formatQ(...totalCost...)", async () => {
    const fs = await import("node:fs");
    for (const f of ["src/app/components/CostBreakdown.tsx", "src/app/components/FinalCTA.tsx", "src/app/components/SupplierResults.tsx", "src/utils/costPdf.ts"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/Q\(costs\.totalCost\)|formatQ\([a-z.]*totalCost|formatUSD\(costs\.totalCost\)|formatUSD\(d\.costs\.totalCost\)/);
    }
  });
});

describe("montos por unidad menores a Q1 conservan sus decimales (revisión independiente)", () => {
  it("0.0003 × 10,000,000 y 0.001 × 1,000,000: nunca «Q0.00»", () => {
    for (const [price, quantity] of [[0.0003, 10_000_000], [0.001, 1_000_000]] as const) {
      const c = cc.calculateCosts({ price, quantity });
      const u = cc.perUnitQ(c, fx);
      expect(u).toBeGreaterThan(0);
      expect(cc.formatQAmount(u)).not.toBe("Q0.00");
      expect(cc.formatQAmount(u)).toMatch(/^Q0\.0\d{2,}/);
    }
  });
  it("montos de Q1 o más siguen con dos decimales", () => {
    expect(cc.formatQAmount(16035.04)).toBe("Q16,035.04");
  });
});
