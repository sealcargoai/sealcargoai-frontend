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
    /(\d{1,4})\s*(?:pcs?|pieces?|piezas?)?\s*\/\s*(?:set|box|pack|bag|caja|paquete|bolsa)\b/,
    // "set of 12", "box of 50 pens", "caja de 100 piezas"; not "backpack with 3 pockets"
    // nor "kit with 2 batteries" (a feature, not the content)
    /\b(?:set|box|pack|bag|caja|paquete|bolsa|kit)\s*(?:of|de)\s*(\d{1,4})\b/,
    /\b(?:set|box|pack|bag|caja|paquete|bolsa|kit)\s*(?:con|with)\s*(\d{1,4})(?!\s*-?\s*(?:pockets?|bolsillos?|batter(?:y|ies)|bater[ií]as?|speeds?|velocidades?|layers?|capas?|compartments?|compartimentos?|drawers?|cajones?|wheels?|ruedas?|heads?|cabezal(?:es)?|needles?|agujas?|gears?|levels?|niveles?|modes?|modos?|ports?|puertos?|slots?|doors?|puertas?|burners?|quemadores?|holes?|years?|a[nñ]os?|months?|meses|hours?|horas?|w\b|v\b|kg\b|g\b|l\b|ml\b|mm\b|cm\b|m\b|inch|pulgadas?|"))/,
    /(\d{1,4})\s*-?\s*(?:pcs|pc|pieces?|piezas?|pzs)\s+(?:[\w-]+\s+){0,4}(?:set|box|pack|kit|caja|paquete|estuche)\b/,
    /\b(?:set|box|pack|kit|caja|paquete|estuche)\b(?:\s+[\w-]+){0,3}\s+(\d{1,4})\s*-?\s*(?:pcs|pc|pieces?|piezas?|pzs)\b/,
    /(\d{1,4})\s*-?\s*(?:pack|pk|count|ct)\b/,
    /(\d{1,4})\s*(?:colou?rs?|colores)\b(?=.*\b(?:set|box|pack|caja|kit)\b)/,
    /\b(?:set|box|pack|caja|kit|estuche)\b.*?\b(\d{1,4})\s*(?:colou?rs?|colores)\b/,
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

// A machine, appliance or piece of furniture sold "per set" is one unit unless
// the title says the set holds several pieces.
const WHOLE_ITEM_TYPES = new Set(["machinery", "electronics", "furniture"]);

export function saleUnitInfo(s?: { saleUnit?: string; productName?: string } | null, productType = ""): SaleUnitInfo {
  const fromMoq = (s?.saleUnit || "") as SaleUnit;
  let packSize = packSizeFromTitle(s?.productName);
  // The platform sells per set/box/pack and the title mentions "12 pcs" on its own:
  // take it as the content of each unit (shown as an assumption to confirm)
  if (!packSize && fromMoq && fromMoq !== "piece") {
    const m = String(s?.productName || "").toLowerCase().match(/\b(\d{1,4})\s*-?\s*(?:pcs|pc|pieces?|piezas?|pzs|count|ct)\b/);
    const n = m ? parseInt(m[1], 10) : 0;
    if (n > 1 && n <= 5000) packSize = n;
  }
  if (WHOLE_ITEM_TYPES.has(productType) && !(packSize > 1)) return { unit: "piece", packSize: 0, multi: false };
  // a pair holds two pieces by definition
  if (fromMoq === "pair" && !(packSize > 1)) packSize = 2;
  let unit: SaleUnit = fromMoq;
  // "piece" from the MOQ text plus "set of 12" in the title: trust the platform's unit
  if (!unit && packSize > 1) unit = unitFromTitle(s?.productName) || "set";
  const multi = (!!unit && unit !== "piece") || (packSize > 1 && unit !== "piece");
  return { unit, packSize: unit === "piece" ? 0 : packSize, multi };
}

/**
 * What the client's own quantity refers to, from their description:
 * "500 lápices" / "500 piezas" → "piece"; "500 paquetes" / "500 cajas" → "pack".
 * A negated mention ("no 500 paquetes") does not count. "" when it's unclear.
 */
interface QtyRead { intent: "piece" | "pack" | ""; word: string }
function readQuantity(description?: string): QtyRead {
  const PACK = "(?:paquetes?|sets?|juegos?|cajas?|docenas?|estuches?|packs?|boxes|box|dozens?|cartons?|cartones?|kits?|pares|par|pairs?|bolsas?|bags?|rollos?|rolls?)";
  const t = ` ${String(description || "").toLowerCase()} `
    // "5 mil cajas" = 5000 cajas
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mil|thousand)\b/g, (_, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000)))
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mill[oó]n(?:es)?|millions?)\b/g, (_, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1e6)))
    // "1000 individual gloves": the counted word is "gloves"
    .replace(/(\d[\d.,]*)\s+(?:individual(?:es)?|single|loose|separate|sueltos?|sueltas?|unitari[oa]s?)\s+/g, "$1 ")
    // the content of each pack is not the order quantity: "cajas de 100 piezas", "set of 12"
    .replace(new RegExp(`(${PACK})\\s+(?:de|of|con|with|x)\\s+\\d[\\d.,]*(?:\\s*[a-záéíóúüñ]+)?`, "g"), "$1 ");
  const MEASURE = "(?:kg|kgs|kilos?|g|gramos?|t|ton|toneladas?|l|lts?|litros?|ml|m|metros?|cm|mm|m2|m3|w|kw|v|hp|hz|agujas?|needles?|cabezal(?:es)?|heads?|%)";
  const num = "\\d[\\d.,]*";
  const NEG = "(\\b(?:no|not|ni|nor|sin|without)\\s+(?:en\\s+|in\\s+)?)?";
  const packs = [...t.matchAll(new RegExp(`${NEG}${num}\\s*(${PACK})\\b`, "g"))].filter((m) => !m[1]);
  // a number followed by a word that is not packaging nor a measure: "500 lápices", "500 piezas"
  const pieces = [...t.matchAll(new RegExp(`${NEG}${num}\\s+([a-záéíóúüñ]{3,})`, "g"))].filter(
    (m) => !m[1] && !new RegExp(`^${PACK}$`).test(m[2]) && !new RegExp(`^${MEASURE}$`).test(m[2]),
  );
  // The counted word must be a unit ("piezas", "unidades") or the product itself
  // ("Botellas de vidrio, 240 botellas"); any other word after a number
  // ("240 capacidad", "500 aprox") is not what is being counted.
  const UNIT_WORD = /^(?:piezas?|unidades?|units?|pieces?|pcs|pzas?|art[ií]culos?|items?)$/;
  const STOP = /^(?:quiero|queremos|necesito|necesitamos|busco|buscamos|importar|comprar|cotizar|traer|pedir|unos?|unas?|para|con|sin|los|las|del|que|una|i|we|need|want|buy|import|quote|about|aprox\w*|approx\w*|around|some)$/;
  const words = t.match(/[a-záéíóúüñ]{3,}/g) || [];
  const head = words.find((w) => !STOP.test(w)) || "";
  const stem = (w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(?:es|s)$/, "").slice(0, 5);
  const valid = (w: string) => UNIT_WORD.test(w) || (!!head && stem(w) === stem(head)) || words.filter((x) => stem(x) === stem(w)).length > 1;
  const counted = pieces.filter((m) => valid(m[2]));
  if (counted.length && !packs.length) return { intent: "piece", word: counted[0][2] };
  if (pieces.length && !counted.length && !packs.length) return { intent: "", word: "" };
  if (packs.length && !pieces.length) return { intent: "pack", word: packs[0][2] };
  return { intent: "", word: "" };
}

