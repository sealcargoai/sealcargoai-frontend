// Cost scenario: the client's quantity converted to the platform's sale unit
// (pieces, pairs, dozens, boxes), minimum order notes and the purchase budget.
import { describe, it, expect } from "vitest";
import { resolveScenario } from "../src/utils/scenario";
import { calculateCosts } from "../src/utils/costCalculator";
import { budgetNote, smallOrderNote } from "../src/utils/costNotes";
import { formatQ } from "../src/utils/costCalculator";

const sc = (supplier: Record<string, unknown>, description: string, qty: number, choices = {}) =>
  resolveScenario(supplier, choices, { requestedQty: qty, productType: "", description });

describe("quantity in the platform's sale unit", () => {
  it("1,000 pairs vs boxes of 100 pieces = 20 boxes (never 1,000 boxes)", () => {
    const r = sc({ saleUnit: "box", productName: "Nitrile Gloves 100pcs/box", price: 3.2, moq: 10 }, "1000 pares de guantes de nitrilo", 1000);
    expect(r.quantity).toBe(20);
    expect(r.requestedPieces).toBe(2000);
    expect(r.notes.join(" ")).toMatch(/1,000 pares = 2,000 piezas/);
  });
  it("501 pairs vs boxes of 20 pairs = 26 boxes", () => {
    const r = sc({ saleUnit: "box", productName: "Safety shoes 20 pairs/box", price: 200, moq: 5 }, "501 pares de zapatos", 501);
    expect(r.quantity).toBe(26);
  });
  it("50 dozens vs boxes of 100 pieces = 6 boxes", () => {
    const r = sc({ saleUnit: "box", productName: "Pencils 100pcs/box", price: 3, moq: 5 }, "50 docenas de lápices", 50);
    expect(r.quantity).toBe(6);
  });
  it("pairs vs a listing sold per pair stay pairs", () => {
    const r = sc({ saleUnit: "pair", productName: "Safety shoes", price: 12, moq: 100 }, "501 pares de zapatos", 501);
    expect(r.quantity).toBe(501);
  });
  it("pairs vs a listing sold per piece become pieces, with the other reading in the note", () => {
    const r = sc({ saleUnit: "piece", productName: "Disposable gloves", price: 0.03, moq: 10000 }, "1000 pares de guantes", 1000);
    expect(r.quantity).toBe(2000);
    expect(r.notes.join(" ")).toMatch(/serían 1,000 unidades/);
  });
  it("pairs vs a listing without unit are not converted silently", () => {
    const r = sc({ saleUnit: "", productName: "Work gloves", price: 1, moq: 5 }, "1000 pares de guantes", 1000);
    expect(r.quantity).toBe(1000);
    expect(r.notes.join(" ")).toMatch(/no indica si su precio es por par o por pieza/);
  });
  it("box content unknown: asks for it instead of assuming", () => {
    const r = sc({ saleUnit: "box", productName: "Nitrile gloves box", price: 3, moq: 5 }, "1000 pares de guantes", 1000);
    expect(r.needsUnitDecision).toBe(true);
    const r2 = sc({ saleUnit: "box", productName: "Nitrile gloves box", price: 3, moq: 5 }, "1000 pares de guantes", 1000, { customPack: 100 });
    expect(r2.quantity).toBe(20);
  });
  it("minimum order above the client's quantity is noted", () => {
    const r = sc({ saleUnit: "box", productName: "Nitrile Gloves 100pcs/box", price: 3.2, moq: 100 }, "1000 guantes de nitrilo", 1000);
    expect(r.quantity).toBe(10);
    expect(r.moqNote).toMatch(/100 cajas.*10 cajas.*por debajo del mínimo/);
  });
});

describe("purchase budget is compared with the supplier purchase only", () => {
  const costs = calculateCosts({ price: 25, quantity: 300, volumeCbm: 0, weightKg: 0, saleUnit: "piece" });
  const Q = (usd: number) => formatQ(usd, costs.exchangeRate);
  it("over budget", () => {
    const n = budgetNote(costs, 7000, Q);
    expect(n).toMatch(/US\$7,500\.00, supera tu presupuesto de compra de US\$7,000\.00 por US\$500\.00/);
    expect(n).toMatch(/solo para la compra al proveedor/);
  });
  it("within budget", () => {
    expect(budgetNote(costs, 8000, Q)).toMatch(/dentro de tu presupuesto/);
  });
  it("no budget, no note", () => {
    expect(budgetNote(costs, 0, Q)).toBe("");
  });
  it("small order note when fixed charges exceed the product", () => {
    const small = calculateCosts({ price: 2, quantity: 50, volumeCbm: 0, weightKg: 0, saleUnit: "piece" });
    expect(smallOrderNote(small, "unidad", (u) => formatQ(u, small.exchangeRate))).toMatch(/cargos que no dependen de la cantidad/);
    expect(smallOrderNote(costs, "unidad", Q)).toBe("");
  });
});
