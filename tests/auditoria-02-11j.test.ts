// @vitest-environment jsdom
// 02-11j — Auditoría integral (frontend). Comportamiento, no frases en el código: se calculan escenarios,
// se genera el Excel de verdad y se llaman las funciones que usan las pantallas.
import { describe, it, expect } from "vitest";
document.documentElement.lang = "es";
const cc = await import("../src/utils/costCalculator");
const { buildCostWorkbook } = await import("../src/utils/reportExports");
const { sealRefusalMessage, reportRefusal400Message } = await import("../src/utils/sendErrors");
const { earlierLine } = await import("../src/app/components/ContactSeal");
const { countryName } = await import("../src/app/components/SelectedSupplier");

const fx = cc.DEFAULT_RATES.exchangeRate;
const line = (c: ReturnType<typeof cc.calculateCosts>, k: string) => c.lines.find((l) => l.key === k)!;
const es = (a: string) => a;
const en = (_a: string, b: string) => b;

describe("redondeo a centavos: medio centavo hacia arriba", () => {
  it("5 × US$0.83 → FOB Q32.785 se imprime Q32.79 (antes Q32.78)", () => {
    const c = cc.calculateCosts({ price: 0.83, quantity: 5 });
    expect(cc.formatQCents(line(c, "product").amount, fx)).toBe("Q32.79");
  });
  it("round2 con casos límite", () => {
    expect(cc.round2(1.005)).toBe(1.01);
    expect(cc.round2(64140.145)).toBe(64140.15);
    expect(cc.round2(0.125)).toBe(0.13);
    expect(cc.round2(2.675)).toBe(2.68);
    expect(cc.round2(-1.005)).toBe(-1.01);
    expect(cc.round2(5)).toBe(5);
    // (review) values where toPrecision writes an exponent
    expect(cc.round2(5e-7)).toBe(0);
    expect(cc.round2(0.004999)).toBe(0);
    expect(cc.round2(1e21)).toBe(1e21);
    expect(cc.formatQTotal(cc.calculateCosts({ price: 0.0000001, quantity: 1 }), fx)).not.toMatch(/NaN/);
  });
  it("el caso de referencia no cambia: Q64,140.15", () => {
    const c = cc.calculateCosts({ price: 1250.5, quantity: 4 });
    expect(cc.formatQTotal(c, fx)).toMatch(/Q64,140\.15/);
  });
});

describe("las bases del DAI y del IVA son la suma de las filas impresas", () => {
  it("1 × US$10.65: «FOB + seguro Q2,059.14» = Q84.14 + Q1,975.00 (antes Q2,059.13)", () => {
    const c = cc.calculateCosts({ price: 10.65, quantity: 1 });
    const fob = cc.qCents(line(c, "product").amount, fx);
    const ins = cc.qCents(line(c, "insurance").amount, fx);
    expect(fob).toBe(84.14);
    expect(line(c, "duties").detail).toContain(`Q${(fob + ins).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    const dai = cc.qCents(line(c, "duties").amount, fx);
    expect(line(c, "vat").detail).toContain(`Q${cc.round2(fob + ins + dai).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  });
  it("200 escenarios variados: la base impresa siempre cuadra con las filas impresas", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const c = cc.calculateCosts({ price: Math.round(rnd() * 500000) / 100, quantity: 1 + Math.floor(rnd() * 400), volumeCbm: rnd() < 0.5 ? Math.round(rnd() * 3000) / 100 : 0 });
      const sum = cc.round2(["product", "freight", "insurance"].reduce((a, k) => a + (k === "freight" && c.freightPending ? 0 : cc.qCents(line(c, k).amount, fx)), 0));
      const printed = line(c, "duties").detail.match(/Q([\d,]+\.\d\d)$/)![1];
      expect(Number(printed.replace(/,/g, ""))).toBe(sum);
    }
  });
});

describe("tasas mostradas como se usaron", () => {
  it("DAI 7.5% y seguro 0.5% se muestran 7.5% y 0.5% (antes 8% y 1%)", () => {
    const c = cc.calculateCosts({ price: 1000, quantity: 100 }, { ...cc.DEFAULT_RATES, dutyRate: 0.075, insuranceRate: 0.005 });
    expect(line(c, "duties").detail).toMatch(/^7\.5% /);
    expect(line(c, "insurance").detail).toMatch(/^0\.5% /);
    expect(cc.scenarioVariables(c).join(" ")).toContain("se usó 7.5% como referencia");
    expect(cc.ratePct(0.15)).toBe("15%");
  });
});

describe("flete LCL: tarifa con centavos y por qué cambian los m³", () => {
  it("3.30 m³: tarifa Q1,551.27/m³ (antes Q1,551)", () => {
    const c = cc.calculateCosts({ price: 13.37, quantity: 7, volumeCbm: 3.3 });
    expect(line(c, "freight").detail).toContain("3.30 m³ × Q1,551.27/m³");
    // (review) the line is exactly volume shown × rate shown
    expect(cc.qCents(line(c, "freight").amount, fx)).toBe(cc.round2(3.3 * 1551.27));
    for (const v of [1, 2.37, 7.05, 14.9]) {
      const f = line(cc.calculateCosts({ price: 10, quantity: 10, volumeCbm: v }), "freight");
      const m = f.detail.match(/([\d.]+) m³[^×]*× Q([\d,]+\.\d\d)\/m³/)!;
      expect(cc.qCents(f.amount, fx), `${v} m³`).toBe(cc.round2(Number(m[1]) * Number(m[2].replace(/,/g, ""))));
    }
  });
  it("0.3 m³ → «1.00 m³ (mínimo cobrable)»; 800 kg sin volumen → «(por peso…)»", () => {
    expect(line(cc.calculateCosts({ price: 10, quantity: 10, volumeCbm: 0.3 }), "freight").detail).toContain("1.00 m³ (mínimo cobrable)");
    expect(line(cc.calculateCosts({ price: 10, quantity: 10, weightKg: 2500 }), "freight").detail).toContain("2.50 m³ (por peso: 1,000 kg = 1 m³)");
  });
});

