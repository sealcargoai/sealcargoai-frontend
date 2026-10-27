// Chat answers: short, honest, and tied to the product the client actually
// named. Without a known product the answer stays general and asks for it.
import { Lx } from "./lang";
import { inferCategory, FOOD_USE, CATEGORY_KEYWORDS } from "./category";
import { wantedText } from "./useMatch";

export interface ChatCtx {
  product: string; // what the client said they import ("" when unknown)
}

// "son lápices escolares", "es un molino", "mi producto es…", "quiero importar…"
const STATEMENT =
  /^\s*(?:no[,.]?\s+)?(?:(?:te\s+(?:aclaro|digo|dije|repito|coment[eé])|ya\s+te\s+(?:dije|indiqu[eé])|como\s+te\s+dije|repito|aclaro|i\s+(?:said|told\s+you)|as\s+i\s+said)\s+(?:que\s+|that\s+)?)?(?:(?:en\s+realidad|realmente|perd[oó]n|corrijo)[,.]?\s+)?(?:son|es|eran|era|se\s+trata\s+de|mi\s+producto\s+es|el\s+producto\s+es|lo\s+que\s+importo\s+(?:es|son)|quiero\s+importar|voy\s+a\s+importar|importar[eé]|hablo\s+de|me\s+refiero\s+a|(?:they|it)\s+(?:are|is)|it's|my\s+product\s+is|i(?:'m|\s+am)\s+importing|i\s+want\s+to\s+import|i\s+mean)\s+(.{3,120}?)\s*[.!]?\s*$/i;

// verbs that clearly introduce the product; "es …" / "son …" alone also start
// ordinary sentences ("es confiable este proveedor"), so they need a product word
const STRONG = /^\s*(?:no[,.]?\s+)?(?:mi\s+producto\s+es|el\s+producto\s+es|lo\s+que\s+importo\s+(?:es|son)|quiero\s+importar|voy\s+a\s+importar|importar[eé]|se\s+trata\s+de|my\s+product\s+is|i(?:'m|\s+am)\s+importing|i\s+want\s+to\s+import)(?=\s|$)/i;
const QUESTION_WORD = /^(?:¿)?\s*(?:qu[eé]|c[oó]mo|cu[aá]nt[oa]s?|cu[aá]l(?:es)?|d[oó]nde|cu[aá]ndo|por\s*qu[eé]|qui[eé]n|puedo|puedes|pueden|hay|tienen|tiene|es\s+(?:confiable|seguro|real|verdad|posible|necesario|cierto)|what|how|which|where|when|why|who|can|is|are|do|does)\b/i;
const NOT_A_PRODUCT = /^(?:desde|de|del|a|algo|cosas|productos|mercader[ií]a|urgente|from|something|stuff|goods|products|confiable|seguro|segura|real|verdad|posible|necesario|cierto|caro|barato|legal|ilegal|bueno|malo|el\s+proveedor|este\s+proveedor|la\s+aduana|reliable|safe|true|possible|legit|expensive|cheap)\b/i;

/** The product the message states, or null. */
export function productFromMessage(text: string): string | null {
  const t = String(text || "").trim();
  const m = t.replace(/[¿?]/g, "").match(STATEMENT);
  // the verb itself ("quiero importar") is not a question about customs
  const asks = /\?/.test(t) || QUESTION_WORD.test(t) || replyKinds(m ? m[1] : t).length > 0;
  if (m) {
    // the product ends where a question or another clause starts
    const cap = clean(m[1].split(/[,;¿]|\s+(?:y|and|pero|but)\s+(?:qu[eé]|c[oó]mo|cu[aá]nto|necesit|what|how|do|does)\b/i)[0]);
    if (!cap || NOT_A_PRODUCT.test(cap) || QUESTION_WORD.test(cap)) return null;
    // a strong verb names the product; "es/son …" or a question need a product word
    if ((STRONG.test(t) && !asks) || inferCategory(cap) !== "other") return cap;
    return null;
  }
  // a bare product name ("lápices escolares") right after a question about it
  if (!asks && t.split(/\s+/).length <= 4 && inferCategory(t) !== "other") return clean(t);
  // a product named inside a longer sentence ("mi pregunta era por lápices escolares")
  if (!asks) return productMention(t);
  return null;
}

/** The product a message mentions, even inside a question ("¿el CE sirve para lápices escolares?"). */
export function productMention(text: string): string | null {
  const t = wantedText(String(text || "").replace(/[¿?¡!]/g, " "));
  let best: { at: number; end: number } | null = null;
  for (const re of Object.values(CATEGORY_KEYWORDS)) {
    const m = t.match(new RegExp(re.source, "i"));
    if (m && m.index !== undefined && (!best || m.index < best.at)) best = { at: m.index, end: m.index + m[0].length };
  }
  if (!best) return null;
  // the word and up to three following words, until punctuation or a new clause
  const tail = t.slice(best.at).split(/[,.;:]|\s+(?:y|o|pero|que|and|or|but|that|para\s+(?:qu[eé]|saber))\s+/i)[0];
  const words = tail.trim().split(/\s+/).slice(0, 6);
  // drop trailing connectors ("lápices de")
  while (words.length > 1 && /^(?:de|del|para|con|en|a|of|for|with|in)$/i.test(words[words.length - 1])) words.pop();
  const out = clean(words.join(" "));
  return out.length >= 3 ? out : null;
}
const clean = (s: string) => s.replace(/^(?:un|una|unos|unas|los|las|el|la|a|an|the)\s+/i, "").replace(/[.!]+$/, "").trim();

// ── Simple pack arithmetic ──────────────────────────────────────────────────
// Recognises the same operation however it is written: "¿cuántos sets de 12
// cubren 500 lápices?", "quiero 500 lápices, cada set trae 12, ¿cuántos sets?",
// "if each box has 100, how many boxes for 5,000 gloves?", "¿alcanzan 40 sets?".
const PACKS: [RegExp, string, string, string, string][] = [
  // regex, singular ES, plural ES, singular EN, plural EN
  [/^(?:sets?|juegos?)$/, "set", "sets", "set", "sets"],
  [/^(?:cajas?|boxes|box)$/, "caja", "cajas", "box", "boxes"],
  [/^(?:paquetes?|packs?)$/, "paquete", "paquetes", "pack", "packs"],
  [/^(?:estuches?|cases?)$/, "estuche", "estuches", "case", "cases"],
  [/^(?:bolsas?|bags?)$/, "bolsa", "bolsas", "bag", "bags"],
  [/^(?:kits?)$/, "kit", "kits", "kit", "kits"],
  [/^(?:docenas?|dozens?)$/, "docena", "docenas", "dozen", "dozens"],
  [/^(?:pares|par|pairs?)$/, "par", "pares", "pair", "pairs"],
  [/^(?:cartones|cart[oó]n|cartons?)$/, "cartón", "cartones", "carton", "cartons"],
  [/^(?:rollos?|rolls?)$/, "rollo", "rollos", "roll", "rolls"],
];
const PACK_RE = "(sets?|juegos?|cajas?|boxes|box|paquetes?|packs?|estuches?|bolsas?|bags?|kits?|docenas?|dozens?|pares|par|pairs?|cartones|cart[oó]n|cartons?|rollos?|rolls?)";
const packOf = (w: string) => PACKS.find(([r]) => r.test(w));
// words that are not the counted item ("1,000 necesito", "500 para")
const NOT_ITEM = /^(?:necesito|necesitas|necesita|quiero|quieres|compro|comprar|pido|pedir|son|hay|para|por|en|de|del|y|o|con|sin|que|cu[aá]nt[oa]s?|cada|total|unidades?|units?|i|need|want|buy|for|in|of|and|or|with|each|are|is|how|many|do|me|mi|mis|el|la|los|las|un|una|unos|unas|the|a|an|individual(?:es)?|sueltos?|sueltas?|single|loose)$/;
const VERB_Q = /cu[aá]nt|how\s+many|how\s+much|necesit|alcanz|cubr|sobr|falt|calcul|enough|cover|need|left\s+over|spare|extra|compute/;

function normalizeNumbers(t: string): string {
  return t
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mil|thousand)\b/g, (_, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000)))
    .replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (n) => n.replace(/,/g, ""))
    .replace(/\b(\d{1,3}(?:\.\d{3})+)\b(?!\.\d)/g, (n) => n.replace(/\./g, ""));
}

export interface PackMath {
  // "ask": the message describes a mixed set but not which item the quantity counts
  mode: "packs" | "total" | "check" | "ask";
  perPack: number;
  packs: number; // packs needed (packs) / given (total, check)
  wanted: number;
  total: number;
  extra: number;
  pack: [RegExp, string, string, string, string];
  item: string;
  // quantity and pack content both counted in pairs or dozens ("501 pares, cajas de 20 pares")
  unit?: "pair" | "dozen";
  // the figures as the client wrote them, before counting both in pieces
  // ("1,000 pares" with boxes of "100 guantes individuales" → 2,000 guantes)
  conv?: { wanted: number; wantedWord: string; perPack: number; perWord: string };
  // the other reading when the unit of one side isn't explicit
  alt?: { packs: number; kind: "contentPairs" | "contentPieces" | "wantedPairs"; word: string };
  // a mixed set ("cada set trae 1 botella y 3 tazas"); target = the item the quantity counts, -1 = none
  kit?: { parts: { n: number; noun: string }[]; target: number };
  zero?: boolean; // the client wrote a pack content of 0
  zeroOrder?: boolean; // the client wrote 0 packs ("0 cajas de 12"): the result is 0, and it is not an order
  // a weight or measure counted in packs of that measure ("2.5 kg en bolsas de 1 kg")
  measure?: { from?: string };
  // the purchase conditions applied: minimum order and multiples, in packs
  cond?: { need: number; minPacks: number; lotPacks: number; mins: Cond[]; lots: Cond[]; unreadable: Cond[]; changed: boolean };
  // conditions read but not applied (the calculation still needs data)
  conds?: { mins: Cond[]; lots: Cond[] };
  // data that can't be calculated as written: ask instead of guessing
  invalid?: "conflictCond" | "badCond" | "negative" | "decimalPacks" | "decimalQty" | "decimalContent" | "zeroQty" | "conflictSize" | "range" | "measure";
  sizes?: number[]; // the different contents written for the same pack
}

