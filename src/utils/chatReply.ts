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

/** Reads a pack calculation in any wording, or null when the message isn't one. */
export function packMath(text: string, force = false): PackMath | null {
  let t = ` ${normalizeNumbers(String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ").replace(/\s+/g, " "))} `;
  if (!force && !VERB_Q.test(t)) return null;
  // money is not a quantity ("tengo US$500", "Q2,000", "300 dólares")
  t = t.replace(/(?:us\$|usd|\$|(?:^|\s)q\.?)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:d[oó]lares|dollars|usd|quetzales|gtq)\b/g, " ");
  // the value being replaced is not part of the calculation: "paquetes de 16 en
  // lugar de 10", "300 en vez de 500", "24 per set instead of 12"
  t = t.replace(new RegExp(`(?:en\\s+lugar\\s+de|en\\s+vez\\s+de|instead\\s+of|rather\\s+than|y\\s+no\\s+de|y\\s+no)\\s+(?:(?:los|las|el|la|the)\\s+)?(?:${PACK_RE}\\s+(?:de|of)\\s+)?\\d+(?:[.,]\\d+)?(?:\\s+(?:${PACK_RE}|[a-záéíóúüñ]+))?`, "g"), " ");
  // samples are not part of the order ("y 2 sets de muestra")
  t = t.replace(new RegExp(`\\d+\\s+${PACK_RE}\\s+(?:de\\s+)?(?:muestras?|samples?)\\b`, "g"), " ");
  // a budget is money even without a currency ("presupuesto de 300")
  t = t.replace(/(?:presupuesto|budget)\s+(?:de\s+|of\s+|es\s+de\s+|is\s+)?(?:unos\s+|about\s+)?\d+(?:[.,]\d+)?/g, " ");
  // a mixed set is counted by the item the quantity refers to
  const kit = kitMath(t);
  if (kit) return kit;
  const N = "(\\d+(?:[.,]\\d+)?)";
  const HAS = HAS_WORDS;
  const rules: [RegExp, number, number][] = [
    // [regex, group of the pack word, group of the size]
    [new RegExp(`(?:cada|each|every|un|una|1|per|por)\\s+${PACK_RE}\\s+${HAS}\\s+${N}`), 1, 2],
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
  if (!pack || !(perPack > 1) || perPack > 1e6 || !Number.isInteger(perPack)) return null;
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
      packsGiven = Number(before[1]);
      rest = t.slice(0, at - before[0].length) + " " + t.slice(at + used.length);
    } else rest = t.replace(used, " ");
  }
  // "40 cajas" elsewhere in the message
  const given = rest.match(new RegExp(`${N}\\s+${PACK_RE}\\b`));
  if (!Number.isFinite(packsGiven) && given && packOf(given[2]) === pack) packsGiven = Number(given[1]);
  const rest2 = given && packOf(given[2]) === pack ? rest.replace(given[0], " ") : rest;
  // the number of items wanted, and the word after it
  const nums = [...rest2.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?(?:\s+([a-záéíóúüñ]+))?/g)];
  const w = nums.find((m) => Number(m[1]) > 0 && !/^(?:contenedor(?:es)?|containers?|modelos?|models?|d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years|horas|hours)$/.test(m[2] || ""));
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
  if (Number.isFinite(packsGiven) && packsGiven > 0 && packsGiven <= 1e7) {
    if (Number.isFinite(wanted) && wanted > 0 && wanted <= 1e8)
      return { mode: "check", perPack, packs: packsGiven, wanted, total: packsGiven * perPack, extra: packsGiven * perPack - wanted, pack, item, ...extras };
    return { mode: "total", perPack, packs: packsGiven, wanted: 0, total: packsGiven * perPack, extra: 0, pack, item, ...extras };
  }
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
  // "¿Y si son 50 sets?": a count of packs, checked against the earlier order
  const given = normalizeNumbers(t.toLowerCase()).match(new RegExp(`(\\d+)\\s+${PACK_RE}\\b(?!\\s+(?:de|of|con|with|x)\\s*\\d)`));
  if (given && packOf(given[2]) === prev.pack && !/\d+\s*(?:por|per)\s/.test(t)) {
    const c = packMath(`¿alcanzan ${given[1]} ${prev.pack[2]} de ${prev.perPack}${unitTail} para ${prev.wanted || prev.total} ${items}?`, true);
    if (c) return keepUnit(c);
  }
  // only a new pack size
  const withQty = keepUnit(packMath(`${t} para ${prev.wanted || prev.total} ${items}`, true));
  if (withQty && withQty.pack === prev.pack && withQty.perPack !== prev.perPack) return withQty;
  // only a new quantity
  const n = normalizeNumbers(t.toLowerCase()).match(/(\d+)/);
  if (n && /^\s*(?:¿\s*)?(?:y|e|and|what\s+about|y\s+si|y\s+para|y\s+con|and\s+for|and\s+if)\b/i.test(t)) {
    const q = packMath(`${n[1]} ${prev.item || ""} en ${prev.pack[2]} de ${prev.perPack}${unitTail}`, true);
    if (q) return keepUnit(q);
  }
  return null;
}

