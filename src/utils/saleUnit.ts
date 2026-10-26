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

/** Pairs per box/pack written in the title ("20 pairs/box", "carton of 12 pairs"), 0 = none. */
export function pairsFromTitle(title?: string): number {
  const t = String(title || "").toLowerCase();
  const rules: RegExp[] = [
    /(\d{1,4})\s*(?:pairs?|prs|pares)\s*(?:\/|per|por|in\s+(?:a|one|1)|a|each)\s*(?:box|boxes|carton|ctn|case|caja|bag|pack|package|paquete|bolsa|set)\b/,
    /\b(?:box|carton|ctn|case|caja|bag|pack|package|paquete|bolsa|set)\s*(?:of|de|con|with|x)\s*(\d{1,4})\s*(?:pairs?|prs|pares)\b/,
    /(\d{1,4})\s*-?\s*(?:pairs?|prs|pares)\s+(?:[\w-]+\s+){0,4}(?:box|carton|ctn|caja|pack|package|paquete|bolsa|set)\b/,
  ];
  for (const re of rules) {
    const m = t.match(re);
    const n = m ? parseInt(m[1], 10) : 0;
    if (n > 1 && n <= 2500) return n;
  }
  return 0;
}

/** Pieces per set/box/pack written in the title ("12 pcs/set", "box of 50", "12 colors set"). */
export function packSizeFromTitle(title?: string): number {
  const t = String(title || "").toLowerCase();
  // "box of 20 pairs" holds 40 pieces, not 20
  const pairs = pairsFromTitle(t);
  if (pairs > 1) return pairs * 2;
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
  pairsPerUnit?: number; // the title counts the content in pairs ("20 pairs/box" → 20; packSize is then 40 pieces)
  mixedWith?: string; // a mixed kit: the other items the title names ("cups")
}

// Words after "with/and" that describe the product, not another item in the set
const NOT_OTHER_ITEM = /^(?:ruedas?|capas?|a[nñ]os?|compartimentos?|cajones?|drawers?|velocidades?|tama[nñ]os?|patas?|tonos?|niveles?|puertas?|quemadores?|agujas?|cabezal(?:es)?|garant[ií]as?|piezas?|modos?|funciones?|bolsillos?|crafts?|dividers?|zippers?|handles?|asas?|tapas?|lids?|caps?|legs?|tiers?|shelves|estantes?|repisas?|pcs|pieces?|piezas?|units?|colou?rs?|colores|sizes?|tallas?|logos?|designs?|dise[nñ]os?|packs?|boxes|sets?|holes?|pockets?|bolsillos?|batter(?:y|ies)|wheels?|speeds?|layers?|compartments?|levels?|modes?|ports?|slots?|doors?|years?|months?|hours?|needles?|heads?|gears?|burners?|patterns?|prints?|styles?|options?|features?|functions?|usb|leds?|lights?|ml|kgs?|lbs?|inch(?:es)?|cm|mm|watts?|volts?)$/;

/**
 * The other items a mixed kit holds ("Glass bottle with 2 cups gift set" → "cups",
 * "Bottle and cup set" → "cup"), "" if none. Only in a set/kit/gift context, and
 * "with/con" needs a count ("with 2 cups"): "with handles", "con borradores" are features.
 */