// ── Purchase conditions the client states in the same message ────────────────
// Minimum order ("mínimo de 15 cajas", "el mínimo del proveedor es 15 cajas",
// "MOQ 300 pares", "pide 300 pares como mínimo", "no venden menos de 15 cajas")
// and multiples ("solo venden en múltiplos de 6 cajas", "en lotes de 6",
// "de 6 en 6 cajas"). Every condition is read, removed from the text before the
// pack arithmetic (so its number is never taken as the quantity or a pack count)
// and applied afterwards: no condition the client wrote is dropped.
const MIN_KEY = "(?:m[ií]nim[oa]s?|minimum|moq)";
const W = "[a-záéíóúüñ']+";
// the client's own need is not the supplier's minimum ("necesito como mínimo 200")
const NEED_VERB = /\b(?:necesit\w*|quiero|queremos|ocupo|ocupamos|requiero|requerimos|busco|buscamos|tengo|compro|comprar[eé]|pido|i\s+need|we\s+need|i\s+want|we\s+want)\b/;
const MIN_RES: RegExp[] = [
  // "mínimo del proveedor es 15 cajas", "pedido mínimo: 15", "compra mínima de 300 pares"
  new RegExp(`\\b(?:(?:pedido|compra|orden|order)\\s+)?${MIN_KEY}\\b((?:\\s*[:=]?\\s*(?!\\d)${W}){0,6})\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  // "no venden menos de 15 cajas", "won't sell less than 15 boxes"
  new RegExp(`\\bno\\s+(?:me\\s+|nos\\s+|te\\s+)?(?:vende|venden|acepta|aceptan|despacha|despachan|env[ií]a|env[ií]an|hace|hacen|fabrica|fabrican|surte|surten)\\s+(?:pedidos\\s+de\\s+)?menos\\s+de\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  new RegExp(`\\b(?:won'?t|doesn'?t|don'?t|does\\s+not|do\\s+not|will\\s+not)\\s+(?:sell|accept|ship)\\s+(?:less|fewer)\\s+than\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  // the supplier's verbs: "el proveedor vende al menos 15 cajas", "exigen como mínimo 300 pares"
  new RegExp(`\\b(?:pide|piden|exige|exigen|vende|venden|acepta|aceptan|requiere|requieren|requires?|sells?|accepts?)\\s+(?:un\\s+)?(?:al\\s+menos|como\\s+m[ií]nimo|at\\s+least|a\\s+minimum\\s+of)\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  // "300 pares como mínimo", "15 cajas mínimo"
  new RegExp(`(\\d+(?:[.,]\\d+)?)\\s+(${W})\\s+(?:como\\s+|as\\s+(?:a\\s+)?|at\\s+(?:a\\s+)?|de\\s+)?${MIN_KEY}\\b`, "g"),
];
const LOT_RES: RegExp[] = [
  new RegExp(`\\b(?:en\\s+|por\\s+)?m[uú]ltiplos?\\s+de\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  new RegExp(`\\b(?:en\\s+|por\\s+)?(?:lotes?|incrementos?|bloques?)\\s+(?:completos?\\s+)?de\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
  new RegExp(`\\bde\\s+(\\d+)\\s+en\\s+\\1(?:\\s+(${W}))?`, "g"),
  new RegExp(`\\b(?:in\\s+)?(?:multiples?|lots?|batches|increments?)\\s+of\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+(${W}))?`, "g"),
];
export interface Cond { n: number; word: string; text: string }
function readConds(t: string, res: RegExp[], kind: "min" | "lot"): { list: Cond[]; text: string } {
  const list: Cond[] = [];
  let rest = t;
  for (const re of res) {
    re.lastIndex = 0;
    for (const m of [...rest.matchAll(re)]) {
      const isFirst = kind === "min" && re === MIN_RES[0];
      const window = isFirst ? m[1] || "" : "";
      const numStr = isFirst ? m[2] : m[1];
      let word = (isFirst ? m[3] : m[2]) || "";
      const before = rest.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
      if (kind === "min") {
        // "necesito como mínimo 200 pares": the client's quantity; "sin mínimo": no minimum
        if (NEED_VERB.test(window) || /(?:necesit\w*|quiero|queremos|ocupo|requiero|busco|compro|i\s+need|we\s+need|i\s+want)\s+(?:(?:un|una|como|al|de|por\s+lo|lo|at|a)\s+)*$/.test(before)) continue;
        if (/\b(?:sin|no\s+hay|no\s+tiene|no\s+piden?|no\s+exigen?|without|no)\s+(?:un\s+|el\s+)?(?:pedido\s+)?$/.test(before)) continue;
        if (/\b(?:d[ií]as?|days?|semanas?|weeks?|meses|months?|horas?|hours?|%|d[oó]lares|dollars|usd|quetzales)\b/.test(word)) continue;
      }
      if (word && (CONNECT.test(word) || NOT_ITEM.test(word))) word = "";
      const text = word ? m[0] : m[0].replace(new RegExp(`\\s+${W}$`), "");
      list.push({ n: Number(numStr.replace(",", ".")), word, text });
      rest = rest.replace(text, " ");
    }
  }
  return { list, text: rest };
}
const piecesOf = (u: QUnit) => (u === "pair" ? 2 : u === "dozen" ? 12 : 1);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** A condition in packs of the calculation (null when it can't be compared). */
function condPacks(m: PackMath, c: Cond, kind: "min" | "lot"): number | null {
  if (!c.word || packOf(c.word) === m.pack) return c.n;
  if (m.kit) {
    const i = m.kit.parts.findIndex((p) => stemOf(p.noun) === stemOf(c.word));
    if (i < 0) return null;
    const k = m.kit.parts[i].n;
    return kind === "min" ? Math.ceil(c.n / k) : (c.n * k) / gcd(c.n, k) / k;
  }
  if (packOf(c.word) && !PAIR_W.test(c.word) && !DOZ_W.test(c.word)) return null; // "mínimo 2 contenedores"
  const cu = unitOf(c.word);
  // a noun must be the product itself ("45 zapatos"), not something else ("2 contenedores")
  if (cu === "noun") {
    const known = [m.item, m.conv?.perWord, m.conv?.wantedWord].filter(Boolean).map((x) => stemOf(x!));
    if (!known.includes(stemOf(c.word))) return null;
  }
  // everything counted in single pieces: pairs × 2, dozens × 12
  const resUnit: QUnit = m.unit === "pair" ? "pair" : m.unit === "dozen" ? "dozen" : "piece";
  const packPieces = m.perPack * piecesOf(resUnit);
  const condPieces = c.n * piecesOf(isPD(cu) ? cu : "piece");
  if (kind === "min") return Math.ceil(condPieces / packPieces);
  // a lot of N pieces with packs of P pieces: whole packs that are also whole lots
  if (!Number.isInteger(condPieces) || condPieces <= 0) return null;
  return condPieces / gcd(condPieces, packPieces);
}

/** Minimum and multiple applied together: the fewest whole packs that cover the need and meet both. */
function applyConditions(m: PackMath, mins: Cond[], lots: Cond[]): PackMath {
  if (!mins.length && !lots.length) return m;
  if (m.mode === "ask" || m.zero || m.invalid || m.zeroOrder) return { ...m, conds: { mins, lots } };
  const minP = mins.map((c) => condPacks(m, c, "min"));
  const lotP = lots.map((c) => condPacks(m, c, "lot"));
  // two different minimums or multiples in one message: ask which one holds
  const uniq = (xs: (number | null)[]) => [...new Set(xs.filter((x): x is number => x !== null))];
  if (uniq(minP).length > 1 || uniq(lotP).length > 1)
    return { ...m, mode: "ask", invalid: "conflictCond", conds: { mins, lots } };
  const minPacks = uniq(minP)[0] ?? 0;
  const lotPacks = uniq(lotP)[0] ?? 0;
  const unreadable = [...mins.filter((_, i) => minP[i] === null), ...lots.filter((_, i) => lotP[i] === null)];
  if (lotPacks && !Number.isInteger(lotPacks)) return { ...m, mode: "ask", invalid: "conflictCond", conds: { mins, lots } };
  const need = m.packs;
  let packs = Math.max(need, minPacks);
  if (lotPacks > 0) packs = Math.ceil(packs / lotPacks) * lotPacks;
  const cond = { need, minPacks, lotPacks, mins, lots, unreadable, changed: false };
  if (m.mode === "packs" && packs !== need)
    return { ...m, packs, total: packs * m.perPack, extra: packs * m.perPack - m.wanted, alt: undefined, cond: { ...cond, changed: true } };
  // packs given ("¿alcanzan 10 cajas?"): the valid order nearest above
  if (m.mode === "check" || m.mode === "total") {
    let ok = Math.max(m.packs, minPacks);
    if (lotPacks > 0) ok = Math.ceil(ok / lotPacks) * lotPacks;
    return { ...m, cond: { ...cond, need: ok } };
  }
  return { ...m, cond };
}

/** Reads a pack calculation in any wording, or null when the message isn't one. */
export function packMath(text: string, force = false): PackMath | null {
  const t0 = normalizeNumbers(String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ").replace(/\s+/g, " "));
  if (!force && !VERB_Q.test(` ${t0} `)) return null;
  // a negative quantity, content or condition ("-200 pares") can't be calculated
  if (/(?:^|[\s(:=,])[-−]\d/.test(t0) && new RegExp(`\\b${PACK_RE}\\b|pares|piezas|unidades|pieces|units`).test(t0))
    return { mode: "ask", perPack: 0, packs: 0, wanted: 0, total: 0, extra: 0, pack: PACKS[1], item: "", invalid: "negative" };
  const mins = readConds(` ${t0} `, MIN_RES, "min");
  const lots = readConds(mins.text, LOT_RES, "lot");
  const m = packMathCore(lots.text, true);
  if (!m) return null;
  // a condition with a negative, zero or decimal count can't be applied
  const badCond = [...mins.list, ...lots.list].find((c) => !(c.n > 0) || !Number.isInteger(c.n));
  if (badCond) return { ...m, mode: "ask", invalid: "badCond", conds: { mins: mins.list, lots: lots.list } };
  return applyConditions(m, mins.list, lots.list);
}

// ── Units: pairs and dozens are not pieces ───────────────────────────────────
const PAIR_W = /^(?:pares|par|pairs?)$/;
const DOZ_W = /^(?:docenas?|dozens?)$/;
const PIECE_W = /^(?:individual(?:es)?|sueltos?|sueltas?|singles?|loose|separate|piezas?|pieces?|pcs|pzas?|unidades?|units?)$/;
const CONNECT = /^(?:por|per|each|cada|en|in|a|y|e|and|o|or|de|of|con|with|para|for|que|si|if|son|are|is|es|me|mi|i)$/;
type QUnit = "pair" | "dozen" | "piece" | "noun" | "";
function unitOf(w1?: string, w2?: string): QUnit {
  if (!w1) return "";
  if (PAIR_W.test(w1)) return "pair";
  if (DOZ_W.test(w1)) return "dozen";
  if (PIECE_W.test(w1)) return "piece";
  if (CONNECT.test(w1) || NOT_ITEM.test(w1) || packOf(w1)) return "";
  // "100 guantes individuales", "2000 guantes sueltos"
  if (w2 && PIECE_W.test(w2)) return "piece";
  return "noun";
}
const unitMult = (u: QUnit) => (u === "pair" ? 2 : u === "dozen" ? 12 : 1);
const isPD = (u: QUnit) => u === "pair" || u === "dozen";

/** Singular of a counted word ("pares" → "par", "lápices" → "lápiz", "guantes" → "guante"). */
export function singularOf(word: string): string {
  const w = String(word || "");
  const one: Record<string, string> = { pares: "par", pairs: "pair", docenas: "docena", dozens: "dozen", piezas: "pieza", pieces: "piece", unidades: "unidad", units: "unit", sets: "set", cajas: "caja", boxes: "box" };
  if (one[w]) return one[w];
  if (/ces$/.test(w)) return w.replace(/ces$/, "z");
  if (/iones$/.test(w)) return w.replace(/iones$/, "ión");
  if (/[aeiouáéíóú]s$/.test(w)) return w.replace(/s$/, "");
  if (/[lnrdj]es$/.test(w)) return w.replace(/es$/, "");
  return w.replace(/s$/, "");
}
/** Plural of a noun the client wrote in singular ("botella" → "botellas"). */
function pluralOf(word: string): string {
  const w = String(word || "");
  if (!w || /s$/.test(w)) return w;
  if (/z$/.test(w)) return w.replace(/z$/, "ces");
  if (/[aeiouáéíóú]$/.test(w)) return `${w}s`;
  if (/ón$/.test(w)) return w.replace(/ón$/, "ones");
  return /^[a-z]+$/.test(w) && !/[lnrdj]$/.test(w) ? `${w}s` : `${w}es`;
}
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${Lx("y", "and")} ${xs[xs.length - 1]}`);

// ── Mixed sets: "cada set trae una botella y tres tazas" ─────────────────────
const NUMWORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const NUMW = `(?:\\d+|${Object.keys(NUMWORDS).sort((a, b) => b.length - a.length).join("|")})`;
const KIT_NOUN = `(?!(?:y|e|and|con|with|de|of|en|in|por|per|cada|each|para|for|m[aá]s|plus|que|si)\\b)[a-záéíóúüñ]{3,}(?![a-záéíóúüñ])`;
const KIT_PART = `\\b${NUMW}\\s+${KIT_NOUN}`;
const KIT_SEP = `(?:\\s*,\\s*(?:(?:y|e|and)\\s+)?|\\s*\\+\\s*|\\s+(?:y|e|and|m[aá]s|plus|con|with)\\s+)`;
const KIT_COMP = `(${KIT_PART}(?:${KIT_SEP}${KIT_PART})+)`;
const HAS_WORDS = "(?:trae|traen|tiene|tienen|contiene|contienen|incluye|incluyen|lleva|llevan|viene\\s+con|vienen\\s+con|llega\\s+con|llegan\\s+con|es\\s+de|son\\s+de|has|have|holds|hold|contains|contain|comes\\s+with|come\\s+with|includes|include)";
const stemOf = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?:es|s)$/, "").slice(0, 5);

function kitMath(t: string): PackMath | null {
  // "set con 1 botella y 3 tazas" / "cada kit trae 12 lápices y 2 borradores"; not
  // "sets de 12 lápices y 300 cuadernos en paquetes de 10" (two separate orders)
  const ctxA = new RegExp(`${PACK_RE}\\s+(?:${HAS_WORDS}|con|with|de|of)\\s+(?:(?:solo|only)\\s+)?${KIT_COMP}(?!\\s+(?:en|in)\\s+${PACK_RE})`);
  // "una botella y tres tazas por set"
  const ctxB = new RegExp(`${KIT_COMP}\\s+(?:por|per|en\\s+cada|in\\s+each|in\\s+every|cada|each|in\\s+a|a)\\s+${PACK_RE}\\b`);
  let packWord = "";
  let comp = "";
  let whole = "";
  const a = t.match(ctxA);
  if (a) [whole, packWord, comp] = a;
  else {
    const b = t.match(ctxB);
    if (!b) return null;
    [whole, comp, packWord] = b;
  }
  const pack = packOf(packWord);
  if (!pack || /^(?:par|docena)$/.test(pack[1])) return null;
  // another pack with its own size ("…y 300 cuadernos en paquetes de 10") means separate orders
  const others = [...t.matchAll(new RegExp(`${PACK_RE}\\s+(?:de|of|con|with|x)\\s*\\d`, "g"))].filter((m) => packOf(m[1]) !== pack);
  if (others.length) return null;
  const parts = [...comp.matchAll(new RegExp(`\\b(${NUMW})\\s+(${KIT_NOUN})`, "g"))].map((m) => ({
    n: /^\d+$/.test(m[1]) ? Number(m[1]) : NUMWORDS[m[1]],
    noun: m[2],
  }));
  if (parts.length < 2 || parts.some((p) => !(p.n >= 1) || p.n > 1e5 || NOT_ITEM.test(p.noun) || packOf(p.noun) || CONNECT.test(p.noun))) return null;
  if (new Set(parts.map((p) => stemOf(p.noun))).size !== parts.length) return null;
  // the pack word stays, so "100 sets con 1 botella y 3 tazas" still counts 100 sets
  const rest = t.replace(whole, ` ${packWord} `);
  const nums = [...rest.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?/g)].filter((m) => Number(m[1]) > 0);
  const base = { pack, kit: { parts, target: -1 }, extra: 0, item: "", perPack: parts[0].n };
  for (const m of nums) {
    const i = m[2] ? parts.findIndex((p) => stemOf(p.noun) === stemOf(m[2])) : -1;
    if (i < 0) continue;
    const W = Number(m[1]);
    if (!Number.isInteger(W) || W > 1e8) return null;
    const k = parts[i].n;
    const packs = Math.ceil(W / k);
    return { ...base, mode: "packs", perPack: k, packs, wanted: W, total: packs * k, extra: packs * k - W, item: m[2]!, kit: { parts, target: i } };
  }
  const sets = nums.find((m) => m[2] && packOf(m[2]) === pack);
  if (sets && Number.isInteger(Number(sets[1])) && Number(sets[1]) <= 1e7) {
    const S = Number(sets[1]);
    return { ...base, mode: "total", packs: S, wanted: 0, total: S * parts[0].n };
  }
  // a number that doesn't say what it counts ("240 piezas", "240"): give each reading
  const any = nums.find((m) => !/^(?:contenedor(?:es)?|containers?|d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years)$/.test(m[2] || ""));
  const W = any && Number.isInteger(Number(any[1])) && Number(any[1]) <= 1e8 ? Number(any[1]) : 0;
  return { ...base, mode: "ask", packs: 0, wanted: W, total: 0 };
}

// ── Weights and measures in packs of the same measure ────────────────────────
// "2,5 kg en bolsas de 1 kg" is plain arithmetic in kilograms: whole bags only.
// A weight against packs counted in pieces ("500 kg, cajas de 100 clavos") is
// never guessed (see invalid "measure").
const MEASURE_UNITS: Record<string, [string, number]> = {
  kg: ["mass", 1], kgs: ["mass", 1], kilo: ["mass", 1], kilos: ["mass", 1], kilogramo: ["mass", 1], kilogramos: ["mass", 1],
  g: ["mass", 0.001], gr: ["mass", 0.001], gramo: ["mass", 0.001], gramos: ["mass", 0.001],
  t: ["mass", 1000], ton: ["mass", 1000], tons: ["mass", 1000], tonelada: ["mass", 1000], toneladas: ["mass", 1000],
  lb: ["mass", 0.45359237], lbs: ["mass", 0.45359237], libra: ["mass", 0.45359237], libras: ["mass", 0.45359237],
  l: ["volume", 1], lt: ["volume", 1], lts: ["volume", 1], litro: ["volume", 1], litros: ["volume", 1], ml: ["volume", 0.001],
  gal: ["volume", 3.785411784], galon: ["volume", 3.785411784], "galón": ["volume", 3.785411784], galones: ["volume", 3.785411784],
  m: ["length", 1], metro: ["length", 1], metros: ["length", 1], cm: ["length", 0.01], mm: ["length", 0.001],
};
// containers only counted as packs when their content is a weight, volume or length
const CONTAINERS: [RegExp, string, string, string, string][] = [
  [/^(?:botellas?|bottles?)$/, "botella", "botellas", "bottle", "bottles"],
  [/^(?:sacos?|costal(?:es)?|sacks?)$/, "saco", "sacos", "sack", "sacks"],
  [/^(?:frascos?|jars?)$/, "frasco", "frascos", "jar", "jars"],
  [/^(?:latas?|cans?)$/, "lata", "latas", "can", "cans"],
  [/^(?:bidones?|bid[oó]n|garraf(?:a|as|[oó]n|ones)|jugs?)$/, "bidón", "bidones", "jug", "jugs"],
  [/^(?:cubetas?|baldes?|buckets?|pails?)$/, "cubeta", "cubetas", "bucket", "buckets"],
  [/^(?:tambos?|tambores?|barriles?|barril|drums?|barrels?)$/, "tambo", "tambos", "drum", "drums"],
];
const CONTAINER_RE = "(botellas?|bottles?|sacos?|costal(?:es)?|sacks?|frascos?|jars?|latas?|cans?|bidones?|bid[oó]n|garraf(?:a|as|[oó]n|ones)|jugs?|cubetas?|baldes?|buckets?|pails?|tambos?|tambores?|barriles?|barril|drums?|barrels?)";
const measureOf = (w?: string) => (w ? MEASURE_UNITS[w] : undefined);
export const fmtMeasure = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

function measureMath(t: string, used: string, pack: PackMath["pack"], perPack: number, unitWord: string, packsBefore: number): PackMath | null {
  const [family, k] = measureOf(unitWord)!;
  const base: PackMath = { mode: "ask", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item: unitWord, measure: {} };
  if (!(perPack > 0)) return { ...base, zero: perPack === 0 };
  // "3 bolsas de 1 kg": a number of packs
  if (Number.isFinite(packsBefore)) {
    if (packsBefore === 0) return { ...base, mode: "total", zeroOrder: true };
    if (!Number.isInteger(packsBefore)) return { ...base, packs: packsBefore, invalid: "decimalPacks" };
    return { ...base, mode: "total", packs: packsBefore, total: packsBefore * perPack };
  }
  const rest = t.replace(used, " ");
  const q = [...rest.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-záéíóúüñ]+)/g)].find((x) => measureOf(x[2])?.[0] === family);
  if (!q) return base;
  const W0 = Number(q[1].replace(",", "."));
  if (W0 === 0) return { ...base, invalid: "zeroQty" };
  // the quantity in the unit of the pack ("2500 g" in bags of "1 kg" = 2.5 kg)
  const wanted = Math.round(((W0 * measureOf(q[2])![1]) / k) * 1e9) / 1e9;
  const packs = Math.ceil(wanted / perPack - 1e-9);
  const total = Math.round(packs * perPack * 1e9) / 1e9;
  return {
    ...base,
    mode: "packs",
    wanted,
    packs,
    total,
    extra: Math.round((total - wanted) * 1e9) / 1e9,
    measure: { from: measureOf(q[2])![1] !== k ? `${fmtMeasure(W0)} ${q[2]}` : undefined },
  };
}

function packMathCore(text: string, force = false): PackMath | null {
  let t = ` ${normalizeNumbers(String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ").replace(/\s+/g, " "))} `;
  if (!force && !VERB_Q.test(t)) return null;
  // money is not a quantity ("tengo US$500", "Q2,000", "300 dólares")
  t = t.replace(/(?:us\$|usd|\$|(?:^|\s)q\.?)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:d[oó]lares|dollars|usd|quetzales|gtq)\b/g, " ");
  // the value being replaced is not part of the calculation: "paquetes de 16 en
  // lugar de 10", "300 en vez de 500", "24 per set instead of 12"
  t = t.replace(new RegExp(`(?:en\\s+lugar\\s+de|en\\s+vez\\s+de|instead\\s+of|rather\\s+than|y\\s+no\\s+de|y\\s+no)\\s+(?:(?:los|las|el|la|the)\\s+)?(?:${PACK_RE}\\s+(?:de|of)\\s+)?\\d+(?:[.,]\\d+)?(?:\\s+(?:${PACK_RE}|[a-záéíóúüñ]+)(?![a-záéíóúüñ]))?`, "g"), " ");
  // samples are not part of the order ("y 2 sets de muestra")
  t = t.replace(new RegExp(`\\d+\\s+${PACK_RE}\\s+(?:de\\s+)?(?:muestras?|samples?)\\b`, "g"), " ");
  // a budget is money even without a currency ("presupuesto de 300")
  t = t.replace(/(?:presupuesto|budget)\s+(?:de\s+|of\s+|es\s+de\s+|is\s+)?(?:unos\s+|about\s+)?\d+(?:[.,]\d+)?/g, " ");
  // "cero lápices" is a content of 0, which gets its own answer
  t = t.replace(/\b(?:cero|zero)\b/g, "0");
  // what the client says it is NOT ("40 zapatos individuales, no 40 pares") is no data
  t = t.replace(/(?:[,;(]|\s)\s*(?:y\s+|pero\s+|o\s+sea\s+)?(?:no|not)\s+(?:son\s+|de\s+|trae\s+|traen\s+|are\s+)?\d+(?:[.,]\d+)?\s+[a-záéíóúüñ]+\)?/g, " ");
  // a range ("200 a 300 pares", "entre 200 y 300") is not one quantity: ask
  const range = t.match(/(?:entre\s+)?(\d+(?:[.,]\d+)?)\s*(?:-|–|a|o|to|or|y)\s*(\d+(?:[.,]\d+)?)\s+([a-záéíóúüñ]+)/);
  if (range && Number(range[2]) > Number(range[1]) && Number(range[1]) > 0 && (/^\s*entre/.test(range[0]) || !/\s(?:y)\s/.test(range[0])) && !/^(?:d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years|horas|hours|por|per|cada|each)$/.test(range[3]))
    return { mode: "ask", perPack: 0, packs: 0, wanted: 0, total: 0, extra: 0, pack: PACKS[1], item: range[3], invalid: "range", sizes: [Number(range[1]), Number(range[2])] };
  // a mixed set is counted by the item the quantity refers to
  const kit = kitMath(t);
  if (kit) return kit;
  const N = "(\\d+(?:[.,]\\d+)?)";
  const HAS = HAS_WORDS;
  const rules: [RegExp, number, number][] = [
    // [regex, group of the pack word, group of the size]
    [new RegExp(`(?:cada|each|every|un|una|1|per|por)\\s+${PACK_RE}\\s+${HAS}\\s+${N}`), 1, 2],
    // "en cada caja hay 40", "en cada set vienen 12", "in each box there are 50"
    [new RegExp(`(?:cada|each|every)\\s+${PACK_RE}\\s+(?:hay|vienen|viene|van|va|caben|cabe|entran|entra|traer[aá]n?|there\\s+are|there\\s+is|are|is|fit|fits|go)\\s+${N}`), 1, 2],
    [new RegExp(`${PACK_RE}\\s+${HAS}\\s+${N}`), 1, 2],
    [new RegExp(`${PACK_RE}\\s+(?:de|of|con|with|x)\\s*${N}`), 1, 2],
    [new RegExp(`${PACK_RE}\\s+(?:vienen|viene|come|comes|son|are)\\s+(?:de|of|con|with|en)\\s+${N}`), 1, 2],
    [new RegExp(`${N}\\s+(?:[a-záéíóúüñ]+\\s+){0,2}(?:por|per|each|en\\s+cada|in\\s+each|in\\s+a|a|/)\\s*${PACK_RE}\\b`), 2, 1],
    [new RegExp(`(?:vienen|viene|come|comes)\\s+(?:en\\s+|in\\s+)?${PACK_RE}\\s+(?:de|of)\\s+${N}`), 1, 2],
  ];
  let perPack = NaN;
  let packWord = "";
  let used = "";
  let sizeFirst = false;
  for (const [re, pw, sz] of rules) {
    const m = t.match(re);
    if (m) {
      perPack = Number(m[sz].replace(",", "."));
      packWord = m[pw];
      used = m[0];
      sizeFirst = sz === 1;
      break;
    }
  }
  if (!packWord) {
    // the pack asked for ("¿cuántas docenas?"), else the first one named
    const asked = t.match(new RegExp(`(?:cu[aá]nt[oa]s|how\\s+many)\\s+${PACK_RE}\\b`));
    const m = asked || t.match(new RegExp(`\\b${PACK_RE}\\b`));
    if (m && /^(?:docenas?|dozens?)$/.test(m[1])) { perPack = 12; packWord = m[1]; }
    else if (m && /^(?:pares|par|pairs?)$/.test(m[1])) { perPack = 2; packWord = m[1]; }
    else if (asked) {
      // "1000 pares de guantes, ¿cuántas cajas?": the content of each box is missing
      const askPack = packOf(asked[1])!;
      const q = [...t.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?(?:\s+(?:de|of)\s+([a-záéíóúüñ]+))?/g)].find((x) => Number(x[1]) > 0 && !(x[2] && packOf(x[2]) === askPack));
      if (!q || !Number.isInteger(Number(q[1]))) return null;
      const word = q[2] && !NOT_ITEM.test(q[2]) && !CONNECT.test(q[2]) ? q[2] : "";
      return { mode: "ask", perPack: 0, packs: 0, wanted: Number(q[1]), total: 0, extra: 0, pack: askPack, item: word, unit: word && PAIR_W.test(word) ? "pair" : undefined, conv: q[3] && !NOT_ITEM.test(q[3]) ? { wanted: 0, wantedWord: "", perPack: 0, perWord: q[3] } : undefined };
    }
  }
  const pack = packOf(packWord);
  // a pack measured in kg, litres or metres: arithmetic in that measure
  if (pack && used) {
    const at0 = t.indexOf(used);
    const after0 = (sizeFirst ? used.replace(/^\s*\d+(?:[.,]\d+)?/, "") : "") + t.slice(at0 + used.length);
    const mw = after0.match(/^\s*([a-záéíóúüñ]+)/);
    if (mw && measureOf(mw[1])) {
      const b0 = t.slice(0, at0).match(new RegExp(`${N}\\s*$`));
      return measureMath(t, used, pack, perPack, mw[1], b0 && !sizeFirst ? Number(b0[1].replace(",", ".")) : NaN);
    }
  }
  // a container sold by weight, volume or length ("botellas de 2 l", "sacos de 25 kg")
  if (!pack || !used) {
    const c = t.match(new RegExp(`${CONTAINER_RE}\\s+(?:de|of|con|with)\\s+${N}\\s*([a-záéíóúüñ]+)`));
    if (c && measureOf(c[3])) {
      const cp = CONTAINERS.find(([r]) => r.test(c[1]))!;
      const b0 = t.slice(0, c.index).match(new RegExp(`${N}\\s*$`));
      return measureMath(t, c[0], cp, Number(c[2].replace(",", ".")), c[3], b0 ? Number(b0[1].replace(",", ".")) : NaN);
    }
  }
  // a pack with nothing in it can't be calculated: ask for its real content
  if (pack && used && perPack === 0) {
    const q = t.replace(used, " ").match(/(\d+)(?:\s+([a-záéíóúüñ]+))?/);
    const word = q?.[2] && !NOT_ITEM.test(q[2]) && !CONNECT.test(q[2]) && !packOf(q[2]) ? q[2] : "";
    return { mode: "ask", perPack: 0, packs: 0, wanted: q && Number(q[1]) > 0 ? Number(q[1]) : 0, total: 0, extra: 0, pack, item: word, zero: true };
  }
  if (pack && used && perPack > 0 && !Number.isInteger(perPack))
    return { mode: "ask", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item: "", invalid: "decimalContent" };
  if (!pack || !(perPack > 1) || perPack > 1e6 || !Number.isInteger(perPack)) return null;
  // two different contents written for the same pack ("cada caja trae 20 pares… cajas de 25 pares")
  if (used) {
    const sizes = new Set<number>();
    for (const [re, pw, sz] of rules) {
      for (const x of t.matchAll(new RegExp(re.source, "g"))) {
        if (packOf(x[pw]) !== pack) continue;
        const after = (sz === 1 ? x[0].replace(/^\s*\d+(?:[.,]\d+)?/, "") : "") + t.slice((x.index ?? 0) + x[0].length);
        const w2 = after.match(/^\s*([a-záéíóúüñ]+)(?:\s+([a-záéíóúüñ]+))?/);
        sizes.add(Number(x[sz].replace(",", ".")) * unitMult(w2 ? unitOf(w2[1], w2[2]) : ""));
      }
    }
    if (sizes.size > 1) return { mode: "ask", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item: "", invalid: "conflictSize", sizes: [...sizes] };
  }
  // the words that say what each pack holds: "cada caja trae 100 [guantes individuales]",
  // "cajas de 20 [pares]", "20 [pares] por caja"
  const usedAt = used ? t.indexOf(used) : -1;
  const afterSize = used ? (sizeFirst ? used.replace(/^\s*\d+(?:[.,]\d+)?/, "") : "") + t.slice(usedAt + used.length) : "";
  const cw = afterSize.match(/^\s*([a-záéíóúüñ]+)(?:\s+([a-záéíóúüñ]+))?/);
  // "42 sets de 12": the number right before the matched pack phrase is a count of packs
  let rest = t;
  let packsGiven = NaN;
  if (used) {
    const at = usedAt;
    const before = t.slice(0, at).match(new RegExp(`${N}\\s*$`));
    if (before && /^(?:sets?|juegos?|cajas?|boxes|box|paquetes?|packs?|estuches?|bolsas?|bags?|kits?|docenas?|dozens?|pares|par|pairs?|cartones|cart[oó]n|cartons?|rollos?|rolls?)/.test(used)) {
      packsGiven = Number(before[1].replace(",", "."));
      rest = t.slice(0, at - before[0].length) + " " + t.slice(at + used.length);
    } else rest = t.replace(used, " ");
  }
  // "40 cajas" elsewhere in the message
  const given = rest.match(new RegExp(`${N}\\s+${PACK_RE}\\b`));
  if (!Number.isFinite(packsGiven) && given && packOf(given[2]) === pack) packsGiven = Number(given[1].replace(",", "."));
  const rest2 = given && packOf(given[2]) === pack ? rest.replace(given[0], " ") : rest;
  // the number of items wanted, and the word after it
  const nums = [...rest2.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?(?:\s+([a-záéíóúüñ]+))?/g)];
  const w = nums.find((m) => Number(m[1].replace(",", ".")) >= 0 && !(Number(m[1]) === 0 && nums.some((o) => Number(o[1]) > 0)) && !/^(?:contenedor(?:es)?|containers?|modelos?|models?|d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years|horas|hours)$/.test(m[2] || ""));
  let wanted = w ? Number(w[1].replace(",", ".")) : NaN;
  let item = "";
  if (w) item = [w[2], w[3]].find((x) => x && !NOT_ITEM.test(x) && !packOf(x)) || "";
  if (!item) {
    const asked = t.match(/cu[aá]nt[oa]s\s+([a-záéíóúüñ]+)|how\s+many\s+([a-z]+)/);
    const a = asked && (asked[1] || asked[2]);
    if (a && !NOT_ITEM.test(a) && !packOf(a)) item = a;
  }
  if (!item && used) {
    const after = used.match(/\d+\s+([a-záéíóúüñ]+)/) || t.slice(t.indexOf(used) + used.length).match(/^\s*([a-záéíóúüñ]{3,})/);
    if (after && !NOT_ITEM.test(after[1]) && !packOf(after[1])) item = after[1];
  }
  // "12 unidades", "500 piezas": the client's own unit word, not a generic "piezas"
  if (!item) {
    const UNIT_ITEM = /^(?:piezas?|unidades?|units?|pieces?|pcs)$/;
    if (w && UNIT_ITEM.test(w[2] || "")) item = w[2]!;
    else if (cw && UNIT_ITEM.test(cw[1])) item = cw[1];
    else {
      const askedU = t.match(/cu[aá]nt[oa]s\s+(piezas|unidades)|how\s+many\s+(pieces|units)/);
      if (askedU) item = askedU[1] || askedU[2];
    }
  }
  if (!item) {
    // "40 cajas de 100 guantes": the word after the pack phrase elsewhere in the message
    const m2 = t.match(new RegExp(`${PACK_RE}\\s+(?:de|of)\\s+\\d+\\s+([a-záéíóúüñ]{3,})`));
    if (m2 && !NOT_ITEM.test(m2[2]) && !packOf(m2[2])) item = m2[2];
  }

  // Units. "1,000 pares" with boxes of "100 guantes individuales" is 2,000 guantes;
  // "501 pares" in "cajas de 20 pares" stays in pairs. A pair or dozen pack itself
  // ("¿cuántos pares son 1000 guantes?") is already the conversion.
  let unit: PackMath["unit"];
  let conv: PackMath["conv"];
  let alt: PackMath["alt"];
  // "120 pares, ¿cuántas docenas?": dozens of pairs
  if (pack[1] === "docena" && w && PAIR_W.test(w[2] || "")) item = w[2];
  if (!/^(?:par|docena)$/.test(pack[1])) {
    const wu: QUnit = w ? unitOf(w[2], w[3]) : "";
    const cu: QUnit = cw ? unitOf(cw[1], cw[2]) : "";
    const wWord = w?.[2] || "";
    const cWord = cw?.[1] || "";
    // "pares de guantes": the product counted in pairs
    const pdNoun = (t.match(/\b(?:pares|pairs|docenas|dozens)\s+(?:de|of)\s+([a-záéíóúüñ]{3,})/) || [])[1] || "";
    const pieceNoun = (cu === "noun" ? cWord : "") || (wu === "noun" ? wWord : "") || (pdNoun && !NOT_ITEM.test(pdNoun) && !packOf(pdNoun) ? pdNoun : "") || (item && !PAIR_W.test(item) && !DOZ_W.test(item) ? item : "");
    if (isPD(wu) && cu === "") {
      // "1000 pares en cajas de 100": the content is taken in the same unit, the other reading is shown
      unit = wu as "pair" | "dozen";
      item = wWord;
      if (wu === "pair" && Number.isFinite(wanted)) alt = { packs: Math.ceil((wanted * 2) / perPack), kind: "contentPieces", word: pieceNoun };
    } else if (isPD(cu) && wu === "") {
      unit = cu as "pair" | "dozen";
      item = cWord;
    } else if ((isPD(wu) || isPD(cu)) && wu === cu) {
      unit = wu as "pair" | "dozen";
      item = wWord;
    } else if (isPD(wu) || isPD(cu)) {
      const W0 = wanted;
      const P0 = perPack;
      conv = { wanted: W0, wantedWord: wWord, perPack: P0, perWord: cWord };
      if (Number.isFinite(wanted)) wanted = wanted * unitMult(wu);
      perPack = perPack * unitMult(cu);
      item = pieceNoun || Lx("piezas", "pieces");
      // the side that only names the product ("100 guantes") could also mean pairs
      if (wu === "pair" && cu === "noun" && Number.isFinite(W0)) alt = { packs: Math.ceil(W0 / P0), kind: "contentPairs", word: wWord };
      if (cu === "pair" && wu === "noun" && Number.isFinite(W0)) alt = { packs: Math.ceil(W0 / P0), kind: "wantedPairs", word: cWord };
    }
  }
  const extras = { unit, conv, alt };
  // "0 cajas de 12": the arithmetic is 0, and it is said that 0 is not an order
  if (packsGiven === 0) return { mode: "total", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item, ...extras, zeroOrder: true };
  // "2.5 cajas": packs are sold whole; show the two whole counts around it, never a fraction
  if (Number.isFinite(packsGiven) && packsGiven > 0 && !Number.isInteger(packsGiven))
    return { mode: "ask", perPack, packs: packsGiven, wanted: 0, total: 0, extra: 0, pack, item, ...extras, invalid: "decimalPacks" };
  if (Number.isFinite(packsGiven) && packsGiven > 0 && packsGiven <= 1e7) {
    if (Number.isFinite(wanted) && wanted > 0 && wanted <= 1e8)
      return { mode: "check", perPack, packs: packsGiven, wanted, total: packsGiven * perPack, extra: packsGiven * perPack - wanted, pack, item, ...extras };
    return { mode: "total", perPack, packs: packsGiven, wanted: 0, total: packsGiven * perPack, extra: 0, pack, item, ...extras };
  }
  const MEASURE_W = /^(?:kg|kgs|kilos?|kilogramos?|g|gramos?|toneladas?|tons?|t|lb|lbs|libras?|litros?|l|lts?|ml|galones?|gal|metros?|m|m2|m3|cm|mm|pies|ft|yardas?)$/;
  if (w && MEASURE_W.test(w[2] || "") && !(cw && MEASURE_W.test(cw[1])))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item: w[2], invalid: "measure" };
  if (w && wanted === 0 && Number(w[1]) === 0)
    return { mode: "ask", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item, invalid: "zeroQty" };
  if (wanted > 0 && !Number.isInteger(wanted) && !MEASURE_W.test(w?.[2] || ""))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item, invalid: "decimalQty" };
  if (!(wanted > 0) || wanted > 1e8 || !Number.isInteger(wanted)) return null;
  const packs = Math.ceil(wanted / perPack);
  if (alt && alt.packs === packs) alt = undefined;
  return { mode: "packs", perPack, packs, wanted, total: packs * perPack, extra: packs * perPack - wanted, pack, item, unit, conv, alt };
}

/**
 * Several pack calculations in one message ("500 lápices en sets de 12 y 300
 * cuadernos en paquetes de 10"): each part is solved on its own. [] when the
 * message holds fewer than two.
 */
export function packMathAll(text: string): PackMath[] {
  const raw = String(text || "");
  if (!VERB_Q.test(normalizeNumbers(raw.toLowerCase()))) return [];
  // one mixed set ("1 botella y 3 tazas") is a single calculation, not two orders
  if (packMath(raw)?.kit) return [];
  const parts = raw
    .split(/(?:[;.+]|,(?!\d)|\s(?:y|e|and|adem[aá]s|tambi[eé]n|plus))\s+(?=(?:(?:otros?|otras?|also|then|luego|tambi[eé]n|adem[aá]s|necesito|quiero|ocupo|i\s+need|i\s+want|need|want)\s+){0,2}\d|¿?\s*cu[aá]nt|how\s+many)/i)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  const out: PackMath[] = [];
  for (const part of parts) {
    const m = packMath(part, true);
    if (!m) continue;
    // "…y otros 300 en sets de 24": the same item as the previous order
    if (!m.item && out.length) m.item = out[out.length - 1].item;
    out.push(m);
  }
  return out.length >= 2 ? out : [];
}

/** How many pack calculations the message seems to ask for (pack phrases with a size). */
function packPhrases(text: string): number {
  const t = normalizeNumbers(String(text || "").toLowerCase());
  return (t.match(new RegExp(`${PACK_RE}\\s+(?:de|of|con|with|x)\\s*\\d+|\\d+\\s+(?:[a-záéíóúüñ]+\\s+){0,2}(?:por|per)\\s+${PACK_RE}\\b`, "g")) || []).length;
}

/**
 * A follow-up to an earlier calculation: "¿Y los 300 cuadernos en paquetes de
 * 10?" (complete), "¿y si cada set trae 30?" (new size) or "¿y para 800?" (new
 * quantity), solved with what the earlier question already said.
 */
export function followUpMath(text: string, previous: string): PackMath | null {
  const t = String(text || "").trim();
  if (!t || t.length > 200) return null;
  const all = packMathAll(previous);
  // "¿Y los cuadernos?" after a message with several orders: that part again
  if (!/\d/.test(t)) {
    if (t.length > 45 || !/^\s*(?:¿\s*)?(?:y|e|and|what\s+about)\b/i.test(t) || replyKinds(t).length) return null;
    const cands = all.length ? all : [packMath(previous, true)].filter((x): x is PackMath => !!x);
    return cands.find((m) => m.item && sameProduct(m.item, t)) || null;
  }
  if (replyKinds(t).some((k) => k !== "cost")) return null;
  // "¿y si el mínimo es 12 cajas?", "¿y si venden en múltiplos de 6?": the earlier
  // calculation with the new condition; the conditions not mentioned stay
  const tn = ` ${normalizeNumbers(t.toLowerCase().replace(/[¿?¡!]/g, " "))} `;
  const newMins = readConds(tn, MIN_RES, "min").list;
  const newLots = readConds(tn, LOT_RES, "lot").list;
  if (newMins.length || newLots.length) {
    const base = all.length ? null : packMath(previous, true);
    if (!base) return null;
    const keep = condsOf(base);
    return packMath(statementWith(base, { mins: newMins.length ? newMins : keep.mins, lots: newLots.length ? newLots : keep.lots }), true);
  }
  // numbers that are days, years, money, containers or models are not a new order
  if (/\d\s*(?:d[ií]as?|days?|semanas?|weeks?|meses|months?|a[nñ]os?|years?|horas?|hours?|contenedor(?:es)?|containers?|%)\b|us\$|\$|(?:^|\s)q\s*\d|\d\s*(?:d[oó]lares|dollars|quetzales|usd|gtq)\b|modelo|model|garant|guarant|flete|freight|pago|pagar|pay\b|precio|price|costo|cost|presupuesto|budget|tiendas?|escuelas?|sucursal(?:es)?|stores?|branch(?:es)?|clientes?|customers?/i.test(t)) return null;
  const full = packMath(t, true);
  if (full) return full;
  // the earlier order this refers to: the one with the same kind of pack when the
  // message names one ("¿Y si cada set trae 30?" is about the sets, not the paquetes)
  const cands = all.length ? all : [packMath(previous, true)].filter((x): x is PackMath => !!x);
  const named = normalizeNumbers(t.toLowerCase()).match(new RegExp(`\\b${PACK_RE}\\b`));
  const namedPack = named ? packOf(named[1]) : undefined;
  const prev = namedPack ? cands.find((m) => m.pack === namedPack) : cands[0];
  if (!prev) return null;
  // a mixed set keeps its content: "¿y para 300?", "¿y si son 50 sets?"
  if (prev.kit) {
    const n = normalizeNumbers(t.toLowerCase()).match(/(\d+)(?:\s+([a-záéíóúüñ]+))?/);
    if (!n) return null;
    const word = n[2] && !NOT_ITEM.test(n[2]) && !CONNECT.test(n[2]) ? n[2] : prev.item;
    return packMath(kitStatement(prev, `${n[1]} ${word}`), true);
  }
  // the earlier unit stays: "¿y para 600?" after "501 pares en cajas de 20 pares"
  const keepUnit = (m: PackMath | null): PackMath | null => {
    if (m && prev.unit && m.unit === prev.unit) m.alt = undefined;
    return m;
  };
  const items = prev.item || Lx("piezas", "pieces");
  const unitTail = prev.unit ? ` ${prev.item}` : "";
  const mt = condTail(prev);
  // "¿Y si son 50 sets?": a count of packs, checked against the earlier order
  const given = normalizeNumbers(t.toLowerCase()).match(new RegExp(`(\\d+)\\s+${PACK_RE}\\b(?!\\s+(?:de|of|con|with|x)\\s*\\d)`));
  if (given && packOf(given[2]) === prev.pack && !/\d+\s*(?:por|per)\s/.test(t)) {
    const c = packMath(`¿alcanzan ${given[1]} ${prev.pack[2]} de ${prev.perPack}${unitTail} para ${prev.wanted || prev.total} ${items}?${mt}`, true);
    if (c) return keepUnit(c);
  }
  // only a new pack size
  const withQty = keepUnit(packMath(`${t} para ${prev.wanted || prev.total} ${items}${mt}`, true));
  if (withQty && withQty.pack === prev.pack && withQty.perPack !== prev.perPack) return withQty;
  // only a new quantity
  const n = normalizeNumbers(t.toLowerCase()).match(/(\d+)/);
  if (n && /^\s*(?:¿\s*)?(?:y|e|and|what\s+about|y\s+si|y\s+para|y\s+con|and\s+for|and\s+if)\b/i.test(t)) {
    const q = packMath(`${n[1]} ${prev.item || ""} en ${prev.pack[2]} de ${prev.perPack}${unitTail}${mt}`, true);
    if (q) return keepUnit(q);
  }
  return null;
}

/** A mixed-set question with its content, for any quantity ("240 botellas", "50 sets"). */
function kitStatement(m: PackMath, qty: string): string {
  const comp = m.kit!.parts.map((p) => `${p.n} ${p.noun}`).join(" y ");
  return `cuántos ${m.pack[2]} necesito para ${qty.trim()} si cada ${m.pack[1]} trae ${comp}${condTail(m)}`;
}
/** The purchase conditions of a calculation (applied or only read). */
function condsOf(m: PackMath): { mins: Cond[]; lots: Cond[] } {
  return { mins: m.cond?.mins ?? m.conds?.mins ?? [], lots: m.cond?.lots ?? m.conds?.lots ?? [] };
}
/** The conditions written back into a statement, so follow-ups keep them. */
function condTail(m: PackMath, c = condsOf(m)): string {
  return [
    ...c.mins.map((x) => `. pedido mínimo de ${x.n} ${x.word || m.pack[2]}`),
    ...c.lots.map((x) => `. solo en múltiplos de ${x.n} ${x.word || m.pack[2]}`),
  ].join("");
}
/** The same calculation with other conditions. */
function statementWith(m: PackMath, c: { mins: Cond[]; lots: Cond[] }): string {
  return mathStatement({ ...m, cond: undefined, conds: undefined }) + condTail(m, c);
}

/** A complete question for a calculation, so later follow-ups can build on it. */
export function mathStatement(m: PackMath): string {
  if (m.kit)
    return kitStatement(m, m.mode === "packs" ? `${m.wanted} ${m.item}` : m.mode === "total" ? `${m.packs} ${m.pack[2]}` : m.wanted ? String(m.wanted) : "");
  if ((m.mode === "ask" && m.invalid) || m.zeroOrder || (m.measure && m.mode === "ask")) return "";
  if (m.measure)
    return `cuántos ${m.pack[2]} necesito para ${m.mode === "total" ? `${m.packs} ${m.pack[2]}` : `${m.wanted} ${m.item}`} en ${m.pack[2]} de ${m.perPack} ${m.item}${condTail(m)}`;
  if (m.mode === "ask") return `cuántos ${m.pack[2]} necesito para ${m.wanted} ${m.item}${m.conv?.perWord ? ` de ${m.conv.perWord}` : ""}${condTail(m)}`;
  // the unit goes with the pack content, so "501 pares en cajas de 20 pares" stays in pairs
  return `cuántos ${m.pack[2]} necesito para ${m.mode === "packs" || m.mode === "check" ? m.wanted : m.total} ${m.item || "piezas"} en ${m.pack[2]} de ${m.perPack}${m.unit ? ` ${m.item}` : ""}${condTail(m)}`;
}

/** "15 cajas" or "300 pares (15 cajas)"; says when the condition's unit was assumed. */
function condLabel(c: Cond, packs: number, pack: PackMath["pack"]): string {
  const f = (n: number) => n.toLocaleString("en-US");
  const pw = (n: number) => (n === 1 ? Lx(pack[1], pack[3]) : Lx(pack[2], pack[4]));
  if (!c.word) return Lx(`${f(c.n)} (tomado como ${pw(2)}; confírmalo)`, `${f(c.n)} (taken as ${pw(2)}; confirm it)`);
  if (packOf(c.word) === pack) return `${f(c.n)} ${pw(c.n)}`;
  return `${f(c.n)} ${tw(c.word)} (${f(packs)} ${pw(packs)})`;
}

/**
 * What the minimum and multiples did to the order, in words:
 * lead = "pero el mínimo del proveedor es 15 cajas y solo vende en múltiplos de 6 cajas"
 * ok = "Cumples el mínimo (15 cajas) y el múltiplo de 6 cajas."
 */
function condWords(m: PackMath): { lead: string; ok: string; unread: string } {
  const c = m.cond;
  if (!c) return { lead: "", ok: "", unread: "" };
  const parts: string[] = [];
  const okParts: string[] = [];
  const minC = c.mins.find((x) => condPacks(m, x, "min") !== null);
  const lotC = c.lots.find((x) => condPacks(m, x, "lot") !== null);
  if (minC) {
    const lbl = condLabel(minC, c.minPacks, m.pack);
    parts.push(Lx(`el mínimo del proveedor es ${lbl}`, `the supplier's minimum is ${lbl}`));
    okParts.push(Lx(`el mínimo (${lbl})`, `the minimum (${lbl})`));
  }
  if (lotC) {
    const lbl = condLabel(lotC, c.lotPacks, m.pack);
    parts.push(Lx(`solo vende en múltiplos de ${lbl}`, `it only sells in multiples of ${lbl}`));
    okParts.push(Lx(`el múltiplo de ${lbl}`, `the multiple of ${lbl}`));
  }
  const unread = c.unreadable.length
    ? Lx(
        ` No pude aplicar «${c.unreadable.map((x) => `${x.n} ${x.word}`.trim()).join("», «")}» porque está en otra unidad; confírmalo con el proveedor.`,
        ` I couldn't apply "${c.unreadable.map((x) => `${x.n} ${x.word}`.trim()).join('", "')}" because it's in another unit; confirm it with the supplier.`,
      )
    : "";
  return {
    lead: joinList(parts),
    ok: okParts.length ? Lx(` Cumples ${joinList(okParts)}.`, ` You meet ${joinList(okParts)}.`) : "",
    unread,
  };
}

function kitReply(m: PackMath): string {
  const k = m.kit!;
  const f = (n: number) => n.toLocaleString("en-US");
  const pw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const count = (noun: string, n: number) => `${f(n)} ${n === 1 ? singularOf(noun) : pluralOf(noun)}`;
  const comp = joinList(k.parts.map((p) => count(p.noun, p.n)));
  const totals = (sets: number) => joinList(k.parts.map((p) => count(p.noun, p.n * sets)));
  const confirm = Lx(
    ` Confirma con el proveedor el contenido real de cada ${pw(1)} y su pedido mínimo.`,
    ` Confirm the real content of each ${pw(1)} and the minimum order with the supplier.`,
  );
  const cw = condWords(m);
  if (m.cond?.changed && m.mode === "packs") {
    const p = k.parts[k.target];
    const need = m.cond.need;
    return Lx(
      `Para ${count(p.noun, m.wanted)} necesitarías ${f(need)} ${pw(need)}, pero ${cw.lead}: debes pedir ${f(m.packs)} ${pw(m.packs)} y recibirías ${totals(m.packs)}, ${count(p.noun, m.extra)} más de las que necesitas, suponiendo que cada ${pw(1)} trae ${comp}.`,
      `For ${count(p.noun, m.wanted)} you'd need ${f(need)} ${pw(need)}, but ${cw.lead}: you should order ${f(m.packs)} ${pw(m.packs)} and would receive ${totals(m.packs)}, ${count(p.noun, m.extra)} more than you need, assuming each ${pw(1)} holds ${comp}.`,
    ) + cw.unread + confirm;
  }
  const minEnd = !m.cond
    ? ""
    : m.mode === "total" && m.packs !== m.cond.need
      ? Lx(` Ojo: ${cw.lead}; para cumplirlo tendrías que pedir ${f(m.cond.need)} ${pw(m.cond.need)}.`, ` Note: ${cw.lead}; to meet it you'd have to order ${f(m.cond.need)} ${pw(m.cond.need)}.`) + cw.unread
      : cw.ok + cw.unread;
  if (m.mode === "packs") {
    const p = k.parts[k.target];
    const extra = m.extra > 0 ? Lx(` (${count(p.noun, m.extra)} de más)`, ` (${count(p.noun, m.extra)} extra)`) : "";
    return Lx(
      `Necesitarías ${f(m.packs)} ${pw(m.packs)} para cubrir ${f(m.wanted)} ${pluralOf(m.item)}, suponiendo que cada ${pw(1)} trae ${comp}. En total recibirías ${totals(m.packs)}${extra}.`,
      `You'd need ${f(m.packs)} ${pw(m.packs)} to cover ${f(m.wanted)} ${pluralOf(m.item)}, assuming each ${pw(1)} holds ${comp}. In total you'd receive ${totals(m.packs)}${extra}.`,
    ) + minEnd + confirm;
  }
  if (m.mode === "total")
    return Lx(
      `${f(m.packs)} ${pw(m.packs)}, si cada ${pw(1)} trae ${comp}, suman ${totals(m.packs)}.`,
      `${f(m.packs)} ${pw(m.packs)}, if each ${pw(1)} holds ${comp}, add up to ${totals(m.packs)}.`,
    ) + minEnd + confirm;
  if (!m.wanted)
    return Lx(
      `Cada ${pw(1)} trae ${comp}. ¿Qué cantidad necesitas y de qué (${joinList([...k.parts.map((p) => pluralOf(p.noun)), pw(2)])})? Con ese dato te digo cuántos ${pw(2)} pedir.`,
      `Each ${pw(1)} holds ${comp}. What quantity do you need, and of what (${joinList([...k.parts.map((p) => pluralOf(p.noun)), pw(2)])})? With that I'll tell you how many ${pw(2)} to order.`,
    );
  const W = m.wanted;
  const readings = k.parts.map((p) => {
    const s = Math.ceil(W / p.n);
    return Lx(`si son ${count(p.noun, W)}, necesitarías ${f(s)} ${pw(s)}`, `if they are ${count(p.noun, W)}, you'd need ${f(s)} ${pw(s)}`);
  });
  readings.push(Lx(`si son ${f(W)} ${pw(W)}, recibirías ${totals(W)}`, `if they are ${f(W)} ${pw(W)}, you'd receive ${totals(W)}`));
  return Lx(
    `Cada ${pw(1)} trae ${comp}, así que depende de qué cuentan tus ${f(W)}: ${readings.join("; ")}. Dime cuál es y lo dejo calculado.`,
    `Each ${pw(1)} holds ${comp}, so it depends on what your ${f(W)} count: ${readings.join("; ")}. Tell me which and I'll calculate it.`,
  ) + confirm;
}

// Unit words the client typed, said in the language in use ("pares" ⇄ "pairs");
// product nouns ("zapatos", "guantes") stay as written.
const UNIT_WORDS: [string, string][] = [
  ["pares", "pairs"], ["par", "pair"], ["piezas", "pieces"], ["pieza", "piece"], ["unidades", "units"], ["unidad", "unit"],
  ["docenas", "dozens"], ["docena", "dozen"],
];
export function tw(word: string): string {
  const w = String(word || "");
  const en = Lx("es", "en") === "en";
  const hit = UNIT_WORDS.find(([es, e]) => w === es || w === e);
  return hit ? (en ? hit[1] : hit[0]) : w;
}

/** Data that can't be calculated as written: say why and ask for what's missing. */
function invalidReply(m: PackMath): string {
  const f = (n: number) => n.toLocaleString("en-US");
  const one = Lx(m.pack[1], m.pack[3]);
  const conds = condsOf(m);
  const list = (cs: Cond[]) => cs.map((c) => `${f(c.n)} ${c.word}`.trim()).join(Lx(" y ", " and "));
  switch (m.invalid) {
    case "negative":
      return Lx(
        "Una cantidad, un contenido o un mínimo negativo no permite calcular. Escríbeme los datos en positivo: cantidad total y su unidad (piezas, pares, sets…), qué trae cada empaque y, si aplica, el pedido mínimo o los múltiplos.",
        "A negative quantity, content or minimum can't be calculated. Send me the figures as positive numbers: total quantity and its unit (pieces, pairs, sets…), what each pack holds and, if any, the minimum order or multiples.",
      );
    case "zeroQty":
      return Lx(
        "La cantidad que necesitas aparece como 0, así que no hay nada que calcular. ¿Cuántas unidades (o pares, sets…) necesitas en total?",
        "The quantity you need shows as 0, so there's nothing to calculate. How many units (or pairs, sets…) do you need in total?",
      );
    case "decimalPacks": {
      const lo = Math.floor(m.packs);
      const hi = Math.ceil(m.packs);
      const u = m.measure ? m.item : tw(m.item) || Lx("piezas", "pieces");
      const pl = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
      const val = (n: number) => (m.measure ? fmtMeasure(n * m.perPack) : f(n * m.perPack));
      const opts = [lo, hi].filter((n) => n > 0).map((n) => `${n} ${pl(n)} = ${val(n)} ${u}`).join(Lx(" o ", " or "));
      return Lx(
        `${fmtMeasure(m.packs)} ${m.pack[2]} no es una cantidad que se pueda pedir: los empaques se venden enteros. Con ${m.pack[2]} de ${val(1)} ${u}: ${opts}. Dime la cantidad entera de ${m.pack[2]} que quieres y la calculo.`,
        `${fmtMeasure(m.packs)} ${m.pack[4]} isn't a quantity you can order: packs are sold whole. With ${m.pack[4]} of ${val(1)} ${u}: ${opts}. Tell me the whole number of ${m.pack[4]} you want and I'll calculate it.`,
      );
    }
    case "decimalQty":
      return Lx(
        `La cantidad ${f(m.wanted)} ${m.item} tiene decimales y no se puede pedir una fracción de ${m.item ? singularOf(m.item) : "pieza"}. ¿La cantidad es ${f(Math.floor(m.wanted))} o ${f(Math.ceil(m.wanted))}? Si es un peso o una medida, dime cuánto trae cada empaque en esa misma medida.`,
        `The quantity ${f(m.wanted)} ${m.item} has decimals and you can't order a fraction of a ${m.item ? singularOf(m.item) : "piece"}. Is it ${f(Math.floor(m.wanted))} or ${f(Math.ceil(m.wanted))}? If it's a weight or a measure, tell me how much each pack holds in that same measure.`,
      );
    case "decimalContent":
      return Lx(
        `El contenido de cada ${one} (${f(m.perPack)}) tiene decimales; un empaque trae piezas completas. ¿Cuántas piezas (o pares) trae exactamente cada ${one}? Si ${f(m.perPack)} es un peso o una medida, indícame la unidad y el peso o medida que necesitas en total.`,
        `The content of each ${one} (${f(m.perPack)}) has decimals; a pack holds whole pieces. Exactly how many pieces (or pairs) does each ${one} hold? If ${f(m.perPack)} is a weight or measure, tell me the unit and the total weight or measure you need.`,
      );
    case "measure":
      return Lx(
        `Pediste ${f(m.wanted)} ${m.item}, pero el empaque está indicado en piezas, no en ${m.item}. Para no adivinar, dime cuánto pesa o mide el contenido de cada ${one} (por ejemplo «cada ${one} trae 25 ${m.item}») o la cantidad en piezas.`,
        `You asked for ${f(m.wanted)} ${m.item}, but the pack is given in pieces, not in ${m.item}. So I don't guess, tell me the weight or measure of each ${one}'s content (for example "each ${one} holds 25 ${m.item}") or the quantity in pieces.`,
      );
    case "range":
      return Lx(
        `Escribiste un rango (${f(m.sizes![0])} a ${f(m.sizes![1])} ${m.item}). Para darte un cálculo exacto necesito una sola cifra: ¿con cuál calculo? Si quieres, mándame las dos preguntas por separado.`,
        `You wrote a range (${f(m.sizes![0])} to ${f(m.sizes![1])} ${m.item}). For an exact calculation I need one figure: which one should I use? You can also send the two questions separately.`,
      );
    case "conflictSize":
      return Lx(
        `Tu mensaje da contenidos distintos para cada ${one} (${m.sizes!.map(f).join(" y ")} piezas). ¿Cuál es el correcto? Con ese dato hago el cálculo; si son dos presentaciones diferentes, escríbelas por separado.`,
        `Your message gives different contents for each ${one} (${m.sizes!.map(f).join(" and ")} pieces). Which one is right? With that I'll calculate; if they are two different presentations, send them separately.`,
      );
    case "conflictCond":
      return Lx(
        `Tu mensaje trae condiciones de compra que no coinciden${conds.mins.length > 1 ? ` (mínimos: ${list(conds.mins)})` : ""}${conds.lots.length > 1 ? ` (múltiplos: ${list(conds.lots)})` : ""}${conds.mins.length <= 1 && conds.lots.length <= 1 ? ` (${[...conds.mins, ...conds.lots].map((c) => `${f(c.n)} ${c.word}`.trim()).join(", ")}: no se pueden cumplir con empaques completos de este contenido)` : ""}. ¿Cuál es la condición vigente del proveedor? Confírmala y hago el cálculo.`,
        `Your message has purchase conditions that don't match${conds.mins.length > 1 ? ` (minimums: ${list(conds.mins)})` : ""}${conds.lots.length > 1 ? ` (multiples: ${list(conds.lots)})` : ""}${conds.mins.length <= 1 && conds.lots.length <= 1 ? ` (${[...conds.mins, ...conds.lots].map((c) => `${f(c.n)} ${c.word}`.trim()).join(", ")}: they can't be met with whole packs of this content)` : ""}. Which condition does the supplier actually apply? Confirm it and I'll calculate.`,
      );
    case "badCond":
      return Lx(
        `El pedido mínimo o el múltiplo (${[...conds.mins, ...conds.lots].map((c) => `${c.n} ${c.word}`.trim()).join(", ")}) debe ser un número entero mayor que cero. ¿Cuál es la condición exacta del proveedor?`,
        `The minimum order or multiple (${[...conds.mins, ...conds.lots].map((c) => `${c.n} ${c.word}`.trim()).join(", ")}) must be a whole number above zero. What is the supplier's exact condition?`,
      );
  }
  return "";
}

function measureReply(m: PackMath): string {
  const f = fmtMeasure;
  const u = m.item;
  const pw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  // Spanish agreement: "bolsas completas", "sacos completos", "1 bolsa completa"
  const fem = /a$/.test(m.pack[1]);
  const whole = (n: number) => (fem ? "complet" + (n === 1 ? "a" : "as") : "complet" + (n === 1 ? "o" : "os"));
  const assume = Lx(
    ` Supone que el contenido neto de cada ${pw(1)} es exactamente ${f(m.perPack)} ${u} y que solo se venden ${pw(2)} ${whole(2)}; confirma el peso o la medida neta con el proveedor.`,
    ` This assumes each ${pw(1)} holds exactly ${f(m.perPack)} ${u} net and that only whole ${pw(2)} are sold; confirm the net weight or measure with the supplier.`,
  );
  if (m.zeroOrder)
    return Lx(
      `0 ${pw(2)} × ${f(m.perPack)} ${u} = 0 ${u}. Un pedido de 0 ${pw(2)} no es una compra: si quieres hacer un pedido, indica una cantidad mayor que cero.`,
      `0 ${pw(2)} × ${f(m.perPack)} ${u} = 0 ${u}. An order of 0 ${pw(2)} is not a purchase: if you want to order, enter a quantity above zero.`,
    );
  if (m.zero)
    return Lx(`Un ${m.pack[1]} con 0 ${u} no permite calcular: ¿cuánto trae en realidad cada ${m.pack[1]}?`, `A ${m.pack[3]} holding 0 ${u} can't be calculated: how much does each ${m.pack[3]} actually hold?`);
  if (m.mode === "ask")
    return Lx(
      `Cada ${pw(1)} trae ${f(m.perPack)} ${u}. ¿Cuánto necesitas en total (en ${u} u otra medida de peso o volumen)? Con ese dato te digo cuánt${fem ? "as" : "os"} ${pw(2)} ${whole(2)} pedir.`,
      `Each ${pw(1)} holds ${f(m.perPack)} ${u}. How much do you need in total (in ${u} or another weight or volume unit)? With that I'll tell you how many whole ${pw(2)} to order.`,
    );
  if (m.mode === "total")
    return Lx(
      `${f(m.packs)} ${pw(m.packs)} × ${f(m.perPack)} ${u} = ${f(m.total)} ${u}.`,
      `${f(m.packs)} ${pw(m.packs)} × ${f(m.perPack)} ${u} = ${f(m.total)} ${u}.`,
    ) + assume;
  const from = m.measure?.from ? Lx(`${m.measure.from} son ${f(m.wanted)} ${u}. `, `${m.measure.from} is ${f(m.wanted)} ${u}. `) : "";
  const cw = condWords(m);
  const lead = m.cond?.changed
    ? Lx(
        `Para ${f(m.wanted)} ${u} necesitarías ${f(m.cond.need)} ${pw(m.cond.need)}, pero ${cw.lead}: debes pedir ${f(m.packs)} ${pw(m.packs)} y recibirías ${f(m.total)} ${u}`,
        `For ${f(m.wanted)} ${u} you'd need ${f(m.cond.need)} ${pw(m.cond.need)}, but ${cw.lead}: you should order ${f(m.packs)} ${pw(m.packs)} and would receive ${f(m.total)} ${u}`,
      )
    : Lx(
        `Para ${f(m.wanted)} ${u} en ${pw(2)} de ${f(m.perPack)} ${u}, necesitarías ${f(m.packs)} ${pw(m.packs)} ${whole(m.packs)} y recibirías ${f(m.total)} ${u}`,
        `For ${f(m.wanted)} ${u} in ${pw(2)} of ${f(m.perPack)} ${u}, you'd need ${f(m.packs)} whole ${pw(m.packs)} and would receive ${f(m.total)} ${u}`,
      );
  const extra = m.extra > 0 ? Lx(` (${f(m.extra)} ${u} más de lo que necesitas).`, ` (${f(m.extra)} ${u} more than you need).`) : ".";
  return from + lead + extra + (m.cond?.changed ? "" : cw.ok) + cw.unread + assume;
}

function packMathReply(m: PackMath): string {
  if (m.invalid) return invalidReply(m);
  if (m.measure) return measureReply(m);
  if (m.kit) return kitReply(m);
  const items = tw(m.item) || Lx("piezas", "pieces");
  // "0 cajas de 12": the arithmetic, then what an order of 0 means
  if (m.zeroOrder)
    return Lx(
      `0 ${m.pack[2]} × ${m.perPack.toLocaleString("en-US")} ${items} por ${m.pack[1]} = 0 ${items}. Un pedido de 0 ${m.pack[2]} no es una compra: si quieres hacer un pedido, indica una cantidad mayor que cero.`,
      `0 ${m.pack[4]} × ${m.perPack.toLocaleString("en-US")} ${items} per ${m.pack[3]} = 0 ${items}. An order of 0 ${m.pack[4]} is not a purchase: if you want to order, enter a quantity above zero.`,
    );
  if (m.mode === "ask" && m.zero)
    return Lx(
      `Un ${m.pack[1]} con 0 ${m.item || "piezas"} no permite calcular: ¿qué cantidad de ${m.item || "piezas"} trae en realidad cada ${m.pack[1]}? Escríbeme un número mayor que cero${m.wanted ? "" : " y la cantidad total que necesitas"}.`,
      `A ${m.pack[3]} holding 0 ${m.item || "pieces"} can't be calculated: how many ${m.item || "pieces"} does each ${m.pack[3]} actually hold? Send me a number above zero${m.wanted ? "" : " and the total quantity you need"}.`,
    );
  if (m.mode === "ask") {
    const pw2 = Lx(m.pack[2], m.pack[4]);
    const noun = m.conv?.perWord || "";
    const what = m.unit === "pair"
      ? Lx(`¿cuántos pares o cuántos ${noun || "piezas"} individuales trae cada ${m.pack[1]}?`, `how many pairs, or how many single ${noun || "pieces"}, does each ${m.pack[3]} hold?`)
      : Lx(`¿cuántos ${items} trae cada ${m.pack[1]}?`, `how many ${items} does each ${m.pack[3]} hold?`);
    return Lx(
      `Para decirte cuántas ${pw2} necesitas para ${m.wanted.toLocaleString("en-US")} ${items}${noun && m.unit ? ` de ${noun}` : ""} me falta un dato: ${what} Con eso te lo calculo.`,
      `To tell you how many ${pw2} you need for ${m.wanted.toLocaleString("en-US")} ${items}${noun && m.unit ? ` of ${noun}` : ""} I need one more figure: ${what} With that I'll calculate it.`,
    );
  }
  const one = singularOf(items);
  // a client counting pairs or dozens also sees the result in their unit:
  // "600 zapatos (300 pares)"; an odd count says what is left loose
  const cu = m.conv ? (PAIR_W.test(m.conv.wantedWord) ? 2 : DOZ_W.test(m.conv.wantedWord) ? 12 : 0) : 0;
  const cuWord = tw(m.conv?.wantedWord || "");
  const inClientUnit = (n: number) => {
    if (!cu || n <= 0) return "";
    const whole = Math.floor(n / cu);
    const rest = n - whole * cu;
    const wWord = whole === 1 ? singularOf(cuWord) : cuWord;
    return rest
      ? Lx(` (${whole.toLocaleString("en-US")} ${wWord} y ${rest} ${rest === 1 ? one : items} suelt${rest === 1 ? "o" : "os"})`, ` (${whole.toLocaleString("en-US")} ${wWord} and ${rest} loose ${rest === 1 ? one : items})`)
      : ` (${whole.toLocaleString("en-US")} ${wWord})`;
  };
  const nn = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? one : items}${inClientUnit(n)}`;
  const pw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const f = (n: number) => n.toLocaleString("en-US");
  const confirm = Lx(
    " Confirma con el proveedor el contenido real y su pedido mínimo.",
    " Confirm the real content and minimum order with the supplier.",
  );
  // the conversion, said before the result: "1,000 pares son 2,000 guantes (cada par son 2)."
  let pre = "";
  const c = m.conv;
  if (c) {
    const by = (w: string) =>
      PAIR_W.test(w) ? Lx(" (cada par son 2)", " (each pair is 2)") : DOZ_W.test(w) ? Lx(" (cada docena son 12)", " (each dozen is 12)") : "";
    if (Number.isFinite(c.wanted) && c.wanted !== m.wanted && m.mode !== "total")
      pre += Lx(`${f(c.wanted)} ${tw(c.wantedWord)} son ${f(m.wanted)} ${items}${by(c.wantedWord)}. `, `${f(c.wanted)} ${tw(c.wantedWord)} are ${f(m.wanted)} ${items}${by(c.wantedWord)}. `);
    if (c.perPack !== m.perPack)
      pre += Lx(`Cada ${pw(1)} de ${f(c.perPack)} ${tw(c.perWord)} trae ${f(m.perPack)} ${items}${by(c.perWord)}. `, `Each ${pw(1)} of ${f(c.perPack)} ${tw(c.perWord)} holds ${f(m.perPack)} ${items}${by(c.perWord)}. `);
  }
  // counting single pieces as pairs assumes they make complete pairs
  const pairNote =
    c && (PAIR_W.test(c.wantedWord) || PAIR_W.test(c.perWord))
      ? Lx(
          ` Supone que los ${items} individuales forman pares completos y compatibles (lado, talla y modelo); confírmalo con el proveedor.`,
          ` This assumes the single ${items} make complete, matching pairs (side, size and model); confirm it with the supplier.`,
        )
      : "";
  // the other reading when one side doesn't say its unit
  let post = "";
  const a = m.alt;
  if (a && c && a.kind === "contentPairs")
    post = Lx(
      ` Si en realidad cada ${pw(1)} trae ${f(c.perPack)} ${tw(a.word)} (y no ${f(c.perPack)} ${tw(c.perWord)} individuales), ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If each ${pw(1)} actually holds ${f(c.perPack)} ${tw(a.word)} (not ${f(c.perPack)} single ${tw(c.perWord)}), it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  else if (a && c && a.kind === "wantedPairs")
    post = Lx(
      ` Si tus ${f(c.wanted)} ${tw(c.wantedWord)} son en realidad ${f(c.wanted)} ${tw(a.word)}, ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If your ${f(c.wanted)} ${tw(c.wantedWord)} are actually ${f(c.wanted)} ${tw(a.word)}, it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  else if (a && a.kind === "contentPieces")
    post = Lx(
      ` Si cada ${pw(1)} trae ${f(m.perPack)} ${tw(a.word) || "piezas"} individuales y no ${f(m.perPack)} ${items}, ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If each ${pw(1)} holds ${f(m.perPack)} single ${tw(a.word) || "pieces"} rather than ${f(m.perPack)} ${items}, it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  const per = Lx(`${f(m.perPack)} ${items} por ${pw(1)}`, `${f(m.perPack)} ${items} per ${pw(1)}`);
  // the supplier's minimum order and multiples
  const cw = condWords(m);
  if (m.cond?.changed && m.mode === "packs")
    return pre + Lx(
      `Para ${nn(m.wanted)} necesitarías ${f(m.cond.need)} ${pw(m.cond.need)}, pero ${cw.lead}: debes pedir ${f(m.packs)} ${pw(m.packs)} = ${nn(m.total)}, y te sobrarían ${nn(m.extra)}, suponiendo ${per}.`,
      `For ${nn(m.wanted)} you'd need ${f(m.cond.need)} ${pw(m.cond.need)}, but ${cw.lead}: you should order ${f(m.packs)} ${pw(m.packs)} = ${nn(m.total)}, with ${nn(m.extra)} left over, assuming ${per}.`,
    ) + cw.unread + pairNote + confirm;
  const minEnd = !m.cond
    ? ""
    : (m.mode === "check" || m.mode === "total") && m.packs !== m.cond.need
      ? Lx(
          ` Ojo: ${cw.lead}; para cumplirlo tendrías que pedir ${f(m.cond.need)} ${pw(m.cond.need)} = ${nn(m.cond.need * m.perPack)}.`,
          ` Note: ${cw.lead}; to meet it you'd have to order ${f(m.cond.need)} ${pw(m.cond.need)} = ${nn(m.cond.need * m.perPack)}.`,
        ) + cw.unread
      : cw.ok + cw.unread;
  if (m.mode === "total")
    return pre + Lx(
      `${f(m.packs)} ${pw(m.packs)} de ${f(m.perPack)} son ${nn(m.total)}.`,
      `${f(m.packs)} ${pw(m.packs)} of ${f(m.perPack)} make ${nn(m.total)}.`,
    ) + minEnd + pairNote + confirm;
  if (m.mode === "check") {
    const need = Math.ceil(m.wanted / m.perPack);
    return pre + (m.extra >= 0
      ? Lx(
          `Sí alcanza: ${f(m.packs)} ${pw(m.packs)} de ${f(m.perPack)} son ${nn(m.total)}${m.extra ? `, con ${nn(m.extra)} ${m.extra === 1 ? "adicional" : "adicionales"}` : ""}, para cubrir ${nn(m.wanted)}.`,
          `Yes, it's enough: ${f(m.packs)} ${pw(m.packs)} of ${f(m.perPack)} make ${nn(m.total)}${m.extra ? `, with ${nn(m.extra)} extra` : ""}, to cover ${nn(m.wanted)}.`,
        )
      : Lx(
          `No alcanza: ${f(m.packs)} ${pw(m.packs)} de ${f(m.perPack)} son ${nn(m.total)}; te ${-m.extra === 1 ? "faltaría" : "faltarían"} ${nn(-m.extra)}. Necesitarías ${f(need)} ${pw(need)} (${nn(need * m.perPack)}).`,
          `It's not enough: ${f(m.packs)} ${pw(m.packs)} of ${f(m.perPack)} make ${nn(m.total)}; you'd be ${nn(-m.extra)} short. You'd need ${f(need)} ${pw(need)} (${nn(need * m.perPack)}).`,
        )) + minEnd + pairNote + confirm;
  }
  if (m.extra === 0)
    return pre + Lx(
      `Necesitarías ${f(m.packs)} ${pw(m.packs)}: exactamente ${nn(m.total)}, suponiendo ${per}.`,
      `You'd need ${f(m.packs)} ${pw(m.packs)}: exactly ${nn(m.total)}, assuming ${per}.`,
    ) + post + minEnd + pairNote + confirm;
  const less = m.packs - 1;
  const short = m.wanted - less * m.perPack;
  return pre + Lx(
    `Necesitarías ${f(m.packs)} ${pw(m.packs)}: ${nn(m.total)}, con ${nn(m.extra)} ${m.extra === 1 ? "adicional" : "adicionales"}, suponiendo ${per}.${less > 0 ? ` Con ${f(less)} ${pw(less)} tendrías ${nn(less * m.perPack)} y te ${short === 1 ? "faltaría" : "faltarían"} ${nn(short)}.` : ""}`,
    `You'd need ${f(m.packs)} ${pw(m.packs)}: ${nn(m.total)}, with ${nn(m.extra)} extra, assuming ${per}.${less > 0 ? ` With ${f(less)} ${pw(less)} you'd have ${nn(less * m.perPack)}, ${nn(short)} short.` : ""}`,
  ) + post + minEnd + pairNote + confirm;
}

/** One answer per calculation asked; says so when part of the message couldn't be read. */
function mathReply(q: string): string {
  const all = packMathAll(q);
  if (all.length >= 2) {
    const asked = packPhrases(q);
    const lines = all.map((m, i) => `${i + 1}. ${m.item ? `${m.item[0].toUpperCase()}${m.item.slice(1)}: ` : ""}${packMathReply(m).replace(/ Confirma con el proveedor.*$| Confirm the real content.*$/, "")}`);
    const missing = asked > all.length
      ? " " + Lx("Una parte del mensaje no la pude leer como cálculo: escríbela por separado, con la cantidad y lo que trae cada empaque.", "I couldn't read one part of the message as a calculation: write it separately, with the quantity and what each pack holds.")
      : "";
    return `${Lx("Calculé cada pedido por separado:", "I calculated each order separately:")}\n${lines.join("\n")}\n${Lx("Confirma con el proveedor el contenido real de cada empaque y su pedido mínimo.", "Confirm the real content of each pack and the minimum order with the supplier.")}${missing}`;
  }
  const one = packMath(q)!;
  if (packPhrases(q) >= 2)
    return packMathReply(one) + " " + Lx(
      "Tu mensaje parece pedir más de un cálculo y solo pude leer este; escribe el otro pedido por separado (cantidad y contenido de cada empaque).",
      "Your message seems to ask for more than one calculation and I could only read this one; write the other order separately (quantity and content of each pack).",
    );
  return packMathReply(one);
}

// "¿Puedo asegurar que son 20 pares vendibles por caja?" with single pieces whose
// side or size isn't stated: a question about the data, answered on its own
const PAIR_DOUBT =
  /(?:asegur|garantiz|seguro|segura|afirmar|confirmar|contar\s+con|saber\s+si|puedo\s+(?:decir|dar\s+por)|se\s+puede\s+(?:decir|asumir|asegurar)|forman?|equivalen?|cuentan?\s+como|ensure|guarantee|be\s+sure|assume|count\s+as|make\s+up)[^.?!]{0,80}\b(?:par(?:es)?|pairs?)\b|\b(?:par(?:es)?|pairs?)\b[^.?!]{0,40}(?:vendibles?|completos?|compatibles?|sellable|complete)/;
const PAIR_DETAIL = /individual|suelt|izquierd|derech|talla|n[uú]mero|lado|single|left|right|\bsize|mismo\s+modelo/;
export function pairDoubt(text: string): boolean {
  const t = text.toLowerCase();
  return PAIR_DOUBT.test(t) && PAIR_DETAIL.test(t);
}
function pairDoubtReply(text: string): string {
  const t = normalizeNumbers(text.toLowerCase());
  const f = (n: number) => n.toLocaleString("en-US");
  const per = t.match(/(\d+)\s+([a-záéíóúüñ]+)\s+(?:individuales|sueltos|sueltas|single|individual)/);
  const wantedPairs = t.match(/(\d+)\s+(?:pares|pairs)\b/);
  const pieces = per ? Number(per[1]) : 0;
  const noun = per?.[2] || Lx("piezas", "pieces");
  const pairsPerBox = pieces && pieces % 2 === 0 ? pieces / 2 : 0;
  const lead = Lx(
    `No: con esa información no se puede asegurar${pairsPerBox ? ` que sean ${f(pairsPerBox)} pares vendibles por caja` : " cuántos pares vendibles trae cada caja"}. ${pieces ? `${f(pieces)} ${noun} individuales` : "Las piezas individuales"} solo forman pares completos si se confirma que:`,
    `No: with that information you can't be sure${pairsPerBox ? ` there are ${f(pairsPerBox)} sellable pairs per box` : " how many sellable pairs each box holds"}. ${pieces ? `${f(pieces)} single ${noun}` : "Single pieces"} only make complete pairs if it is confirmed that:`,
  );
  const checks = Lx(
    "\n1. La mitad son izquierdos y la mitad derechos (o que el modelo no tiene lado).\n2. Coinciden en talla, modelo y color dentro de cada caja.\n3. Vienen emparejados o identificados por par (no surtidos al azar).\nPide al proveedor el packing list por caja con tallas y lado, o fotos del empaque abierto.",
    "\n1. Half are left and half are right (or the model has no side).\n2. They match in size, model and color within each box.\n3. They come paired or marked by pair (not randomly assorted).\nAsk the supplier for the per-box packing list with sizes and sides, or photos of an open box.",
  );
  const tail =
    pairsPerBox && wantedPairs
      ? Lx(
          `\nSi se confirma, cada caja trae ${f(pairsPerBox)} pares y para ${f(Number(wantedPairs[1]))} pares necesitarías ${f(Math.ceil(Number(wantedPairs[1]) / pairsPerBox))} cajas; si no, los pares vendibles pueden ser menos y conviene pedir más cajas o una muestra antes de comprar.`,
          `\nIf confirmed, each box holds ${f(pairsPerBox)} pairs and for ${f(Number(wantedPairs[1]))} pairs you'd need ${f(Math.ceil(Number(wantedPairs[1]) / pairsPerBox))} boxes; if not, the sellable pairs may be fewer, so consider more boxes or a sample before buying.`,
        )
      : pieces && pieces % 2 === 1
        ? Lx(`\nAdemás, ${f(pieces)} es impar: aunque todo coincida, quedaría al menos 1 ${singularOf(noun)} sin pareja por caja.`, `\nAlso, ${f(pieces)} is odd: even if everything matches, at least 1 ${singularOf(noun)} per box would have no pair.`)
        : "";
  return lead + checks + tail;
}

// A question that looks like a calculation the parser couldn't read: ask for the data
const MATH_ASK = new RegExp(`cu[aá]nt[oa]s\\s+(?:${PACK_RE}|piezas|pares|unidades|pieces|units)\\b|how\\s+many\\s+(?:${PACK_RE}|pieces|units)\\b|\\b(?:alcanza|alcanzan|me\\s+sobran?|sobrar[aá]n?|faltar[aá]n?|enough|left\\s+over)\\b`);

export function replyKinds(text: string): string[] {
  const t = text.toLowerCase();
  const kinds: string[] = [];
  // a question about whether single pieces make pairs is answered on its own
  if (pairDoubt(text)) return ["pairs"];
  // a calculation is answered, and so is anything else the message asks
  const isMath = !!(packMathAll(text).length || packMath(text));
  if (/certificad|certificaci|certificate|certification|\bce\b|\bfda\b|\biso\b|\bul\b|\brohs\b|\bsgs\b|grado alimenticio|food[- ]grade|apto para alimentos|suitable for food/.test(t)) kinds.push("certificate");
  // in a calculation, "mi proveedor exige un mínimo" is context, not a question about the supplier
  if ((isMath ? /confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit|seguro\s+el\s+proveedor/ : /proveedor|supplier|seller|vendedor|f[aá]brica|factory|confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit/).test(t)) kinds.push("supplier");
  // "Guarantee" goes to customs authorization only when the question is about the import itself
  const customsCtx = /importaci|aduana|autoriz|permiso|aprobad|aprobaci|liberaci|despacho|que pase|customs|import(?!ar\b|ing\b)|authoriz|permit|approv/.test(t);
  // "asegurar" alone ("¿puedo asegurar que son 20 pares?") is not about customs
  const guaranteeWord = /garantiz|garant[ií]a de que|sin problema|guarantee/.test(t) || (customsCtx && /asegur/.test(t));
  const permitWord = /permiso|autoriz|licencia|permit|authoriz|license/.test(t);
  if ((customsCtx && (!isMath || guaranteeWord || permitWord)) || (guaranteeWord && !kinds.includes("certificate"))) kinds.push("guarantee");
  if (/\bdai\b|arancel|partida|impuesto|\biva\b|tributo|tariff|duty|duties|\btax/.test(t)) kinds.push("dai");
  if (/cu[aá]nto\s+(?:tiempo|tarda|demora)|cu[aá]ntos\s+d[ií]as|cu[aá]ndo\s+(?:llega|llegar[ií]a|estar[ií]a)|when\s+(?:will\s+it\s+)?arrive|tiempo\s+de\s+(?:tr[aá]nsito|env[ií]o|llegada)|tarda\s+en\s+llegar|how\s+long|transit\s+time|lead\s+time/.test(t)) kinds.push("transit");
  else if (isMath ? /precio|costo|cuest[ae]|cotiz|price|cost|quote|how much/.test(t) : /precio|costo|cu[aá]nto|cotiz|price|cost|quote|how much/.test(t)) kinds.push("cost");
  // numbers and packs in a question the calculator couldn't read: ask rather than guess
  const sizeOnly = new RegExp(`${PACK_RE}\\s+(?:de|of|con|with|x)\\s*\\d|(?:trae|traen|tiene|tienen|contiene|vienen?|has|holds|contains)\\s+\\d`).test(t);
  if (!isMath && !sizeOnly && /\d/.test(t) && MATH_ASK.test(normalizeNumbers(t)) && !kinds.some((k) => k === "cost" || k === "transit")) kinds.unshift("mathUnclear");
  return isMath ? ["math", ...kinds] : kinds;
}

function certificateReply(text: string, ctx: ChatCtx): string {
  const asksGuarantee = /garant|guarantee|verific|verified|asegur|demuestra que el proveedor|proves the supplier/i.test(text);
  const base = Lx(
    "No puedo validar certificados desde la herramienta: solo muestro las certificaciones que el proveedor declara en la plataforma. Antes de comprar, pide copia del certificado y confirma que corresponda al modelo exacto y al fabricante (número, fecha y organismo que lo emitió).",
    "I can't validate certificates from the tool: I only show the certifications the supplier declares on the platform. Before buying, ask for a copy of the certificate and confirm it matches the exact model and manufacturer (number, date and issuing body).",
  );
  const ce = /\bce\b/i.test(text)
    ? " " +
      Lx(
        `Una marca como CE indica que se declara que el producto cumple ciertas normas europeas${asksGuarantee ? "; no verifica al proveedor ni es una garantía de la compra o de la calidad" : ""}.`,
        `A mark like CE indicates the product is declared to meet certain European standards${asksGuarantee ? "; it does not verify the supplier and is not a guarantee of the purchase or the quality" : ""}.`,
      )
    : asksGuarantee
      ? " " + Lx("Un certificado no verifica al proveedor ni es una garantía de la compra.", "A certificate does not verify the supplier and is not a guarantee of the purchase.")
      : "";
  if (!ctx.product) {
    return (
      base +
      ce +
      " " +
      Lx(
        "¿Qué producto vas a importar? Con eso te digo qué conviene revisar en ese caso.",
        "What product are you importing? With that I can tell you what to check in that case.",
      )
    );
  }
  const cat = inferCategory(ctx.product);
  const food = FOOD_USE.test(wantedText(ctx.product));
  ctx = { product: ctx.product.length > 60 ? `${ctx.product.slice(0, 57).trim()}…` : ctx.product };
  let tail = "";
  if (food && (cat === "machinery" || cat === "ppe" || cat === "other"))
    tail = Lx(
      `Para «${ctx.product}», el certificado no demuestra por sí solo que sea apto para contacto con alimentos: pide al fabricante la especificación de los materiales que tocan el alimento o su reporte de prueba.`,
      `For "${ctx.product}", the certificate does not by itself show it is suitable for food contact: ask the manufacturer for the specification of the materials that touch the food or its test report.`,
    );
  else if (cat === "stationery")
    tail = Lx(
      `Para «${ctx.product}», si son para niños, pide los reportes de prueba o certificados de seguridad de materiales que declare el fabricante.`,
      `For "${ctx.product}", if they are for children, ask for the material safety test reports or certificates the manufacturer declares.`,
    );
  else if (cat === "electronics")
    tail = Lx(
      `Para «${ctx.product}», confirma que el certificado cubra el modelo exacto, incluido el voltaje y el cargador si lo trae.`,
      `For "${ctx.product}", confirm the certificate covers the exact model, including voltage and the charger if included.`,
    );
  else
    tail = Lx(
      `Para «${ctx.product}», confirma con SEAL qué documentos pide la importación según su partida.`,
      `For "${ctx.product}", confirm with SEAL which documents the import needs for its tariff heading.`,
    );
  return `${base}${ce} ${tail}`;
}

const FIXED: Record<string, () => string> = {
  supplier: () =>
    Lx(
      "No puedo confirmar si un proveedor es real o confiable: la herramienta solo organiza lo que publica la plataforma (insignias, años, reseñas) y no lo verifica. Siguiente paso: continúa con el formulario para ver opciones ordenadas por índice referencial y, si vas a comprar, pide a SEAL la verificación del proveedor en China (servicio adicional).",
      "I can't confirm whether a supplier is real or reliable: the tool only organizes what the platform publishes (badges, years, reviews) and doesn't verify it. Next step: continue with the form to see options sorted by reference index and, if you're going to buy, ask SEAL for the supplier verification in China (additional service).",
    ),
  guarantee: () =>
    Lx(
      "Tampoco puedo garantizar que la importación sea autorizada ni que pase la aduana sin observaciones: eso depende de la partida arancelaria, de los permisos que esa partida pida y de que la documentación del embarque coincida. Dato a confirmar: la ficha técnica del producto, para que SEAL revise la partida y los permisos antes de comprar.",
      "I also can't guarantee the import will be authorized or clear customs without remarks: that depends on the tariff heading, the permits it requires and the shipping documents matching. Data to confirm: the product's technical sheet, so SEAL can review the heading and permits before you buy.",
    ),
  dai: () =>
    Lx(
      "No puedo dar el impuesto exacto sin la ficha técnica: el DAI depende de la partida arancelaria, y la partida se define con lo que dice esa ficha (qué es el producto, material, uso). En la estimación usamos 15% de DAI como referencia y el IVA de 12% sobre CIF + DAI. Siguiente paso: completa el formulario para ver el escenario y, para la partida exacta, comparte la ficha técnica con un agente aduanero de SEAL (WhatsApp +502 5996 4664).",
      "I can't give the exact tax without the technical sheet: the DAI depends on the tariff heading, and the heading is set from that sheet (what the product is, material, use). The estimate uses 15% DAI as reference and 12% IVA on CIF + DAI. Next step: complete the form to see the scenario and, for the exact heading, share the technical sheet with a SEAL customs broker (WhatsApp +502 5996 4664).",
    ),
  transit: () =>
    Lx(
      "Como referencia, el tránsito marítimo desde China a Guatemala suele ser de 30 a 45 días, más el tiempo de producción del proveedor y el despacho. El plazo real lo confirman el proveedor (producción) y la cotización de flete de SEAL según la ruta y la fecha de embarque.",
      "As a reference, ocean transit from China to Guatemala is usually 30 to 45 days, plus the supplier's production time and customs clearance. The real lead time is confirmed by the supplier (production) and SEAL's freight quote for the route and sailing date.",
    ),
  cost: () =>
    Lx(
      "Puedo prepararte una estimación preliminar con los datos del formulario (producto, cantidad y, si lo tienes, volumen o peso). Un costo confirmado solo lo da una cotización de SEAL. Siguiente paso: continúa con el formulario.",
      "I can prepare a preliminary estimate with the form data (product, quantity and, if you have it, volume or weight). A confirmed cost only comes from a SEAL quote. Next step: continue with the form.",
    ),
  mathUnclear: () =>
    Lx(
      "No pude leer este cálculo con seguridad y prefiero no adivinar. Escríbemelo así: 1) cantidad total y su unidad (piezas, pares, sets…), 2) qué trae cada empaque y en qué unidad, y 3) si hay pedido mínimo o múltiplos. Ejemplo: «Necesito 200 pares; cada caja trae 20 pares; mínimo 15 cajas».",
      "I couldn't read this calculation reliably and I'd rather not guess. Send it like this: 1) total quantity and its unit (pieces, pairs, sets…), 2) what each pack holds and in what unit, and 3) any minimum order or multiples. Example: \"I need 200 pairs; each box holds 20 pairs; minimum 15 boxes\".",
    ),
  general: () =>
    Lx(
      "Gracias. Por ahora no respondo preguntas abiertas en este chat. Para orientarte, continúa con el formulario: ahí ordenamos tus datos y preparamos las referencias y estimaciones. Si prefieres hablar con una persona, escribe al WhatsApp de SEAL +502 5996 4664.",
      "Thanks. For now I don't answer open questions in this chat. To guide you, continue with the form: there we organize your data and prepare the references and estimates. If you'd rather talk to a person, message SEAL on WhatsApp +502 5996 4664.",
    ),
};

export interface ReplySpec {
  text: string; // the client's message
  product: string; // product known when answering
  newProduct?: string; // product the message stated (correction or first mention)
  mentioned?: string; // product named inside a question (used as context, no acknowledgement)
  previous?: string; // product before this message ("" when unknown)
  reask?: string; // earlier question to answer again for the new product
  earlierFood?: boolean; // an earlier answer talked about food-contact materials
  previousMath?: string; // the client's earlier calculation question, for follow-ups
  mathText?: string; // this message's calculation, written in full (for later follow-ups)
  newQuantity?: number; // "quiero 2000 en vez de 500"
  oldQuantity?: number;
}

/** Whether a certificate answer for this product talks about food contact. */
export function foodAdvice(product: string): boolean {
  if (!product) return false;
  const cat = inferCategory(product);
  return FOOD_USE.test(wantedText(product)) && (cat === "machinery" || cat === "ppe" || cat === "other");
}

/** Builds the reply in the current language (called at render time). */
// "Lápices de grafito para escuela, 500 unidades" and "lápices escolares" are the same product
const STOP = new Set(["para", "with", "from", "unidades", "piezas", "units", "pieces", "quiero", "importar", "necesito", "escuela", "school", "industrial", "industriales"]);
const stems = (x: string) =>
  new Set(
    x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.slice(0, 5)),
  );
export function sameProduct(a: string, b: string): boolean {
  if (!a || !b) return false;
  const A = stems(a);
  return [...stems(b)].some((w) => A.has(w));
}

/** "Quiero 2000 en vez de 500", "cambia la cantidad a 2,000", "make it 300". */
export function quantityChange(text: string): { qty: number; before: number } | null {
  const t = normalizeNumbers(` ${String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ")} `);
  if (packMath(text)) return null;
  // "paquetes de 16 en lugar de 10" changes the pack, not the quantity
  if (new RegExp(`\\b${PACK_RE}\\b`).test(t)) return null;
  const m =
    t.match(/(?:cambi\w*|ajust\w*|pon\w*|modific\w*|change|set|make)\s+(?:la\s+|the\s+)?(?:cantidad|quantity|it)?\s*(?:a|to|en)?\s*(\d+)/) ||
    t.match(/(?:quiero|necesito|ser[ií]an|mejor|i\s+want|i\s+need|make\s+it)\s+(\d+)\b[^\d]*?\b(?:en\s+vez\s+de|en\s+lugar\s+de|instead\s+of|y\s+no|not)\s+(\d+)/) ||
    t.match(/\b(\d+)\s+(?:[a-záéíóúüñ]+\s+)?(?:en\s+vez\s+de|en\s+lugar\s+de|instead\s+of)\s+(\d+)/);
  if (!m) return null;
  const qty = Number(m[1]);
  if (!(qty >= 1) || qty > 10_000_000) return null;
  return { qty, before: m[2] ? Number(m[2]) : 0 };
}

export function buildReply(r: ReplySpec): string {
  const ctx: ChatCtx = { product: r.product };
  const parts: string[] = [];
  if (r.newQuantity) {
    parts.push(
      Lx(
        `Anotado: la cantidad es ${r.newQuantity.toLocaleString("en-US")}${r.oldQuantity ? ` (antes ${r.oldQuantity.toLocaleString("en-US")})` : ""}. La paso al formulario; ahí puedes ajustarla.`,
        `Noted: the quantity is ${r.newQuantity.toLocaleString("en-US")}${r.oldQuantity ? ` (before ${r.oldQuantity.toLocaleString("en-US")})` : ""}. I'll carry it to the form, where you can adjust it.`,
      ),
    );
    return parts.join("\n\n");
  }
  if (r.newProduct) {
    const changed = !!r.previous && !sameProduct(r.previous, r.newProduct);
    const wrongAdvice = !!r.earlierFood && !foodAdvice(r.newProduct);
    parts.push(
      changed || wrongAdvice
        ? Lx(
            `Gracias por aclararlo: tu producto es «${r.newProduct}». Corrijo lo anterior: ${wrongAdvice ? "lo que dije sobre materiales en contacto con alimentos no aplica a este producto" : "lo que respondí pensando en otro producto no aplica"}; tomo «${r.newProduct}» para lo que sigue y para el formulario.`,
            `Thanks for clarifying: your product is "${r.newProduct}". Correcting what I said: ${wrongAdvice ? "what I said about food-contact materials doesn't apply to this product" : "what I answered with another product in mind doesn't apply"}; I'll use "${r.newProduct}" from here on and in the form.`,
          )
        : Lx(
            `Anotado: tu producto es «${r.newProduct}»; lo uso para lo que sigue y para el formulario.`,
            `Noted: your product is "${r.newProduct}"; I'll use it from here on and in the form.`,
          ),
    );
  }
  let q = r.text;
  let kinds = replyKinds(q);
  // a follow-up to an earlier calculation ("¿Y los 300 cuadernos en paquetes de 10?")
  const follow = !kinds.length && r.previousMath ? followUpMath(q, r.previousMath) : null;
  if (follow) return [...parts, packMathReply(follow)].join("\n\n");
  // a pack size with no quantity and nothing earlier to build on: ask before calculating
  if (!kinds.length && !r.newProduct) {
    const size = normalizeNumbers(q.toLowerCase()).match(new RegExp(`${PACK_RE}\\s+(?:de|of|con|with|x)\\s*(\\d+)|(?:trae|traen|tiene|tienen|contiene|vienen?|has|holds|contains)\\s+(\\d+)`));
    if (size) {
      const n = size[2] || size[3];
      return [
        ...parts,
        (() => {
          // the pack word in the language in use ("cajas" ⇄ "boxes")
          const pk = size[1] ? packOf(size[1]) : undefined;
          return Lx(
            `Para calcular con ${pk ? `${pk[2]} de ${n}` : `${n} por empaque`} necesito la cantidad total: ¿cuántas piezas quieres en total?`,
            `To calculate with ${pk ? `${pk[4]} of ${n}` : `${n} per pack`} I need the total quantity: how many pieces do you want in total?`,
          );
        })(),
      ].join("\n\n");
    }
  }
  // a bare product statement answers the earlier question again, now for this product
  if (!kinds.length && r.newProduct && r.reask) {
    q = r.reask;
    kinds = replyKinds(q).filter((k) => k === "certificate");
  }
  if (!kinds.length && !r.newProduct) kinds = ["general"];
  kinds.forEach((k, i) => {
    let t =
      k === "certificate" ? certificateReply(q, ctx) : k === "math" ? mathReply(q) : k === "pairs" ? pairDoubtReply(q) : (FIXED[k] ?? FIXED.general)();
    if (i === 0 && !parts.length) t = t.replace(/^Tampoco puedo/, "No puedo").replace(/^I also can't/, "I can't");
    parts.push(t);
  });
  if (r.newProduct && !kinds.length)
    parts.push(Lx("Para orientarte con ese producto, continúa con el formulario.", "To guide you on that product, continue with the form."));
  return parts.join("\n\n");
}

/**
 * The reply spec for a new client message, given the earlier ones: whether it is a
 * calculation, a follow-up to an earlier one, a product statement or a quantity
 * change. The chat page stores it and renders buildReply(spec) in the language in use.
 */
export function nextSpec(text: string, specs: ReplySpec[], currentProduct: string, currentQuantity: number): ReplySpec {
  const kinds = replyKinds(text);
  const isMath = kinds.includes("math");
  // the latest earlier calculation this message follows ("¿Y los cuadernos?" can point further back)
  let lastMath = "";
  let follow: PackMath | null = null;
  if (!isMath && !kinds.length)
    for (const x of [...specs].reverse()) {
      if (!x.mathText) continue;
      follow = followUpMath(text, x.mathText);
      if (follow) { lastMath = x.mathText; break; }
    }
  const single = isMath && !packMathAll(text).length ? packMath(text) : null;
  // a calculation that still needs data is kept as the client wrote it
  const mathText = isMath ? (single && mathStatement(single)) || text : follow ? mathStatement(follow) || undefined : undefined;
  // a calculation is not a product statement nor a quantity change
  const newProduct = mathText || kinds.includes("pairs") ? undefined : productFromMessage(text) || undefined;
  // a product named inside a question ("¿el CE sirve para lápices?") becomes the context silently
  const mentioned = !newProduct && !mathText ? productMention(text) || undefined : undefined;
  // only a certificate answer that asked "¿qué producto?" is answered again for the new product
  const lastAi = specs[specs.length - 1];
  const askedForProduct = !!lastAi && !lastAi.product && replyKinds(lastAi.reask || lastAi.text).includes("certificate");
  const qc = mathText ? null : quantityChange(text);
  return {
    mathText,
    previousMath: follow ? lastMath : undefined,
    newQuantity: qc?.qty,
    oldQuantity: qc ? qc.before || currentQuantity || undefined : undefined,
    text,
    product: newProduct || mentioned || currentProduct,
    newProduct,
    mentioned,
    previous: currentProduct,
    reask: askedForProduct ? lastAi.reask || lastAi.text : undefined,
    earlierFood: specs.some((x) => (replyKinds(x.text).includes("certificate") || !!x.reask) && foodAdvice(x.product)),
  };
}

/** A whole conversation, message by message, as the chat page answers it (used by tests). */
export function replayConversation(messages: string[], query = ""): string[] {
  const specs: ReplySpec[] = [];
  return messages.map((text) => {
    const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
    const currentProduct = lastNamed?.newProduct || lastNamed?.mentioned || query;
    const currentQuantity = [...specs].reverse().find((x) => x.newQuantity)?.newQuantity || 0;
    const spec = nextSpec(text, specs, currentProduct, currentQuantity);
    specs.push(spec);
    return buildReply(spec);
  });
}