/** A mixed-set question with its content, for any quantity ("240 botellas", "50 sets"). */
function kitStatement(m: PackMath, qty: string): string {
  const comp = m.kit!.parts.map((p) => `${p.n} ${p.noun}`).join(" y ");
  return `cuántos ${m.pack[2]} necesito para ${qty.trim()} si cada ${m.pack[1]} trae ${comp}`;
}

/** A complete question for a calculation, so later follow-ups can build on it. */
export function mathStatement(m: PackMath): string {
  if (m.kit)
    return kitStatement(m, m.mode === "packs" ? `${m.wanted} ${m.item}` : m.mode === "total" ? `${m.packs} ${m.pack[2]}` : m.wanted ? String(m.wanted) : "");
  if (m.mode === "ask") return `cuántos ${m.pack[2]} necesito para ${m.wanted} ${m.item}${m.conv?.perWord ? ` de ${m.conv.perWord}` : ""}`;
  // the unit goes with the pack content, so "501 pares en cajas de 20 pares" stays in pairs
  return `cuántos ${m.pack[2]} necesito para ${m.mode === "packs" || m.mode === "check" ? m.wanted : m.total} ${m.item || "piezas"} en ${m.pack[2]} de ${m.perPack}${m.unit ? ` ${m.item}` : ""}`;
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
  if (m.mode === "packs") {
    const p = k.parts[k.target];
    const extra = m.extra > 0 ? Lx(` (${count(p.noun, m.extra)} de más)`, ` (${count(p.noun, m.extra)} extra)`) : "";
    return Lx(
      `Necesitarías ${f(m.packs)} ${pw(m.packs)} para cubrir ${f(m.wanted)} ${pluralOf(m.item)}, suponiendo que cada ${pw(1)} trae ${comp}. En total recibirías ${totals(m.packs)}${extra}.`,
      `You'd need ${f(m.packs)} ${pw(m.packs)} to cover ${f(m.wanted)} ${pluralOf(m.item)}, assuming each ${pw(1)} holds ${comp}. In total you'd receive ${totals(m.packs)}${extra}.`,
    ) + confirm;
  }
  if (m.mode === "total")
    return Lx(
      `${f(m.packs)} ${pw(m.packs)}, si cada ${pw(1)} trae ${comp}, suman ${totals(m.packs)}.`,
      `${f(m.packs)} ${pw(m.packs)}, if each ${pw(1)} holds ${comp}, add up to ${totals(m.packs)}.`,
    ) + confirm;
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

function packMathReply(m: PackMath): string {
  if (m.kit) return kitReply(m);
  const items = m.item || Lx("piezas", "pieces");
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
  const nn = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? one : items}`;
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
      pre += Lx(`${f(c.wanted)} ${c.wantedWord} son ${f(m.wanted)} ${items}${by(c.wantedWord)}. `, `${f(c.wanted)} ${c.wantedWord} are ${f(m.wanted)} ${items}${by(c.wantedWord)}. `);
    if (c.perPack !== m.perPack)
      pre += Lx(`Cada ${pw(1)} de ${f(c.perPack)} ${c.perWord} trae ${f(m.perPack)} ${items}${by(c.perWord)}. `, `Each ${pw(1)} of ${f(c.perPack)} ${c.perWord} holds ${f(m.perPack)} ${items}${by(c.perWord)}. `);
  }
  // the other reading when one side doesn't say its unit
  let post = "";
  const a = m.alt;
  if (a && c && a.kind === "contentPairs")
    post = Lx(
      ` Si en realidad cada ${pw(1)} trae ${f(c.perPack)} ${a.word} (y no ${f(c.perPack)} ${c.perWord} individuales), ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If each ${pw(1)} actually holds ${f(c.perPack)} ${a.word} (not ${f(c.perPack)} single ${c.perWord}), it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  else if (a && c && a.kind === "wantedPairs")
    post = Lx(
      ` Si tus ${f(c.wanted)} ${c.wantedWord} son en realidad ${f(c.wanted)} ${a.word}, ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If your ${f(c.wanted)} ${c.wantedWord} are actually ${f(c.wanted)} ${a.word}, it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  else if (a && a.kind === "contentPieces")
    post = Lx(
      ` Si cada ${pw(1)} trae ${f(m.perPack)} ${a.word || "piezas"} individuales y no ${f(m.perPack)} ${items}, ${a.packs === 1 ? "sería" : "serían"} ${f(a.packs)} ${pw(a.packs)}.`,
      ` If each ${pw(1)} holds ${f(m.perPack)} single ${a.word || "pieces"} rather than ${f(m.perPack)} ${items}, it would be ${f(a.packs)} ${pw(a.packs)}.`,
    );
  const per = Lx(`${f(m.perPack)} ${items} por ${pw(1)}`, `${f(m.perPack)} ${items} per ${pw(1)}`);
  if (m.mode === "total")
    return pre + Lx(
      `${f(m.packs)} ${pw(m.packs)} de ${f(m.perPack)} son ${nn(m.total)}.`,
      `${f(m.packs)} ${pw(m.packs)} of ${f(m.perPack)} make ${nn(m.total)}.`,
    ) + confirm;
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
        )) + confirm;
  }
  if (m.extra === 0)
    return pre + Lx(
      `Necesitarías ${f(m.packs)} ${pw(m.packs)}: exactamente ${nn(m.total)}, suponiendo ${per}.`,
      `You'd need ${f(m.packs)} ${pw(m.packs)}: exactly ${nn(m.total)}, assuming ${per}.`,
    ) + post + confirm;
  const less = m.packs - 1;
  const short = m.wanted - less * m.perPack;
  return pre + Lx(
    `Necesitarías ${f(m.packs)} ${pw(m.packs)}: ${nn(m.total)}, con ${nn(m.extra)} ${m.extra === 1 ? "adicional" : "adicionales"}, suponiendo ${per}.${less > 0 ? ` Con ${f(less)} ${pw(less)} tendrías ${nn(less * m.perPack)} y te ${short === 1 ? "faltaría" : "faltarían"} ${nn(short)}.` : ""}`,
    `You'd need ${f(m.packs)} ${pw(m.packs)}: ${nn(m.total)}, with ${nn(m.extra)} extra, assuming ${per}.${less > 0 ? ` With ${f(less)} ${pw(less)} you'd have ${nn(less * m.perPack)}, ${nn(short)} short.` : ""}`,
  ) + post + confirm;
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

export function replyKinds(text: string): string[] {
  const t = text.toLowerCase();
  const kinds: string[] = [];
  // a calculation is answered, and so is anything else the message asks
  const isMath = !!(packMathAll(text).length || packMath(text));
  if (/certificad|certificaci|certificate|certification|\bce\b|\bfda\b|\biso\b|\bul\b|\brohs\b|\bsgs\b|grado alimenticio|food[- ]grade|apto para alimentos|suitable for food/.test(t)) kinds.push("certificate");
  if (/proveedor|supplier|seller|vendedor|f[aá]brica|factory|confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit/.test(t)) kinds.push("supplier");
  // "Guarantee" goes to customs authorization only when the question is about the import itself
  const customsCtx = /importaci|aduana|autoriz|permiso|aprobad|aprobaci|liberaci|despacho|que pase|customs|import(?!ar\b|ing\b)|authoriz|permit|approv/.test(t);
  const guaranteeWord = /garantiz|garant[ií]a de que|asegur|sin problema|guarantee/.test(t);
  const permitWord = /permiso|autoriz|licencia|permit|authoriz|license/.test(t);
  if ((customsCtx && (!isMath || guaranteeWord || permitWord)) || (guaranteeWord && !kinds.includes("certificate"))) kinds.push("guarantee");
  if (/\bdai\b|arancel|partida|impuesto|\biva\b|tributo|tariff|duty|duties|\btax/.test(t)) kinds.push("dai");
  if (/cu[aá]nto\s+(?:tiempo|tarda|demora)|cu[aá]ntos\s+d[ií]as|cu[aá]ndo\s+(?:llega|llegar[ií]a|estar[ií]a)|when\s+(?:will\s+it\s+)?arrive|tiempo\s+de\s+(?:tr[aá]nsito|env[ií]o|llegada)|tarda\s+en\s+llegar|how\s+long|transit\s+time|lead\s+time/.test(t)) kinds.push("transit");
  else if (isMath ? /precio|costo|cuest[ae]|cotiz|price|cost|quote|how much/.test(t) : /precio|costo|cu[aá]nto|cotiz|price|cost|quote|how much/.test(t)) kinds.push("cost");
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
        Lx(
          `Para calcular con ${size[1] ? `${size[1]} de ${n}` : `${n} por empaque`} necesito la cantidad total: ¿cuántas piezas quieres en total?`,
          `To calculate with ${size[1] ? `${size[1]} of ${n}` : `${n} per pack`} I need the total quantity: how many pieces do you want in total?`,
        ),
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
      k === "certificate" ? certificateReply(q, ctx) : k === "math" ? mathReply(q) : (FIXED[k] ?? FIXED.general)();
    if (i === 0 && !parts.length) t = t.replace(/^Tampoco puedo/, "No puedo").replace(/^I also can't/, "I can't");
    parts.push(t);
  });
  if (r.newProduct && !kinds.length)
    parts.push(Lx("Para orientarte con ese producto, continúa con el formulario.", "To guide you on that product, continue with the form."));
  return parts.join("\n\n");
}