export function mixedKitItems(title?: string): string {
  const t = ` ${String(title || "").toLowerCase().replace(/[(),]/g, " ")} `;
  if (!/\b(?:sets?|kits?|gift|combo|juegos?|estuches?|regalo)\b/.test(t)) return "";
  const found: string[] = [];
  const re = /\s(with|and|&|\+|plus|includ(?:es|ing)|con|y|incluye)\s+(?:(\d{1,3})\s*(?:pcs?\s+|pieces?\s+|piezas?\s+)?)?([a-záéíóúñ]{3,})\b/g;
  for (const m of t.matchAll(re)) {
    const [, conn, count, w] = m;
    if (NOT_OTHER_ITEM.test(w) || /^(?:sets?|kits?|gift|combo|juegos?|regalo|the|a|an|el|la|los|las|un|una)$/.test(w)) continue;
    if (/^(?:with|con|includ(?:es|ing)|incluye)$/.test(conn) && !count) continue;
    // "and/y" without a count: only a plural noun is another item ("bottle and cups");
    // "black and white", "hot and cold" are descriptions
    if (/^(?:and|y|plus)$/.test(conn) && !count && !(/s$/.test(w) && !/ss$/.test(w)) && !/^(?:cup|mug|spoon|fork|knife|plate|bowl|straw|saucer|bottle|brush|comb|towel|taza|vaso|cuchara|tenedor|cuchillo|plato|taz[oó]n|botella|cepillo|toalla)$/.test(w)) continue;
    found.push(w);
  }
  return [...new Set(found)].join(", ");
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
  // a pair holds two pieces by definition (a "20 pairs/box" title doesn't change that)
  if (fromMoq === "pair") packSize = 2;
  if (fromMoq === "dozen" && !(packSize > 1)) packSize = 12;
  let unit: SaleUnit = fromMoq;
  // "piece" from the MOQ text plus "set of 12" in the title: trust the platform's unit
  if (!unit && packSize > 1) unit = unitFromTitle(s?.productName) || "set";
  const multi = (!!unit && unit !== "piece") || (packSize > 1 && unit !== "piece");
  // A mixed kit ("bottle with 2 cups, 3 pcs set"): the title's count mixes items,
  // so it is not the number of the client's product in each set — it must be asked
  const mixedWith = multi && unit !== "pair" ? mixedKitItems(s?.productName) : "";
  if (mixedWith) return { unit, packSize: 0, multi, mixedWith };
  const pairs = unit !== "pair" && unit !== "piece" ? pairsFromTitle(s?.productName) : 0;
  return { unit, packSize: unit === "piece" ? 0 : packSize, multi, ...(pairs > 1 && packSize === pairs * 2 ? { pairsPerUnit: pairs } : {}) };
}

/**
 * What the client's own quantity refers to, from their description:
 * "500 lápices" / "500 piezas" → "piece"; "500 paquetes" / "500 cajas" → "pack".
 * A negated mention ("no 500 paquetes") does not count. "" when it's unclear.
 */
// "pair" / "dozen": the client counts pairs or dozens ("1000 pares de guantes"), which are
// pieces × 2 / × 12 unless the listing also sells by the pair or dozen
export type QtyIntent = "piece" | "pack" | "pair" | "dozen" | "";
interface QtyRead { intent: QtyIntent; word: string }
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
    (m) =>
      !m[1] &&
      !new RegExp(`^${PACK}$`).test(m[2]) &&
      !new RegExp(`^${MEASURE}$`).test(m[2]) &&
      // "para 20 escuelas", "tengo 3 tiendas", "de 2 colores": not what is being counted
      !/(?:^|\s)(?:para|for|tengo|have|de|of|con|with)\s+$/.test(t.slice(0, m.index! + (m[0].length - m[0].trimStart().length))),
  );
  // The counted word must be a unit ("piezas", "unidades") or the product itself
  // ("Botellas de vidrio, 240 botellas"); any other word after a number
  // ("240 capacidad", "500 aprox") is not what is being counted.
  const UNIT_WORD = /^(?:piezas?|unidades?|units?|pieces?|pcs|pzas?|art[ií]culos?|items?)$/;
  const STOP = /^(?:quiero|queremos|necesito|necesitamos|busco|buscamos|importar|comprar|cotizar|traer|pedir|unos?|unas?|para|con|sin|los|las|del|que|una|i|we|need|want|buy|import|quote|about|aprox\w*|approx\w*|around|some|proveedor(?:es)?|suppliers?|precios?|prices?|productos?|products?|modelos?|models?|varios|varias|tipos?|types?|muestras?|samples?|cotizaci[oó]n(?:es)?|quotes?|contenedor(?:es)?|containers?|gracias|thanks|son|hola|hello|info|informaci[oó]n)$/;
  const words = t.match(/[a-záéíóúüñ]{3,}/g) || [];
  const head = words.find((w) => !STOP.test(w)) || "";
  const stem = (w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(?:es|s)$/, "").slice(0, 5);
  const valid = (w: string) => UNIT_WORD.test(w) || (!!head && stem(w) === stem(head)) || words.filter((x) => stem(x) === stem(w)).length > 1;
  const counted = pieces.filter((m) => valid(m[2]));
  if (counted.length && !packs.length) return { intent: "piece", word: counted[0][2] };
  if (pieces.length && !counted.length && !packs.length) return { intent: "", word: "" };
  if (packs.length && !pieces.length) {
    const w = packs[0][2];
    return { intent: /^(?:pares|par|pairs?)$/.test(w) ? "pair" : /^(?:docenas?|dozens?)$/.test(w) ? "dozen" : "pack", word: w };
  }
  return { intent: "", word: "" };
}

