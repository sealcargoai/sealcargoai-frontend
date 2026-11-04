// 02-11s — Proveedores: una contradicción explícita sale de las recomendaciones antes de ordenar; un dato
// ausente queda «por confirmar» y nunca se mezcla con las coincidencias claras. Datos ficticios.
import { describe, it, expect } from "vitest";
import { listingVerdict } from "../src/utils/differences";
import { groupByVerdict, sortWithinGroups } from "../src/utils/verdictGroups";
import { flagComponents } from "../src/utils/componentMatch";

const verdict = (d: string, t: string) => listingVerdict(d, flagComponents([{ productName: t, price: 10 }], d)[0]).verdict;

describe("los tres falsos positivos de la auditoría", () => {
  it.each([
    ["Guantes desechables sin látex", "Latex disposable gloves"],
    ["Compresor industrial de tornillo 220 V", "Industrial screw compressor 380V"],
    ["Botas con puntera compuesta", "Steel toe safety boots"],
  ])("%s ≠ «%s» → incompatible", (d, t) => expect(verdict(d, t)).toBe("incompatible"));
});

describe("coincidencias válidas que no deben excluirse", () => {
  it.each([
    ["Guantes desechables sin látex", "Disposable nitrile gloves latex free powder free"],
    ["Guantes desechables sin látex", "Latex-free disposable examination gloves"],
    ["Guantes desechables sin látex", "Non-latex disposable gloves"],
    ["Compresor industrial de tornillo 220 V", "Industrial screw air compressor 220V 60Hz"],
    ["Botas con puntera compuesta", "Composite toe safety boots"],
    ["Botas con puntera compuesta", "Non-metallic toe cap safety boots"],
  ])("%s ↔ «%s» → match", (d, t) => expect(verdict(d, t)).toBe("match"));
});

describe("dato ausente u opciones: por confirmar", () => {
  it.each([
    ["Guantes desechables sin látex", "Disposable gloves"],
    ["Compresor industrial de tornillo 220 V", "Industrial screw air compressor"],
    ["Compresor industrial de tornillo 220 V", "Screw air compressor 220V/380V/415V"],
    ["Botas con puntera compuesta", "Safety boots for construction"],
  ])("%s ↔ «%s» → confirm", (d, t) => expect(verdict(d, t)).toBe("confirm"));
});

describe("negaciones ES/EN, accesorios y títulos ambiguos", () => {
  it("EN: «latex-free» pedido, título de látex → incompatible; título «latex free» → match", () => {
    expect(verdict("Disposable gloves, latex-free", "Powder free latex gloves")).toBe("incompatible");
    expect(verdict("Disposable gloves, latex-free", "Latex free nitrile gloves")).toBe("match");
  });
  it("«no 380 V» y «not 380V» excluyen el 380 V", () => {
    expect(verdict("Compresor de tornillo, no 380 V", "Screw compressor 380V")).toBe("incompatible");
    expect(verdict("Screw compressor 220V, not 380V", "Screw compressor 380V 3 phase")).toBe("incompatible");
  });
  it("la pieza suelta no es el producto: «toe cap for safety shoes» → incompatible", () => {
    expect(verdict("Botas con puntera compuesta", "Composite toe cap for safety shoes")).toBe("incompatible");
  });
  it("un título que menciona acero y compuesto a la vez no es coincidencia clara", () => {
    expect(verdict("Botas con puntera compuesta", "Steel toe or composite toe safety boots")).not.toBe("match");
  });
});

describe("recorrido de la lista: excluir antes de ordenar; grupos separados", () => {
  const D = "Compresor industrial de tornillo 220 V";
  const list = [
    // the platform's order: the incompatible one first and cheapest, with the best reputation
    { productName: "Industrial screw compressor 380V", price: 900, rating: 5 },
    { productName: "Industrial screw air compressor", price: 1000, rating: 4.9 },
    { productName: "Industrial screw air compressor 220V 60Hz", price: 1500, rating: 4.1 },
  ];
  it("la incompatible sale aunque sea la más barata y mejor valorada; la clara va antes que la por confirmar", () => {
    const g = groupByVerdict(list, D);
    expect(g.excluded.map((x) => x.item.productName)).toEqual(["Industrial screw compressor 380V"]);
    expect(g.excluded[0].reasons[0]).toMatch(/380 V; solicitaste 220 V/);
    expect(g.shown.map((s) => [s.productName, s.verdict])).toEqual([
      ["Industrial screw air compressor 220V 60Hz", "match"],
      ["Industrial screw air compressor", "confirm"],
    ]);
    expect(g.shown[1].verdictNotes.join(" ")).toMatch(/no indica el voltaje/);
  });
  it("ordenar por precio no sube una «por confirmar» sobre una clara", () => {
    const g = groupByVerdict(list, D);
    const byPrice = sortWithinGroups(g.shown, (l) => [...l].sort((a, b) => a.price - b.price));
    expect(byPrice.map((s) => s.verdict)).toEqual(["match", "confirm"]);
  });
  it("cero coincidencias: si todas contradicen, no se muestra ninguna (la página dice por qué y ofrece a SEAL)", () => {
    const g = groupByVerdict([{ productName: "Latex disposable gloves" }, { productName: "Latex examination gloves powdered" }], "Guantes desechables sin látex");
    expect(g.shown).toEqual([]);
    expect(g.excluded).toHaveLength(2);
  });
  it("sin requisitos comprobables todo queda como está (no se inventan exclusiones)", () => {
    const g = groupByVerdict([{ productName: "Plastic stackable chairs" }, { productName: "Stackable event chairs" }], "Sillas apilables para eventos");
    expect(g.excluded).toEqual([]);
    expect(g.shown.map((s) => s.productName)).toEqual(["Plastic stackable chairs", "Stackable event chairs"]);
  });
});