/**
 * What the client's own quantity refers to, from their description:
 * "500 lápices" / "500 piezas" → "piece"; "500 paquetes" / "500 cajas" → "pack".
 * A negated mention ("no 500 paquetes") does not count. "" when it's unclear.
 */
export function quantityIntent(description?: string): "piece" | "pack" | "" {
  return readQuantity(description).intent;
}

/** The word the client counted with ("guantes", "lápices", "cajas"), "" when unclear. */
export function quantityWord(description: string | undefined, n: number): string {
  const { intent, word } = readQuantity(description);
  if (!intent) return "";
  if (n !== 1) return word;
  // singular of the counted word
  const one: Record<string, string> = { cajas: "caja", sets: "set", paquetes: "paquete", juegos: "juego", docenas: "docena", estuches: "estuche", boxes: "box", packs: "pack", kits: "kit", piezas: "pieza", pieces: "piece", pares: "par", pairs: "pair", bolsas: "bolsa", bags: "bag", rollos: "rollo", rolls: "roll", unidades: "unidad", units: "unit" };
  if (one[word]) return one[word];
  if (/ces$/.test(word)) return word.replace(/ces$/, "z"); // lápices → lápiz
  if (/ones$/.test(word)) return word.replace(/ones$/, "ón"); // camiones → camión
  if (/[lnrdjy]es$/.test(word)) return word.replace(/es$/, ""); // colores → color
  return word.replace(/s$/, ""); // guantes → guante, gloves → glove
}