describe("tarifas del servidor fuera de rango no rompen la estimación", () => {
  it("tipo de cambio 0, texto, ausente o 780 → 7.9; contenedor 0 m³ → 55; tasa >100% → defecto", () => {
    for (const exchangeRate of [0, "7.80x", undefined, 780, -1, NaN])
      expect(cc.sanitizeRates({ exchangeRate }).exchangeRate, String(exchangeRate)).toBe(7.9);
    expect(cc.sanitizeRates({ exchangeRate: "7.80" }).exchangeRate).toBe(7.8);
    expect(cc.sanitizeRates({ container40Cbm: 0 }).container40Cbm).toBe(55);
    expect(cc.sanitizeRates({ dutyRate: 15 }).dutyRate).toBe(0.15);
    expect(cc.sanitizeRates(null)).toEqual(cc.DEFAULT_RATES);
    const c = cc.calculateCosts({ price: 100, quantity: 10 }, cc.sanitizeRates({ exchangeRate: 0 }));
    expect(cc.formatQTotal(c, c.exchangeRate)).not.toMatch(/NaN|Infinity/);
  });
});

describe("Excel: líneas diminutas como en pantalla y PDF", () => {
  it("1 × US$0.0001: el % del producto es «<0.1%» (antes «0.0%») y los montos con 2 decimales", () => {
    const c = cc.calculateCosts({ price: 0.0001, quantity: 1 });
    const wb = buildCostWorkbook({ reportTitle: "t", supplierName: "Proveedor ficticio", productType: "machinery", destination: "Guatemala", quantity: 1, price: 0.0001, costs: c, vatRate: c.vatRate, insuranceRate: c.insuranceRate });
    const rows: { values: unknown[]; fmt: (string | undefined)[] }[] = [];
    wb.worksheets[0].eachRow((r) => rows.push({ values: (r.values as unknown[]).slice(1), fmt: (r.values as unknown[]).slice(1).map((_, i) => r.getCell(i + 1).numFmt) }));
    const product = rows.find((r) => String(r.values[0] || "").includes("FOB"))!;
    expect(product.values).toContain("<0.1%");
    expect(product.fmt.filter(Boolean)).not.toContain('"Q"#,##0.0000');
  });
});

describe("mensajes de rechazo: nombran el dato que el servidor rechazó", () => {
  it("cantidad, presupuesto, formato, correo no soportado y genérico", () => {
    expect(sealRefusalMessage("quantity_not_integer", es)).toMatch(/cantidad de tu caso no es válida/);
    expect(sealRefusalMessage("budget_above_max", es)).toMatch(/presupuesto de tu caso no es válido/);
    expect(sealRefusalMessage("invalid_fields", en)).toMatch(/not in a valid format/);
    expect(sealRefusalMessage("email_not_supported", es)).toMatch(/sin tildes/);
    expect(sealRefusalMessage(undefined, es)).toMatch(/Revisa tu nombre y correo/);
  });
  it("«invalid PDF» del informe no culpa al correo y pide descargar el PDF", () => {
    expect(reportRefusal400Message("invalid PDF", es)).toEqual({ message: expect.stringMatching(/No pudimos adjuntar el PDF/), downloadPdf: true });
    expect(reportRefusal400Message("a valid recipientEmail is required", es).message).toMatch(/Revisa el correo/);
  });
});

describe("textos en el idioma del cliente", () => {
  it("historial: en inglés se traduce y no se rotula dos veces", () => {
    const x = "Estimación anterior (ya no vigente): guantes de nitrilo · cantidad 2,000 · presupuesto US$60 · proveedor Acme · estimación Q1,000.00";
    expect(earlierLine(x, en)).toBe("Earlier estimate (no longer current): guantes de nitrilo · quantity 2,000 · budget US$60 · supplier Acme · estimate Q1,000.00");
    expect(earlierLine(x, es)).toBe(x);
    expect(earlierLine("bombas · cantidad 4", es)).toBe("Historial (ya no vigente): bombas · cantidad 4");
  });
  it("país del proveedor por nombre, no por código", () => {
    expect(countryName("CN")).not.toBe("CN");
  });
});

describe("caso repetido (02-11k: sin el token del caso no cambia nada)", () => {
  it("sin token: mensaje sin número de caso ni direcciones; con token: actualizado", async () => {
    const { receiptText } = await import("../src/utils/caseContext");
    const u = receiptText({ ok: true, status: 200, duplicate: true, unchanged: true, notified: true }, es);
    expect(u).toMatch(/No se creó un caso nuevo ni se cambió ninguno/);
    expect(u).not.toMatch(/SEAL-|@/);
    expect(receiptText({ ok: true, status: 200, id: "SEAL-1", duplicate: true, notified: true }, es)).toMatch(/lo actualizamos con esta información/);
  });
});
