// Alibaba publishes the price per sale unit: piece, set, box, pack…
// A "set of 12 pencils" priced per set is not the price of one pencil, so the
// tool shows the unit and, when the title says it, how many pieces it holds.
import { Lx } from "./lang";

export type SaleUnit =
  | "piece" | "set" | "box" | "pack" | "carton" | "dozen" | "pair"
  | "bag" | "roll" | "meter" | "kilogram" | "ton" | "";

const WORDS: Record<string, [string, string, string, string]> = {
  piece: ["unidad", "unidades", "unit", "units"],
  set: ["set", "sets", "set", "sets"],
  box: ["caja", "cajas", "box", "boxes"],
  pack: ["paquete", "paquetes", "pack", "packs"],
  carton: ["cartón", "cartones", "carton", "cartons"],
  dozen: ["docena", "docenas", "dozen", "dozens"],
  pair: ["par", "pares", "pair", "pairs"],
  bag: ["bolsa", "bolsas", "bag", "bags"],
  roll: ["rollo", "rollos", "roll", "rolls"],
  meter: ["metro", "metros", "meter", "meters"],
  kilogram: ["kilo", "kilos", "kilogram", "kilograms"],
  ton: ["tonelada", "toneladas", "ton", "tons"],
};

/** "unidad/unidades", "set/sets", "caja/cajas"… in the current language. */
export function unitWordFor(unit: string | undefined, n: number): string {
  const w = WORDS[unit || "piece"] || WORDS.piece;
  return n === 1 ? Lx(w[0], w[2]) : Lx(w[1], w[3]);
}

/** Pieces per set/box/pack written in the title ("12 pcs/set", "box of 50", "12 colors set"). */
export function packSizeFromTitle(title?: string): number {
  const t = String(title || "").toLowerCase();
  const rules: RegExp[] = [
    /(\d{1,4})\s*(?:pcs|pc|pieces?|piezas?|pzs|unidades|units?)\s*(?:\/|per|por|in\s+(?:a|one|1))\s*(?:set|box|pack|bag|caja|paquete|bolsa)/,
    /(?:set|box|pack|bag|caja|paquete|bolsa)\s*(?:of|de|con|with)\s*(\d{1,4})\b/,
    /(\d{1,4})\s*-?\s*(?:pcs|pieces|piezas|pzs)\s+(?:\w+\s+){0,3}(?:set|box|pack|kit)\b/,
    /(\d{1,4})\s*-?\s*(?:pack|pk|count|ct)\b/,
    /(\d{1,4})\s*(?:colou?rs?|colores)\b(?=.*\b(?:set|box|pack|caja|kit)\b)/,
  ];
  for (const re of rules) {
    const m = t.match(re);
    const n = m ? parseInt(m[1], 10) : 0;
    if (n > 1 && n <= 5000) return n;
  }
  if (/\bdozen\b|\bdocena\b/.test(t)) return 12;
  return 0;
}

function unitFromTitle(title?: string): SaleUnit {
  const t = String(title || "").toLowerCase();
  if (/\b(set|kit)\b/.test(t)) return "set";
  if (/\b(box|caja)\b/.test(t)) return "box";
  if (/\b(pack|paquete)\b/.test(t)) return "pack";
  return "";
}

export interface SaleUnitInfo {
  unit: SaleUnit; // "" when the platform doesn't say
  packSize: number; // pieces per unit from the title, 0 = unknown
  multi: boolean; // the unit is not a single piece (or holds several)
}

export function saleUnitInfo(s?: { saleUnit?: string; productName?: string } | null): SaleUnitInfo {
  const fromMoq = (s?.saleUnit || "") as SaleUnit;
  const packSize = packSizeFromTitle(s?.productName);
  let unit: SaleUnit = fromMoq;
  // "piece" from the MOQ text plus "set of 12" in the title: trust the platform's unit
  if (!unit && packSize > 1) unit = unitFromTitle(s?.productName) || "set";
  const multi = (!!unit && unit !== "piece") || (packSize > 1 && unit !== "piece");
  return { unit, packSize: unit === "piece" ? 0 : packSize, multi };
}