/**
 * What the client's own quantity refers to, from their description:
 * "500 lápices" / "500 piezas" → "piece"; "500 paquetes" / "500 cajas" → "pack".
 * A negated mention ("no 500 paquetes") does not count. "" when it's unclear.
 */
export function quantityIntent(description?: string): QtyIntent {
  return readQuantity(description).intent;
}

/** The client's product noun ("Botellas de vidrio de 500 ml" → "botellas"), "" when unclear. */
export function productNoun(description?: string): string {
  const { intent, word } = readQuantity(description);
  if (intent === "piece" && !/^(?:piezas?|unidades?|units?|pieces?|pcs|pzas?)$/.test(word)) return word;
  const STOP = /^(?:quiero|queremos|necesito|necesitamos|busco|buscamos|importar|comprar|cotizar|traer|pedir|unos?|unas?|para|con|sin|los|las|del|que|una|i|we|need|want|buy|import|quote|some|about|proveedor(?:es)?|suppliers?|precios?|prices?|productos?|products?|modelos?|models?|varios|varias|tipos?|types?|muestras?|samples?|cotizaci[oó]n(?:es)?|quotes?|contenedor(?:es)?|containers?|gracias|thanks|son|hola|hello|info|informaci[oó]n|limpieza|cleaning)$/;
  // "Productos de limpieza, 500 botellas": the plural noun counted after a number
  const counted = [...String(description || "").toLowerCase().matchAll(/(?:^|[\s,;])(\S+\s+)?\d[\d.,]*\s+([a-záéíóúüñ]{3,}s)\b/g)]
    .filter((m) => !/^(?:de|del|con|of|with|para|for|tengo|have|en|in|a)\s+$/.test(m[1] || ""))
    .map((m) => m[2])
    .filter((w) => !NOT_OTHER_ITEM.test(w) && !/^(?:tiendas|escuelas|sucursales|clientes|stores|schools|branches|customers|colores|colors|colours)$/.test(w))
    .find((w) => !STOP.test(w) && !/^(?:piezas|unidades|units|pieces|pcs|cajas|sets|paquetes|bolsas|pares|docenas|kgs|kilos|gramos|litros|metros|toneladas|agujas|needles|horas|d[ií]as|meses|a[nñ]os)$/.test(w));
  if (counted) return counted;
  // "1000 pares de guantes": the product counted in pairs or dozens
  const pd = String(description || "").toLowerCase().match(/\b(?:pares|pairs|docenas|dozens)\s+(?:de|of)\s+([a-záéíóúüñ]{3,}s)\b/);
  if (pd) return pd[1];
  const of = String(description || "").toLowerCase().match(/\b(?:piezas?|unidades?|units?|pieces?)\s+(?:de|of)\s+([a-záéíóúüñ]{3,}s)\b/);
  if (of) return of[1];
  const words = (String(description || "").toLowerCase().match(/[a-záéíóúüñ]{3,}/g) || []).filter((w) => !STOP.test(w) && !/^(?:piezas?|unidades?|units?|pieces?)$/.test(w));
  // the first plural noun ("Tengo 3 tiendas y quiero botellas" → "botellas"); only a
  // plural reads naturally in "¿Cuántas botellas…?"
  const w = words.find((x) => /s$/.test(x) && !/ss$/.test(x) && !NOT_OTHER_ITEM.test(x) && !/^(?:piezas|unidades|cajas|sets|paquetes|tiendas|escuelas|sucursales|clientes|stores|schools|branches|customers|colores|colors|colours|tengo|has|was|this|plus|less|yes|yes)$/.test(x)) || "";
  return w;
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
