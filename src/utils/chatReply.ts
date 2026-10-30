// Chat answers: short, honest, and tied to the product the client actually
// named. Without a known product the answer stays general and asks for it.
import { Lx } from "./lang";
import { inferCategory, FOOD_USE, CATEGORY_KEYWORDS } from "./category";
import { wantedText } from "./useMatch";
import { explain, forMath, oddEquivalenceReply, readMoney, moneyLines, type OrderCounts } from "./orderMoney";

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

// ── An explicit product statement, wherever it sits in the message ──────────
// "Cambio definitivo de producto: ahora quiero importar 3 compresores industriales de tornillo,
// trifásicos 220 V, 60 Hz, tanque de 500 litros y libres de aceite. Ya tengo proforma…",
// "no es un molino, es un compresor", "ya no son guantes sino compresores", "the product is now…".
// It wins over any other intent in the same message (a contact request still carries the new
// product) and keeps EVERY characteristic the client wrote (voltage, frequency, capacity,
// material, exclusions…): the description is what the search, the estimate and SEAL use.
const ART = "(?:(?:un|una|unos|unas|el|la|los|las|a|an|the)\\s+)?";
const TRIGGERS: RegExp[] = [
  // "cambio (definitivo) de producto: …", "cambiamos el producto a …", "corrijo el producto: …"
  new RegExp(`\\b(?:cambi\\w*|corrij\\w*|corrig\\w*|actualiz\\w*)\\s+(?:[a-záéíóúüñ]+\\s+){0,2}(?:de\\s+|del\\s+|el\\s+|mi\\s+|nuestro\\s+)?producto\\s*(?:[:,\\-–]\\s*|\\s+(?:a|por|es|son)\\s+)`, "i"),
  /\b(?:el|mi|nuestro)\s+producto\s+(?:ahora\s+|ya\s+|real\s+|correcto\s+|nuevo\s+)?(?:es|son|ser[aá]n?|va\s+a\s+ser)\s+/i,
  /\b(?:the|my|our)\s+product\s+(?:is|will\s+be)\s+(?:now\s+)?/i,
  /\b(?:change|switch)\s+(?:the\s+|my\s+)?product\s+to\s+/i,
];
// the verbs that introduce the product inside a sentence ("ahora quiero importar 3 compresores")
const VERB_INTRO = /\b(?:(?:ahora|mejor|en\s+realidad|realmente|m[aá]s\s+bien|now|actually)\s*,?\s*)?(?:quiero|queremos|quisiera|necesito|necesitamos|voy\s+a|vamos\s+a|deseo|planeo|busco|buscamos|me\s+interesa[n]?|i\s+(?:want|need|plan)\s+to|we\s+(?:want|need)\s+to)\s+(?:importar|comprar|traer|import|buy)\s+/i;
const NOW_INTRO = /\b(?:ahora|mejor|en\s+realidad|realmente|m[aá]s\s+bien)\s*,?\s*(?:es|son|quiero|queremos|necesito|necesitamos|busco|importo|ocupo)\s+|\b(?:now|actually)\s*,?\s*(?:it'?s|they'?re|i\s+want|i\s+need)\s+/i;
// "no es un molino, es un compresor", "ya no son guantes sino compresores", "not gloves, it's a compressor"
const AFTER_NEG = /\b(?:no|ya\s+no|not|no\s+longer)\s+(?:es|son|era|eran|quiero|necesito|importo|busco|is|are)?\s*[^,.;:]{2,60}?(?:\s+sino(?:\s+que)?\s+|\s*[,;:]\s*(?:(?:sino|ahora|ahora\s+bien|que)\s+)?(?:es|son|quiero|necesito|busco|importo|it'?s|they'?re|i\s+want|i\s+need)\s+)(?:importar\s+|comprar\s+)?/i;
const EN_SWAP = /\ben\s+(?:vez|lugar)\s+de\s+(?!\d)[^,.;:]{2,60}[,:]\s*(?:ahora\s+)?(?:(?:es|son|quiero|necesito|importo)\s+(?:importar\s+)?)?|\binstead\s+of\s+(?!\d)[^,.;:]{2,60},\s*/i;
// where the product description ends: a request to SEAL, papers in hand, a question
const DESC_END = /\s*(?:[,;]\s*)?(?:\b(?:y|e|pero|and|but)\s+)?\b(?:ya\s+tengo|ya\s+tenemos|tengo\s+(?:una?\s+|la\s+|mi\s+)?(?:proforma|proveedor|factura|cotizaci)|necesito\s+que|necesitamos\s+que|quiero\s+que|quisiera\s+que|me\s+pueden|nos\s+pueden|pueden\s+(?:ayudar|revisar|cotizar)|podr[ií]an|quiero\s+(?:hablar|contratar|cotizar)|necesito\s+(?:hablar|cotizar|una\s+cotizaci)|me\s+(?:ayudan|cotizan)|para\s+que\s+(?:seal|ustedes|me)|i\s+already|i\s+(?:want|need)\s+to\s+(?:talk|speak|hire)|please|por\s+favor|¿).*$/i;
// what the client says it is not ("…, no molinos", "no son guantes ni molinos")
const NEG_TAIL = /\s*(?:[,;]\s*)?\b(?:y\s+)?(?:no|ni|not)\s+(?:(?:es|son|quiero|necesito|is|are)\s+)?(?:un|una|unos|unas|los|las|el|la|a|an)?\s*[a-záéíóúüñ]+(?:\s+(?:ni|nor|or|o)\s+[a-záéíóúüñ]+)*\s*\.?\s*$/i;
const NEG_ITEMS = /\b(?:no|ni|ya\s+no|not|no\s+longer|nor)\s+(?:(?:es|son|era|eran|quiero|necesito|importo|busco|is|are)\s+)?(?:(?:un|una|unos|unas|el|la|los|las|a|an)\s+)?([a-záéíóúüñ]{4,})/gi;
const QTY_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 };

export interface ProductStatement {
  description: string; // everything the client wrote about the product (specs kept)
  name: string; // a short name to show ("compresores industriales de tornillo")
  quantity?: number; // "3 compresores"
  negated: string[]; // stems of what the client says it is not
}
const stem5 = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?:es|s)$/, "").slice(0, 5);
/** Stems of the products the message rules out ("no son guantes ni molinos" → guant, molin). */
export function negatedProducts(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const out = new Set<string>();
  for (const m of t.matchAll(NEG_ITEMS)) {
    const w = m[1];
    if (/^(?:necesito|quiero|tengo|tiene|puedo|puede|hay|est[aá]|sabe|s[eé]|solo|tambi[eé]n|todav[ií]a|creo|longer|want|need|have|sure|only|para|muchos|mucho)$/.test(w)) continue;
    out.add(stem5(w));
  }
  return [...out];
}
/** A short name for a description: its first noun phrase, before specs and figures. */
export function productName(description: string): string {
  const d = String(description || "").trim();
  const cut = d.split(/,|;|\s+(?=\d)|\s+(?:de|of|con|with|para|for)\s+(?=\d)|\s+(?:que|which|y\s+libres?|y\s+sin)\s+/i)[0].trim();
  const words = cut.split(/\s+/).slice(0, 6);
  while (words.length > 1 && /^(?:de|del|para|con|en|a|y|of|for|with|in|and)$/i.test(words[words.length - 1])) words.pop();
  return words.join(" ") || d.slice(0, 60);
}
function sentencesOf(t: string): string[] {
  // a decimal ("2.5 kg", "US$0.03") is not the end of a sentence
  return t.split(/(?<![\d])[.!?;\n]+(?!\d)|(?<=\d)[.!?;\n]+(?=\s|$)/).map((x) => x.trim()).filter(Boolean);
}
/** The product the message states (with its whole description), or null. */
export function productStatement(text: string): ProductStatement | null {
  const raw = String(text || "").replace(/[¡!]/g, " ").replace(/\s+/g, " ").trim();
  const negated = negatedProducts(raw);
  for (const sentence of sentencesOf(raw)) {
    let rest = "";
    let strong = false;
    for (const re of TRIGGERS) {
      const m = sentence.match(re);
      if (m && m.index !== undefined) { rest = sentence.slice(m.index + m[0].length); strong = true; break; }
    }
    if (!rest) for (const re of [AFTER_NEG, EN_SWAP, VERB_INTRO, NOW_INTRO]) {
      const m = sentence.match(re);
      if (m && m.index !== undefined) { rest = sentence.slice(m.index + m[0].length); strong = re !== NOW_INTRO; break; }
    }
    if (!rest) continue;
    // a trigger right after another ("cambio de producto: ahora quiero importar 3 compresores")
    const inner = rest.match(VERB_INTRO) || rest.match(NOW_INTRO);
    if (inner && inner.index !== undefined && inner.index < 25) rest = rest.slice(inner.index + inner[0].length);
    rest = rest.replace(/^(?:ya\s+no\s+(?:es|son)\s+[^,.;:]+[,;:]\s*)/i, "");
    let desc = rest.replace(DESC_END, "").replace(NEG_TAIL, "").replace(/^\s*(?:es|son)\s+/i, "").trim();
    // a price or a budget is not a characteristic of the product ("…, a US$3 la caja")
    desc = desc
      .replace(/,?\s*(?:(?:a|at|@|por|for|de|of)\s+)?(?:us\$|u\$s|usd|\$|q\.?)\s*\d+(?:[.,]\d+)?(?:\s*(?:usd|d[oó]lares?|dollars?|quetzales?))?(?:\s+(?:la|el|por|cada|per|each|c\/u)(?:\s+[a-záéíóúüñ]+)?)?/gi, "")
      .replace(/,?\s*(?:con\s+)?(?:un\s+)?(?:presupuesto|budget)\b.*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    // the quantity the client wants, said with the product ("3 compresores")
    let quantity: number | undefined;
    const q = desc.match(/^(\d{1,3}(?:[,.]\d{3})+|\d+)\s+(?=[a-záéíóúüñ])/i) || desc.match(/^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|one|two|three|four|five|ten)\s+(?=[a-záéíóúüñ]{3})/i);
    if (q) {
      const n = /^\d/.test(q[1]) ? Number(q[1].replace(/[,.]/g, "")) : QTY_WORDS[q[1].toLowerCase()];
      // "un compresor" is the product, not a quantity of 1 the client asked for
      if (/^\d/.test(q[1]) && n >= 1 && n <= 10_000_000) quantity = n;
      desc = desc.slice(q[0].length);
    }
    // "sillas plásticas…, color blanco, 200 unidades": the quantity at the end is the order's,
    // never part of the description (it would contradict a later quantity change)
    const tailQ = desc.match(/[,;]?\s*(?:(?:cantidad|en\s+total|total|son|quantity)\s*:?\s*)?(\d{1,3}(?:,\d{3})+|\d+)\s+(?:unidades|units|piezas|pieces|pzas?|equipos)\s*[.]?$/i);
    if (tailQ && tailQ.index !== undefined && tailQ.index > 0) {
      const n = Number(tailQ[1].replace(/,/g, ""));
      if (n >= 1 && n <= 10_000_000) {
        if (!quantity) quantity = n;
        desc = desc.slice(0, tailQ.index);
      }
    }
    desc = desc.replace(new RegExp(`^${ART}`, "i"), "").replace(/[\s,.;:]+$/, "").trim();
    if (desc.length < 3 || desc.length > 600 || !/[a-záéíóúüñ]{3}/i.test(desc)) continue;
    if (NOT_A_PRODUCT.test(desc) || QUESTION_WORD.test(desc)) continue;
    const name = productName(desc);
    // what it says it is NOT is never the product
    if (negated.includes(stem5(name.split(/\s+/)[0]))) continue;
    if (!strong && inferCategory(desc) === "other" && desc.split(/\s+/).length < 2) continue;
    return { description: desc, name, ...(quantity ? { quantity } : {}), negated };
  }
  return null;
}
/** The product the message explicitly changes to (its whole description), or null. */
export function productChange(text: string): string | null {
  return productStatement(text)?.description ?? null;
}

// ── A correction of ONE characteristic: "corrijo: es 440 V, no 220 V" ──────────
// The rest of the description is kept as it was.
const MEASURE = "(\\d+(?:[.,]\\d+)?)\\s*(v|vac|vdc|voltios|volts?|hz|hertz|l|lt|lts|litros?|liters?|litres?|kg|kgs|kilos?|g|gr|gramos?|kw|hp|ml|cm|mm|m|metros?|pulgadas?|in|w|watts?|psi|bar|cfm|rpm|t|ton|toneladas?|gal|galones?)\\b(?![a-záéíóúüñ])";
const UNIT_KEY = (u: string) => {
  const x = u.toLowerCase();
  if (/^(?:v|vac|vdc|voltios|volts?)$/.test(x)) return "v";
  if (/^(?:hz|hertz)$/.test(x)) return "hz";
  if (/^(?:l|lt|lts|litros?|liters?|litres?)$/.test(x)) return "l";
  if (/^(?:kg|kgs|kilos?)$/.test(x)) return "kg";
  if (/^(?:g|gr|gramos?)$/.test(x)) return "g";
  if (/^(?:m|metros?)$/.test(x)) return "m";
  if (/^(?:pulgadas?|in)$/.test(x)) return "in";
  if (/^(?:w|watts?)$/.test(x)) return "w";
  if (/^(?:t|ton|toneladas?)$/.test(x)) return "t";
  if (/^(?:gal|galones?)$/.test(x)) return "gal";
  return x;
};
const PHASES = ["monofásic", "bifásic", "trifásic", "monofasic", "bifasic", "trifasic"];
export interface AttributeFix { from: string; to: string; description: string }
/** A one-characteristic correction applied to the current description, or null. */
export function attributeCorrection(text: string, current: string): AttributeFix | null {
  let t = String(text || "");
  const cur = String(current || "");
  if (!cur) return null;
  const cue = /\b(?:corrij\w*|correcci[oó]n|corrig\w*|en\s+realidad|realmente|perd[oó]n|me\s+equivoqu[eé]|mejor|no\s+es\s+de|no\s+son\s+de|en\s+(?:vez|lugar)\s+de|cambi\w*|actualiz\w*|modific\w*|ajust\w*|el\s+voltaje|la\s+tensi[oó]n|la\s+frecuencia|la\s+capacidad|el\s+tanque|la\s+potencia|ya\s+no|ahora|nuev[oa]|pero\s+con|con\s+tanque|que\s+sean?|son|sean|mant[eé]n\w*|quiero|necesito|que\s+tenga|voltaje|tensi[oó]n|frecuencia|tanque|capacidad|fase|actually|correction|instead\s+of|voltage|frequency|capacity|tank|now)\b/i.test(t);
  if (!cue) return null;
  // "el voltaje a 440", "la capacidad del tanque a 300": the unit is the one that field has
  const unitIn = (key: string) => [...cur.matchAll(new RegExp(MEASURE, "gi"))].find((m) => UNIT_KEY(m[2]) === key)?.[2];
  const FIELD: [RegExp, string][] = [
    [/\b(?:voltaje|tensi[oó]n|voltage)/i, "v"],
    [/\b(?:frecuencia|frequency)/i, "hz"],
    [/\b(?:capacidad(?:\s+del\s+tanque)?|tanque|tank(?:\s+capacity)?|capacity)/i, "l"],
    [/\b(?:potencia|power)/i, "hp"],
  ];
  for (const [re, key] of FIELD) {
    const unit = key === "hp" ? unitIn("hp") || unitIn("kw") : unitIn(key);
    if (!unit) continue;
    const noUnit = "(?!\\d|[.,]\\d|\\s*(?:v|vac|vdc|volts?|voltios|hz|hertz|l|lt|lts|litros?|liters?|litres?|kw|hp|w|watts?|gal|galones?)\\b)";
    t = t.replace(new RegExp(`(${re.source}[^.;\\d]{0,25}?\\b(?:a|de|es|en|sea|to|is|:)\\s*)(\\d+(?:[.,]\\d+)?)${noUnit}`, "gi"), (_, pre, n) => `${pre}${n} ${unit}`);
    // "el voltaje de 220 a 440": the new value has that unit too
    t = t.replace(new RegExp(`(\\d+(?:[.,]\\d+)?\\s*${unit}\\s+(?:a|to)\\s+)(\\d+(?:[.,]\\d+)?)${noUnit}`, "gi"), (_, pre, n) => `${pre}${n} ${unit}`);
  }
  const all = [...t.matchAll(new RegExp(MEASURE, "gi"))].map((m) => ({ txt: m[0], n: m[1], u: UNIT_KEY(m[2]), at: m.index ?? 0 }));
  // the old value is the one after "no", "en vez de", "en lugar de", "instead of", "de X a"
  const isOld = (at: number, len: number) =>
    /(?:\bno(?:\s+(?:es|son|de|era|quiero|necesito|lleva|tiene|va))?|en\s+(?:vez|lugar)\s+de|instead\s+of|not|antes|y\s+no)\s*(?:de\s+)?$/i.test(t.slice(Math.max(0, at - 20), at)) ||
    /^\s*(?:a|to)\s+\d/i.test(t.slice(at + len)) && /\b(?:de|from)\s*$/i.test(t.slice(Math.max(0, at - 6), at));
  const fresh = all.filter((x) => !isOld(x.at, x.txt.length));
  const old = all.filter((x) => isOld(x.at, x.txt.length));
  let description = cur;
  const from: string[] = [];
  const to: string[] = [];
  const done = new Set<string>();
  for (const f of fresh) {
    if (done.has(f.u)) continue;
    const o = old.find((x) => x.u === f.u);
    const present = [...description.matchAll(new RegExp(MEASURE, "gi"))].filter((m) => UNIT_KEY(m[2]) === f.u);
    // replace the value of that unit the description already has (the old one, if named)
    const target = present.find((m) => !o || m[1].replace(",", ".") === o.n.replace(",", ".")) || (present.length === 1 ? present[0] : undefined);
    if (!target) continue;
    done.add(f.u);
    if (target[1].replace(",", ".") === f.n.replace(",", ".")) continue;
    description = description.slice(0, target.index) + f.txt.trim() + description.slice((target.index ?? 0) + target[0].length);
    from.push(target[0]);
    to.push(f.txt.trim());
  }
  // phase: "es monofásico, no trifásico"
  const low = t.toLowerCase();
  const said = PHASES.find((p) => new RegExp(`(?<!no\\s)\\b${p}`, "i").test(low) && !new RegExp(`(?:\\bno|en\\s+vez\\s+de)\\s+(?:es\\s+)?${p}`, "i").test(low));
  if (said) {
    const curPhase = PHASES.find((p) => description.toLowerCase().includes(p));
    if (curPhase && curPhase.slice(0, 4) !== said.slice(0, 4)) {
      const re = new RegExp(`${curPhase}\\w*`, "i");
      const m = description.match(re)!;
      const ph = said + (m[0].slice(curPhase.length) || "o");
      from.push(m[0]);
      to.push(ph);
      description = description.replace(re, ph);
    }
  }
  if (!from.length) return null;
  return { from: from.join(", "), to: to.join(", "), description };
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
  // a price is never part of the name ("guantes a US$0.03 cada uno" → "guantes")
  const words = tail.replace(/\s+(?:a|at|@|por|for|en)\s+(?:us\$|usd|\$|q\.?\s?\d|\d).*$|\s+(?:us\$|usd|\$)\s?\d.*$/i, "").trim().split(/\s+/).slice(0, 6);
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
  [/^(?:pacas?|bales?)$/, "paca", "pacas", "bale", "bales"],
  [/^(?:bultos?|fardos?|bundles?)$/, "bulto", "bultos", "bundle", "bundles"],
  [/^(?:bandejas?|charolas?|trays?)$/, "bandeja", "bandejas", "tray", "trays"],
  [/^(?:tarimas?|pallets?)$/, "tarima", "tarimas", "pallet", "pallets"],
  [/^(?:displays?|exhibidor(?:es)?)$/, "display", "displays", "display", "displays"],
  [/^(?:master(?:es|s)?|m[aá]sters?)$/, "master", "masters", "master", "masters"],
  [/^(?:inners?)$/, "inner", "inners", "inner", "inners"],
];
const PACK_WORDS = "sets?|juegos?|cajas?|boxes|box|paquetes?|packs?|estuches?|cases?|bolsas?|bags?|kits?|docenas?|dozens?|pares|par|pairs?|cartones|cart[oó]n|cartons?|rollos?|rolls?|pacas?|bales?|bultos?|fardos?|bundles?|bandejas?|charolas?|trays?|tarimas?|pallets?|displays?|exhibidor(?:es)?|master(?:es|s)?|m[aá]sters?|inners?";
const PACK_RE = `(${PACK_WORDS})`;
const packOf = (w: string) => PACKS.find(([r]) => r.test(w));
// a pack or a container sold by weight/volume ("sacos", "botellas")
const anyPackOf = (w: string) => packOf(w) || CONTAINERS.find(([r]) => r.test(w));
// words that are not the counted item ("1,000 necesito", "500 para")
const NOT_ITEM = /^(?:necesito|necesitas|necesita|quiero|quieres|compro|comprar|pido|pedir|son|hay|para|por|en|de|del|y|o|con|sin|que|cu[aá]nt[oa]s?|cada|total|unidades?|units?|i|need|want|buy|for|in|of|and|or|with|each|are|is|how|many|do|me|mi|mis|el|la|los|las|un|una|unos|unas|the|a|an|individual(?:es)?|sueltos?|sueltas?|single|loose|si|if|cuesta|cuestan|cost|costs|at|per|cover|covers|cubren|cubre|alcanzan|alcanza|aprox|como|about|around|unas|ocupo|necesitamos|requiero|vienen|viene|traen|trae|come|comes|holds|have|has|pls|please|plis|porfa|xfa|gracias|thanks|thx)$/;
const VERB_Q = /cu[aá]nt|how\s+many|how\s+much|necesit|alcanz|cubr|sobr|falt|calcul|enough|cover|need|left\s+over|spare|extra|compute|\bocup|requier|\btotal\b|\bquiero\b|\bwant\b/;

// ── How importers really write: one canonical form before any calculation ─────
// Every calculation path reads the text through normalizeNumbers, so this is the
// single place where "24 x caja", "doc.", "10k", "quinientas", "1/2", a phone
// number or "contenedor de 40'" are made unambiguous.
const NUM_ES: Record<string, number> = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, trece: 13, catorce: 14, quince: 15,
  "dieciséis": 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, "veintidós": 22,
  veintitres: 23, "veintitrés": 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, "veintiséis": 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500,
  quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const UNIT_ES: Record<string, number> = { uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const NUM_TOKEN = `(?:${[...Object.keys(NUM_ES), "cien", "ciento", "mil", "mill[oó]n", "millones", "hundred", "thousand", "million", "millions"].sort((a, b) => b.length - a.length).join("|")})`;
const NUM_SEQ = new RegExp(`(?<![a-záéíóúüñ\\d])(?:(?:un|una|a)\\s+)?${NUM_TOKEN}(?:(?:\\s+(?:y|and)\\s+|[\\s-]+)(?:${NUM_TOKEN}|${Object.keys(UNIT_ES).join("|")}))*(?![a-záéíóúüñ])`, "g");
function wordsToNumber(seq: string): number | null {
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const w of seq.split(/[\s-]+/)) {
    if (w === "y" || w === "and") continue;
    // "un millón", "a hundred": the article only matters before a multiplier (handled there with
    // `cur || 1`); it never adds 1 to a following number ("a siete" is 7, not 8)
    if (w === "un" || w === "una" || w === "a") continue;
    if (w === "cien" || w === "ciento") { cur += 100; seen = true; continue; }
    if (w === "hundred") { cur = (cur || 1) * 100; seen = true; continue; }
    if (w === "mil" || w === "thousand") { total += (cur || 1) * 1000; cur = 0; seen = true; continue; }
    if (/^(?:mill[oó]n|millones|millions?)$/.test(w)) { total += (cur || 1) * 1e6; cur = 0; seen = true; continue; }
    const v = NUM_ES[w] ?? UNIT_ES[w];
    if (v === undefined) return null;
    cur += v;
    seen = true;
  }
  return seen ? total + cur : null;
}
const PACK_LOOSE = "(cajas?|boxes|box|cases?|paquetes?|packs?|bolsas?|bags?|sets?|kits?|pacas?|bultos?|fardos?|bandejas?|trays?|rollos?|rolls?|docenas?|dozens?|cartones|cart[oó]n|cartons?|tarimas?|pallets?|estuches?|juegos?)";
export function tidy(raw: string): string {
  let t = ` ${raw.toLowerCase()} `;
  t = t
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    // phone numbers and contact data are never quantities
    .replace(/(?:tel[eé]fono|tel\.?|cel(?:ular)?|whats(?:app)?|wa|llamar\s+al|ll[aá]mame\s+al|call\s+me\s+at|phone|n[uú]mero)\s*(?:es\s+|is\s+|:\s*)?\+?[\d][\d\s-]{6,}\d/g, " ")
    .replace(/\+?\b(?:502\s*)?\d{4}-\d{4}\b/g, " ")
    // models, years and container sizes
    .replace(/\b(modelo|model|a[nñ]o|year|versi[oó]n|version|del|of|desde|since)\s+(?:19|20)\d{2}\b/g, "$1 ")
    .replace(/\b(contenedor(?:es)?|containers?)\s+(?:de\s+|of\s+)?\d+\s*(?:'|’|"|pies|ft|feet|foot)?(?:\s*(?:hc|hq|high\s*cube|dry|st|reefer))?/g, "$1 ")
    .replace(/\b\d+\s*(?:'|’)(?:\s*(?:hc|hq|high\s*cube|dry|st|reefer))?/g, " ")
    .replace(/\b\d+\s*(?:pies|ft|feet)\s+(?:hc|hq|high\s*cube|dry|reefer|contenedor|container)/g, " ")
    // percentages (a deposit, a discount) are not counts
    .replace(/[-−]?\d+(?:[.,]\d+)?\s*(?:%|por\s*ciento|percent)/g, " ")
    // abbreviations
    .replace(/\bc\/u\b/g, " ")
    .replace(/\bmaster\s+(?:cartons?|boxes|box|cases?)\b/g, "masters")
    // "caja master" is the box itself, unless the message also talks about inner packs
    .replace(/\b(cajas?)\s+master(?:es|s)?\b/g, (_, c) => (/\binners?\b/.test(raw.toLowerCase()) ? "masters" : c))
    .replace(/(\d)\s*(?:doc\.?|dz\.?|doz\.?)(?=[\s,.;:)?!]|$)/g, "$1 docenas")
    .replace(/\b(?:doc\.?|dz\.?|doz\.?)(?=\s+(?:de\s+)?[a-záéíóúüñ])/g, "docenas")
    .replace(/(\d)\s*(?:pzas?|pzs|pz)\.?(?=[\s,.;:/)?!x]|$)/g, "$1 piezas")
    .replace(/(?<![a-záéíóúüñ])(?:pzas?|pzs|pz)\.?(?=[\s,.;:/)?!x]|$)/g, "piezas")
    .replace(/(\d)\s*(?:unds?|uds?|unid)\.?(?=[\s,.;:/)?!x]|$)/g, "$1 unidades")
    .replace(/(?<![a-záéíóúüñ])(?:unds?|uds?|unid)\.?(?=[\s,.;:/)?!x]|$)/g, "unidades")
    .replace(/m²|\bm2\b|metros?\s+cuadrados?|square\s+met(?:er|re)s?|sq\.?\s*m\b/g, "m²")
    .replace(/m³|\bm3\b|metros?\s+c[uú]bicos?|cubic\s+met(?:er|re)s?|cbm\b/g, "m³");
  // multipliers: "10k", "1.5 millones", "1e6"
  t = t
    .replace(/(\d+(?:[.,]\d+)?)\s*k\b/g, (_, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000)))
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mill[oó]n(?:es)?|millions?)(?:\s+de\b|\s+of\b)?/g, (_, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1e6)))
    .replace(/\b(\d+(?:\.\d+)?)e(\d{1,2})\b/g, (m, a, b) => {
      const v = parseFloat(a) * 10 ** Number(b);
      return Number.isInteger(v) && v <= 1e9 ? String(v) : m;
    })
    // numbers written as words ("dos mil quinientas", "una docena", "media docena")
    .replace(/\bmedia\s+docena\b/g, "0.5 docenas")
    .replace(/\bhalf\s+(?:a\s+)?dozen\b/g, "0.5 dozen")
    .replace(/\b(?:una|un|a)\s+(docena|dozen|caja|box|paquete|pack|set|kit|bolsa|bag)\b/g, "1 $1")
    .replace(/\bten\s+(?=thousand|hundred|million)/g, "10 ")
    .replace(NUM_SEQ, (m, off: number, str: string) => {
      // "2 mil" is read further on as 2000
      if (/^\s*(?:mil|thousand|mill[oó]n|millones|millions?|hundred)\b/.test(m) && /\d\s*$/.test(str.slice(0, off))) return m;
      const v = wordsToNumber(m.trim());
      return v && v >= 2 ? ` ${v} ` : m;
    })
    // fractions ("1/2 caja"), not dates (15/11/2026)
    .replace(/(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])(?=\s+(?:de\s+)?[a-záéíóúüñ])/g, (m, a, b) => (Number(b) > 0 && Number(a) < Number(b) ? String(Number(a) / Number(b)) : m));
  // the content of each pack, however it is written: "24 x caja", "24/caja",
  // "25 pzas/caja", "x caja vienen 25", "a box holds 24", "24 per box"
  t = t
    .replace(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*([a-záéíóúüñ]+\\s*)?(?:x|/)\\s*${PACK_LOOSE}\\b`, "g"), (_, n, w, pk) => `${n} ${w ? w.trim() + " " : ""}por ${pk}`)
    .replace(new RegExp(`(?:^|\\s)(?:x|por|per)\\s+${PACK_LOOSE}\\s+(?:vienen|viene|van|trae|traen|hay|son|caben|come|comes|are|has|holds)\\s+(\\d+)`, "g"), (_, pk, n) => ` cada ${pk} trae ${n}`)
    // "cada caja 10 sets", "cada caja: 10 sets", "cada caja con 10 sets", "each box 10 sets": the verb is implied
    .replace(new RegExp(`\\bcada\\s+${PACK_LOOSE}\\s*(?:con\\s+|:\\s*|=\\s*)?(\\d+(?:[.,]\\d+)?)\\s+(?=[a-záéíóúüñ])`, "g"), (_, pk, n) => `cada ${pk} trae ${n} `)
    .replace(new RegExp(`\\beach\\s+${PACK_LOOSE}\\s*(?:with\\s+|:\\s*|=\\s*)?(\\d+(?:[.,]\\d+)?)\\s+(?=[a-z])`, "g"), (_, pk, n) => `each ${pk} has ${n} `)
    .replace(/\b(\d+)-packs?\b/g, "packs of $1")
    // "kg bags", "750 ml bottles", "30 m rolls" (English order)
    .replace(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|lb|lbs|l|lt|ml|m|cm|mm|gal|oz|m²|m³)\s+(bags?|bottles?|sacks?|rolls?|boxes|box|cans?|jars?|drums?|buckets?|pails?|jugs?|cases?|packs?)\b/g, "$3 of $1 $2")
    // "una docena de cajas" = 12 cajas
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s+(?:docenas?|dozens?)\\s+(?:de\\s+|of\\s+)?${PACK_LOOSE}\\b`, "g"), (m, n, pk) => (/^doc|^doz/.test(pk) ? m : `${Number(n) * 12} ${pk}`))
    .replace(/\s=\s*(?:\?|$)/g, " total? ")
    .replace(new RegExp(`${PACK_LOOSE}\\s+(?:de|of|con|with)\\s+(\\d+(?:\\.\\d+)?)\\s+(?:docenas?|dozens?)\\b(?!\\s+(?:de\\s+|of\\s+)?(?:pares|pairs))`, "g"), (m, pk, n) => (/^doc|^doz/.test(pk) ? m : `${pk} de ${Math.round(Number(n) * 12 * 1000) / 1000} piezas`))
    .replace(/\s\/\s/g, ", ")
    .replace(/\s+/g, " ");
  // "si vienen de 36", "come in 30s": the content of the pack the client asks about
  const asked = t.match(new RegExp(`(?:cu[aá]nt[oa]s|how\\s+many)\\s+${PACK_LOOSE}\\b`)) || t.match(new RegExp(`\\b${PACK_LOOSE}\\b`));
  if (asked && !/^(?:docenas?|dozens?|pares|pairs?)$/.test(asked[1]))
    t = t.replace(
      new RegExp(`\\b(vienen|viene|come|comes|(?:las|los|lo|la|them|it)\\s+(?:vende|venden|sells?|ofrece|ofrecen|offers?|maneja|manejan))\\s+(?:de|en|in|of)\\s+(\\d+)s?\\b(?!\\s*(?:${PACK_LOOSE}|en\\s|in\\s))`, "g"),
      (_, v, n) => `${v} en ${asked[1]} de ${n}`,
    );
  return t.trim();
}

function normalizeNumbers(t: string): string {
  return tidy(t)
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
  kit?: { parts: { n: number; noun: string }[]; target: number; also?: { i: number; W: number }[] };
  zero?: boolean; // the client wrote a pack content of 0
  zeroOrder?: boolean;
  perWord?: string; // the measure of each pack, for "measureCount"
  // packs inside a bigger pack ("6 cajas por master"): how many of the big ones
  outer?: { pack: PackMath["pack"]; per: number; count: number; whole?: boolean };
  // the order in the pack that is actually sold, when it holds other packs: "cada caja
  // trae 10 sets de 12 lápices" → boxes of 120; `loose` is the reading with loose sets
  chain?: { inner: PackMath["pack"]; k: number; innerPer: number; loose?: { packs: number; total: number } };
  // what the supplier has in stock ("solo tiene 12 disponibles"), in packs
  stock?: { packs: number; word: string; n: number };
  nested?: boolean; // packs inside packs ("pacas de 20 bolsas"): one calculation
  // "menos de 500" / "máximo 500": the most whole packs that stay within the limit
  atMost?: { limit: number; strict: boolean; packs: number; minP?: number; lotP?: number };
  // "600 piezas… menos de 800 en total": a ceiling on what is received, next to the need
  capTotal?: { limit: number; strict: boolean }; // the client wrote 0 packs ("0 cajas de 12"): the result is 0, and it is not an order
  // a weight or measure counted in packs of that measure ("2.5 kg en bolsas de 1 kg")
  measure?: { from?: string };
  // the purchase conditions applied: minimum order and multiples, in packs
  cond?: { need: number; minPacks: number; lotPacks: number; mins: Cond[]; lots: Cond[]; unreadable: Cond[]; changed: boolean };
  // conditions read but not applied (the calculation still needs data)
  conds?: { mins: Cond[]; lots: Cond[] };
  // data that can't be calculated as written: ask instead of guessing
  invalid?: "conflictCond" | "badCond" | "negative" | "correction" | "twoQty" | "minChoice" | "measureCount" | "tooBig" | "whichPack" | "decimalPacks" | "decimalQty" | "decimalContent" | "zeroQty" | "conflictSize" | "range" | "measure";
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
      if (word && !PIECE_W.test(word) && (CONNECT.test(word) || NOT_ITEM.test(word))) word = "";
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
  if (!c.word || anyPackOf(c.word) === m.pack) return c.n;
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

// ── Stock ────────────────────────────────────────────────────────────────────
const STOCK_RES = [
  new RegExp(`(?:(?:solo|s[oó]lamente|only)\\s+)?(?:(?:tiene|tienen|hay|has|have|there\\s+are|cuenta\\s+con|cuentan\\s+con)\\s+)?(?:(?:solo|s[oó]lamente|only)\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:(${W})\\s+)?(?:disponibles?|en\\s+(?:stock|existencias?|inventario|bodega)|in\\s+stock|available|de\\s+existencias?)`),
  new RegExp(`(?:stock|existencias?|inventario|disponibilidad|disponibles?|available|quedan|le\\s+quedan|les\\s+quedan|solo\\s+(?:le\\s+|les\\s+)?quedan|only\\s+has|only\\s+have|has\\s+only|have\\s+only|tiene\\s+solo|tienen\\s+solo|solo\\s+tiene|solo\\s+tienen)\\s*(?:de|:|es\\s+de|is|of)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(${W})?(?!\\s+(?:por|per|en\\s+cada)\\b)`),
];
export interface StockHit { text: string; n: number; word: string }
/** The supplier's stock written in the message, or null. */
function findStock(t: string): StockHit | null {
  for (const re of STOCK_RES) {
    const sm = t.match(re);
    // "cada caja tiene 20" is a content; "solo tiene 12 disponibles" is stock
    if (sm && !/(?:cada|each|every|por|per)\s+[a-záéíóúüñ]+\s+(?:solo\s+)?$/.test(t.slice(0, sm.index))) {
      const word = sm[2] && !CONNECT.test(sm[2]) && !/^(?:disponibles?|available)$/.test(sm[2]) ? sm[2] : "";
      return { text: sm[0], n: Number(sm[1].replace(",", ".")), word };
    }
  }
  return null;
}
/** The stock counted in the packs the order is made of (NaN when it can't be compared). */
function stockPacks(m: PackMath, st: StockHit): number {
  const n = st.n;
  const w = st.word;
  const whole = (x: number) => Math.floor(x + 1e-9);
  if (!w) return whole(n);
  const wp = anyPackOf(w);
  if (wp === m.pack) return whole(n);
  if (m.chain && wp === m.chain.inner) return whole(n / m.chain.k);
  if (m.outer && wp === m.outer.pack) return whole(n) * m.outer.per;
  if (m.kit) {
    const i = m.kit.parts.findIndex((p) => stemOf(p.noun) === stemOf(w));
    return i >= 0 ? whole(n / m.kit.parts[i].n) : NaN;
  }
  if (m.measure) {
    const a = measureOf(w);
    const b = measureOf(m.item);
    return a && b && a[0] === b[0] ? whole((n * a[1]) / b[1] / m.perPack) : NaN;
  }
  if (wp && !/^(?:par|docena)$/.test(wp[1])) return NaN; // another pack
  // counted in pieces, pairs or dozens: compare in pieces
  const per = (u: string) => (PAIR_W.test(u) ? 2 : DOZ_W.test(u) ? 12 : 1);
  const stockPieces = n * per(w);
  const packPieces = m.perPack * (m.unit === "pair" ? 2 : m.unit === "dozen" ? 12 : 1);
  return whole(stockPieces / packPieces);
}
function withStock(m: PackMath, st: StockHit): PackMath {
  if (m.invalid || m.mode === "ask" || m.zeroOrder || m.mode === "total") return m;
  return { ...m, stock: { packs: stockPacks(m, st), word: st.word, n: st.n } };
}

/** Reads a pack calculation in any wording, or null when the message isn't one. */
export function packMath(text: string, force = false): PackMath | null {
  text = forMath(text);
  let t0 = normalizeNumbers(String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ").replace(/\s+/g, " "));
  // "5 cajas, cada caja con 10 sets…": an order of packs stated up front counts as the question
  if (!force && !VERB_Q.test(` ${t0} `) && !new RegExp(`^\\s*\\d+\\s+${PACK_RE}\\b[^\\d]*\\b(?:cada|each)\\s+${PACK_RE}`).test(t0)) return null;
  // a negative quantity, content or condition ("-200 pares") can't be calculated
  if (/(?:^|[\s(:=,])[-−]\d/.test(t0) && new RegExp(`\\b${PACK_RE}\\b|pares|piezas|unidades|pieces|units`).test(t0))
    return { mode: "ask", perPack: 0, packs: 0, wanted: 0, total: 0, extra: 0, pack: PACKS[1], item: "", invalid: "negative" };
  // what the supplier has ("solo tiene 12 disponibles", "only 12 boxes in stock") is a
  // limit, never a quantity: the order is solved without it and then checked against it
  const st = findStock(t0);
  if (st) {
    const base = packMath(t0.replace(st.text, " "), true);
    return base ? withStock(base, st) : null;
  }
  // "500 unidades, 24 por caja, 6 cajas por master", "pacas de 20 bolsas": the order in the
  // inner packs first, then how many outer packs hold them
  const nestRe: [RegExp, (m: RegExpMatchArray) => [number, string, string]][] = [
    [new RegExp(`(\\d+)\\s+${PACK_RE}\\s+(?:por|per|en\\s+cada|in\\s+each|in\\s+a|x|/)\\s+${PACK_RE}\\b`), (m) => [Number(m[1]), m[2], m[3]]],
    // "cada caja trae 10 sets", "each box holds 10 packs"
    [new RegExp(`(?:cada|each|every|la|el|una?|1|the|a)\\s+${PACK_RE}\\s+(?:${HAS_WORDS}|vienen|viene|hay|caben|lleva|llevan|are|is)\\s+(\\d+)\\s+${PACK_RE}\\b`), (m) => [Number(m[2]), m[3], m[1]]],
    [new RegExp(`${PACK_RE}\\s+(?:de|of|con|with)\\s+(\\d+)\\s+${PACK_RE}\\b`), (m) => [Number(m[2]), m[3], m[1]]],
    // "los sets vienen en cajas de 10"
    [new RegExp(`${PACK_RE}\\s+(?:vienen|viene|come|comes|van|se\\s+venden)\\s+(?:en|in)\\s+${PACK_RE}\\s+(?:de|of)\\s+(\\d+)\\b`), (m) => [Number(m[3]), m[1], m[2]]],
  ];
  // "solo venden cajas completas", "only full boxes": the loose reading is not offered
  const onlyWhole = /\b(?:solo|s[oó]lamente|only)\s+(?:se\s+)?(?:venden?|sell|sells|sold)?\s*(?:por\s+|in\s+|by\s+(?:the\s+)?)?(?:\w+\s+)?(?:complet[oa]s|enter[oa]s|cerrad[oa]s|full|whole|complete)|no\s+(?:se\s+)?venden?\s+(?:\w+\s+)?suelt|(?:cajas?|boxes)\s+cerradas?/.test(t0);
  // every pair of packs written is tried ("cada caja trae 12 pares y cada master trae 4 cajas":
  // the pairs are a unit, the boxes inside the masters are the nesting)
  for (const [re, pick] of nestRe) {
    for (const nm of t0.matchAll(new RegExp(re.source, "g"))) {
      const [k, inW, outW] = pick(nm);
      const inP = packOf(inW);
      const outP = packOf(outW);
      if (!inP || !outP || inP === outP || /^(?:par|docena)$/.test(inP[1]) || /^(?:par|docena)$/.test(outP[1]) || !(k >= 1) || !Number.isInteger(k)) continue;
      // the order written in the outer packs ("quiero 5 cajas", "5 cajas, cada caja con 10 sets y
      // cada set con 12 piezas"): it's a count of outer packs, never 5 pieces
      const rest = ` ${t0.replace(nm[0], " ")} `;
      const ords = [...rest.matchAll(new RegExp(`(?:^|[^\\d.,x×])(\\d+)\\s+${PACK_RE}\\b(?!\\s+(?:${HAS_WORDS}|de|of|con|with)\\s+\\d)`, "g"))].filter((x) => packOf(x[2]) === outP);
      // "necesito 3 cajas de 10 sets de 12": the count written just before the nesting
      const lead = nm[0].startsWith(outW) ? /(?:^|[^\d.,x×])(\d+)\s+$/.exec(t0.slice(0, nm.index)) : null;
      const ordN = [...new Set([...ords.map((x) => Number(x[1])), ...(lead ? [Number(lead[1])] : [])])];
      if (ordN.length === 1 && ordN[0] > 0 && Number.isInteger(ordN[0])) {
        // the content may sit right after the nesting ("cada caja tiene 10 sets de 12")
        let rest2 = ` ${t0} `;
        for (const x of ords) rest2 = rest2.replace(x[0], " ");
        if (lead) rest2 = rest2.replace(new RegExp(`${lead[1]}\\s+(?=${outW})`), " ");
        // a lookahead, so "caja tiene 10 sets de 12" still finds "sets de 12"
        const cont = [...rest2.matchAll(new RegExp(`\\b(?=${PACK_RE}\\s+(?:${HAS_WORDS}|de|of|con|with|:|=)\\s+(\\d+)(?:\\s+([a-záéíóúñ]+))?)`, "g"))].find((x) => packOf(x[1]) === inP);
        // "quiero 5 cajas de 10 sets" with no content per set: 50 sets, never 50 pieces
        if (!cont && (t0.match(/\d+(?:[.,]\d+)?/g) || []).map(Number).every((n) => n === k || n === ordN[0]) && !new RegExp(`${MIN_KEY}|m[uú]ltiplo|multiple|lote|stock|disponible|available`).test(t0))
          return { mode: "total", perPack: k, packs: ordN[0], wanted: 0, total: ordN[0] * k, extra: 0, pack: outP, item: Lx(inP[2], inP[4]) };
        if (cont) {
          const ip = Number(cont[2]);
          const w = cont[3] || "";
          const item = w && (PAIR_W.test(w) || DOZ_W.test(w) || (!packOf(w) && !CONNECT.test(w) && !NOT_ITEM.test(w))) ? w : Lx("piezas", "pieces");
          // only the plain case: any other figure (a minimum, a stock, an order in items) goes the long way
          const nums = (t0.match(/\d+(?:[.,]\d+)?/g) || []).map(Number);
          const plain = nums.every((n) => n === k || n === ip || n === ordN[0]) && !new RegExp(`${MIN_KEY}|m[uú]ltiplo|multiple|lote|stock|disponible|available|solo\\s+tiene`).test(t0);
          if (plain && ip >= 1 && Number.isInteger(ip) && !/[-−]/.test(rest2)) {
            const per = k * ip;
            return { mode: "total", perPack: per, packs: ordN[0], wanted: 0, total: ordN[0] * per, extra: 0, pack: outP, item, chain: { inner: inP, k, innerPer: ip } };
          }
        }
      }
      const inner = packMath(t0.replace(nm[0], /^\d/.test(nm[0]) ? " " : ` ${inW} `), true);
      if (!inner || inner.pack !== inP) continue;
      // the inner order can't be calculated ("50 kg" against boxes counted in pieces): say so
      if (inner.invalid || (inner.mode === "ask" && !inner.kit)) return inner;
      if (inner.mode === "ask" || !(inner.packs > 0)) continue;
      // an order counted in items or pairs: solved in the pack that is sold (box of 10 sets × 12)
      if (inner.mode === "packs" && !inner.measure && !inner.conv && !inner.kit) {
        const item = inner.unit ? inner.item : inner.item || Lx("piezas", "pieces");
        const per = k * inner.perPack;
        // a minimum or a multiple written in the inner packs ("mínimo 60 sets") counts in outer packs
        const c = condsOf(inner);
        const conv = (x: Cond, kind: "min" | "lot"): Cond => {
          if (!x.word || packOf(x.word) !== inP) return x;
          const n = kind === "min" ? Math.ceil(x.n / k) : x.n / gcd(x.n, k);
          return { n, word: outP[2], text: "" };
        };
        const tail = [
          ...c.mins.map((x) => conv(x, "min")).map((x) => `. pedido mínimo de ${x.n} ${x.word || outP[2]}`),
          ...c.lots.map((x) => conv(x, "lot")).map((x) => `. solo en múltiplos de ${x.n} ${x.word || outP[2]}`),
        ].join("");
        const sold = packMath(`${inner.wanted} ${item} en ${outP[2]} de ${per} ${item}${tail}`, true);
        if (sold && !sold.invalid && sold.mode === "packs" && sold.pack === outP)
          return { ...sold, chain: { inner: inP, k, innerPer: inner.perPack, loose: onlyWhole ? undefined : { packs: inner.packs, total: inner.total } } };
      }
      return { ...inner, outer: { pack: outP, per: k, count: Math.ceil(inner.packs / k), whole: onlyWhole } };
    }
  }
  const ask = (invalid: PackMath["invalid"], extra: Partial<PackMath> = {}): PackMath => ({ mode: "ask", perPack: 0, packs: 0, wanted: 0, total: 0, extra: 0, pack: PACKS[1], item: "", invalid, ...extra });
  // a figure corrected halfway ("cajas de 24, ah no, de 25", "1000… bueno mejor 1200",
  // "sorry I meant 25"): never calculate with the wrong one
  const corr = t0.match(/(?:^|[\s,.;])(ah\s+no|perd[oó]n|disculp\w*|bueno\s+mejor|mejor\s+(?:dicho\s+)?(?=\d)|corrijo|me\s+equivoqu[eé]|digo|sorry|i\s+meant|i\s+mean|actually|correction)\b[^\d]{0,25}(\d+(?:[.,]\d+)?)/);
  if (corr && /\d/.test(t0.slice(0, corr.index)))
    return ask("correction", { wanted: Number(corr[2].replace(",", ".")) });
  // "no sé si el mínimo es 30 o 50 cajas": two possible minimums
  const minOr = t0.match(new RegExp(`${MIN_KEY}[^\\d]{0,30}?(\\d+)\\s*(?:(${W})\\s+)?(?:o|or|ó|u)\\s+(\\d+)\\s*(${W})?`));
  if (minOr && minOr[1] !== minOr[3] && !(minOr[2] && minOr[4] && minOr[2] !== minOr[4])) {
    const w4 = minOr[4] || minOr[2] || "";
    const word = w4 && !CONNECT.test(w4) ? w4 : "";
    return ask("minChoice", { conds: { mins: [{ n: Number(minOr[1]), word, text: "" }, { n: Number(minOr[3]), word, text: "" }], lots: [] } });
  }
  // "menos de 500", "como máximo 500", "no more than 500": a ceiling, not a need
  const capRe = /(menos\s+de|less\s+than|fewer\s+than|under|no\s+m[aá]s\s+de|not\s+more\s+than|como\s+m[aá]ximo|a\s+lo\s+sumo|m[aá]ximo(?:\s+de)?|at\s+most|up\s+to|max(?:imum)?(?:\s+of)?)\s+(\d+(?:[.,]\d+)?)/;
  let cap = t0.match(capRe);
  // "no venden menos de 15 cajas" is the supplier's minimum, not the client's ceiling
  if (cap && /(?:\bno|won'?t|doesn'?t|don'?t|do\s+not|does\s+not|will\s+not)\s+(?:\S+\s+){1,3}$/.test(t0.slice(0, cap.index))) cap = null;
  let mins = readConds(` ${cap ? t0.replace(capRe, " $2") : t0} `, MIN_RES, "min");
  let lots = readConds(mins.text, LOT_RES, "lot");
  let m = packMathCore(lots.text, true);
  if (!m) return null;
  const capN = cap ? Number(cap[2].replace(",", ".")) : NaN;
  const strict = !!cap && /menos|less|fewer|under/.test(cap[1]);
  let capTotal: PackMath["capTotal"];
  // "necesito 600 piezas… menos de 800": the ceiling is on the total, the need is 600
  if (cap && m.invalid === "twoQty" && m.sizes?.includes(capN)) {
    mins = readConds(` ${t0.replace(capRe, " ")} `, MIN_RES, "min");
    lots = readConds(mins.text, LOT_RES, "lot");
    const m2 = packMathCore(lots.text, true);
    if (!m2) return null;
    m = m2;
    capTotal = { limit: capN, strict };
  }
  // a ceiling that is not the quantity ("600 piezas… menos de 800 en total")
  if (cap && !capTotal && (m.mode === "packs" || m.mode === "check") && m.wanted !== capN && m.wanted > 0 && capN > m.wanted)
    capTotal = { limit: capN, strict };
  if (cap && !capTotal && m.mode === "packs" && !m.kit && !m.measure && m.wanted === capN) {
    const K = Math.floor((m.wanted - (strict ? 1 : 0)) / m.perPack);
    // with a minimum or multiples: the largest order within the ceiling that meets them
    let minP = 0;
    let lotP = 1;
    for (const c of mins.list) {
      const x = condPacks(m, c, "min");
      if (x === null || !(c.n > 0)) return ask("conflictCond", { conds: { mins: mins.list, lots: lots.list }, pack: m.pack });
      minP = Math.max(minP, x);
    }
    for (const c of lots.list) {
      const x = condPacks(m, c, "lot");
      if (x === null || !Number.isInteger(x) || !(x > 0)) return ask("conflictCond", { conds: { mins: mins.list, lots: lots.list }, pack: m.pack });
      lotP = (lotP * x) / gcd(lotP, x);
    }
    const packs = Math.floor(K / lotP) * lotP;
    return { ...m, atMost: { limit: m.wanted, strict, packs, minP, lotP }, conds: mins.list.length || lots.list.length ? { mins: mins.list, lots: lots.list } : undefined };
  }
  // a condition with a negative, zero or decimal count can't be applied
  const badCond = [...mins.list, ...lots.list].find((c) => !(c.n > 0) || !Number.isInteger(c.n));
  if (badCond) return { ...m, mode: "ask", invalid: "badCond", conds: { mins: mins.list, lots: lots.list } };
  const out = applyConditions(m, mins.list, lots.list);
  return capTotal ? { ...out, capTotal } : out;
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
// "cuántas cajas", "cuántos sacos"
const cuant = (plural: string) => (/(?:as|dades|ciones)$/.test(plural) ? "cuántas" : "cuántos");
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
  const ctxA = new RegExp(`${PACK_RE}\\s*(?:\\s(?:${HAS_WORDS}|con|with|de|of)|:|=)\\s+(?:(?:solo|only)\\s+)?${KIT_COMP}(?!\\s+(?:en|in)\\s+${PACK_RE})`);
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
  const partsOf = (c: string) =>
    [...c.matchAll(new RegExp(`\\b(${NUMW})\\s+(${KIT_NOUN})`, "g"))].map((m) => ({
      n: /^\d+$/.test(m[1]) ? Number(m[1]) : NUMWORDS[m[1]],
      noun: m[2],
    }));
  let parts = partsOf(comp);
  // "240 botellas, 1 botella y 3 tazas por set": the first item repeats a later one, so it is
  // the order's quantity, not part of the set
  while (parts.length > 2 && new Set(parts.map((p) => stemOf(p.noun))).size !== parts.length && stemOf(parts[0].noun) && parts.slice(1).some((p) => stemOf(p.noun) === stemOf(parts[0].noun))) {
    const shorter = comp.replace(new RegExp(`^${KIT_PART}${KIT_SEP}`), "");
    if (shorter === comp) break;
    whole = whole.replace(comp, shorter);
    comp = shorter;
    parts = partsOf(comp);
  }
  if (parts.length < 2 || parts.some((p) => !(p.n >= 1) || p.n > 1e5 || NOT_ITEM.test(p.noun) || packOf(p.noun) || CONNECT.test(p.noun))) return null;
  if (new Set(parts.map((p) => stemOf(p.noun))).size !== parts.length) return null;
  // the pack word stays, so "100 sets con 1 botella y 3 tazas" still counts 100 sets
  const rest = t.replace(whole, ` ${packWord} `);
  const nums = [...rest.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?/g)].filter((m) => Number(m[1]) > 0);
  const base = { pack, kit: { parts, target: -1 }, extra: 0, item: "", perPack: parts[0].n };
  // every item the client needs counts: "100 platos y 300 vasos" with 2 platos and
  // 4 vasos per set needs 75 sets (the vasos decide), not 50
  const needs = new Map<number, { W: number; word: string }>();
  for (const m of nums) {
    const i = m[2] ? parts.findIndex((p) => stemOf(p.noun) === stemOf(m[2])) : -1;
    if (i < 0 || needs.has(i)) continue;
    const W = Number(m[1]);
    if (!Number.isInteger(W) || W > 1e8) return null;
    needs.set(i, { W, word: m[2]! });
  }
  if (needs.size) {
    let best = -1;
    let packs = 0;
    for (const [i, { W }] of needs) {
      const p = Math.ceil(W / parts[i].n);
      if (p > packs) { packs = p; best = i; }
    }
    const { W, word } = needs.get(best)!;
    const k = parts[best].n;
    const also = [...needs].filter(([i]) => i !== best).map(([i, x]) => ({ i, W: x.W }));
    return { ...base, mode: "packs", perPack: k, packs, wanted: W, total: packs * k, extra: packs * k - W, item: word, kit: { parts, target: best, also } };
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
  kilogram: ["mass", 1], kilograms: ["mass", 1], gram: ["mass", 0.001], grams: ["mass", 0.001], tonne: ["mass", 1000], tonnes: ["mass", 1000],
  pound: ["mass", 0.45359237], pounds: ["mass", 0.45359237], oz: ["mass", 0.028349523125], onzas: ["mass", 0.028349523125], ounces: ["mass", 0.028349523125],
  liter: ["volume", 1], liters: ["volume", 1], litre: ["volume", 1], litres: ["volume", 1], mililitros: ["volume", 0.001], milliliters: ["volume", 0.001],
  gallon: ["volume", 3.785411784], gallons: ["volume", 3.785411784], "m³": ["volume", 1000],
  meter: ["length", 1], meters: ["length", 1], metre: ["length", 1], metres: ["length", 1],
  yd: ["length", 0.9144], yds: ["length", 0.9144], yarda: ["length", 0.9144], yardas: ["length", 0.9144], yard: ["length", 0.9144], yards: ["length", 0.9144],
  ft: ["length", 0.3048], pie: ["length", 0.3048], pies: ["length", 0.3048], foot: ["length", 0.3048], feet: ["length", 0.3048],
  "m²": ["area", 1],
};
// containers only counted as packs when their content is a weight, volume or length
const CONTAINERS: [RegExp, string, string, string, string][] = [
  [/^(?:botellas?|bottles?)$/, "botella", "botellas", "bottle", "bottles"],
  [/^(?:sacos?|costal(?:es)?|sacks?)$/, "saco", "sacos", "sack", "sacks"],
  [/^(?:frascos?|jars?)$/, "frasco", "frascos", "jar", "jars"],
  [/^(?:latas?|cans?)$/, "lata", "latas", "can", "cans"],
  [/^(?:botes?|tubs?)$/, "bote", "botes", "tub", "tubs"],
  [/^(?:bidones?|bid[oó]n|garraf(?:a|as|[oó]n|ones)|jugs?)$/, "bidón", "bidones", "jug", "jugs"],
  [/^(?:cubetas?|baldes?|buckets?|pails?)$/, "cubeta", "cubetas", "bucket", "buckets"],
  [/^(?:tambos?|tambores?|barriles?|barril|drums?|barrels?)$/, "tambo", "tambos", "drum", "drums"],
];
const CONTAINER_RE = "(botes?|tubs?|botellas?|bottles?|sacos?|costal(?:es)?|sacks?|frascos?|jars?|latas?|cans?|bidones?|bid[oó]n|garraf(?:a|as|[oó]n|ones)|jugs?|cubetas?|baldes?|buckets?|pails?|tambos?|tambores?|barriles?|barril|drums?|barrels?)";
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
  const q = [...rest.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-záéíóúüñ]+[²³]?)/g)].find((x) => measureOf(x[2])?.[0] === family);
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
  // two contents for the same pack ("cajas de 20 o 25 piezas", "boxes of 24 or 36"): which one?
  const twoSizes = t.match(new RegExp(`${PACK_RE}\\s+(?:de|of|con|with)\\s+(\\d+)\\s*(?:[a-záéíóúüñ]+\\s+)?(?:o|or|ó|u)\\s+(?:de\\s+|of\\s+)?(\\d+)(?!\\s*${PACK_RE})`));
  if (twoSizes && Number(twoSizes[2]) !== Number(twoSizes[3]) && Number(twoSizes[2]) > 0)
    return { mode: "ask", perPack: 0, packs: 0, wanted: 0, total: 0, extra: 0, pack: packOf(twoSizes[1])!, item: "", invalid: "conflictSize", sizes: [Number(twoSizes[2]), Number(twoSizes[3])] };
  const range =
    t.match(/(?:entre|between)\s+(\d+(?:[.,]\d+)?)\s*(?:[a-záéíóúüñ]+\s+)?(?:y|and|-|a|to)\s*(\d+(?:[.,]\d+)?)\s+([a-záéíóúüñ]+)/) ||
    t.match(/()(\d+(?:[.,]\d+)?)\s*(?:-|–|a|o|to|or)\s*(\d+(?:[.,]\d+)?)\s+([a-záéíóúüñ]+)/)?.slice(1) as RegExpMatchArray | null | undefined;
  if (range && Number(range[2]) > Number(range[1]) && Number(range[1]) > 0 && !/^(?:d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years|horas|hours|por|per|cada|each)$/.test(range[3]))
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
    [new RegExp(`${N}\\s+(?:(?!(?:si|if|cuando|when|y|and|que|for|para|do|does|i|we|necesito|need)\\b)[a-záéíóúüñ]+\\s+){0,2}(?:por|per|each|en\\s+cada|in\\s+each|in\\s+a|a|/)\\s*${PACK_RE}\\b`), 2, 1],
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
    const mw = after0.match(/^\s*([a-záéíóúüñ]+[²³]?)/);
    // the bags are the item when they come inside another pack ("pacas de 20 bolsas"):
    // their weight only describes them
    const outer = t.match(new RegExp(`${PACK_RE}\\s+(?:de|of|con|with)\\s+\\d+\\s+${PACK_RE}\\b`));
    if (mw && measureOf(mw[1]) && outer && packOf(outer[2]) === pack && packOf(outer[1]) !== pack) {
      const desc = (sizeFirst ? "" : used) + after0.slice(0, (after0.match(/^\s*[a-záéíóúüñ]+[²³]?/) || [""])[0].length);
      const inner = packMathCore(t.replace(desc, ` ${packWord} `), true);
      return inner && !inner.item ? { ...inner, item: Lx(pack[2], pack[4]), nested: true } : inner && { ...inner, nested: true };
    }
    if (mw && measureOf(mw[1])) {
      const b0 = t.slice(0, at0).match(new RegExp(`${N}\\s*$`));
      return measureMath(t, used, pack, perPack, mw[1], b0 && !sizeFirst ? Number(b0[1].replace(",", ".")) : NaN);
    }
  }
  // a container sold by weight, volume or length ("botellas de 2 l", "sacos de 25 kg")
  if (!pack || !used) {
    const c = t.match(new RegExp(`${CONTAINER_RE}\\s+(?:(?:son|vienen|are|come)\\s+)?(?:de|of|con|with|in)\\s+${N}\\s*([a-záéíóúüñ]+[²³]?)`));
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
    if (before && new RegExp(`^${PACK_RE}`).test(used)) {
      packsGiven = Number(before[1].replace(",", "."));
      rest = t.slice(0, at - before[0].length) + " " + t.slice(at + used.length);
    } else rest = t.replace(used, " ");
  }
  // "40 cajas" elsewhere in the message
  const given = rest.match(new RegExp(`${N}\\s+${PACK_RE}\\b`));
  if (!Number.isFinite(packsGiven) && given && packOf(given[2]) === pack) packsGiven = Number(given[1].replace(",", "."));
  const rest2 = given && packOf(given[2]) === pack ? rest.replace(given[0], " ") : rest;
  // the number of items wanted, and the word after it
  const nums = [...rest2.matchAll(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+[²³]?))?(?:\s+([a-záéíóúüñ]+))?/g)];
  const w = nums.find((m) => Number(m[1].replace(",", ".")) >= 0 && !(Number(m[1]) === 0 && nums.some((o) => Number(o[1]) > 0)) && !/^(?:contenedor(?:es)?|containers?|modelos?|models?|d[ií]as|days|semanas|weeks|meses|months|a[nñ]os|years|horas|hours)$/.test(m[2] || ""));
  let wanted = w ? Number(w[1].replace(",", ".")) : NaN;
  // two different quantities of the same thing ("500 piezas, son 600 piezas"): which one?
  const twin = w && w[2] && !packOf(w[2]) && !CONNECT.test(w[2])
    ? nums.find((o) => o !== w && o[2] && stemOf(o[2]) === stemOf(w[2]!) && Number(o[1].replace(",", ".")) !== wanted && Number(o[1]) > 0)
    : undefined;
  if (twin && !Number.isFinite(packsGiven))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item: w![2]!, invalid: "twoQty", sizes: [wanted, Number(twin[1].replace(",", "."))] };
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
    if (wu === "dozen" && cu === "") {
      // "3 docenas, cajas de 10": a dozen is a way of counting; the box content is in pieces
      conv = { wanted, wantedWord: wWord, perPack, perWord: "" };
      if (Number.isFinite(wanted)) wanted = Math.round(wanted * 12 * 1e6) / 1e6;
      item = pieceNoun || Lx("piezas", "pieces");
    } else if (isPD(wu) && cu === "") {
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
  const MEASURE_W = { test: (w: string) => !!measureOf(w) };
  if (w && MEASURE_W.test(w[2] || "") && !(cw && MEASURE_W.test(cw[1])))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item: w[2], invalid: "measure" };
  if (w && wanted === 0 && Number(w[1]) === 0)
    return { mode: "ask", perPack, packs: 0, wanted: 0, total: 0, extra: 0, pack, item, invalid: "zeroQty" };
  if (wanted > 0 && !Number.isInteger(wanted) && !MEASURE_W.test(w?.[2] || ""))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item, invalid: "decimalQty" };
  if (wanted > 1e8 && Number.isFinite(wanted))
    return { mode: "ask", perPack, packs: 0, wanted, total: 0, extra: 0, pack, item, invalid: "tooBig" };
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
  const raw = forMath(String(text || ""));
  if (!VERB_Q.test(normalizeNumbers(raw.toLowerCase()))) return [];
  // one mixed set ("1 botella y 3 tazas") is a single calculation, not two orders;
  // a correction or a doubtful minimum concerns the whole message
  const whole = packMath(raw);
  if (whole?.kit || whole?.invalid === "correction" || whole?.invalid === "minChoice") return [];
  // "only 150 pairs in stock" is not a second order
  if (findStock(normalizeNumbers(raw.toLowerCase()))) return [];
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
  let t = forMath(String(text || "")).trim();
  if (!t || t.length > 200) return null;
  const all = packMathAll(previous);
  const tn0 = ` ${normalizeNumbers(t.toLowerCase().replace(/[¿?¡!]/g, " "))} `;
  // "quítale el mínimo", "sin el mínimo", "without the minimum": the same order without it
  if (/(?:qu[ií]t|elimin|borr|remov|drop|sin\s+(?:el\s+|la\s+)?|without\s+(?:the\s+)?|no\s+(?:hay|tiene|aplica)\s+(?:el\s+|un\s+)?)\w*\s*(?:le\s+|el\s+|la\s+|the\s+)?(m[ií]nimo|minimum|moq|m[uú]ltiplos?|multiples?|lotes?)/.test(tn0)) {
    const base = all.length ? null : packMath(previous, true);
    if (!base || !base.conds && !base.cond) return null;
    const keep = condsOf(base);
    const dropLots = /m[uú]ltiplo|multiple|lote/.test(tn0);
    return packMath(statementWith(base, { mins: dropLots ? keep.mins : [], lots: dropLots ? [] : keep.lots }), true);
  }
  // "¿y si solo tienen 12 disponibles?", "el proveedor solo tiene 8 cajas": the same order
  // against that stock (a minimum or multiple in the same message applies too)
  const stockNow = findStock(tn0);
  if (stockNow) {
    const base = all.length ? null : packMath(previous, true);
    if (!base || base.invalid || base.mode === "ask") return null;
    const rest = tn0.replace(stockNow.text, " ");
    const keep = condsOf(base);
    const nMins = readConds(rest, MIN_RES, "min").list;
    const nLots = readConds(rest, LOT_RES, "lot").list;
    const conds = { mins: nMins.length ? nMins : keep.mins, lots: nLots.length ? nLots : keep.lots };
    const stmt = statementWith({ ...base, stock: undefined }, conds);
    return packMath(`${stmt}. el proveedor solo tiene ${stockNow.n} ${stockNow.word || base.pack[2]} disponibles`, true);
  }
  // "¿Y los cuadernos?" after a message with several orders: that part again
  if (!/\d/.test(tn0)) {
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
  // a complete calculation of its own ("¿y 300 cuadernos en paquetes de 10?"); a bare
  // "¿y si son 500 pares?" is not one: pairs are a unit here, not a pack with a size
  const full = packMath(t, true);
  if (full && (packPhrases(t) > 0 || (full.measure && full.mode !== "ask") || full.kit)) return full;
  // the earlier order this refers to: the one with the same kind of pack when the
  // message names one ("¿Y si cada set trae 30?" is about the sets, not the paquetes)
  const cands = all.length ? all : [packMath(previous, true)].filter((x): x is PackMath => !!x);
  const named = normalizeNumbers(t.toLowerCase()).match(new RegExp(`\\b${PACK_RE}\\b`));
  // pairs and dozens are units of the order, not the pack it refers to
  const namedPack = named && !/^(?:par|docena)$/.test(packOf(named[1])?.[1] || "") ? packOf(named[1]) : undefined;
  const prev = namedPack ? cands.find((m) => m.pack === namedPack || m.chain?.inner === namedPack) : cands[0];
  if (!prev) return null;
  // after "cada caja trae 10 sets de 12": which pack changes, the quantity, or ask
  if (prev.chain && prev.mode === "packs") {
    const c = prev.chain;
    const fem = /a$/.test(prev.pack[1]);
    const stmt = (qty: number | string, innerPer: number, k: number) =>
      `${qty} ${prev.item}. cada ${c.inner[1]} trae ${innerPer} ${prev.item} y cada ${prev.pack[1]} trae ${k} ${c.inner[2]}${c.loose ? "" : `. solo venden ${prev.pack[2]} ${fem ? "completas" : "completos"}`}${condTail(prev)}`;
    const named2 = tn.match(new RegExp(`${PACK_RE}\\s+(?:${HAS_WORDS}|vienen?\\s+(?:de|con)|son\\s+de|de|of)\\s+(\\d+)`));
    const np = named2 ? packOf(named2[1]) : undefined;
    if (named2 && np === c.inner) return packMath(stmt(prev.wanted, Number(named2[2]), c.k), true);
    if (named2 && np === prev.pack) return packMath(stmt(prev.wanted, c.innerPer, Number(named2[2])), true);
    const bare = tn.match(/\b(?:vienen|viene|traen|trae|tienen|tiene|come|comes|hold|holds|contain|contains)\s+(?:de\s+|en\s+|in\s+|of\s+)?(\d+(?:[.,]\d+)?)s?\b(?!\s*[a-záéíóúüñ])/);
    if (bare) return { ...prev, mode: "ask", invalid: "whichPack", sizes: [Number(bare[1])], chain: c };
    // "¿y si son 50 cajas?": how much that many boxes hold
    const cnt = tn.match(new RegExp(`(\\d+)\\s+${PACK_RE}\\b`));
    if (cnt && packOf(cnt[2]) === prev.pack) return packMath(`${cnt[1]} ${prev.pack[2]} de ${prev.perPack} ${prev.item}, cuántos ${prev.item} son`, true);
    if (cnt && packOf(cnt[2]) === c.inner) return packMath(`${cnt[1]} ${c.inner[2]} de ${c.innerPer} ${prev.item}, cuántos ${prev.item} son`, true);
    const nq = tn.match(/(\d+(?:[.,]\d+)?)/);
    if (nq && /^\s*(?:¿\s*)?(?:y|e|and|what\s+about|y\s+si|y\s+para|y\s+con|and\s+for|and\s+if|perd[oó]n|son|eran|sorry|actually)\b/i.test(t))
      return packMath(stmt(nq[1], c.innerPer, c.k), true);
  }
  // "¿y si vienen de 30?", "y si traen 16", "what if they come in 30s": a new content
  // for the same pack ("¿y si vienen 500?" with a word after it is not one)
  const sizeOnly = tn.match(/\b(?:vienen|viene|traen|trae|tienen|tiene|come|comes|hold|holds|contain|contains)\s+(?:de\s+|en\s+|in\s+|of\s+)?(\d+(?:[.,]\d+)?)s?\b(?!\s*[a-záéíóúüñ])/);
  if (sizeOnly && !namedPack && !prev.kit) {
    t = `${prev.pack[2]} de ${sizeOnly[1]}${prev.measure ? ` ${prev.item}` : ""}`;
    const sized = packMath(`${t} para ${prev.wanted || prev.total} ${prev.item || Lx("piezas", "pieces")}${condTail(prev)}`, true);
    if (sized) return sized;
  }
  // a mixed set keeps its content: "¿y para 300?", "¿y si son 50 sets?"
  if (prev.kit) {
    // "¿y si cada set trae 4 tazas?": the set changes, the quantity stays
    const cm = tn.match(new RegExp(`(?:${HAS_WORDS}|vienen|viene)\\s+(\\d+)\\s+([a-záéíóúüñ]+)`));
    const ci = cm ? prev.kit.parts.findIndex((p) => stemOf(p.noun) === stemOf(cm[2])) : -1;
    if (cm && ci >= 0) {
      const parts = prev.kit.parts.map((p, i) => (i === ci ? { ...p, n: Number(cm[1]) } : p));
      const qty = prev.mode === "total" ? `${prev.packs} ${prev.pack[2]}` : `${prev.wanted} ${prev.item}`;
      return packMath(kitStatement({ ...prev, kit: { ...prev.kit, parts } }, qty), true);
    }
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
  const unitTail = prev.unit || prev.measure ? ` ${prev.item}` : "";
  const mt = condTail(prev);
  // "¿Y si son 50 sets?": a count of packs, checked against the earlier order
  const given = normalizeNumbers(t.toLowerCase()).match(new RegExp(`(\\d+)\\s+${PACK_RE}\\b(?!\\s+(?:de|of|con|with|x)\\s*\\d)`));
  if (given && packOf(given[2]) === prev.pack && !/\d+\s*(?:por|per)\s/.test(t)) {
    // "y 55 cajas?" after "40 cajas de 100 guantes, ¿cuántos son?": a count, not a check
    if (prev.mode === "total" && !prev.wanted) {
      const tot = packMath(`${given[1]} ${prev.pack[2]} de ${prev.perPack}${unitTail || ` ${items}`}, ¿cuántos ${items} son?`, true);
      if (tot) return keepUnit(tot);
    }
    const c = packMath(`¿alcanzan ${given[1]} ${prev.pack[2]} de ${prev.perPack}${unitTail} para ${prev.wanted || prev.total} ${items}?${mt}`, true);
    if (c) return keepUnit(c);
  }
  // only a new pack size
  const withQty = keepUnit(packMath(`${t} para ${prev.wanted || prev.total} ${items}${mt}`, true));
  if (withQty && withQty.pack === prev.pack && withQty.perPack !== prev.perPack) return withQty;
  // only a new quantity
  const n = normalizeNumbers(t.toLowerCase()).match(/(\d+(?:[.,]\d+)?)(?:\s+([a-záéíóúüñ]+))?/);
  if (n && /^\s*(?:¿\s*)?(?:y|e|and|what\s+about|y\s+si|y\s+para|y\s+con|and\s+for|and\s+if|perd[oó]n|disculp\w*|corrijo|mejor|en\s+realidad|son|eran|ser[aá]n|sorry|actually|make\s+it|i\s+meant|no,?\s+(?:son|eran))\b/i.test(t)) {
    // "Corrijo: serán 10,000,001 compresores" after a calculation about lápices names ANOTHER
    // item: it is not a new quantity for that calculation (that reused the lápices answer)
    const named = n[2] && !PIECE_W.test(n[2]) && !measureOf(n[2]) && !PAIR_W.test(n[2]) && !DOZ_W.test(n[2]) && !packOf(n[2]) && !CONNECT.test(n[2]) && !NOT_ITEM.test(n[2]) ? n[2] : "";
    if (named && prev.item && !sameProduct(named, prev.item)) return null;
    // "¿y si son 500 pares?": the client's unit, the earlier content per pack
    const w2 = n[2] && (PIECE_W.test(n[2]) || !!measureOf(n[2]) || (!CONNECT.test(n[2]) && !NOT_ITEM.test(n[2]))) && !packOf(n[2] === "pares" || n[2] === "docenas" ? "" : n[2]) ? n[2] : "";
    const unitChange = w2 && (PAIR_W.test(w2) || DOZ_W.test(w2)) && !prev.unit && !prev.measure;
    // "¿y para 500 unidades?" after a calculation in kg: a count can't be turned into kg
    if (prev.measure && w2 && measureOf(w2)?.[0] !== measureOf(prev.item)?.[0])
      return { ...prev, mode: "ask", wanted: Number(n[1].replace(",", ".")), invalid: "measureCount", conds: undefined, cond: undefined, extra: 0, total: 0, packs: 0, measure: undefined, sizes: undefined, alt: undefined, conv: undefined, unit: undefined, item: w2, perWord: prev.item } as PackMath;
    // "¿y para 2 toneladas?" after kg: the new figure keeps its own unit
    const sameMeasure = prev.measure && w2 && measureOf(w2) ? ` ${w2}` : "";
    // "¿y para 300?" after "100 pares… cajas de 30 zapatos": still pairs against single shoes
    const keepConv = !w2 && prev.conv && prev.conv.wantedWord && (PAIR_W.test(prev.conv.wantedWord) || DOZ_W.test(prev.conv.wantedWord));
    const q = keepConv
      ? packMath(`${n[1]} ${prev.conv!.wantedWord} en ${prev.pack[2]} de ${prev.conv!.perPack} ${prev.conv!.perWord || prev.item}${mt}`, true)
      : sameMeasure
      ? packMath(`${n[1]}${sameMeasure} en ${prev.pack[2]} de ${prev.perPack} ${prev.item}${mt}`, true)
      : unitChange
      ? packMath(`${n[1]} ${w2} en ${prev.pack[2]} de ${prev.perPack} ${prev.item || Lx("piezas", "pieces")}${mt}`, true)
      : packMath(`${n[1]} ${prev.item || ""} en ${prev.pack[2]} de ${prev.perPack}${unitTail}${mt}`, true);
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
    // the supplier's stock stays for follow-ups
    ...(m.stock ? [`. el proveedor solo tiene ${m.stock.packs} ${m.pack[2]} disponibles`] : []),
  ].join("");
}
/** The same calculation with other conditions. */
function statementWith(m: PackMath, c: { mins: Cond[]; lots: Cond[] }): string {
  return mathStatement({ ...m, cond: undefined, conds: undefined, stock: undefined }) + condTail(m, c);
}

/** A complete question for a calculation, so later follow-ups can build on it. */
export function mathStatement(m: PackMath): string {
  if (m.chain && m.mode === "packs") {
    const c = m.chain;
    const fem = /a$/.test(m.pack[1]);
    return `${m.wanted} ${m.item}. cada ${c.inner[1]} trae ${c.innerPer} ${m.item} y cada ${m.pack[1]} trae ${c.k} ${c.inner[2]}${c.loose ? "" : `. solo venden ${m.pack[2]} ${fem ? "completas" : "completos"}`}${condTail(m)}`;
  }
  if (m.kit && m.outer)
    return `${kitStatement({ ...m, outer: undefined }, m.mode === "packs" ? `${m.wanted} ${m.item}` : `${m.packs} ${m.pack[2]}`)}. cada ${m.outer.pack[1]} trae ${m.outer.per} ${m.pack[2]}${m.outer.whole ? `. solo venden ${m.outer.pack[2]} completas` : ""}${condTail(m)}`;
  if (m.kit)
    return kitStatement(m, m.mode === "packs" ? `${m.wanted} ${m.item}` : m.mode === "total" ? `${m.packs} ${m.pack[2]}` : m.wanted ? String(m.wanted) : "");
  if ((m.mode === "ask" && m.invalid) || m.zeroOrder || (m.measure && m.mode === "ask")) return "";
  if (m.measure)
    return `cuántos ${m.pack[2]} necesito para ${m.mode === "total" ? `${m.packs} ${m.pack[2]}` : `${m.wanted} ${m.item}`} en ${m.pack[2]} de ${m.perPack} ${m.item}${condTail(m)}`;
  if (m.mode === "ask") return `cuántos ${m.pack[2]} necesito para ${m.wanted} ${m.item}${m.conv?.perWord ? ` de ${m.conv.perWord}` : ""}${condTail(m)}`;
  // a count of packs stays a count ("40 cajas de 100 guantes, ¿cuántos guantes son?")
  if (m.mode === "total" && !m.wanted && !m.conds && !m.cond)
    return `${m.packs} ${m.pack[2]} de ${m.perPack} ${m.conv?.perWord || m.item || "piezas"}, cuántos ${m.item || "piezas"} son`;
  // pairs or dozens against single pieces keep both words ("100 pares de zapatos en cajas de 30 zapatos")
  if (m.conv && (m.mode === "packs" || m.mode === "check") && (PAIR_W.test(m.conv.wantedWord) || DOZ_W.test(m.conv.wantedWord)) && m.conv.perWord && !isPD(unitOf(m.conv.perWord)))
    return `cuántos ${m.pack[2]} necesito para ${m.conv.wanted} ${m.conv.wantedWord} de ${m.item} en ${m.pack[2]} de ${m.conv.perPack} ${m.conv.perWord}${m.alt ? "" : " individuales"}${condTail(m)}`;
  // the unit goes with the pack content, so "501 pares en cajas de 20 pares" stays in pairs
  return `cuántos ${m.pack[2]} necesito para ${m.mode === "packs" || m.mode === "check" ? m.wanted : m.total} ${m.item || "piezas"} en ${m.pack[2]} de ${m.perPack}${m.unit ? ` ${m.item}` : ""}${condTail(m)}`;
}

/** "15 cajas" or "300 pares (15 cajas)"; says when the condition's unit was assumed. */
function condLabel(c: Cond, packs: number, pack: PackMath["pack"]): string {
  const f = (n: number) => n.toLocaleString("en-US");
  const pw = (n: number) => (n === 1 ? Lx(pack[1], pack[3]) : Lx(pack[2], pack[4]));
  if (!c.word) return Lx(`${f(c.n)} (tomado como ${pw(2)}; confírmalo)`, `${f(c.n)} (taken as ${pw(2)}; confirm it)`);
  if (anyPackOf(c.word) === pack) return `${f(c.n)} ${pw(c.n)}`;
  return `${f(c.n)} ${tw(c.word)} (${f(packs)} ${pw(packs)})`;
}

/**
 * What the minimum and multiples did to the order, in words:
 * lead = "pero el mínimo del proveedor es 15 cajas y solo vende en múltiplos de 6 cajas"
 * ok = "Cumples el mínimo (15 cajas) y el múltiplo de 6 cajas."
 */
function condWords(m: PackMath): { lead: string; ok: string; met: string; unread: string } {
  const c = m.cond;
  if (!c) return { lead: "", ok: "", met: "", unread: "" };
  const parts: string[] = [];
  const okParts: string[] = [];
  const minC = c.mins.find((x) => condPacks(m, x, "min") !== null);
  const lotC = c.lots.find((x) => condPacks(m, x, "lot") !== null);
  // when the order goes up, the "pero …" names only the conditions that raise it:
  // 301 pares in boxes of 20 need 16 boxes, which already meet a minimum of 15;
  // the multiple of 6 is what takes the order to 18
  // (packs given, "Ojo" note: from the packs written to the valid order nearest above)
  const from = c.changed ? c.need : m.packs;
  const to = c.changed ? m.packs : c.need;
  const raised = (m.mode === "packs" && c.changed) || ((m.mode === "check" || m.mode === "total") && to !== from);
  const minRaises = !raised || c.minPacks > from;
  const lotRaises = !raised || (c.lotPacks > 0 && Math.max(from, c.minPacks) % c.lotPacks !== 0);
  const metParts: string[] = [];
  if (minC) {
    const lbl = condLabel(minC, c.minPacks, m.pack);
    if (minRaises) parts.push(Lx(`el mínimo del proveedor es ${lbl}`, `the supplier's minimum is ${lbl}`));
    else metParts.push(Lx(`el mínimo de ${lbl}`, `the minimum of ${lbl}`));
    okParts.push(Lx(`el mínimo de ${lbl}`, `the minimum of ${lbl}`));
  }
  if (lotC) {
    const lbl = condLabel(lotC, c.lotPacks, m.pack);
    if (lotRaises)
      parts.push(parts.length ? Lx(`solo vende en múltiplos de ${lbl}`, `it only sells in multiples of ${lbl}`) : Lx(`el proveedor solo vende en múltiplos de ${lbl}`, `the supplier only sells in multiples of ${lbl}`));
    else metParts.push(Lx(`el múltiplo de ${lbl}`, `the multiple of ${lbl}`));
    okParts.push(Lx(`el múltiplo de ${lbl}`, `the multiple of ${lbl}`));
  }
  const unread = c.unreadable.length
    ? Lx(
        // ask instead of concluding that the units can't be compared
        ` Para aplicar «${c.unreadable.map((x) => `${x.n} ${x.word}`.trim()).join("», «")}» necesito un dato: ${packOf(c.unreadable[0].word) ? `¿cuántos ${m.pack[2]} trae cada ${singularOf(c.unreadable[0].word) || c.unreadable[0].word}?` : `¿a cuántos ${m.item} equivalen ${c.unreadable[0].n} ${c.unreadable[0].word}?`} Con eso lo incluyo en el cálculo.`,
        ` To apply "${c.unreadable.map((x) => `${x.n} ${x.word}`.trim()).join('", "')}" I need one more figure: ${packOf(c.unreadable[0].word) ? `how many ${m.pack[4]} does each ${singularOf(c.unreadable[0].word) || c.unreadable[0].word} hold?` : `how many ${tw(m.item)} are ${c.unreadable[0].n} ${tw(c.unreadable[0].word)}?`} With that I'll include it in the calculation.`,
      )
    : "";
  return {
    lead: joinList(parts),
    ok: okParts.length ? Lx(` Cumples ${joinList(okParts)}.`, ` You meet ${joinList(okParts)}.`) : "",
    // a condition the need already met, said after the raised order
    met: metParts.length ? Lx(` Ese pedido también cumple ${joinList(metParts)}.`, ` That order also meets ${joinList(metParts)}.`) : "",
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
    ) + cw.met + cw.unread + confirm;
  }
  const minEnd = !m.cond
    ? ""
    : m.mode === "total" && m.packs !== m.cond.need
      ? Lx(` Ojo: ${cw.lead}; para cumplirlo tendrías que pedir ${f(m.cond.need)} ${pw(m.cond.need)}.`, ` Note: ${cw.lead}; to meet it you'd have to order ${f(m.cond.need)} ${pw(m.cond.need)}.`) + cw.unread
      : cw.ok + cw.unread;
  if (m.mode === "packs") {
    const p = k.parts[k.target];
    const extra = m.extra > 0 ? Lx(` (${count(p.noun, m.extra)} de más)`, ` (${count(p.noun, m.extra)} extra)`) : "";
    // the other items the client needs are covered too ("también cubre los 100 platos")
    const also = (k.also || []).map((x) => count(k.parts[x.i].noun, x.W));
    const alsoTxt = also.length ? Lx(` Con eso también cubres ${joinList(also)}.`, ` That also covers ${joinList(also)}.`) : "";
    return Lx(
      `Necesitarías ${f(m.packs)} ${pw(m.packs)} para cubrir ${f(m.wanted)} ${pluralOf(m.item)}, suponiendo que cada ${pw(1)} trae ${comp}. En total recibirías ${totals(m.packs)}${extra}.`,
      `You'd need ${f(m.packs)} ${pw(m.packs)} to cover ${f(m.wanted)} ${pluralOf(m.item)}, assuming each ${pw(1)} holds ${comp}. In total you'd receive ${totals(m.packs)}${extra}.`,
    ) + alsoTxt + minEnd + confirm;
  }
  if (m.mode === "total")
    return Lx(
      `${f(m.packs)} ${pw(m.packs)}, si cada ${pw(1)} trae ${comp}, suman ${totals(m.packs)}.`,
      `${f(m.packs)} ${pw(m.packs)}, if each ${pw(1)} holds ${comp}, add up to ${totals(m.packs)}.`,
    ) + minEnd + confirm;
  if (!m.wanted)
    return Lx(
      `Cada ${pw(1)} trae ${comp}. ¿Qué cantidad necesitas y de qué (${joinList([...k.parts.map((p) => pluralOf(p.noun)), pw(2)])})? Con ese dato te digo ${cuant(pw(2))} ${pw(2)} pedir.`,
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
    case "whichPack": {
      const c = m.chain!;
      const n = f(m.sizes![0]);
      return Lx(
        `¿${n} es lo que trae cada ${c.inner[1]} (${tw(m.item)}) o cada ${m.pack[1]} (${c.inner[2]})? Dímelo, por ejemplo «cada ${c.inner[1]} trae ${n}» o «cada ${m.pack[1]} trae ${n} ${c.inner[2]}», y lo recalculo.`,
        `Is ${n} what each ${c.inner[3]} holds (${tw(m.item)}) or each ${m.pack[3]} (${c.inner[4]})? Tell me, for example "each ${c.inner[3]} holds ${n}" or "each ${m.pack[3]} holds ${n} ${c.inner[4]}", and I'll recalculate it.`,
      );
    }
    case "tooBig":
      return Lx(
        `La cantidad ${f(m.wanted)} es demasiado grande para calcularla con confianza aquí; revisa la cifra (¿quizás sobran ceros?) y vuelve a escribirme el pedido.`,
        `The quantity ${f(m.wanted)} is too large to calculate reliably here; check the figure (maybe extra zeros?) and send me the order again.`,
      );
    case "measureCount":
      return Lx(
        `Cada ${one} está indicado en ${m.perWord} (${f(m.perPack)} ${m.perWord}), y ahora pides ${f(m.wanted)} ${tw(m.item)}. Para no adivinar: ¿cuántos ${m.perWord} necesitas en total, o ${cuant(tw(m.item))} ${tw(m.item)} trae cada ${one}?`,
        `Each ${one} is given in ${m.perWord} (${f(m.perPack)} ${m.perWord}), and now you ask for ${f(m.wanted)} ${tw(m.item)}. So I don't guess: how many ${m.perWord} do you need in total, or how many ${tw(m.item)} does each ${one} hold?`,
      );
    case "correction":
      return Lx(
        `Veo que corregiste una cifra dentro del mismo mensaje (la última es ${f(m.wanted)}). Para no calcular con la equivocada, mándame el pedido completo con las cifras finales: cantidad total y su unidad, y qué trae cada empaque.`,
        `I see you corrected a figure within the same message (the last one is ${f(m.wanted)}). So I don't calculate with the wrong one, send me the whole order with the final figures: total quantity and its unit, and what each pack holds.`,
      );
    case "twoQty":
      return Lx(
        `Tu mensaje trae dos cantidades distintas de ${tw(m.item)} (${f(m.sizes![0])} y ${f(m.sizes![1])}). ¿Con cuál calculo? Si son dos pedidos diferentes, escríbelos por separado.`,
        `Your message has two different quantities of ${tw(m.item)} (${f(m.sizes![0])} and ${f(m.sizes![1])}). Which one should I use? If they are two different orders, send them separately.`,
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
    case "minChoice":
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
  return from + lead + extra + (m.cond?.changed ? cw.met : cw.ok) + cw.unread + assume;
}

function outerNote(m: PackMath): string {
  const o = m.outer;
  if (!o) return "";
  const f = (n: number) => n.toLocaleString("en-US");
  const ow = (n: number) => (n === 1 ? Lx(o.pack[1], o.pack[3]) : Lx(o.pack[2], o.pack[4]));
  const iw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const full = o.count * o.per;
  const unit = m.measure ? m.item : tw(m.item) || Lx("piezas", "pieces");
  const amount = m.measure ? fmtMeasure(full * m.perPack) : f(full * m.perPack);
  const whole = /a$/.test(o.pack[1]) ? "completas" : "completos";
  return full > m.packs
    ? Lx(
        ` En ${o.pack[2]} de ${f(o.per)} ${iw(o.per)}: ${f(o.count)} ${ow(o.count)}. Si solo venden ${o.pack[2]} ${whole}, serían ${f(full)} ${iw(full)} = ${amount} ${unit}.`,
        ` In ${o.pack[4]} of ${f(o.per)} ${iw(o.per)}: ${f(o.count)} ${ow(o.count)}. If only whole ${o.pack[4]} are sold, that's ${f(full)} ${iw(full)} = ${amount} ${unit}.`,
      )
    : Lx(` En ${o.pack[2]} de ${f(o.per)} ${iw(o.per)}: exactamente ${f(o.count)} ${ow(o.count)}.`, ` In ${o.pack[4]} of ${f(o.per)} ${iw(o.per)}: exactly ${f(o.count)} ${ow(o.count)}.`);
}

function chainReply(m: PackMath): string {
  const c = m.chain!;
  const f = (n: number) => n.toLocaleString("en-US");
  const items = tw(m.item) || Lx("piezas", "pieces");
  const inW = (n: number) => (n === 1 ? Lx(c.inner[1], c.inner[3]) : Lx(c.inner[2], c.inner[4]));
  const outOne = Lx(m.pack[1], m.pack[3]);
  const pre = Lx(
    `Cada ${outOne} trae ${f(c.k)} ${inW(c.k)} de ${f(c.innerPer)} ${items} = ${f(m.perPack)} ${items}. `,
    `Each ${outOne} holds ${f(c.k)} ${inW(c.k)} of ${f(c.innerPer)} ${items} = ${f(m.perPack)} ${items}. `,
  );
  const base = packMathReply({ ...m, chain: undefined });
  // an order counted in the outer packs: "5 cajas (50 sets) de 120 son 600 piezas"
  if (m.mode === "total")
    return pre + base.replace(new RegExp(`^(${f(m.packs)} [^\\s:,]+)`), `$1 (${f(m.packs * c.k)} ${inW(m.packs * c.k)})`);
  const sets = Lx(` (${f(m.packs * c.k)} ${inW(m.packs * c.k)})`, ` (${f(m.packs * c.k)} ${inW(m.packs * c.k)})`);
  const withSets = base.replace(new RegExp(`^((?:Necesitarías|You'd need|Para [^:]+?debes pedir|For [^:]+?you should order) ${f(m.packs)} [^\\s:,]+)`), `$1${sets}`);
  const loose = c.loose && c.loose.packs % c.k !== 0
    ? Lx(
        ` Si el proveedor vendiera ${Lx(c.inner[2], c.inner[4])} suelt${/a$/.test(c.inner[1]) ? "as" : "os"}, bastarían ${f(c.loose.packs)} ${inW(c.loose.packs)} = ${f(c.loose.total)} ${items}; confírmalo.`,
        ` If the supplier sold loose ${c.inner[4]}, ${f(c.loose.packs)} ${inW(c.loose.packs)} = ${f(c.loose.total)} ${items} would do; confirm it.`,
      )
    : "";
  const at = withSets.search(/ Confirma con el proveedor el contenido real| Confirm the real content/);
  return pre + (at >= 0 ? withSets.slice(0, at) + loose + withSets.slice(at) : withSets + loose);
}

function stockReply(m: PackMath): string {
  const s = m.stock!;
  const f = (n: number) => n.toLocaleString("en-US");
  const fm = (n: number) => (m.measure ? fmtMeasure(n) : f(n));
  const items = m.measure ? m.item : tw(m.item) || Lx("piezas", "pieces");
  const pw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const fem = /a$/.test(m.pack[1]);
  const las = (n: number) => Lx(fem ? (n === 1 ? "La" : "Las") : n === 1 ? "El" : "Los", "The");
  const disp = (n: number) => Lx(n === 1 ? "disponible" : "disponibles", "available");
  const base = packMathReply({ ...m, stock: undefined });
  const confirmAt = base.search(/ Confirma con el proveedor el contenido real| Confirm the real content/);
  const insert = (txt: string) => (confirmAt >= 0 ? base.slice(0, confirmAt) + txt + base.slice(confirmAt) : base + txt);
  if (!Number.isFinite(s.packs))
    return insert(
      Lx(
        ` Para comparar las existencias (${f(s.n)} ${s.word}) con este pedido necesito un dato: ${packOf(s.word) ? `¿cuántos ${m.pack[2]} trae cada ${singularOf(s.word) || s.word}?` : `¿a cuántos ${m.item} equivalen ${f(s.n)} ${s.word}?`} Con eso te digo si alcanzan.`,
        ` To compare the stock (${f(s.n)} ${s.word}) with this order I need one more figure: ${packOf(s.word) ? `how many ${m.pack[4]} does each ${singularOf(s.word) || s.word} hold?` : `how many ${tw(m.item)} are ${f(s.n)} ${tw(s.word)}?`} With that I'll tell you if it's enough.`,
      ),
    );
  const have = s.packs;
  const unitsIn = (packs: number) => packs * m.perPack;
  // "200 pares disponibles" is said as written, with the whole packs it makes
  const other = !!s.word && packOf(s.word) !== m.pack;
  const stockTxt = other
    ? Lx(`${fm(s.n)} ${tw(s.word)} ${s.n === 1 ? "disponible" : "disponibles"} (${f(have)} ${pw(have)} ${fem ? (have === 1 ? "completa" : "completas") : have === 1 ? "completo" : "completos"}, ${fm(unitsIn(have))} ${items})`, `${fm(s.n)} ${tw(s.word)} available (${f(have)} whole ${pw(have)}, ${fm(unitsIn(have))} ${items})`)
    : Lx(`${f(have)} ${pw(have)} ${disp(have)} (${fm(unitsIn(have))} ${items})`, `${f(have)} ${pw(have)} available (${fm(unitsIn(have))} ${items})`);
  // a ceiling ("menos de 500"): the order is the most packs within it
  if (m.atMost) {
    const k = m.atMost.packs;
    return insert(
      have >= k
        ? Lx(` ${las(have)} ${f(have)} ${pw(have)} ${disp(have)} alcanzan para eso.`, ` The ${f(have)} ${pw(have)} available are enough for that.`)
        : Lx(
            ` Pero el proveedor solo tiene ${stockTxt}: con eso recibirías ${fm(unitsIn(have))} ${items}. Pregúntale si repondrá existencias.`,
            ` But the supplier only has ${stockTxt}: that would give you ${fm(unitsIn(have))} ${items}. Ask whether they will restock.`,
          ),
    );
  }
  const need = m.cond?.need ?? m.packs; // packs that cover the quantity
  const required = m.mode === "check" ? Math.max(m.packs, m.cond?.need ?? 0) : m.packs; // with minimum and multiples
  if (have >= required)
    return insert(Lx(` ${las(have)} ${f(have)} ${pw(have)} ${disp(have)} alcanzan para ese pedido.`, ` The ${f(have)} ${pw(have)} available are enough for that order.`));
  const confirm = m.kit
    ? Lx(` Confirma con el proveedor el contenido real de cada ${m.pack[1]} y su pedido mínimo.`, ` Confirm the real content of each ${m.pack[3]} and the minimum order with the supplier.`)
    : Lx(" Confirma con el proveedor el contenido real y su pedido mínimo.", " Confirm the real content and minimum order with the supplier.");
  const covers = unitsIn(have);
  const wanted = m.mode === "check" ? m.wanted : m.wanted;
  if (have >= need && need < required) {
    // enough to cover the quantity, not enough to meet the purchase conditions:
    // never recommend more packs than the supplier has
    const cw = condWords(m);
    return Lx(
      `Con ${las(have).toLowerCase()} ${f(have)} ${pw(have)} ${disp(have)} sí cubres ${fm(wanted)} ${items}: recibirías ${fm(covers)} ${items}${covers > wanted ? ` (${fm(covers - wanted)} ${items} de más)` : ""}, suponiendo ${fm(m.perPack)} ${m.perPack === 1 ? singularOf(items) : items} por ${pw(1)}. Pero no alcanzan para cumplir la condición de compra: ${cw.lead}, así que el pedido tendría que ser de ${f(required)} ${pw(required)} y el proveedor solo tiene ${f(have)}. Pregúntale si repondrá existencias o si acepta ${f(have)} ${pw(have)} como pedido; no compres pensando que se cumplirá el mínimo.`,
      `With the ${f(have)} ${pw(have)} available you do cover ${fm(wanted)} ${items}: you'd receive ${fm(covers)} ${items}${covers > wanted ? ` (${fm(covers - wanted)} ${items} extra)` : ""}, assuming ${fm(m.perPack)} ${m.perPack === 1 ? singularOf(items) : items} per ${pw(1)}. But they are not enough to meet the purchase condition: ${cw.lead}, so the order would have to be ${f(required)} ${pw(required)} and the supplier only has ${f(have)}. Ask whether they will restock or accept ${f(have)} ${pw(have)} as the order; don't buy assuming the minimum will be met.`,
    ) + cw.unread + confirm;
  }
  if (have === 0)
    return insert(Lx(" Pero el proveedor no tiene existencias disponibles: pregúntale cuándo repone o busca otra opción.", " But the supplier has no stock available: ask when they will restock, or look for another option."));
  // not even the quantity is covered: the calculation stays, with what is missing
  // stock written in units ("200 pares") is compared as written, not only in whole packs
  const per = (u: string) => (PAIR_W.test(u) ? 2 : DOZ_W.test(u) ? 12 : 1);
  const wp = s.word ? packOf(s.word) : undefined;
  const rawUnits =
    other && !m.kit && !m.measure && (!wp || /^(?:par|docena)$/.test(wp[1]))
      ? (s.n * per(s.word)) / (m.unit === "pair" ? 2 : m.unit === "dozen" ? 12 : 1)
      : m.chain && m.chain.loose && wp === m.chain.inner
        ? s.n * m.chain.innerPer // loose inner packs may be bought: 20 cajas = 480 piezas
        : covers;
  const short = Math.max(0, (m.wanted || unitsIn(required)) - Math.min(rawUnits, m.wanted || Infinity));
  const altOk = m.alt && m.alt.packs <= have
    ? Lx(` Con la otra lectura (${f(m.alt.packs)} ${pw(m.alt.packs)}) sí alcanzarían.`, ` With the other reading (${f(m.alt.packs)} ${pw(m.alt.packs)}) they would be enough.`)
    : "";
  return insert(
    Lx(
      ` Pero el proveedor solo tiene ${stockTxt}: no alcanzan${short > 0 ? `, te faltarían ${fm(short)} ${items}` : ""}. Pregúntale cuándo repone existencias o busca otra opción.${altOk}`,
      ` But the supplier only has ${stockTxt}: not enough${short > 0 ? `, ${fm(short)} ${items} short` : ""}. Ask when they will restock, or look for another option.${altOk}`,
    ),
  );
}

/** Mixed sets inside bigger packs ("10 sets por caja"): boxes first, what they hold after. */
function kitOuterReply(m: PackMath): string {
  const k = m.kit!;
  const o = m.outer!;
  const f = (n: number) => n.toLocaleString("en-US");
  const sw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const ow = (n: number) => (n === 1 ? Lx(o.pack[1], o.pack[3]) : Lx(o.pack[2], o.pack[4]));
  const count = (noun: string, n: number) => `${f(n)} ${n === 1 ? singularOf(noun) : pluralOf(noun)}`;
  const comp = joinList(k.parts.map((p) => count(p.noun, p.n)));
  const totals = (sets: number) => joinList(k.parts.map((p) => count(p.noun, p.n * sets)));
  const S = o.count * o.per;
  const p = k.parts[k.target];
  const extraSets = S - m.packs;
  const loose = !o.whole && extraSets > 0
    ? Lx(` Si el proveedor vendiera ${m.pack[2]} sueltos, bastarían ${f(m.packs)} ${sw(m.packs)} (${totals(m.packs)}); confírmalo.`, ` If the supplier sold loose ${m.pack[4]}, ${f(m.packs)} ${sw(m.packs)} would do (${totals(m.packs)}); confirm it.`)
    : "";
  return Lx(
    `Para ${count(p.noun, m.wanted)} necesitarías ${f(o.count)} ${ow(o.count)} de ${f(o.per)} ${sw(o.per)} = ${f(S)} ${sw(S)}, suponiendo que cada ${sw(1)} trae ${comp}. En total recibirías ${totals(S)}${extraSets > 0 ? ` (${f(extraSets)} ${sw(extraSets)} más de ${Lx("los", "the")} ${f(m.packs)} que cubren tu pedido)` : ""}.${loose} Confirma con el proveedor el contenido real de cada ${sw(1)} y su pedido mínimo.`,
    `For ${count(p.noun, m.wanted)} you'd need ${f(o.count)} ${ow(o.count)} of ${f(o.per)} ${sw(o.per)} = ${f(S)} ${sw(S)}, assuming each ${sw(1)} holds ${comp}. In total you'd receive ${totals(S)}${extraSets > 0 ? ` (${f(extraSets)} ${sw(extraSets)} more than the ${f(m.packs)} that cover your order)` : ""}.${loose} Confirm the real content of each ${sw(1)} and the minimum order with the supplier.`,
  );
}

function packMathReply(m: PackMath): string {
  if (m.capTotal) {
    const c = m.capTotal;
    const base = packMathReply({ ...m, capTotal: undefined });
    const f = (n: number) => n.toLocaleString("en-US");
    const items = tw(m.item) || Lx("piezas", "pieces");
    const over = c.strict ? m.total >= c.limit : m.total > c.limit;
    const note = m.mode !== "packs" && m.mode !== "check"
      ? ""
      : over
        ? Lx(` Ojo: así recibirías ${f(m.total)} ${items}, ${c.strict ? "y pediste menos de" : "más del límite de"} ${f(c.limit)}: revisa la cantidad o la condición con el proveedor.`, ` Note: that way you'd receive ${f(m.total)} ${items}, and you asked for ${c.strict ? "fewer than" : "no more than"} ${f(c.limit)}: check the quantity or the condition with the supplier.`)
        : Lx(` Eso queda dentro de tu límite de ${f(c.limit)} ${items}.`, ` That stays within your limit of ${f(c.limit)} ${items}.`);
    const at = base.search(/ Confirma con el proveedor el contenido real| Confirm the real content/);
    return at >= 0 ? base.slice(0, at) + note + base.slice(at) : base + note;
  }
  if (m.invalid) return invalidReply(m);
  // the stock is said on top of whatever the order is (nested, kit, weight…)
  if (m.stock) return stockReply(m);
  if (m.chain) return chainReply(m);
  if (m.kit && m.outer && m.mode === "packs") return kitOuterReply(m);
  if (m.outer) {
    // the outer packs are said before the closing reminder
    const base = packMathReply({ ...m, outer: undefined });
    const at = base.search(/ Confirma con el proveedor el contenido real| Confirm the real content/);
    return at >= 0 ? base.slice(0, at) + outerNote(m) + base.slice(at) : base + outerNote(m);
  }
  if (m.invalid) return invalidReply(m);
  if (m.measure) return measureReply(m);
  if (m.kit) return kitReply(m);
  // an item written in singular ("1 pieza") reads in plural for other counts
  const plural = (w: string) => (w === "unidad" ? "unidades" : /^(?:pieza|piece|botella|bottle|taza|cup)$/.test(w) || (/[aeo]$/.test(w) && singularOf(w) === w) ? `${w}s` : w);
  const items = tw(m.item ? plural(m.item) : "") || Lx("piezas", "pieces");
  // "0 cajas de 12": the arithmetic, then what an order of 0 means
  if (m.zeroOrder)
    return Lx(
      `0 ${m.pack[2]} × ${m.perPack.toLocaleString("en-US")} ${items} por ${m.pack[1]} = 0 ${items}. Un pedido de 0 ${m.pack[2]} no es una compra: si quieres hacer un pedido, indica una cantidad mayor que cero.`,
      `0 ${m.pack[4]} × ${m.perPack.toLocaleString("en-US")} ${items} per ${m.pack[3]} = 0 ${items}. An order of 0 ${m.pack[4]} is not a purchase: if you want to order, enter a quantity above zero.`,
    );
  if (m.mode === "ask" && m.zero)
    return Lx(
      `${/a$/.test(m.pack[1]) ? "Una" : "Un"} ${m.pack[1]} con 0 ${m.item || "piezas"} no permite calcular: ¿qué cantidad de ${m.item || "piezas"} trae en realidad cada ${m.pack[1]}? Escríbeme un número mayor que cero${m.wanted ? "" : " y la cantidad total que necesitas"}.`,
      `A ${m.pack[3]} holding 0 ${m.item || "pieces"} can't be calculated: how many ${m.item || "pieces"} does each ${m.pack[3]} actually hold? Send me a number above zero${m.wanted ? "" : " and the total quantity you need"}.`,
    );
  if (m.mode === "ask") {
    const pw2 = Lx(m.pack[2], m.pack[4]);
    const noun = m.conv?.perWord || "";
    const what = m.unit === "pair"
      ? Lx(`¿cuántos pares o ${cuant(noun || "piezas")} ${noun || "piezas"} individuales trae cada ${m.pack[1]}?`, `how many pairs, or how many single ${noun || "pieces"}, does each ${m.pack[3]} hold?`)
      : Lx(`¿cuánt${/as$/.test(items) ? "as" : "os"} ${items} trae cada ${m.pack[1]}?`, `how many ${items} does each ${m.pack[3]} hold?`);
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
    if (whole === 0) return "";
    const rest = n - whole * cu;
    const wWord = whole === 1 ? singularOf(cuWord) : cuWord;
    const g = /as$/.test(items) ? "a" : "o";
    return rest
      ? Lx(` (${whole.toLocaleString("en-US")} ${wWord} y ${rest} ${rest === 1 ? one : items} suelt${g}${rest === 1 ? "" : "s"})`, ` (${whole.toLocaleString("en-US")} ${wWord} and ${rest} loose ${rest === 1 ? one : items})`)
      : ` (${whole.toLocaleString("en-US")} ${wWord})`;
  };
  const nn = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? one : items}${inClientUnit(n)}`;
  const pw = (n: number) => (n === 1 ? Lx(m.pack[1], m.pack[3]) : Lx(m.pack[2], m.pack[4]));
  const f = (n: number) => n.toLocaleString("en-US");
  const confirm = Lx(
    " Confirma con el proveedor el contenido real y su pedido mínimo.",
    " Confirm the real content and minimum order with the supplier.",
  );
  // a ceiling ("menos de 500"): the most whole packs within it, and the other reading
  if (m.atMost && m.mode === "packs") {
    const k = m.atMost.packs;
    const minP = m.atMost.minP || 0;
    const lotP = m.atMost.lotP || 1;
    // the ceiling and the supplier's conditions can't both hold
    if ((minP || lotP > 1) && (k < minP || k <= 0))
      return Lx(
        `Para recibir ${m.atMost.strict ? "menos de" : "no más de"} ${nn(m.atMost.limit)} lo máximo serían ${f(Math.floor((m.atMost.limit - (m.atMost.strict ? 1 : 0)) / m.perPack))} ${pw(2)}, pero ${minP ? `el mínimo del proveedor es ${f(minP)} ${pw(minP)} (${nn(minP * m.perPack)})` : `el proveedor solo vende en múltiplos de ${f(lotP)} ${pw(lotP)}`}: no se pueden cumplir las dos cosas. Revisa con el proveedor si acepta menos o ajusta tu límite.`,
        `To receive ${m.atMost.strict ? "fewer than" : "no more than"} ${nn(m.atMost.limit)} the most would be ${f(Math.floor((m.atMost.limit - (m.atMost.strict ? 1 : 0)) / m.perPack))} ${pw(2)}, but ${minP ? `the supplier's minimum is ${f(minP)} ${pw(minP)} (${nn(minP * m.perPack)})` : `the supplier only sells in multiples of ${f(lotP)} ${pw(lotP)}`}: both can't hold. Check whether the supplier accepts less, or adjust your limit.`,
      ) + confirm;
    const meets = [
      minP ? Lx(`el mínimo de ${f(minP)} ${pw(minP)}`, `the minimum of ${f(minP)} ${pw(minP)}`) : "",
      lotP > 1 ? Lx(`los múltiplos de ${f(lotP)} ${pw(lotP)}`, `the multiples of ${f(lotP)} ${pw(lotP)}`) : "",
    ].filter(Boolean);
    const meetsTxt = meets.length ? Lx(` Ese pedido cumple ${joinList(meets)}.`, ` That order meets ${joinList(meets)}.`) : "";
    const lim = Lx(m.atMost.strict ? `menos de ${nn(m.atMost.limit)}` : `no más de ${nn(m.atMost.limit)}`, m.atMost.strict ? `fewer than ${nn(m.atMost.limit)}` : `no more than ${nn(m.atMost.limit)}`);
    const within = k > 0
      ? Lx(`Para recibir ${lim}, lo máximo son ${f(k)} ${pw(k)} = ${nn(k * m.perPack)}`, `To receive ${lim}, the most is ${f(k)} ${pw(k)} = ${nn(k * m.perPack)}`)
      : Lx(`Con ${pw(1)} de ${f(m.perPack)} no se puede recibir ${lim}: una sola ${pw(1)} ya trae ${nn(m.perPack)}`, `With ${pw(2)} of ${f(m.perPack)} you can't receive ${lim}: a single ${pw(1)} already holds ${nn(m.perPack)}`);
    // the other reading (a need, not a ceiling) only without the supplier's conditions
    const other = m.packs !== k && !meets.length
      ? Lx(` Si en realidad necesitas al menos ${nn(m.atMost.limit)}, serían ${f(m.packs)} ${pw(m.packs)} = ${nn(m.total)}.`, ` If you actually need at least ${nn(m.atMost.limit)}, it would be ${f(m.packs)} ${pw(m.packs)} = ${nn(m.total)}.`)
      : "";
    return Lx(`${within}, suponiendo ${f(m.perPack)} ${items} por ${pw(1)}.`, `${within}, assuming ${f(m.perPack)} ${items} per ${pw(1)}.`) + meetsTxt + other + confirm;
  }
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
          ` Supone que ${/as$/.test(items) ? "las" : "los"} ${items} individuales forman pares completos y compatibles (lado, talla y modelo); confírmalo con el proveedor.`,
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
    ) + cw.met + cw.unread + pairNote + confirm;
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
  const one = (packMath(q) || bareMath(q))!;
  if (packPhrases(q) >= 2 && !one.nested && !one.invalid && !one.outer && !one.chain)
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
  const t = forMath(text).toLowerCase();
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

/** A complete order written without a question ("300 und. / 25 und. por bulto", "1000 pzs / 36 x caja"). */
function bareMath(text: string): PackMath | null {
  text = forMath(text);
  if (packPhrases(text) < 1 || (normalizeNumbers(String(text || "").toLowerCase()).match(/\d+/g) || []).length < 2) return null;
  const m = packMath(text, true);
  return m && m.mode === "packs" && !m.invalid ? m : null;
}

// ── Someone who wants to move forward goes to SEAL first ─────────────────────
// "Quiero contratar", "hablar con alguien", "tengo proforma", "mi carga ya viene"
// (and "ya tengo proveedor") are answered with contact to SEAL before anything
// else: they don't need a supplier search or general guidance.
export type ContactIntent = "contratar" | "hablar_persona" | "proforma" | "documentos" | "carga_en_camino" | "ya_tiene_proveedor";
// most specific first: cargo already moving, then papers in hand, then asking for a person
const INTENTS: [ContactIntent, RegExp][] = [
  ["carga_en_camino", /\bmi\s+(?:carga|mercader[ií]a|pedido|contenedor|embarque|env[ií]o|importaci[oó]n)\s+(?:ya\s+)?(?:viene|vienen|est[aá]\s+en\s+camino|sali[oó]|ya\s+sali[oó]|fue\s+embarcad[oa]|est[aá]\s+embarcad[oa]|est[aá]\s+(?:por\s+llegar|llegando|en\s+tr[aá]nsito)|va\s+a\s+llegar|lleg[aóo]|arriba|ya\s+est[aá]\s+en\s+(?:el\s+)?puerto)|\b(?:la\s+|el\s+)?(?:carga|mercader[ií]a|contenedor|embarque)\s+(?:ya\s+)?(?:viene|sali[oó]|est[aá]\s+en\s+camino|llega|arriba|lleg[oó])\b|\bya\s+(?:compr[eé]|pagu[eé]|embarc[oó]|embarcaron|viene\s+en\s+camino)(?![a-záéíóúñ])|\bmy\s+(?:cargo|shipment|order|container|goods)\s+(?:is\s+|has\s+|will\s+)?(?:already\s+)?(?:on\s+(?:its|the)\s+way|coming|shipped|arriving|arrives?|in\s+transit|left)|\bi\s+already\s+(?:bought|paid|shipped)\b/],
  ["proforma", /\b(?:tengo|tenemos|ya\s+tengo|me\s+(?:enviaron|mandaron|dieron|pas[oó])|recib[ií](?:mos)?)\s+(?:una\s+|la\s+|mi\s+|el\s+)?(?:factura\s+)?(?:pro-?\s?forma|pi)\b|\bpro-?\s?forma\s+(?:del?|de\s+mi)\s+proveedor|\b(?:i|we)\s+(?:already\s+)?(?:have|got|received)\s+(?:a\s+|the\s+|my\s+|our\s+)?(?:proforma|pro-forma|pi)\b|\bproforma\s+invoice\b|\brevis(?:i[oó]n|ar|e|en|ion)\s+(?:de\s+)?(?:la\s+|mi\s+|una\s+|el\s+|nuestra\s+)?(?:factura\s+)?pro-?\s?forma\b|\bpro-?\s?forma\s+(?:para\s+)?(?:que\s+)?(?:la\s+)?revis|\breview\s+(?:of\s+)?(?:my|the|our|a)\s+(?:proforma|pro-forma|pi)\b/],
  ["documentos", /\b(?:ya\s+)?(?:tengo|tenemos|cuento\s+con)\s+(?:(?:los|mis|todos\s+los|el|la)\s+)?(?:documentos|papeles|bl\b|b\/l|conocimiento\s+de\s+embarque|factura\s+comercial|lista\s+de\s+empaque|packing\s+list|gu[ií]a\s+a[eé]rea|certificado\s+de\s+origen)|\bi\s+(?:already\s+)?have\s+(?:the\s+|my\s+|all\s+the\s+)?(?:documents|paperwork|bill\s+of\s+lading|commercial\s+invoice|packing\s+list)\b/],
  ["hablar_persona", /\bhablar\s+con\s+(?:alguien|una\s+persona|un\s+humano|un[ao]?\s+(?:asesor|asesora|ejecutiv[oa]|agente|vendedor[a]?)|seal|ustedes|ventas|el\s+equipo)|\b(?:comunicarme|contactarme|contactar|contactarlos)\s+con\s+(?:alguien|seal|ustedes|un[ao]?\s+(?:asesor|asesora|ejecutiv[oa])|ventas)|\bque\s+me\s+(?:llamen|contacten|llame|contacte|escriban|asesoren|atiendan)\b|\b(?:ll[aá]m[ae]nme|cont[aá]ct[ae]nme|ll[aá]mame|cont[aá]ctame)\b|\b(?:un[ao]?\s+)?(?:ejecutiv[oa]|asesor[a]?|agente|alguien|persona)\s+(?:de\s+seal\s+)?(?:revise|revisen|atienda|me\s+atienda|me\s+contacte|me\s+llame|me\s+ayude|vea)\b|\bque\s+(?:seal|ustedes)\s+(?:revise|revisen|me\s+(?:contacte|contacten|llame|llamen|ayude|ayuden|atienda|atiendan))\b|\brevis(?:e|en|ar)\s+mi\s+caso\b|\b(?:talk|speak)\s+(?:to|with)\s+(?:someone|somebody|a\s+person|a\s+human|an?\s+(?:agent|advisor|rep(?:resentative)?)|sales|seal|your\s+team)\b|\b(?:someone|an?\s+(?:agent|executive|advisor))\s+(?:from\s+seal\s+)?(?:to\s+)?(?:review|check|look\s+at)\s+my\s+(?:case|shipment|cargo)\b|\b(?:call|contact)\s+me\b/],
  ["contratar", /\b(?:quiero|quisiera|deseo|queremos|quisi[eé]ramos|me\s+interesa|nos\s+interesa|c[oó]mo|d[oó]nde|puedo|podemos|necesito|necesitamos)\s+(?:\w+\s+)?contrat(?:ar|arlos|arles|arte|arlo)\b|\bcontrat(?:ar|arlos|arles)\s+(?:a\s+)?(?:seal|ustedes|sus\s+servicios|el\s+servicio)|\b(?:i\s+want\s+to|i'?d\s+like\s+to|how\s+(?:do|can)\s+i|can\s+i|we\s+want\s+to)\s+hire\b|\bhire\s+(?:you|seal|your\s+services)\b/],
  ["ya_tiene_proveedor", /\bya\s+tengo\s+(?:mi\s+|un\s+|el\s+)?proveedor|\btengo\s+(?:mi\s+)?propio\s+proveedor|\bya\s+tenemos\s+(?:nuestro\s+|un\s+)?proveedor|\bno\s+(?:necesito|necesitamos|quiero|busco|buscamos|buscar)\s+(?:buscar\s+)?(?:otros?\s+|un\s+|m[aá]s\s+)?proveedor(?:es)?\b|\bi\s+(?:already\s+)?have\s+(?:a|my\s+own|my)\s+supplier\b|\bi\s+don'?t\s+need\s+(?:to\s+(?:search|look)\s+for\s+)?(?:a\s+|another\s+)?suppliers?\b/],
];
// "todavía no quiero contratar", "aún no tengo proforma": a negation right before the
// phrase cancels THAT phrase only ("…y no necesito buscar proveedores" cancels nothing else)
const NEG_BEFORE = /(?:\bno|\btodav[ií]a\s+no|\ba[uú]n\s+no|\bnot\s+yet|\bdon'?t|\bdo\s+not|\bnunca)\s+(?:[a-záéíóúñ]+\s+){0,2}$/;
export function contactIntent(text: string): ContactIntent | "" {
  const t = ` ${String(text || "").toLowerCase()} `;
  for (const [k, re] of INTENTS) {
    const g = new RegExp(re.source, "g");
    for (let m = g.exec(t); m; m = g.exec(t)) {
      // "no necesito buscar proveedores" is itself the signal: the client doesn't need a search
      if (k === "ya_tiene_proveedor" && /^\s*(?:no|i\s+don)/.test(m[0])) return k;
      if (!NEG_BEFORE.test(t.slice(Math.max(0, m.index - 30), m.index))) return k;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return "";
}

/** "Llega mañana", "hoy", "urgente": the client needs attention soon. */
export function urgentContact(text: string): boolean {
  return /\burgen(?:te|cia)\b|\burge\b|\bhoy(?:\s+mismo)?\b|\bma[ñn]ana\b|\bcuanto\s+antes\b|\blo\s+antes\s+posible\b|\besta\s+semana\b|\basap\b|\burgent(?:ly)?\b|\btoday\b|\btomorrow\b|\bthis\s+week\b/i.test(String(text || ""));
}

function contactReply(text: string): string {
  const k = contactIntent(text);
  const open: Record<ContactIntent, [string, string]> = {
    proforma: ["Con una proforma, lo mejor es que SEAL la revise directamente; no necesitas buscar proveedores aquí.", "With a proforma, the best step is for SEAL to review it directly; you don't need to search for suppliers here."],
    documentos: ["Si ya tienes los documentos, lo mejor es que un ejecutivo de SEAL revise tu caso directamente; no necesitas buscar proveedores aquí.", "If you already have the documents, the best step is for a SEAL executive to review your case directly; you don't need to search for suppliers here."],
    carga_en_camino: ["Si tu carga ya viene en camino, SEAL te atiende directamente para la llegada y el despacho; no necesitas buscar proveedores aquí.", "If your cargo is already on its way, SEAL handles its arrival and customs clearance directly; you don't need to search for suppliers here."],
    contratar: ["Perfecto, te conecto con SEAL.", "Great, I'll connect you with SEAL."],
    hablar_persona: ["Claro, te conecto con un ejecutivo de SEAL.", "Sure, I'll connect you with a SEAL executive."],
    ya_tiene_proveedor: ["Si ya tienes proveedor, no necesitas buscar otro aquí: SEAL puede cotizarte la importación con ese proveedor.", "If you already have a supplier, you don't need to search for another here: SEAL can quote the import with that supplier."],
  };
  const [es, en] = k ? open[k] : open.hablar_persona;
  // urgent: say how to flag it, without promising a response time or a customs outcome
  const urgent = urgentContact(text)
    ? Lx(
        " Como es urgente, escribe en tu caso la fecha de llegada y qué documentos tienes. No puedo garantizarte desde aquí un tiempo de atención ni el resultado del despacho; para algo que no puede esperar, el WhatsApp de SEAL +502 5996 4664 es la vía más directa.",
        " Since it's urgent, write the arrival date and which documents you have in your case. I can't guarantee a response time or the customs outcome from here; for something that can't wait, SEAL's WhatsApp +502 5996 4664 is the most direct channel.",
      )
    : Lx(" Si prefieres, escribe al WhatsApp de SEAL +502 5996 4664.", " If you prefer, message SEAL on WhatsApp +502 5996 4664.");
  return Lx(
    `${es} Usa «Enviar mi caso a SEAL» aquí abajo: le llega a SEAL con lo que me contaste y te damos un número de caso.${urgent}`,
    `${en} Use "Send my case to SEAL" below: SEAL receives it with what you told me and you get a case number.${urgent}`,
  );
}

/** "¿Ya llegó mi solicitud?", "¿recibieron mi caso?", "did you get my request?" */
export function requestStatusQuestion(text: string): boolean {
  const t = ` ${String(text || "").toLowerCase()} `;
  const thing = "(?:solicitud|caso|mensaje|consulta|formulario|petici[oó]n|cotizaci[oó]n|datos)";
  return (
    new RegExp(`\\b(?:ya\\s+)?(?:(?:me|nos|les?)\\s+)?(?:lleg[oó]|recibi(?:eron|ó|o|mos)|recibieron|se\\s+envi[oó]|qued[oó]\\s+(?:registrad|enviad)\\w*|est[aá]\\s+(?:registrad|enviad)\\w*|fue\\s+(?:recibid|enviad)\\w*)\\s+(?:ya\\s+)?(?:mi|la|el|nuestra|nuestro)\\s+${thing}`).test(t) ||
    new RegExp(`\\b(?:mi|la|el|nuestra|nuestro)\\s+${thing}\\s+(?:ya\\s+)?(?:lleg[oó]|fue\\s+(?:recibid|enviad)\\w*|se\\s+envi[oó]|qued[oó]\\s+(?:registrad|enviad)\\w*|est[aá]\\s+(?:registrad|enviad)\\w*)`).test(t) ||
    /\b(?:did|have)\s+you\s+(?:get|got|receive|received)\s+my\s+(?:request|case|message|form)|\bhas\s+my\s+(?:request|case|message)\s+(?:arrived|been\s+(?:received|sent))|\bwas\s+my\s+(?:request|case|message)\s+(?:received|sent)|\bdid\s+my\s+(?:request|case|message)\s+(?:arrive|go\s+through)/.test(t)
  );
}

function requestStatusReply(sentCase?: string): string {
  return sentCase
    ? Lx(
        `Sí: tu solicitud quedó registrada con el número de caso ${sentCase}. En la confirmación tienes el enlace para ver lo que recibió SEAL y el estado de tu caso.`,
        `Yes: your request was registered with case number ${sentCase}. The confirmation has the link to see what SEAL received and your case status.`,
      )
    : Lx(
        "Todavía no: aún debes completar y enviar el formulario «Enviar mi caso a SEAL» aquí abajo. Al enviarlo recibirás la confirmación con tu número de caso.",
        "Not yet: you still need to fill in and send the \"Send my case to SEAL\" form below. Once you send it, you'll get the confirmation with your case number.",
      );
}

// ── Product subtotal: "2,000 guantes a US$0.03 cada uno" → US$60 ─────────────
// Only the product value with the price the client gives (not a quote, not the landed cost).
const SUB_RE = /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+)\s+([a-záéíóúüñ]+(?:\s+de\s+[a-záéíóúüñ]+)?)\s+(?:a|at|@|por|for)\s+(us\$\s*|usd\s*|\$\s*)?(\d+(?:[.,]\d+)?)\s*(us\$|usd|d[oó]lares?|dollars?)?\s*(cada\s+(?:un[oa]|pieza|unidad|par|kilo|metro)|c\/u|por\s+(?:unidad|pieza|par|kilo|metro)|la\s+(?:unidad|pieza)|el\s+(?:par|kilo|metro)|each|apiece|per\s+(?:unit|piece|pair))?/i;
export function productSubtotal(text: string): { qty: number; word: string; price: number; total: number } | null {
  const raw = explain(String(text || "")).text.toLowerCase();
  const m = raw.match(SUB_RE);
  if (m) {
    const [, q, word, cur1, p, cur2, per] = m;
    // a price needs a currency or "cada uno / c/u / per unit"; "a 25 por caja" is pack content
    if ((cur1 || cur2 || per) && !(/^(?:cajas?|paquetes?|sets?|bolsas?|boxes|packs?)$/.test(word.split(/\s+/)[0]) && !per)) {
      const qty = Number(q.replace(/[.,](?=\d{3}(?:\D|$))/g, ""));
      const price = Number(p.replace(",", "."));
      if (qty > 0 && price > 0 && qty <= 1e9) return { qty, word: word.trim(), price, total: Math.round(qty * price * 100) / 100 };
    }
  }
  // "2,000 guantes; el precio es US$0.03 por unidad; presupuesto US$50": a quantity, a unit price
  // and a question about the total or the budget, in any order
  if (!/subtotal|total|cu[aá]nto|alcanza|falta|sobra|enough|short|how\s+much/.test(raw)) return null;
  const q = normalizeNumbers(raw.replace(/(?:us\$|usd|\$|q\.?)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usd|d[oó]lares?|dollars?|quetzales?)/g, " ")).match(/\b(\d+)\s+([a-záéíóúüñ]+(?:\s+de\s+[a-záéíóúüñ]+)?)/);
  if (!q || NOT_ITEM.test(q[2].split(/\s+/)[0]) || new RegExp(`^${PACK_RE}$`).test(q[2].split(/\s+/)[0])) return null;
  const money = readMoney(raw, q[2]);
  if (!money.price || money.price.basis !== "unit") return null;
  const qty = Number(q[1]);
  const price = money.price.e4 / 10000;
  if (!(qty > 0) || qty > 1e9) return null;
  return { qty, word: q[2].trim(), price, total: Math.round(qty * money.price.e4 / 100) / 100 };
}
function subtotalReply(text: string): string {
  const s = productSubtotal(text)!;
  const ex = explain(text);
  const money = readMoney(ex.text, s.word);
  if (ex.assumedUsd && money.price) money.assumedUsd = true;
  // the arithmetic is exact (ten-thousandths), the price basis is the unit unless said otherwise
  if (!money.price) money.price = { e4: Math.round(s.price * 10000), cur: "USD", raw: `US$${s.price}`, basis: "unit" };
  if (!money.price.basis) money.price.basis = "unit";
  const pairs = money.price.basis === "pair" && /^pares?\b|^pairs?\b/.test(s.word) ? s.qty : undefined;
  const counts: OrderCounts = { pieces: pairs !== undefined ? s.qty * 2 : s.qty, pairs, item: s.word };
  const lines = moneyLines(money, counts).trim();
  return lines + Lx(" Si quieres, el formulario te da esa estimación completa.", " If you want, the form gives you that full estimate.");
}

/** The counts a price can apply to, from a calculated order (null when the order still needs data). */
function countsOf(m: PackMath): OrderCounts | null {
  if (m.invalid || m.mode === "ask" || m.zero || m.zeroOrder) return null;
  const packs = m.mode === "packs" ? m.packs : m.cond?.need && m.cond.need > m.packs ? m.cond.need : m.packs;
  const pieces = m.kit || m.measure ? -1 : packs * m.perPack * (m.unit === "pair" ? 2 : m.unit === "dozen" ? 12 : 1);
  return {
    packs,
    packWord: m.pack,
    innerPacks: m.chain ? { word: m.chain.inner, count: packs * m.chain.k } : undefined,
    pieces,
    pairs: m.unit === "pair" ? packs * m.perPack : undefined,
    item: tw(m.item) || Lx("piezas", "pieces"),
    stockShort: !!m.stock && Number.isFinite(m.stock.packs) && m.stock.packs < packs,
  };
}

/** The product value of a calculated order (price, subtotal, budget), or "" with no money in the message. */
function mathMoney(q: string): string {
  const t = forMath(q);
  const all = packMathAll(t);
  const m = all.length >= 2 ? null : packMath(t) || bareMath(t);
  const ex = explain(q);
  const money = readMoney(ex.text, m?.item || "");
  if (ex.assumedUsd && money.price) money.assumedUsd = true;
  if (!money.price && !money.budget && !money.conflict) return "";
  if (all.length >= 2)
    return Lx(
      " Para el subtotal de varios pedidos, escríbeme el precio de cada uno por separado (y si es por unidad o por empaque).",
      " For the subtotal of several orders, write the price of each one separately (and whether it is per unit or per pack).",
    );
  const c = m ? countsOf(m) : null;
  if (!c) return "";
  return moneyLines(money, c);
}

export function replyKinds(text: string): string[] {
  // "¿ya llegó mi solicitud?" is answered on its own (it is not a new request)
  if (requestStatusQuestion(text)) return ["requestStatus"];
  // "1 par = 3 zapatos": confirm the equivalence before any calculation
  const ex = explain(text);
  if (ex.odd) return ["equivalence"];
  text = ex.text;
  const kinds = baseKinds(text);
  if (!contactIntent(text)) return kinds;
  // contact first; "ya tengo proveedor" is not a question about the supplier's reliability
  const reliability = /confiable|reliable|\breal\b|estafa|fraude|scam|verific|legit/i.test(text);
  return ["contact", ...kinds.filter((k) => k !== "general" && k !== "mathUnclear" && (k !== "supplier" || reliability))];
}

function baseKinds(text: string): string[] {
  // a product subtotal is answered, not sent to the general reply
  // (a pack calculation in the same message wins: its quantities are the ones that count)
  const inner = baseKindsInner(text);
  if (productSubtotal(text) && !inner.includes("math")) return ["subtotal", ...inner.filter((k) => !["mathUnclear", "cost", "general"].includes(k))];
  return inner;
}

function baseKindsInner(text: string): string[] {
  const t = text.toLowerCase();
  const kinds: string[] = [];
  // a question about whether single pieces make pairs is answered on its own
  if (pairDoubt(text)) return ["pairs"];
  // a calculation is answered, and so is anything else the message asks
  // how many boxes fit in a container is a question of volume, not of counting
  if (/contenedor|container/.test(t) && /cab[ea]n?|caber|entran?|meter|fit|cu[aá]nt[oa]s\s+(?:cajas|bultos|tarimas)\s+(?:son|hay|caben)|how\s+many\s+(?:boxes|cartons|pallets)/.test(t)) return ["container"];
  const isMath = !!(packMathAll(text).length || packMath(text) || bareMath(text));
  if (/certificad|certificaci|certificate|certification|\bce\b|\bfda\b|\biso\b|\bul\b|\brohs\b|\bsgs\b|grado alimenticio|food[- ]grade|apto para alimentos|suitable for food/.test(t)) kinds.push("certificate");
  // in a calculation, "mi proveedor exige un mínimo" is context, not a question about the supplier
  if ((isMath ? /confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit|seguro\s+el\s+proveedor/ : /proveedor|supplier|seller|vendedor|f[aá]brica|factory|confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit/).test(t)) kinds.push("supplier");
  // "Guarantee" goes to customs authorization only when the question is about the import itself
  const customsCtx = /importaci|aduana|autoriz|permiso|aprobad|aprobaci|liberaci|despacho|que pase|customs|\bimport(?:ation|s)?\s+(?:dut|permit|licen|tax|clearance|approv)|authoriz|permit|approv/.test(t);
  // "asegurar" alone ("¿puedo asegurar que son 20 pares?") is not about customs
  const guaranteeWord = /garantiz|garant[ií]a de que|sin problema|guarantee/.test(t) || (customsCtx && /asegur/.test(t));
  const permitWord = /permiso|autoriz|licencia|permit|authoriz|license/.test(t);
  if ((customsCtx && (!isMath || guaranteeWord || permitWord)) || (guaranteeWord && !kinds.includes("certificate"))) kinds.push("guarantee");
  if (/\bdai\b|arancel|partida|impuesto|\biva\b|tributo|tariff|duty|duties|\btax/.test(t)) kinds.push("dai");
  if (!/libres?|almacenaje|bodegaje|storage|free\s+days/.test(t) && /cu[aá]nto\s+(?:tiempo|tarda|demora)|cu[aá]ntos\s+d[ií]as|cu[aá]ndo\s+(?:llega|llegar[ií]a|estar[ií]a)|when\s+(?:will\s+it\s+)?arrive|tiempo\s+de\s+(?:tr[aá]nsito|env[ií]o|llegada)|tarda\s+en\s+llegar|how\s+long|transit\s+time|lead\s+time/.test(t)) kinds.push("transit");
  else if (isMath ? /precio|costo|cuest[ae]|cotiz|price|cost|quote|how much/.test(t) : /precio|costo|cu[aá]nto\b|cotiz|price|cost|quote|how much/.test(t)) kinds.push("cost");
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
  container: () =>
    Lx(
      "Cuántas cajas caben en un contenedor depende de las medidas y el peso de cada caja (y de si se pueden estibar), así que no lo calculo aquí sin esos datos. Como referencia, un contenedor de 20 pies tiene unos 33 m³ y uno de 40 pies unos 67 m³, pero la carga útil real es menor. Siguiente paso: en el formulario anota el volumen o el peso de tu carga, o pide a SEAL que lo revise con las medidas de la caja (WhatsApp +502 5996 4664).",
      "How many boxes fit in a container depends on each box's dimensions and weight (and whether they can be stacked), so I don't calculate it here without that data. As a reference, a 20-ft container holds about 33 m³ and a 40-ft one about 67 m³, but the usable load is lower. Next step: enter your cargo's volume or weight in the form, or ask SEAL to check it with the box dimensions (WhatsApp +502 5996 4664).",
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

export interface HeldProposal { quantity?: number; budget?: number; budgetClear?: boolean; attrFix?: { from: string; to: string }; product?: string }
/** Which case and which saved version of it (utils/caseStore). */
export interface CaseVersion { caseId?: string; rev?: number }
/** A proposal waiting for the client's confirmation, kept apart from the history and the case. */
export interface PendingProposal { proposal: HeldProposal; base: CaseVersion }
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
  combined?: string; // the calculation the client split over two messages ("500 piezas" + "vienen 24 por caja")
  sentCase?: string; // case number already sent from this tab (for "¿ya llegó mi solicitud?")
  formUpdate?: boolean; // the client changed the product in the form (said once when back in the chat)
  newQuantity?: number; // "quiero 2000 en vez de 500"
  oldQuantity?: number;
  // data typed for the previous product (form or chat) that no longer applies: asked again
  stale?: { product: string; quantity?: string; budget?: string };
  explicitChange?: boolean; // "cambio el producto a…": a change, not a correction of a misunderstanding
  attrFix?: { from: string; to: string }; // one characteristic corrected, the rest kept
  confirmProduct?: string; // a doubt about the product, asked ("" = which product now?)
  confirmQuantity?: number; // the quantity said with that product ("proforma de 20 secadoras")
  newBudget?: number; // "solo actualiza el presupuesto a US$5,000" (US$)
  oldBudget?: number;
  fieldUpdate?: boolean; // the message changes fields of the case, not the product
  askNumber?: number; // "cambia a 300" with no field named: asked
  askRelative?: { delta: number; from: number; to: number }; // "agrega 2 más": the new total is confirmed
  qtyInvalid?: QuantityIssue["kind"]; // "la cantidad a 3.5", "10,000,001 compresores": explained, not applied
  qtyRaw?: string; // the value as the client wrote it ("3.5")
  // "no cambies nada hasta confirmar": nothing in the message is applied; valid values are only proposed
  hold?: boolean;
  held?: HeldProposal;
  // the case (id and version) a held proposal was made on: confirming it on another state re-asks
  heldBase?: CaseVersion;
  heldStale?: boolean; // "sí" arrived after the case changed: the proposal is asked again, not applied
  forbidden?: CaseField[]; // fields the client said not to change ("do not update the quantity to 8")
  fromMismatch?: { said: number; inCase: number; to: number }; // "de 7 a 8" with 4 in the case
  unsure?: string[]; // a change with a negation, condition, deferral or question not understood: proposed, not applied
  heldApplied?: boolean; // "sí, aplícalo" after a held proposal
  persistFailed?: boolean; // the change could not be saved: nothing was changed
  budgetClear?: boolean; // "quita el presupuesto"
  qtyConflict?: { said: number; inCase: number }; // "la cantidad sigue siendo 5" with 3 in force
  budgetAsk?: boolean; // the budget came in quetzales: the form's budget is in US$
  hypothetical?: boolean; // "¿y si fueran 5?": nothing changes
  // the case after this message (what the reply confirms and the form / SEAL receive)
  caseNow?: { product: string; quantity?: number; budget?: number };
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
/** Every word of `a` (numbers aside) is already in `b`: «compresores de tornillo» ⊂ «compresores industriales de tornillo, 220 V». */
export function subsetOf(a: string, b: string): boolean {
  const A = new Set([...stems(String(a || "").replace(/\d+(?:[.,]\d+)?/g, " "))].filter((w) => !/^(?:total|ahora|tambi|igual|mismo|misma|solo|unica|favor|pedid|canti|unida|tengo|neces|quier)/.test(w)));
  const B = stems(String(b || ""));
  return A.size > 0 && [...A].every((w) => B.has(w));
}
// words that qualify a product, never name it ("industrial", "trifásico", "acero")
const QUALIFIER = /^(?:industr|trifa|monof|bifas|electr|autom|digit|porta|nuevo|nueva|usado|usada|grand|peque|inoxi|plast|metal|acero|madera|vidri|profe|comer|domes|manua|hidra|neuma|marca|model|calid|gener|class|heavy|elect|autom|indus|stain|steel|plast|woode|porta|profe|comme|singl|doubl|doble|simpl|negro|blanc|black|white)/;
/** The noun(s) that name a product: the first and the last content word of its name. */
export function productHeads(x: string): Set<string> {
  const name = productName(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = (name.split(/[^a-z]+/) || []).filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.replace(/(?:es|s)$/, "").slice(0, 5)).filter((w) => !QUALIFIER.test(w));
  const out = new Set<string>();
  if (words[0]) out.add(words[0]);
  if (words.length > 1) out.add(words[words.length - 1]);
  return out;
}
export function sameProduct(a: string, b: string): boolean {
  if (!a || !b) return false;
  // the same product when the nouns that name it match ("molino trifásico" ≠ "compresor trifásico")
  const A = productHeads(a);
  const B = productHeads(b);
  if (A.size && B.size) return [...A].some((w) => B.has(w));
  const S = stems(a);
  return [...stems(b)].some((w) => S.has(w));
}
/** "sí", "correcto", "así es" / "no", "sigue siendo…" after a product question. */
export function confirmAnswer(text: string): "yes" | "no" | "" {
  const t = String(text || "").trim().toLowerCase();
  const end = "(?=$|[\\s,.;:!¡?¿])";
  if (new RegExp(`^(?:s[ií]|correcto|exacto|as[ií]\\s+es|eso\\s+es|claro|afirmativo|yes|yep|correct|right)${end}`).test(t)) return "yes";
  if (new RegExp(`^(?:no|sigue|contin[uú]a|el\\s+mismo|the\\s+same|nope)${end}`).test(t)) return "no";
  return "";
}

// A number followed by a unit ("300 litros", "440 V", "60 Hz") is a characteristic, and one
// after a currency sign ("US$5,000") is money: neither is ever the quantity of the order.
const UNIT_NEXT = /^\s*(?:(?:ml|mililitros?|l|lt|lts|litros?|liters?|litres?|gal|galon(?:es)?|gallons?|kg|kgs|kilos?|kilogramos?|g|gr|grs|gramos?|lb|lbs|libras?|oz|onzas?|t|ton|tons|toneladas?|cm|mm|m|mts?|metros?|pulgadas?|in|inch(?:es)?|ft|pies|w|watts?|vatios?|kw|kva|hp|cv|v|vac|vdc|volts?|voltios|hz|hertz|bar|psi|cfm|rpm|mah|ah|gb|tb|m3|cbm|grados?|d[oó]lares|dollars|usd|quetzales?|gtq|centavos|cents)(?![a-záéíóúñ0-9])|[%°"³]|\s*x\s*\d|[.,]\d)/i;
const CURRENCY_BEFORE = /(?:us\$|usd|\$|\bq\.?|quetzales?|gtq)\s*$/i;
// The tail of a decimal ("3.5" → "5") or a negative sign ("-1") is never a plain number on its own:
// `\b(\d+)` stops at the point, so without this "3.5 compresores" was read as 5 compresores.
// (also the exponent of "5e2", "1e+3" or "10^3": the "2" is not a quantity and neither is the "5")
const PART_OF_NUMBER_BEFORE = /(?:\d[.,]|[-−]\s?|\de[+-]?|\^\s?|\*\*\s?)$/;
// "5e2", "5 ^ 2", "5**2": a number written in a notation that is not a plain amount
const NOTATION_AFTER = /^(?:e[+-]?\d|\s*(?:\^|\*\*)\s*\d|\s*[x×*]\s*10\s*(?:\^|\*\*))/i;
const plainAt = (t: string, at: number, len: number) => !UNIT_NEXT.test(t.slice(at + len)) && !NOTATION_AFTER.test(t.slice(at + len)) && !CURRENCY_BEFORE.test(t.slice(Math.max(0, at - 6), at)) && !PART_OF_NUMBER_BEFORE.test(t.slice(Math.max(0, at - 3), at));
/** A number in scientific / exponent notation ("5e2", "1.2e3", "10^3", "5x10^2"): never read as an amount, always asked. */
const NOTATION_NUMBER = /(?<![a-záéíóúüñ\d.,])(\d+(?:[.,]\d+)?\s*(?:e[+-]?\d+|(?:\^|\*\*)\s*[+-]?\d+|[x×*·]\s*10\s*(?:(?:\^|\*\*)\s*[+-]?\d+|[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)|[⁰¹²³⁴⁵⁶⁷⁸⁹]+))(?![a-záéíóúüñ\d])/i;

/** Order quantity limits (the form uses the same: whole number from 1 to 10,000,000). */
export const QTY_MIN = 1;
export const QTY_MAX = 10_000_000;
export const validQuantity = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= QTY_MIN && n <= QTY_MAX;

/**
 * "No cambies nada hasta confirmar…", "don't change anything yet": an explicit instruction not to
 * modify the case. It blocks every change in that message (the values are only proposed).
 * "no cambies el presupuesto" (keep one field, change another) is NOT a hold: see KEEP_REST.
 */
export const HOLD =
  /\b(?:no\s+(?:lo\s+|la\s+|los\s+|las\s+|le\s+)?(?:cambies|cambie|modifiques|modifique|actualices|actualice|guardes|guarde|apliques|aplique)\b[^.;]{0,30}?\bhasta\s+(?:que|confirm|saber|verificar|revisar)|no\s+(?:(?:lo|la|los|las|le)\s+)?(?:cambies|cambie|modifiques|modifique|actualices|actualice|guardes|guarde|toques|toque|apliques|aplique|registres|registre)\s+(?:nada(?!\s+m[aá]s)|todav[ií]a|a[uú]n|ning[uú]n\s+dato|hasta)|no\s+hagas\s+(?:ning[uú]n\s+)?cambios?|sin\s+(?:cambiar|modificar|guardar|aplicar)\s+nada(?!\s+m[aá]s)|todav[ií]a\s+no\s+(?:cambies|modifiques|actualices|guardes|apliques)|(?:don'?t|do\s+not)\s+(?:change|modify|update|save|touch|apply)\s+(?:anything(?!\s+else)|it\s+yet|yet|until)|(?:don'?t|do\s+not)\s+(?:change|modify|update|save|apply)\s+[a-z\s]{0,20}\buntil\b|no\s+changes?\s+(?:yet|until))/i;

/**
 * "Cambia la cantidad a 7, pero pídeme confirmación antes", "ask me before changing it": the client
 * wants the change PROPOSED, not applied. The message leaves a pending proposal; nothing is written.
 */
export const CONFIRM_FIRST =
  /(?:\bp(?:[ií]de|ed[ií])(?:me|nos)\s+(?:(?:una|la|tu)\s+)?(?:confirmaci[oó]n|autorizaci[oó]n|aprobaci[oó]n|permiso)|\bp(?:[ií]de|ed[ií])me\s+que\s+(?:te\s+)?(?:lo\s+)?(?:confirme|autorice|apruebe)|\bpreg[uú]nta(?:me|nos)\s+(?:antes|primero)|\bconsult(?:a|á|e)(?:me|lo\s+conmigo)\s+(?:antes|primero)|\bconf[ií]rm(?:a|á)(?:me|lo\s+conmigo)\s+(?:antes|primero)|\bantes\s+(?:conf[ií]rm(?:a|á)me|preg[uú]ntame|cons[uú]ltame|p(?:[ií]de|ed[ií])me)|\bantes\s+de\s+(?:cambiar|aplicar|actualizar|guardar|modificar|hacer)\w*\b[^.;]{0,30}\b(?:p(?:[ií]de|ed[ií])me|preg[uú]ntame|conf[ií]rm(?:a|á)me|cons[uú]ltame)|\bespera\s+(?:a\s+)?(?:que\s+(?:te\s+)?(?:lo\s+)?(?:confirme|autorice|apruebe)|mi\s+(?:confirmaci|autorizaci|aprobaci|visto\s+bueno))|\bno\b[^.;]{0,40}\bsin\s+(?:mi\s+(?:confirmaci[oó]n|autorizaci[oó]n|aprobaci[oó]n|visto\s+bueno|permiso)|preguntarme|consultarme|que\s+(?:yo\s+)?(?:lo\s+)?confirme)\b|\b(?:hasta|cuando)\s+que?\s*(?:te\s+)?(?:lo\s+)?(?:confirme|autorice|apruebe)|\bcon\s+mi\s+(?:confirmaci[oó]n|autorizaci[oó]n|aprobaci[oó]n)|\bsolo\s+(?:prop[oó]n|sugi[eé]r)\w*|\bask\s+me\s+(?:first|before)|\bcheck\s+with\s+me\s+(?:first|before)|\bconfirm\s+with\s+me|\b(?:wait|hold)\s+(?:for|until)\s+(?:my|i)\s+(?:confirm|approv|ok|say)|\b(?:don'?t|do\s+not|never)\b[^.;]{0,40}\bwithout\s+(?:my\s+(?:confirmation|approval|ok)|asking\s+me)|\b(?:only\s+)?after\s+i\s+(?:confirm|approve)|\b(?:first|before\s+(?:that|changing|applying|updating)),?\s+(?:ask|check\s+with)\s+me|\blet\s+me\s+confirm\s+(?:first|before)|\bneeds?\s+my\s+(?:confirmation|approval)|\bjust\s+(?:propose|suggest))/i;

/** The fields of the case a message can change. */
export type CaseField = "quantity" | "budget" | "product" | "spec";
const FIELD_WORDS: [CaseField, RegExp][] = [
  ["quantity", /\b(?:cantidad|cantidades|quantity|quantities|unidades|units|piezas|pieces|n[uú]mero\s+de\s+(?:unidades|equipos|piezas)|number\s+of\s+units)\b/],
  ["budget", /\b(?:presupuesto|budget|monto|amount)\b/],
  ["product", /\b(?:producto|product|art[ií]culo|item)\b/],
  ["spec", /\b(?:tanque|tank|voltaje|voltage|capacidad|capacity|especificaci\w*|specs?|specifications?|caracter[ií]stica\w*|litros|liters|litres|frecuencia|frequency|potencia|power|material|modelo|model|tama[ñn]o|size|medida\w*)\b|\d+\s*(?:v|hz|l|litros|kg|hp|kw)\b/],
];
/**
 * Explicit prohibitions: "Do not update the quantity to 8", "no cambies la cantidad a 8",
 * "no quiero que toques el presupuesto", "mantén la cantidad". A negated change verb forbids
 * changing the field(s) it names; with nothing named (or "nada", "anything") it forbids every
 * change. "no cambies nada más" / "nothing else" only keeps the OTHER fields (not a prohibition
 * of the change the message asks for).
 */
export function prohibitions(text: string): { all: boolean; fields: Set<CaseField>; spans: string[]; specWords: string[] } {
  const t = ` ${normalizeNumbers(String(text || "").toLowerCase()).replace(/[¿?¡!]/g, " ")} `;
  const out = { all: false, fields: new Set<CaseField>(), spans: [] as string[], specWords: [] as string[] };
  const VERB = "(?:cambi\\w*|actualiz\\w*|actualic\\w*|modific\\w*|modifiqu\\w*|pong\\w*|pon|toqu\\w*|toc(?:ar|ando|a|á)\\b|ajust\\w*|apliqu\\w*|guard\\w*|registr\\w*|edit\\w*|alter\\w*|reemplac\\w*|sustitu\\w*|corrij\\w*|sub(?:as|a|an)|baj(?:es|e|en)|aument\\w*|reduzc\\w*|reduc\\w*|change|update|modify|set|touch|alter|edit|apply|save|increase|decrease|raise|lower|replace|switch|put)";
  const NEG = `(?:\\b(?:no|nunca|jam[aá]s)\\s+(?:(?:me|te|se|lo|la|los|las|le|les)\\s+)?(?:(?:vayas|vaya|vas)\\s+a\\s+|(?:debes|debe|hace\\s+falta)\\s+|quiero\\s+que\\s+(?:(?:me|lo|la|le)\\s+)?|(?:es\\s+necesario|hay\\s+que)\\s+)?|\\b(?:do\\s+not|don'?t|dont|never|please\\s+don'?t)\\s+(?:(?:want|need)\\s+(?:you\\s+)?to\\s+)?|\\bsin\\s+|\\bwithout\\s+)`;
  const re = new RegExp(`${NEG}(${VERB})\\b([^.;:]{0,70})`, "g");
  for (const m of t.matchAll(re)) {
    const lead = m[0].slice(0, m[0].indexOf(m[1]));
    // "sin cambiar el resto" / "without changing anything else": keeps the others, forbids nothing named
    if (/^\s*(?:sin|without)\b/.test(lead) && !/(?:ar|er|ir|ing)$/.test(m[1])) continue;
    // the object ends where another instruction starts ("…, pero cambia el presupuesto")
    const obj = m[2].split(/\b(?:pero|but|sino|y\s+(?:s[ií]\s+)?(?:cambi|actualiz|pon|ajust|modific)\w*|and\s+(?:do\s+)?(?:change|update|set|make)|,\s*(?:cambi|actualiz|pon|ajust|modific|change|update|set)\w*)\b/)[0];
    if (/\b(?:nada\s+m[aá]s|ning[uú]n\s+otro|ninguna\s+otra|lo\s+dem[aá]s|el\s+resto|las?\s+dem[aá]s|los\s+dem[aá]s|anything\s+else|nothing\s+else|the\s+rest|other\s+(?:fields|data|values))\b/.test(obj)) {
      out.spans.push(m[0].slice(0, m[0].length - m[2].length) + obj);
      continue;
    }
    out.spans.push(m[0].slice(0, m[0].length - m[2].length) + obj);
    const sw = obj.match(FIELD_WORDS[3][1]);
    if (sw) out.specWords.push(sw[0]);
    let named = FIELD_WORDS.filter(([, w]) => w.test(obj)).map(([f]) => f);
    // "la cantidad no cambia", "the budget doesn't change": the field is named before the verb
    if (!named.length) {
      const pre = t.slice(Math.max(0, (m.index ?? 0) - 70), m.index ?? 0).split(/[,.;:]|\b(?:y|e|pero|and|but)\b/).pop() || "";
      named = FIELD_WORDS.filter(([, w]) => w.test(pre)).map(([f]) => f);
    }
    if (/\b(?:nada|todo|todav[ií]a|a[uú]n|anything|everything|nothing|yet|ning[uú]n\s+dato)\b/.test(obj) || !named.length) out.all = true;
    for (const f of named) out.fields.add(f);
  }
  // elliptical: "…pero no el voltaje", "…y no el presupuesto", "…, el voltaje no", "but not the budget"
  for (const m of t.matchAll(/\b(?:pero|y|but|and)\s+(?:no|not)\s+(?:el|la|los|las|the|mi|my)\s+([a-záéíóúñ]+)\b|,\s*(?:el|la|los|las|the)\s+([a-záéíóúñ]+)\s+no\b(?!\s+[a-záéíóúñ\d])/g)) {
    const w = m[1] || m[2];
    for (const [f, re] of FIELD_WORDS)
      if (re.test(w)) {
        out.fields.add(f);
        out.spans.push(m[0]);
        if (f === "spec") out.specWords.push(w);
      }
  }
  // "mantén la cantidad", "keep the budget", "deja igual el producto": that field stays
  for (const m of t.matchAll(/\b(?:mant[eé]n(?:ga|gan)?|mantengamos|conserv(?:a|á|e|en)|keep|leave)\s+(?:igual\s+)?(?:la|el|los|las|the|mi|my)?\s*([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/g))
    for (const [f, w] of FIELD_WORDS)
      if (w.test(m[1])) {
        out.fields.add(f);
        out.spans.push(m[0]);
        if (f === "spec") out.specWords.push(m[1]);
      }
  for (const m of t.matchAll(/\bdej(?:a|á|e|en)\s+(?:igual\s+)?(?:la|el|the)\s+([a-záéíóúñ]+)\s+(?:igual|como\s+est[aá]|as\s+is)/g))
    for (const [f, w] of FIELD_WORDS)
      if (w.test(m[1])) {
        out.fields.add(f);
        out.spans.push(m[0]);
        if (f === "spec") out.specWords.push(m[1]);
      }
  return out;
}

/**
 * Whether a forbidden characteristic is the one a correction changes: "no cambies el voltaje" forbids
 * 220 V → 440 V but not the tank 500 → 300 L. A generic word ("especificaciones", "material",
 * "modelo") forbids every characteristic.
 */
export function specForbidden(words: string[], fix: { from: string; to: string }): boolean {
  const both = `${fix.from} ${fix.to}`.toLowerCase();
  const KINDS: [RegExp, RegExp][] = [
    [/volt|\bv\b|\d\s*v\b|vac|vdc/, /\d\s*(?:v|vac|vdc|volts?|voltios)\b/],
    [/tanque|tank|capacidad|capacity|litro|liter|litre|\d\s*l\b/, /\d\s*(?:l|lt|lts|litros?|liters?|litres?|gal|galones?)\b/],
    [/frecuencia|frequency|hz|hertz/, /\d\s*(?:hz|hertz)\b/],
    [/potencia|power|hp|kw|watt/, /\d\s*(?:hp|kw|w|watts?)\b/],
    [/tama[ñn]o|size|medida/, /\d\s*(?:cm|mm|m|pulgadas?|in)\b/],
  ];
  for (const w of words) {
    const kind = KINDS.find(([k]) => k.test(w));
    if (!kind) return true; // generic: every characteristic
    if (kind[1].test(both)) return true;
  }
  return false;
}

/**
 * Words that make a requested change uncertain — a negation, a condition, a deferral or a question —
 * left over after the parts this parser understands are removed (a recognized prohibition, "no
 * cambies nada más", "en vez de", "son 4, no 3", "si es posible", "¿puedes cambiar…?"). When any is
 * left, a change is never applied: it is proposed and the client confirms it ("sí, aplícalo").
 * General by design: the list of phrasings people use is open, so what is not understood is asked.
 */
/** "si es posible", "si podés", "if possible", "por favor": politeness, not a condition. */
export const POLITE = /\b(?:si\s+(?:es\s+posible|se\s+puede|puedes|pod[eé]s|puede|pueden|no\s+es\s+molestia|me\s+haces\s+el\s+favor)|if\s+(?:possible|you\s+can|you\s+could)|por\s+favor|please|porfa|gracias|thanks?)\b/g;
export function uncertainMarkers(text: string, resolvedSpans: string[] = [], hints: string[] = []): string[] {
  let t = ` ${normalizeNumbers(String(text || "").toLowerCase())} `;
  for (const sp of resolvedSpans) if (sp.trim()) t = t.split(sp).join(" ");
  // "¿puedes cambiar la cantidad a 6?": a polite request, not a question about a hypothesis
  // (only when a change verb follows: "puede que sean 8" and "podrían ser 8" are doubts, not requests)
  const polite = /^\s*[¿]?\s*(?:(?:me|nos)\s+)?(?:(?:puede[sn]?|pod[eé]s|podr[ií]a[sn]?|podr[ií]amos|me\s+ayud\w*\s+a|can\s+you|could\s+you|would\s+you|will\s+you|can\s+we)\s+(?:(?:please|por\s+favor|me|nos)\s+)?(?=(?:cambi|pon|actualiz|ajust|sub|baj|modific|dej|corrig|change|set|update|make|adjust|increase|lower|raise|put)\w*)|cambi[aá]s\b|pon[eé]s\b|actualiz[aá]s\b|sub[ií]s\b|baj[aá]s\b|ajust[aá]s\b)/;
  // "No, la cantidad es 7": a leading "No," answers the previous reply; tag questions ", ¿ok?"
  t = t.replace(/^\s*no\s*[,.:;!]+/, " ").replace(/[,\s]*¿?\s*(?:ok|okay|va|vale|dale)\s*\?\s*$/, " ");
  if (polite.test(t)) t = t.replace(polite, " ").replace(/^([^?]*)\?/, "$1 ");
  t = t
    .replace(POLITE, " ")
    // understood shapes: keep the rest, replacements, "son 4, no 3", "without asking me", "sin presupuesto"
    .replace(/\b(?:no\s+(?:(?:lo|la)\s+)?(?:cambies|cambi[eé]s|cambie|modifiques|modifiqu[eé]s|toques|toqu[eé]s)\s+nada\s+m[aá]s|sin\s+(?:cambiar|modificar|tocar)\s+nada\s+m[aá]s|(?:lo\s+dem[aá]s|el\s+resto)\s+(?:no\s+cambia|igual|se\s+mantiene|sigue\s+igual)|nothing\s+else|(?:don'?t|do\s+not)\s+change\s+anything\s+else)\b/g, " ")
    .replace(/\b(?:en\s+vez\s+de|en\s+lugar\s+de|instead\s+of|rather\s+than)\b/g, " ")
    .replace(/(\d[\w\s]{0,30}?)[,;]?\s*(?:y\s+)?(?:no|not)\s+(?:de\s+|a\s+|en\s+)?(\d+)/g, (m, a, n) => (hints.some((h) => h && h.replace(/,/g, "") === n) ? m : `${a} `))
    // the rejected OLD value: "no son 4 sino 7", "not 4, 7 units", "ya no quiero 4, quiero 7", "ya no es 5000, es 6000"
    .replace(new RegExp(`\\b(?:ya\\s+no|no|not)\\s+(?:(?:es|son|era|eran|quiero|serán|ser[aá]n|a|de|en|is|are|was|were|it'?s)\\s+){0,2}(?:us\\$|\\$)?([\\d.,]+)\\b`, "g"), (m, n) => (hints.some((h) => h && h.replace(/,/g, "") === String(n).replace(/[.,]/g, "")) ? m : " "))
    // "no sin antes preguntarme", "no hasta que confirme": a deferral written with a negation
    .replace(/\bno\s+(?:sin\s+)?(?=(?:antes|hasta|todav[ií]a|a[uú]n)\b)/g, " ")
    .replace(/\bno\s+necesit\w*\s+m[aá]s\b|\bno\s+(?:hay\s+)?(?:prisa|apuro)\b|\bno\s+rush\b|\bsin\s+prisa\b|\bcuando\s+(?:puedas|pod[aá]s|tengas\s+tiempo)\b|\bwhen\s+you\s+(?:can|get\s+a\s+chance)\b/g, " ")
    // a correction of what it is NOT followed by what it IS ("no es un molino sino…", "ya no son molinos. Ahora…")
    .replace(/\b(?:ya\s+no|no|not|no\s+longer)\b(?=[^.;]{0,70}?(?:\bsino\b|\bahora\b|\bnow\b|\bbut\b|,\s*(?:es|son|it'?s|they'?re)\b))/g, " ")
    .replace(/\b(?:ya\s+no|no\s+longer)\s+(?:es|son|era|eran|quiero|is|are)\b/g, " ")
    // what the product is NOT ("no son guantes ni molinos"): read by negatedProducts, not a condition
    .replace(/\b(?:no|not)\s+(?:es|son|era|eran|is|are|was|were)\s+(?:(?:un|una|unos|unas|el|la|los|las|a|an|the)\s+)?[a-záéíóúüñ]{3,}(?:\s+(?:ni|nor|or|o)\s+(?:(?:un|una|unos|unas|el|la|los|las|a|an|the)\s+)?[a-záéíóúüñ]{3,})*/g, " ")
    .replace(/\b(?:sin|without)\s+(?:preguntarme|consultarme|asking(?:\s+me)?|checking\s+with\s+me)\b/g, " ")
    .replace(/\b(?:sin\s+presupuesto|no\s+tengo\s+presupuesto|no\s+budget)\b/g, " ")
    .replace(/\bantes\s+(?:era|eran|ten[ií]a|ten[ií]amos|dec[ií]a)\b(?=[^.;]{0,40}?\b(?:ahora|now)\b)/g, " ")
    .replace(/\b(?:mant[eé]n\w*\s+)?(?:todo|lo\s+dem[aá]s|el\s+resto)\s+igual\b/g, " ")
    .replace(/^\s*(?:s[ií]|ok|okay|yes|claro|bueno|dale)\b[,.]?/, " ");
  const found: string[] = [];
  // an emoji other than thanks / OK / a smile (🤔, 😅, 🤷, 😬…) expresses doubt or irony: asked
  const emojis = String(text || "").match(/\p{Extended_Pictographic}/gu) || [];
  if (emojis.some((e) => !/^(?:🙏|👍|👌|✅|🙂|😊|😀|😃|☺|🤝|💪|🚀|📦|🇬🇹)$/u.test(e))) found.push("condition:emoji");
  const NEG = /\b(?:no|ni|nunca|jam[aá]s|nada\s+de|evit\w*|not|never|avoid\w*|don'?t|doesn'?t|without|sin)\b/;
  const DEFER = /\b(?:antes|primero|todav[ií]a|a[uú]n|luego|despu[eé]s|m[aá]s\s+tarde|hasta|esper\w*|avis\w*|confirm\w*|aprob\w*|aprueb\w*|autoriz\w*|consult\w*|pregunt\w*|pending|once|after|before|first|later|wait\w*|let\s+me|check\s+with|until|unless|a\s+menos)\b/;
  const COND = /\b(?:si|cuando|when|supuestamente|aparentemente|presuntamente|te[oó]ricamente|en\s+teor[ií]a|apparently|supposedly|allegedly|in\s+theory|seg[uú]n|according\s+to|says|dice|dicen|dijo|dijeron|said|told|verdad|right|ayer|antier|anteayer|yesterday|hace\s+\w+\s+(?:d[ií]as|semanas|meses|a[ñn]os)|ago|ojal[aá](?![a-z])|(?:importar|comprar|traer|pedir|cambiar|subir|bajar|dejar|necesitar|preferir|mandar|enviar|actualizar|modificar|ajustar|gustar|querr|tendr|har|pondr|convendr|saldr|vendr)[ií]a(?:mos|n|s)?|a\s+lo\s+mejor|puede\s+que|podr[ií]a[sn]?|deber[ií]a[sn]?|habr[ií]a|tentativ\w*|tentative\w*|pr[oó]xim\w*|next|siguiente|que\s+viene|antes\s+eran|tenía|ten[ií]amos|fueron|fue|pasad\w*|anterior\w*|last|otro\s+cliente|otra\s+empresa|another|mi\s+(?:socio|socia|cliente|jefe|jefa|hermano|hermana|amigo|amiga|proveedor|esposa|esposo|pap[aá]|mam[aá])|un\s+(?:amigo|conocido|cliente)|una\s+amiga|my\s+(?:partner|boss|client|brother|sister|friend|supplier|wife|husband)|a\s+friend|someone|alguien|ma[ñn]ana|m[aá]s\s+adelante|el\s+otro\s+a[ñn]o|el\s+a[ñn]o\s+que\s+viene|en\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)|next\s+(?:year|month|week)|tomorrow|later|tambi[eé]n|adem[aá]s|also|as\s+well|too|additionally|imagin\w*|digamos|sup[oó]n\w*|supong\w*|en\s+caso|pensando|pienso|conviene|ser[ií]a|ser[ií]an|let'?s\s+say|hypothetic\w*|suppose|imagine|in\s+case|if|would|maybe|perhaps|quiz[aá]s?|tal\s+vez|capaz|probablemente|posiblemente|probably|possibly|creo|creemos|creer[ií]a|calculo|could(?!\s+you)|might|may\s+be|i\s+think|i\s+guess|not\s+sure|no\s+s[eé])(?![a-záéíóúüñ])|\?/;
  const INTERROG = /\b(?:cu[aá]nt\w*|qu[eé]|c[oó]mo|cu[aá]l\w*|d[oó]nde|cu[aá]ndo|qui[eé]n\w*|how|what|which|where|when|who)\b/;
  // a deferral anywhere refers to the change ("Cambia la cantidad a 7. Primero confirmame.")
  const d = t.match(DEFER);
  if (d) found.push(`deferral:${d[0].trim()}`);
  // a negation or a condition counts in the sentence that carries the change, or in a short
  // sentence of its own ("No lo hagas.", "¿Te parece?"); a separate full question ("¿cuántas cajas
  // son?") or statement about something else is not about this change
  const sentences = t.split(/(?<=[.!?;:])\s+|\s(?=¿)|\n/).map((x) => x.trim()).filter(Boolean);
  for (const sen of sentences) {
    const words = sen.split(/\s+/).filter((w) => /[a-záéíóúüñ\d]/i.test(w)).length;
    const carries = hints.some((h) => h && sen.includes(h.toLowerCase()));
    const own = words <= 6 && !INTERROG.test(sen) && !carries;
    if (!carries && !own) continue;
    const n = sen.match(NEG);
    if (n) found.push(`negation:${n[0].trim()}`);
    const c = sen.match(COND) || sen.match(/^\W*igual\b/);
    if (c) found.push(`condition:${c[0].trim()}`);
    // cancelling or forgetting the value itself ("olvidate de los 8 compresores", "cancelá lo de 8")
    const x = carries ? sen.match(/\b(?:olvid\w*|cancel\w*|forget|descart\w*|anul\w*|scrap)\b/) : null;
    if (x) found.push(`negation:${x[0].trim()}`);
  }
  return found;
}

/** "el presupuesto es -500", "presupuesto a US$0", "budget 200,000,000": not a valid purchase budget. */
export function budgetIssue(t: string): QuantityIssue | null {
  const s = ` ${t.replace(/[¿?¡!]/g, " ")} `;
  const fm = s.match(new RegExp(`\\b(?:presupuesto|budget)\\b[^.;\\d]{0,35}?(?:us\\$|usd|\\$)?\\s*${NOTATION_NUMBER.source}`, "i"));
  if (fm) return { kind: "budgetFormat", raw: fm[1].replace(/\s+/g, "") };
  const m = s.match(/\b(?:presupuesto|budget)\b[^.;\d−-]{0,35}?(?:us\$|usd|\$|\bq\.?\s?)?\s*((?:[-−]\s?)?(?:us\$|\$)?\s?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const raw = m[1].replace(/\s+/g, "").replace(/^([-−]?)us\$/i, "$1US$");
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (/^[-−]/.test(raw) || !(n > 0)) return { kind: "budgetMin", raw };
  if (n > 100_000_000) return { kind: "budgetMax", raw };
  return null;
}

/** Words that ask for a change ("cambia", "¿puedes actualizar…?", "mejor…", "en vez de", "change"). */
export const CHANGE_REQUEST =
  /\b(?:cambi(?:a|e|á|ar|alo|ala|en)|actualiz(?:a|e|á|ar)|modific(?:a|á|ar)|modifique|corrig(?:e|á|ir)|corrija|corrijo|correcci[oó]n|p[oó]n(?:le|lo|la|er)?|ponga|ajust(?:a|e|á|ar)|sub(?:e|ir)|baj(?:a|ar)|quiero|queremos|necesito|necesitamos|mejor|en\s+vez\s+de|en\s+lugar\s+de|ahora\s+(?:es|son|ser[aá]n?)|ser[aá]n|d[eé]jal[oa]|que\s+sean?|change|update|set|modify|correct|make\s+it|i\s+(?:want|need)|instead\s+of)\b/i;

export interface QuantityIssue { kind: "decimal" | "zero" | "max" | "ambiguous" | "missing" | "format" | "budgetMin" | "budgetMax" | "budgetFormat" | "budgetAmbiguous"; raw: string }
/**
 * A quantity the message gives for the order that is not a valid whole number of units:
 * "3.5 compresores", "la cantidad a 0", "-1 unidades", "10,000,001 compresores",
 * "5 o 6 compresores", "cambia la cantidad a" (no number). Numbers with a unit ("3.5 kg",
 * "220 V") or money ("US$3.5") are characteristics or prices, never the quantity.
 * `t` must already be lowercased and normalized (normalizeNumbers).
 */
export function quantityIssue(t: string, head = ""): QuantityIssue | null {
  const s = ` ${t.replace(/[¿?¡!]/g, " ")} `;
  const stem = head ? head.slice(0, Math.max(4, head.length - 2)) : "";
  const NOUN = `(?:unidades|unidad|units?|piezas?|pieces?|equipos?|m[aá]quinas?${stem ? `|${stem}[a-záéíóúñ]*` : ""})\\b`;
  // ranges and approximations: the client has not decided the number yet
  const amb =
    s.match(new RegExp(`\\b(\\d+(?:[.,]\\d+)?\\s*(?:o|ó|or|/|-|–)\\s*\\d+(?:[.,]\\d+)?)\\s+(?:de\\s+)?${NOUN}`)) ||
    s.match(new RegExp(`\\b((?:entre|between)\\s+\\d+\\s+(?:y|and)\\s+\\d+)\\s+(?:de\\s+)?${NOUN}`)) ||
    s.match(new RegExp(`\\b((?:unos|unas|aproximadamente|aprox\\.?|alrededor\\s+de|m[aá]s\\s+o\\s+menos|cerca\\s+de|about|around|approximately|roughly)\\s+\\d+)\\s+(?:de\\s+)?${NOUN}`)) ||
    s.match(/\b(?:cantidad|quantity)\b[^.;\d]{0,30}?((?:entre|between)\s+\d+\s+(?:y|and)\s+\d+|\d+\s*(?:o|ó|or)\s*\d+|(?:unos|unas|aproximadamente|aprox\.?|alrededor\s+de|about|around|approximately)\s+\d+)/);
  if (amb) return { kind: "ambiguous", raw: amb[1].trim() };
  const cands: string[] = [];
  for (const m of s.matchAll(new RegExp(`(?:^|[^\\d.,])((?:[-−]\\s?|menos\\s+)?\\d+(?:[.,]\\d+)?)\\s+(?:de\\s+)?${NOUN}`, "g"))) cands.push(m[1]);
  const byField = s.match(/\b(?:cantidad|quantity)\b[^.;\d−-]{0,30}?((?:[-−]\s?)?\d+(?:[.,]\d+)?)/);
  if (byField) {
    const at = (byField.index ?? 0) + byField[0].lastIndexOf(byField[1]);
    const after = s.slice(at + byField[1].length);
    if (!UNIT_NEXT.test(after.replace(/^[.,]\d+/, "")) && !CURRENCY_BEFORE.test(s.slice(Math.max(0, at - 6), at))) cands.push(byField[1]);
  }
  // "quiero 3.5 tanques", "serán 10000001;", "cambia a 3.5", "mejor 2.5 en lugar de 4", "agrega 0.5 más":
  // a number right after a word that sets the order (not a size: "quiero 3.5 kg" has a unit)
  const VERB = /(?:\b(?:quiero|queremos|necesito|necesitamos|pido|pedimos|ser[aá]n|ser[aá]\s+de|ser[aá]|comprar[eé]|compraremos|compramos|son|mejor|cambi\w*\s+(?:la\s+cantidad\s+)?(?:a|en|por)|p[oó]n\w*(?:\s+(?:a|en))?|d[eé]ja\w*\s+en|agreg\w*|añad\w*|sum\w*|que\s+sean|i\s+(?:need|want)|we(?:'ll|\s+will)\s+(?:buy|need|order)|make\s+it|buy|order)\s+(?:de\s+|unos\s+|unas\s+)?)((?:[-−]\s?)?\d+(?:[.,]\d+)?)(?![\d])/g;
  for (const m of s.matchAll(VERB)) {
    const at = (m.index ?? 0) + m[0].length;
    const after = s.slice(at);
    if (UNIT_NEXT.test(after) || CURRENCY_BEFORE.test(s.slice(Math.max(0, at - m[1].length - 6), at - m[1].length))) continue;
    if (/^\s*(?:%|x\b|por\s+(?:caja|paquete|ciento))/i.test(after)) continue;
    cands.push(m[1]);
  }
  // "tres compresores y medio", "3 y medio", "three and a half": not a whole number
  const half = s.match(new RegExp(`\\b(\\d+\\s+(?:(?:de\\s+)?${NOUN}\\s+)?(?:y\\s+medi[oa]|and\\s+a\\s+half))`)) || s.match(/\b(\d+\s+(?:1\/2|½|0[.,]5)(?![\d]))(?!\s*(?:kg|l\b|litros|lb|m\b|metros|pulgadas|in\b|"))/);
  if (half) return { kind: "decimal", raw: half[1].trim().replace(/\s0[.,]5$/, " 1/2") };
  for (const raw of cands) {
    const neg = /^(?:[-−]|menos)/.test(raw);
    const num = raw.replace(/^(?:[-−]\s?|menos\s+)/, "");
    if (/[.,]\d/.test(num)) return { kind: "decimal", raw: raw.trim() };
    const n = Number(num);
    if (neg || n < QTY_MIN) return { kind: "zero", raw: raw.trim() };
    if (n > QTY_MAX) return { kind: "max", raw: raw.trim() };
  }
  // "cambia la cantidad a", "update the quantity" with no number at all
  if (!/\d/.test(s) && /\b(?:cambi\w*|actualiz\w*|modific\w*|ajust\w*|pon\w*|change|update|set)\b[^.;]{0,25}\b(?:la\s+cantidad|the\s+quantity)\b(?:\s+(?:a|en|to))?\s*[.;]?\s*$/.test(s.trim() + " ")) return { kind: "missing", raw: "" };
  return null;
}
/**
 * "cambia la cantidad a 5e2", "serán 1e3 unidades", "10^3 compresores": a quantity written in a
 * notation is never read partially (5, 2) nor converted silently (500): it is asked. Must be given
 * the message BEFORE normalizeNumbers (which turns "1e3" into 1000 for calculations).
 */
export function notationIssue(raw: string, head = ""): QuantityIssue | null {
  const s = ` ${String(raw || "").toLowerCase().replace(/[¿?¡!]/g, " ")} `;
  const stem = head ? head.slice(0, Math.max(4, head.length - 2)) : "";
  const NOUN = `(?:unidades|unidad|units?|piezas?|pieces?|equipos?|m[aá]quinas?${stem ? `|${stem}[a-záéíóúñ]*` : ""})\\b`;
  // "cambia la cantidad a 5e2", "serán 1e3 unidades": a notation, never partially read (5 or 2 or 500)
  const notation = s.match(NOTATION_NUMBER);
  if (notation) {
    const before = s.slice(0, notation.index ?? 0);
    const after = s.slice((notation.index ?? 0) + notation[0].length);
    const aboutQty =
      /\b(?:cantidad|quantity|unidades|units|pedido|order)\b/.test(s) ||
      new RegExp(`^\\s*(?:de\\s+)?${NOUN}`).test(after) ||
      /(?:\b(?:quiero|queremos|necesito|necesitamos|pido|ser[aá]n|ser[aá]|son|mejor|cambi\w*(?:\s+\w+){0,3}\s+(?:a|en|por)|p[oó]n\w*(?:\s+(?:a|en))?|d[eé]ja\w*\s+en|que\s+sean|i\s+(?:need|want)|make\s+it|change\s+(?:it\s+)?to|set\s+(?:it\s+)?to|buy|order))\s+$/.test(before);
    if (aboutQty && !/\b(?:presupuesto|budget)\b[^.;\d]{0,35}$/.test(before)) return { kind: "format", raw: notation[1].replace(/\s+/g, "") };
  }
  const bi = budgetIssue(s);
  return bi?.kind === "budgetFormat" ? bi : null;
}
/**
 * The digits a value was read from must be a whole, plain amount. "10 000 001" read as 10, "7-8" or
 * "7 a 8" read as 7, "15/2", "7½", "7+", "7 aprox", "5·10²": the number goes on or is qualified, so
 * reading part of it is never safe — it is asked. ("de 3 a 4" is a change from 3 to 4: allowed.)
 */
export function valueTokenIssue(rawText: string, value: number): QuantityIssue | null {
  if (!(value > 0)) return null;
  const t = ` ${String(rawText || "").toLowerCase()} `;
  const whole = Math.trunc(value);
  const forms = new Set<string>([String(whole), whole.toLocaleString("en-US"), whole.toLocaleString("en-US").replace(/,/g, ".")]);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let seen = false;
  let dirty: string | null = null;
  for (const f of forms) {
    for (const m of t.matchAll(new RegExp(`(?<![\\d.,'’])${esc(f)}(?:\\.\\d{1,2})?(?![\\d])`, "g"))) {
      seen = true;
      const at = m.index ?? 0;
      const before = t.slice(Math.max(0, at - 24), at);
      const after = t.slice(at + m[0].length, at + m[0].length + 40);
      const cont =
        // a bound ("menos de 8", "máximo 8", "hasta 8", "8 o menos", "up to 8") is not an exact quantity
        /(?:menos\s+de|m[aá]s\s+de|m[aá]ximo|m[ií]nimo|hasta|al\s+menos|por\s+lo\s+menos|como\s+mucho|a\s+lo\s+sumo|at\s+(?:most|least)|up\s+to|under|over|more\s+than|less\s+than|fewer\s+than|no\s+m[aá]s\s+de|[~≈<>≤≥])\s*$/.test(before) ||
        /^\s*(?:[a-záéíóúñ]+\s+){0,2}(?:o\s+(?:menos|m[aá]s)|or\s+(?:less|more|fewer)|max\b|m[aá]x\b|como\s+m[aá]ximo|como\s+m[ií]nimo|at\s+(?:most|least)|tops)/.test(after) ||
        // another number right after ("8, 9", "8 9") or a lot/container instead of units ("8 lotes", "2 contenedores")
        /^\s*[,;]?\s+\d/.test(after) ||
        /^\s*(?:lotes?|lots?|contenedores?|containers?|batch(?:es)?|embarques?|env[ií]os?|shipments?|cargas?|loads?|pedidos?|orders?|tarimas?|pallets?|furgones?|camiones?|trucks?)\b/.test(after) ||
        /^(?:\s*[-–~+\/½¼¾·^⁰¹²³⁴⁵⁶⁷⁸⁹]|[.,]\d|\s+\d{3}\b|['’]\d|\s*(?:a|u|o|ó|y|al|to|or)\s+\d|\s*(?:aprox\w*|approx\w*|m[aá]s\s+o\s+menos|o\s+m[aá]s|or\s+(?:more|so)|ish|y\s+pico|y\s+tantos)\b)/.test(after) ||
        (/(?:\d\s*[-–~\/]\s*|\d\s+(?:u|o|ó|or)\s+|\d\s*['’]|\d\s+(?=$))$/.test(before) && !/\b(?:de|from)\s+\d+\s+$/.test(before)) ||
        (/\d\s+(?:a|to)\s+$/.test(before) && !/\b(?:de|from)\s+[\d,.]+\s+(?:a|to)\s+$/.test(before));
      if (!cont) return null; // one clean occurrence: the value is what the client wrote
      dirty = dirty || `${before.match(/[\d\s.,'’\-–~\/]*$/)?.[0] || ""}${m[0]}${after.match(/^[\s\-–~+\/½¼¾·^⁰-⁹\d.,'’]*(?:(?:a|u|o|ó|y|to|or)\s+\d+|aprox\w*|approx\w*)?/)?.[0] || ""}`.trim();
    }
  }
  if (seen && dirty) return { kind: "ambiguous", raw: dirty.replace(/\s+/g, " ").slice(0, 30) };
  // the value is nowhere in the text as written, yet the text has digits ("10'000,001" read as 1):
  // unless it comes from words with a multiplier ("2 mil", "10k", "1.5 millones"), it is asked
  if (!seen && /\d/.test(t) && !/\d\s*(?:mil|k|thousand|mill[oó]n(?:es)?|millions?)\b/.test(t)) {
    const chunk = (t.match(/[\d][\d\s.,'’\-–~\/½¼¾·^⁰-⁹]*\d|\d/g) || []).sort((a, b) => b.length - a.length)[0] || "";
    return { kind: "ambiguous", raw: chunk.trim().slice(0, 30) };
  }
  return null;
}
/** The product name without an instruction tacked on ("bombas, pero confirmame antes", "bombas, ¿conviene?"). */
function productOnly(name: string): string {
  return String(name || "")
    .replace(/[,;:]?\s*[¿?].*$/, "")
    .replace(/[,;:]\s*(?:pero|but|y\s+(?:no|antes|primero|av[ií]sa)|and\s+(?:don'?t|ask|wait))\b.*$/i, "")
    .replace(/\s+(?:pero|but)\s+(?:antes|primero|confirm|preg[uú]nt|av[ií]s|wait|ask|check)\w*.*$/i, "")
    .replace(/[\s,;:.]+$/, "")
    .trim();
}

/**
 * "Applied only when fully understood": the clause that carries each new value must match one of
 * the known shapes of a change, word for word. Anything else in that clause — "o a 8", "mañana",
 * "era broma", "(2 de repuesto)", "o algo así", "mi socio quiere…", a currency other than US$, a
 * price per unit — means the value is not applied and the client is asked to state the change
 * plainly. Sentences that carry no new value are other topics (questions, a proforma, a contact
 * request) and are answered as before; their negations and conditions are checked by
 * uncertainMarkers. General by design: unknown wording is asked, never guessed.
 */
export function fullyUnderstood(text: string, change: { quantity?: number; budget?: number; budgetClear?: boolean; fixTo?: string; fixFrom?: string; product?: string; head?: string; productHead?: string; current?: { quantity?: number; budget?: number } }, resolvedSpans: string[] = []): { ok: boolean; why?: string } {
  let t = ` ${normalizeNumbers(String(text || "").toLowerCase())} `;
  for (const sp of resolvedSpans) if (sp.trim()) t = t.split(sp).join(" ");
  t = t
    .replace(POLITE, " ")
    .replace(/\b(?:hola|buen[oa]s(?:\s+(?:d[ií]as|tardes|noches))?|saludos|gracias|muchas\s+gracias|thanks|thank\s+you|porfa|xfa|please|por\s+favor)\b/g, " ")
    .replace(/\b(?:no\s+(?:(?:lo|la)\s+)?(?:cambies|cambi[eé]s|cambie|modifiques|modifiqu[eé]s|toques|toqu[eé]s)\s+nada\s+m[aá]s|sin\s+(?:cambiar|modificar|tocar)\s+nada\s+m[aá]s|(?:mant[eé]n\w*\s+)?(?:lo\s+dem[aá]s|el\s+resto|todo)\s+(?:igual|no\s+cambia|se\s+mantiene|sigue\s+igual)|nothing\s+else|(?:don'?t|do\s+not)\s+change\s+anything\s+else|no\s+necesit\w*\s+m[aá]s|cuando\s+(?:puedas|pod[aá]s)|no\s+rush|sin\s+prisa)\b/g, " ")
    .replace(/\b(?:sin|without)\s+(?:preguntarme|consultarme|asking(?:\s+me)?|checking\s+with\s+me)\b/g, " ")
    .replace(/[¡!"“”«»()]/g, " ")
    .replace(/\s*:\s*/g, " : ");
  // a polite request opening: "¿puedes cambiar…?", "can you set…", "¿me cambiás…?"
  t = t.replace(/(^|[.?!;¿]\s*)(?:(?:me|nos)\s+)?(?:puede[sn]?|pod[eé]s|podr[ií]a[sn]?|can\s+you|could\s+you|would\s+you|will\s+you)\s+(?:(?:me|nos)\s+)?(?=(?:cambi|pon|actualiz|ajust|sub|baj|modific|dej|corrig|change|set|update|make|adjust|increase|lower|raise|put)\w*)/g, "$1 ");
  t = t.replace(/(^|[.?!;¿]\s*)(?:me|nos)\s+(?=(?:cambi[aá]s|pon[eé]s|actualiz[aá]s|sub[ií]s|baj[aá]s|ajust[aá]s)\b)/g, "$1 ");
  t = t.replace(/[,\s]*¿?\s*(?:ok|okay|va|vale|dale)\s*\?\s*$/, " ");
  const sentences = t.split(/(?:(?<!\d)\.|\.(?!\d)|[!?;\n])+|¿/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const num = (n: number) => String(n).replace(".", "\\.");
  const stem = change.head ? change.head.slice(0, Math.max(4, change.head.length - 2)) : "";
  const W = "[a-záéíóúüñ]";
  const PRE = "(?:(?:corrijo|correcci[oó]n|perd[oó]n|disculpa|ok|okay|bueno|entonces|mejor|en\\s+realidad|realmente|actually|sorry|so|no|s[ií]|ahora|now|solo|s[oó]lo|[uú]nicamente|only|just|please|con|with)\\s*[:,]?\\s*)*";
  // ONLY orders (imperative, tú / vos / usted, or the infinitive): "cambiaría", "cambié", "cambiaron",
  // "subiría" describe, wonder or report — they are not a request to change the case
  const CL = "(?:lo|la|le|los|las|les|me|nos|melo|mela)?";
  // verbs that SET a value, and verbs that MOVE it ("sube", "reduce", "increase"): a moving verb sets
  // a value only with "a"/"to" ("sube el presupuesto a 7000"); "sube 3 unidades", "aumenta el
  // presupuesto en 2000" are increments — asked, never saved as the new total
  const SETV = `(?:(?:c[aá]mbi|actualiz|actualic|actual[ií]z|modific|modifiqu|modif[ií]c|ajust|aj[uú]st|d[eé]j)(?:a|á|e|en|ar|í|ir|ás|as|és|es|ís)${CL}|p(?:[oó]n|on[eé]s?|[oó]ng(?:a|an)|oner)${CL}|corr(?:ige|eg[ií]|ija|ijan|egir|ijo)${CL}|change|set|update|modify|make|adjust|put)(?![a-záéíóúüñ])`;
  const RELV = `(?:(?:aument|aum[eé]nt|b[aá]j|s[uú]b)(?:a|á|e|en|ar|í|ir|ás|as|és|es|ís)${CL}|reduc(?:e|í|ir)${CL}|reduzc(?:a|an)|increase|decrease|lower|raise|bump)(?![a-záéíóúüñ])(?=.*\\s(?:a|to)\\s+(?:us\\s?\\$|usd|\\$)?\\s*\\d)`;
  const VERB = `(?:${SETV}|${RELV})(?:\\s+(?:[uú]nicamente|solo|s[oó]lo|only|just))?`;
  const UNIT = `(?:unidades|unidad|units?|piezas?|pieces?|equipos?|m[aá]quinas?|pcs${stem ? `|${stem}[a-záéíóúñ]*` : ""})`;
  const FQ = "(?:(?:(?:la|the)\\s+)?(?:(?:order|requested|purchase|total)\\s+)?(?:cantidad|quantity)(?:\\s+(?:del?\\s+pedido|total|solicitada|requerida|correcta|de\\s+compra|of\\s+the\\s+order|ordered))?|(?:el|mi|the|my)\\s+(?:pedido|orden|order))";
  const FB = "(?:(?:el|mi|un|nuestro|the|my|a|our)\\s+)?(?:(?:purchase|total)\\s+)?(?:presupuesto|budget)(?:\\s+(?:de\\s+compra|total|m[aá]ximo|disponible|for\\s+the\\s+purchase|purchase|of\\s+purchase))?";
  const SET = "(?:a|(?<!(?:sub|baj|aument|reduc|increas|decreas|rais|lower)\\w*\\s(?:\\w+\\s){0,4})en|por|to|es|ser[aá]|sea|son|ser[aá]n|queda|quedar[aá]|pasa\\s+a|sube\\s+a|baja\\s+a|:|=|is|will\\s+be|be|now|should\\s+be)";
  const okClause = (c: string): boolean => {
    const q = change.quantity ? num(change.quantity) : "";
    const N = q ? `${q}` : "\\d+";
    const NQ = `(?:${N})(?:\\s+${UNIT})?`;
    const OLDQ = `\\d+(?:\\s+${UNIT})?`;
    const b = change.budget ? `${Math.trunc(change.budget)}(?:\\.\\d{1,2})?` : "";
    const M = `(?:us\\s?\\$|usd|\\$)?\\s*${b || "\\d+(?:\\.\\d{1,2})?"}\\s*(?:us\\$|usd|d[oó]lares|dollars)?`;
    const OLDM = "(?:us\\s?\\$|usd|\\$)?\\s*\\d+(?:\\.\\d{1,2})?\\s*(?:us\\$|usd|d[oó]lares|dollars)?";
    const VU = "(?!0+(?:[.,]0+)?\\s*[a-z])\\d+(?:[.,]\\d+)?\\s*(?:v|vac|vdc|voltios|volts?|hz|hertz|l|lt|lts|litros?|liters?|litres?|kg|kgs|kilos?|g|gr|gramos?|kw|hp|ml|cm|mm|m|metros?|pulgadas?|in|w|watts?|psi|bar|cfm|rpm|t|ton|toneladas?|gal|galones?)";
    // (a verb in any form is never part of a characteristic's name: "cambiaron el tanque…" is a report)
    const ATTRW = "(?:(?!(?:si|cuando|no|ni|pero|o|u|y|mi|tu|su|otro|otra|ma[ñn]ana|despu[eé]s|luego|tal|quiz[aá]s?|creo|igual|ayer|antier|anteayer|hoy|yesterday|today|hace|ago|seg[uú]n|according|says|dice|dicen|dijo|said|supplier|proveedor|supuestamente|aparentemente|presuntamente|te[oó]ricamente|apparently|supposedly|allegedly)\\b)(?!(?:c[aá]mbi|camb[ií]|actualiz|actualic|modific|ajust|aument|b[aá]j|s[uú]b|d[eé]j|p[oó]n|pus|corrig|corrij|reduj|reduc|change|set|update|modif|adjust|increas|decreas|lower|rais|put)[a-záéíóúñ]*\\s)[a-záéíóúñ]+\\s+)";
    const shapes: RegExp[] = [];
    if (change.quantity) {
      shapes.push(
        new RegExp(`^${PRE}(?:${VERB}\\s+)?${FQ}\\s*(?:(?:de|from)\\s+${OLDQ}\\s+)?(?:${SET}\\s*)?(?:de\\s+)?${NQ}$`),
        new RegExp(`^${PRE}${VERB}(?:\\s+(?:la|lo|el|it|them|le))?(?:\\s+(?:a|en|to))?\\s+${NQ}$`),
        new RegExp(`^${PRE}${SETV}\\s+${NQ}$`),
        new RegExp(`^${PRE}(?:(?:ahora|now|en\\s+total|in\\s+total|que)\\s+)?(?:son|ser[aá]n|sean|quiero|queremos|necesito|necesitamos|ocupo|ocupamos|pido|pedimos|compro|compramos|comprar[eé]|compraremos|vamos\\s+a\\s+(?:pedir|comprar|traer)|traeremos|i\\s+need|we\\s+need|i\\s+want|we\\s+want|i'?ll\\s+(?:buy|take|order)|we'?ll\\s+(?:buy|take|order|need)|it'?s|they'?re|it\\s+will\\s+be|they\\s+will\\s+be|make\\s+it)\\s+(?:de\\s+)?${NQ}$`),
        new RegExp(`^${PRE}${NQ}$`),
        new RegExp(`^${PRE}(?:en\\s+total|in\\s+total|total)\\s*(?::\\s*)?(?:son\\s+|ser[aá]n\\s+)?${NQ}$`),
        // "son 3 compresores de 300 litros": the quantity with characteristics the case already has
        ...(change.product ? [new RegExp(`^${PRE}(?:(?:son|ser[aá]n|quiero|necesito|i\\s+need|i\\s+want)\\s+)?${NQ}\\s+(?:de|of|con|with)\\s+(.+)$`)] : []),
        new RegExp(`^${PRE}(?:${VERB}\\s+)?(?:${FQ}\\s+)?(?:de|from)\\s+${OLDQ}\\s+(?:a|to)\\s+${NQ}$`),
        new RegExp(`^${PRE}(?:(?:quiero|necesito|mejor|son|ser[aá]n|i\\s+want|i\\s+need|make\\s+it|it'?s)\\s+)?${NQ}\\s+(?:en\\s+vez\\s+de|en\\s+lugar\\s+de|instead\\s+of|y\\s+no|no|not)\\s+(?:a\\s+|de\\s+)?${OLDQ}$`),
        new RegExp(`^${PRE}(?:no|not)\\s+(?:son\\s+|es\\s+)?${OLDQ}\\s+(?:sino|but)\\s+(?:que\\s+)?(?:son\\s+)?${NQ}$`),
      );
    }
    if (change.budget) {
      shapes.push(
        new RegExp(`^${PRE}(?:${VERB}\\s+)?${FB}\\s*(?:(?:de|from)\\s+${OLDM}\\s+)?(?:${SET}\\s*)?(?:de\\s+)?${M}$`),
        new RegExp(`^${PRE}${M}\\s+(?:de\\s+|of\\s+)?(?:presupuesto|budget)$`),
        new RegExp(`^${PRE}(?:${VERB}\\s+)?${FB}\\s*(?:${SET}\\s*)?(?:de\\s+)?${M}\\s*,?\\s*(?:en\\s+vez\\s+de|en\\s+lugar\\s+de|instead\\s+of|y\\s+no|no|not)\\s+(?:a\\s+|de\\s+)?${OLDM}$`),
        new RegExp(`^${PRE}${FB}\\s+(?:ya\\s+no|no)\\s+(?:es|ser[aá])\\s+(?:de\\s+)?${OLDM}\\s+(?:sino|,)?\\s*(?:es\\s+|ser[aá]\\s+)?(?:de\\s+)?${M}$`),
      );
    }
    if (change.budgetClear) shapes.push(new RegExp(`^${PRE}(?:(?:quit\\w*|elimin\\w*|borr\\w*|remove|delete|drop)\\s+${FB}|sin\\s+presupuesto|no\\s+tengo\\s+presupuesto|no\\s+budget)$`));
    if (change.fixTo) {
      shapes.push(
        // "son 3 compresores de 300 litros": the same quantity restated with the new characteristic
        new RegExp(`^${PRE}(?:(?:son|ser[aá]n|quiero|necesito|i\\s+need|i\\s+want|they'?re)\\s+)?\\d+\\s+${UNIT}\\s+(?:de|con|of|with)\\s+${VU}$`),
        // "cambia la capacidad a 300", "cambia el voltaje a 380": the characteristic named, value without unit
        new RegExp(`^${PRE}(?:${VERB}\\s+)?(?:(?:el|la|los|las|the|mi|my)\\s+)?${ATTRW}{1,4}(?:(?:de|from)\\s+\\d+(?:[.,]\\d+)?\\s+)?(?:${SET}\\s*)?(?:de\\s+)?(?!0+(?:[.,]0+)?$)\\d+(?:[.,]\\d+)?$`),
        new RegExp(`^${PRE}(?:${VERB}\\s+)?(?:(?:el|la|los|las|the|mi|my)\\s+)?${ATTRW}{0,4}(?:(?:de|from)\\s+${VU}\\s+)?(?:${SET}|de|of)?\\s*(?:de\\s+)?${VU}(?:\\s*,?\\s*(?:no|not|y\\s+no|en\\s+vez\\s+de|en\\s+lugar\\s+de|instead\\s+of)\\s+(?:de\\s+|a\\s+)?(?:${VU}|\\d+))?$`),
        new RegExp(`^${PRE}(?:${VERB}\\s+)?(?:(?:el|la|los|las|the)\\s+)?${ATTRW}{0,4}(?:de|from)\\s+(?:${VU}|\\d+)\\s+(?:a|to)\\s+${VU}$`),
        new RegExp(`^${PRE}(?:no|not)\\s+(?:es\\s+|son\\s+)?(?:de\\s+)?${VU}\\s+(?:sino|but)\\s+(?:de\\s+)?${VU}$`),
      );
    }
    return shapes.some((re) => {
      const m = c.match(re);
      if (!m) return false;
      // the restated characteristics must be ones the case already has
      const tail = m.length > 1 ? m[m.length - 1] : undefined;
      if (tail !== undefined && re.source.includes("(?:de|of|con|with)\\s+(.+)$")) {
        if (!change.product) return false;
        const prod = change.product.toLowerCase();
        const segs = prod.split(/\s*,\s*/);
        const prep = (m[0].match(/\s(de|of|con|with)\s+[^]*$/) || ["", "de"])[1];
        return tail.split(/\s*(?:,|\by\b|\band\b)\s*/).every((x0) => {
          const x = x0.trim().replace(/^(?:de|of|con|with)\s+/, "");
          if (!x) return true;
          const measure = x.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)$/);
          if (measure) return new RegExp(`(?<![\\d.,])${measure[1]}\\s*${measure[2]}\\b`, "i").test(prod);
          // a phrase that ends one of the product's segments, not negated there ("libres de aceite"
          // is not "con aceite"), introduced the same way ("de tornillo")
          return segs.some((sg) => sg.endsWith(`${prep} ${x}`) && !/\b(?:libres?|sin|free|no|non)\s+(?:de\s+)?$/.test(sg.slice(0, sg.length - `${prep} ${x}`.length)));
        });
      }
      return true;
    });
  };
  const valueHints: string[] = [];
  if (change.quantity) valueHints.push(String(change.quantity));
  if (change.budget) valueHints.push(String(Math.trunc(change.budget)));
  if (change.fixTo) valueHints.push((change.fixTo.match(/\d+(?:[.,]\d+)?/) || [""])[0]);
  if (change.budgetClear) valueHints.push("presupuesto", "budget");
  const has = (c: string, h: string) => (/^\d/.test(h) ? new RegExp(`(?<![\\d.,])${h.replace(".", "\\.")}(?![\\d])`).test(c) : c.includes(h));
  if (change.productHead) valueHints.push(change.productHead);
  for (const sen of sentences) {
    if (!valueHints.some((h) => h && has(sen, h))) {
      // another sentence: a separate question is another topic; but one that retracts, replaces or
      // adds a value ("Mentira.", "Ocho.", "Mejor 8", "eso era otro pedido") makes the change unsure
      const question = /\b(?:cu[aá]nt\w*|qu[eé]|c[oó]mo|cu[aá]l\w*|d[oó]nde|cu[aá]ndo|qui[eé]n\w*|how|what|which|where|when|who|puedo|pueden|tienen|hay|necesito\s+(?:algo|alg[uú]n|permiso|registro))\b/.test(sen) && /[?¿]|^(?:cu|qu|c[oó]|d[oó]|how|what|which|where|when|who|puedo|pueden|tienen|hay)/.test(sen);
      const retract = /\b(?:mentira|broma|bromeo|kidding|joke|jk|nah+|nel|ignor\w*|cancel\w*|equivoqu\w*|wrong|mistake|never\s*mind|era\s+otro|es\s+otro|otro\s+pedido|otra\s+cotizaci|no\s+era|scratch\s+that|digo|o\s+sea)\b/.test(sen) || (/^(?:mejor|better|instead|actually|perd[oó]n|sorry)\b/.test(sen) && /\d/.test(sen));
      // numbers in another sentence are fine when they restate the case ("la cantidad sigue siendo 3")
      // or a characteristic the product already has; any other number is a second value
      const nums = sen.match(/\d+(?:\.\d+)?/g) || [];
      const cur = change.current || {};
      const prodL = (change.product || "").toLowerCase();
      const foreign = nums.some((n) => Number(n) !== cur.quantity && Number(n) !== cur.budget && !new RegExp(`(?<![\\d.,])${n.replace(".", "\\.")}\\s*[a-z]`).test(prodL));
      const deferral = /\b(?:antes|primero|todav[ií]a|esper\w*|av[ií]s\w*|confirm\w*|aprob\w*|aprueb\w*|autoriz\w*|consult\w*|pregunt\w*|pending|first|before|wait\w*|approv\w*|until|hasta)\b/.test(sen);
      const words = sen.split(/\s+/).filter((w) => /[a-záéíóúüñ]/.test(w));
      const filler = /^(?:gracias|muchas\s+gracias|thanks|thank\s+you|ok|okay|saludos|listo|perfecto|excelente|bien|bueno|dale|feliz\s+d[ií]a|buen\s+d[ií]a|(?:la\s+)?misma\s+cantidad|(?:el\s+)?mismo\s+presupuesto|lo\s+dem[aá]s\s+igual|todo\s+igual|igual|lo\s+mismo|same(?:\s+(?:quantity|budget))?|the\s+rest\s+(?:stays|the\s+same))$/.test(sen);
      if (!filler && !deferral && (retract || (foreign && !question) || (!question && words.length <= 2 && !/^(?:no|s[ií]|yes)$/.test(sen)))) return { ok: false, why: sen.slice(0, 60) };
      continue;
    }
    // the sentence that states a new product is read by the product parser (productStatement)
    if (change.productHead && has(sen, change.productHead) && !valueHints.some((h) => h && h !== change.productHead && has(sen, h))) continue;
    // clauses: "cambia la cantidad a 6 y el presupuesto a 7000" → two clauses
    const clauses = sen
      .split(/\s*,\s*|\s+(?=(?:con|with)\s+(?:(?:un|mi|el|a|my|the)\s+)?(?:presupuesto|budget)\b)|\s+(?:pero|but)\s+|\s+(?=(?:once|until|after|before|cuando|hasta|antes|primero|despu[eé]s)\b)|\s+(?:y|e|and)\s+(?=(?:no\s+|antes|primero|av[ií]s|esper|confirm|aprob|pending|si\s+|m[aá]nd|env[ií]|dec[ií]|dime|cotiz|send|tell|call|quote)|(?:(?:el|la|los|las|the|mi|my)\s+)?(?:cantidad|quantity|presupuesto|budget|tanque|tank|voltaje|voltage|capacidad|capacity|frecuencia|potencia|\d))/)
      // (a leading "y 7 unidades" in the first clause may mean 7 MORE: kept, so it does not match)
      .map((x, i) => x.trim().replace(i === 0 ? /^(?:(?:pero|but)\s+)+|(?:\s+(?:y|e|and|pero|but|o))+$/g : /^(?:(?:y|e|and|pero|but|o)\s+)+|(?:\s+(?:y|e|and|pero|but|o))+$/g, "").trim())
      .filter(Boolean);
    for (const cl of clauses) {
      // the part that names the new product is read by the product parser
      if (change.productHead && has(cl, change.productHead) && !valueHints.some((h) => h && h !== change.productHead && has(cl, h))) continue;
      const carries = valueHints.some((h) => h && has(cl, h));
      if (carries) {
        if (!okClause(cl)) return { ok: false, why: cl.slice(0, 60) };
      } else if (/\d/.test(cl)) {
        // a second number next to the change ("perdón 8", "por 2"): not understood — except the value
        // being replaced ("no a 7000", "ya no quiero 500 litros") or another characteristic the
        // corrected description already carries ("y la frecuencia a 50 hz")
        const rejectedOld = /^(?:ya\s+no|no|not|y\s+no|en\s+vez\s+de|en\s+lugar\s+de|instead\s+of)\s+(?:(?:quiero|es|son|era|eran|is|are|was)\s+)?(?:de\s+|a\s+)?(?:us\s?\$|\$)?\s*\d+(?:[.,]\d+)?(?:\s*[a-záéíóúñ]+)?$/.test(cl);
        const vu = cl.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)\s*$/);
        const alsoInFix = !!vu && !!change.product && /^(?:(?:el|la|los|las|the)\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2}\s+(?:a|en|to|es|de)\s+\d+(?:[.,]\d+)?\s*[a-z]+$/.test(cl) && change.product.toLowerCase().includes(`${vu[1]} ${vu[2]}`);
        if (!rejectedOld && !alsoInFix) return { ok: false, why: cl.slice(0, 60) };
      } else if (
        !/^(?:no|not|y|and|pero|but|ok|okay|bueno|listo|dale|gracias|perd[oó]n|corrijo|sorry|s[ií]|ahora|now|solo|s[oó]lo|please|(?:el|la|los|las)?\s*(?:dem[aá]s|resto)(?:\s+igual)?)?$/.test(cl) &&
        // a deferral ("pero pídeme confirmación antes") is handled as such by uncertainMarkers
        !/\b(?:antes|primero|todav[ií]a|a[uú]n|esper\w*|av[ií]s\w*|confirm\w*|aprob\w*|aprueb\w*|autoriz\w*|consult\w*|pregunt\w*|pending|once|first|before|wait\w*|approv\w*|until|hasta)\b/.test(cl) &&
        !/^(?:sin|without)\s+(?:preguntarme|consultarme|asking(?:\s+me)?)$/.test(cl) &&
        !/^(?:no\s+)?(?:sin|without)$/.test(cl) &&
        // another request to SEAL in the same message ("y mandame la cotización", "and send me the quote")
        !/^(?:si\s+pod[eé]s\s+|if\s+you\s+can\s+)?(?:m[aá]nd[a-záéíóúñ]*|env[ií][a-záéíóúñ]*|dec[ií]me|dime|d[ií]game|cotiz[a-záéíóúñ]*|ll[aá]m[a-záéíóúñ]*|escrib[a-záéíóúñ]*|quiero\s+hablar|send|tell|call|email|quote)\b[^\d]*$/.test(cl)
      ) {
        // words next to the change that are not part of it ("mañana", "era broma", "o algo así")
        return { ok: false, why: cl.slice(0, 60) };
      }
    }
  }
  return { ok: true };
}

/** A product name that can be used as such (no question, link, joke, alternative or field data attached). */
export function cleanProductName(name: string): boolean {
  const n = String(name || "").trim().toLowerCase();
  if (!n || /[?¿@]|https?:|www\.|\.com\b/.test(n)) return false;
  if (/[()]|\b(?:gracias|thanks?|please|por\s+favor|porfa|aprox\w*|approx\w*|otro\s+pedido|other\s+order|para\s+(?:el|la)\s+(?:otr|pr[oó]xim|siguient)\w*|ayer|yesterday|jaja\w*|jeje\w*|lol|xd|broma|kidding|joke|cantidad|presupuesto|quantity|budget|correo|email|tel[eé]fono|whatsapp|requisitos|decime|dime|d[ií]game|cu[aá]nto|ma[ñn]ana|despu[eé]s|luego|later)\b/.test(n)) return false;
  if (/\s(?:o|u|or)\s/.test(n)) return false;
  if (/^(?:\d+\s*)?(?:v|hz|l|litros?|liters?|kg|hp|kw|unidades?|units?|piezas?|pieces?)$/.test(n)) return false;
  const words = n.match(/[a-záéíóúüñ]{4,}/g) || [];
  if (!words.length || words.every((w) => /^(?:otro|otra|otros|otras|algo|cosa|cosas|esto|esos|esas|eso|este|esta|something|other|stuff|thing|things|xxxx*)$/.test(w))) return false;
  return true;
}
/** A conditional or comparison ("¿y si fueran 5?", "suponiendo 300 litros…") never changes the order. */
export const HYPOTHETICAL = /(?:\by\s+si\b|\bsi\s+(?:fuera|fueran|fuese|fuesen|pido|pidiera|pidiese|compro|comprara|cambio|cambiara|subo|subiera|bajo|bajara|aumento|aumentara|tuviera|quisiera|llevo|llevara|el\s+presupuesto|la\s+cantidad|en\s+vez|en\s+lugar|ahora|son|es|tuviese)\b|\bsi\s+(?:[a-záéíóúñ]+\s+){0,3}(?:fuera|fueran|fuese|fuesen|tuviera|tuvieran|costara|costaran|viniera|vinieran|cambiara|cambiaran|pidiera|subiera|bajara)\b|\bsuponiendo\b|\bsupongamos\b|\bsup[oó]n(?:é|e|go|gamos|iendo)?\b|\bimagin(?:emos|a|á|ate|ese)\b|\bdigamos\b|\ben\s+caso\s+de\b|\blet'?s\s+say\b|\bhypothetically\b|\bhipot[eé]tic\w*|\bqu[eé]\s+pasa(?:r[ií]a)?\s+si\b|\bsolo\s+para\s+comparar\b|\bpara\s+comparar\b|\bsin\s+cambiar\s+(?:el|mi)\s+pedido\b|\bwhat\s+if\b|\bsuppose\b|\bif\s+i\s+(?:order|ordered|bought|buy|change|changed|wanted)\b|\bhow\s+much\s+would\b|\bcu[aá]nto\s+(?:ser[ií]a|costar[ií]a|saldr[ií]a|me\s+saldr[ií]a)n?\b)/i;
/** "mantengo los mismos…", "no modifiques las especificaciones", "solo cambia…": the rest stays. */
export const KEEP_REST = /\b(?:mantengo|mantener|mantenga|mantenemos|mism[oa]s?|no\s+(?:modifiques|modifique|cambies|cambie|toques|toque|cambian|cambia|se\s+modifican?|se\s+cambian?)|sin\s+cambiar|sin\s+modificar|se\s+mantienen?|siguen?\s+(?:igual|siendo)|las\s+dem[aá]s|lo\s+dem[aá]s|el\s+resto|solo\s+(?:cambia|actualiza|modifica|ajusta|corrige)|[uú]nicamente|keep|same|don'?t\s+change|unchanged|only\s+(?:change|update)|the\s+rest)\b/i;

/** "Quiero 2000 en vez de 500", "cambia la cantidad a 2,000", "de 3 a 4 compresores", "make it 300". */
export function quantityChange(textIn: string, head = ""): { qty: number; before: number; bare?: boolean; stated?: boolean; keepSaid?: boolean; relative?: number; noun?: boolean } | null {
  // "set the quantity to 7": the verb "set", not a pack of sets
  const text = String(textIn || "").replace(/\bset\s+(?=(?:the|it|my|our|this)\b)/gi, "change ");
  const t = normalizeNumbers(` ${String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ")} `);
  if (packMath(text)) return null;
  // "paquetes de 16 en lugar de 10" changes the pack, not the quantity
  if (new RegExp(`\\b${PACK_RE}\\b`).test(t)) return null;
  if (HYPOTHETICAL.test(t.replace(POLITE, " "))) return null;
  const ok = (n: number) => n >= 1 && n <= 10_000_000;
  const plainGroup = (m: RegExpExecArray | RegExpMatchArray, g: number) => {
    const at = (m.index ?? 0) + m[0].lastIndexOf(m[g]);
    return plainAt(t, at, m[g].length);
  };
  // "agrega 2 más", "reduce el pedido en 1": relative to the quantity in force (confirmed, never guessed)
  const rel =
    t.match(/\b(agreg\w*|añad\w*|sum\w*|quit\w*|rest\w*|add|remove)\b[^.;\d]{0,25}?(\d+)\b/) ||
    t.match(/\b(aument\w*|reduc\w*|disminu\w*|sub\w*|baj\w*|increase|reduce|lower|raise)\b[^.;\d]{0,25}?\b(?:en|by)\s+(\d+)\b/) ||
    t.match(/\b(\d+)\s+(?:[a-záéíóúñ]+\s+)?(m[aá]s|menos|adicionales|extra|more|less|fewer)\b/);
  if (rel) {
    const numFirst = /^\d+$/.test(rel[1]);
    const n = Number(numFirst ? rel[1] : rel[2]);
    const word = numFirst ? rel[2] : rel[1];
    if (n >= 1 && plainGroup(rel, numFirst ? 1 : 2)) return { qty: 0, before: 0, relative: /^(?:quit|rest|reduc|disminu|baj|menos|less|fewer|remove|lower)/.test(word) ? -n : n };
  }
  // "de 3 a 4 compresores", "la cantidad del pedido de 3 a 4", "from 3 to 4 units"
  for (const m of t.matchAll(/\b(?:de|from)\s+(\d+)\s+(?:unidades\s+|units\s+|piezas\s+)?(?:a|to)\s+(\d+)\b/g)) {
    const atX = (m.index ?? 0) + m[0].indexOf(m[1]);
    const atY = (m.index ?? 0) + m[0].lastIndexOf(m[2]);
    if (!plainAt(t, atX, m[1].length) || !plainAt(t, atY, m[2].length)) continue;
    const sentence = t.slice(Math.max(0, t.lastIndexOf(".", m.index ?? 0) + 1), (m.index ?? 0) + m[0].length + 30);
    if (!/\b(?:cantidad|pedido|orden|unidades|piezas|quantity|order|units|pieces|cambi\w*|sub\w*|baj\w*|aument\w*|reduc\w*|ajust\w*|pas\w*|change|increase|reduce|raise|lower)\b/.test(sentence)) continue;
    if (ok(Number(m[2]))) return { qty: Number(m[2]), before: Number(m[1]) };
  }
  // "la cantidad sigue siendo 3", "mantengo la cantidad en 3": said again, not changed
  const keep =
    t.match(/\b(?:cantidad|quantity)\b(?:\s+(?:del?\s+pedido|solicitada|requerida|total|de\s+compra|of\s+the\s+order))?\s+(?:sigue\s+siendo|sigue\s+en|se\s+mantiene(?:\s+en)?|queda\s+en|no\s+cambia\W*(?:es|son|sigue\s+siendo)?|stays(?:\s+at)?|remains(?:\s+at)?|is\s+still)\s*(?:de\s+)?(\d+)/) ||
    t.match(/\b(?:mantengo|mantenemos|keep)\s+(?:la\s+cantidad|the\s+quantity)\s+(?:en|de|at)?\s*(\d+)/) ||
    t.match(/\b(?:siguen\s+siendo|still)\s+(\d+)\s+(?:unidades|units|piezas|pieces|[a-záéíóúñ]{4,})/);
  if (keep && plainGroup(keep, 1) && ok(Number(keep[1]))) return { qty: Number(keep[1]), before: 0, stated: true, keepSaid: true };
  // "cambia la cantidad a 5", "la cantidad solicitada es 3 unidades", "quantity to 5"
  const set = t.match(/\b(?:cantidad|quantity)\b(?:\s+(?:del?\s+pedido|solicitada|requerida|total|de\s+compra|of\s+the\s+order))?\s*(?:a|en|es|ser[aá]|sea|son|queda|pasa\s+a|cambia\s+a|sube\s+a|baja\s+a|:|=|to|is|now)?\s*(?:de\s+)?(\d+)/);
  if (set && plainGroup(set, 1) && ok(Number(set[1]))) {
    // "la cantidad solicitada es 3" states it; "cambia la cantidad a 5" changes it
    const verb = /\b(?:cambi\w*|ajust\w*|pon\w*|modific\w*|actualiz\w*|sub\w*|baj\w*|change|set|make|update)\s+(?:[a-záéíóúñ]+\s+){0,3}$/.test(t.slice(0, set.index ?? 0));
    return { qty: Number(set[1]), before: 0, stated: !verb && /\b(?:es|son|is|ser[aá]|sea)\s*(?:de\s+)?\d+$/.test(set[0]) };
  }
  const tries: [RegExp, boolean, boolean?][] = [
    [/(?:cambi\w*|ajust\w*|pon\w*|modific\w*|change|set|make)\s+(?:la\s+|the\s+)?(?:it\s+)?(?:a|to|en)?\s*(\d+)/, true],
    [/(?:quiero|necesito|ser[ií]an|mejor|i\s+want|i\s+need|make\s+it)\s+(\d+)\b[^\d]*?\b(?:en\s+vez\s+de|en\s+lugar\s+de|instead\s+of|y\s+no|not)\s+(\d+)/, false],
    [/\b(\d+)\s+(?:[a-záéíóúüñ]+\s+)?(?:en\s+vez\s+de|en\s+lugar\s+de|instead\s+of)\s+(\d+)/, false],
    // "son 4 compresores, no 3"
    [/\b(?:son|ser[aá]n|are|it'?s)\s+(\d+)\s+(?:[a-záéíóúüñ]+\s*)?,?\s*(?:no|y\s+no|not)\s+(\d+)\b/, false],
    // "ahora son 4 unidades", "en total serán 6 piezas"
    [/\b(?:ahora|now|en\s+total|in\s+total)\s+(?:son|ser[aá]n|ser[ií]an|quiero|necesito|pido|are|i\s+need|i\s+want)\s+(\d+)\s+(?=unidades|units|piezas|pieces|equipos|m[aá]quinas)/, false],
    // "vuelve a 3", "que sean 5", "déjalo en 5 unidades"
    [/\b(?:vuelv\w*|regr[eé]s\w*|d[eé]ja\w*|que\s+sean|p[oó]nle|sub\w*|baj\w*|pas\w*)\s+(?:(?:la\s+cantidad|el\s+pedido|lo|la)\s+)?(?:a|en)?\s*(\d+)\b/, true],
    // "5 unidades", "en total 5 compresores", "son 3 compresores de 300 litros"
    [new RegExp(`\\b(\\d+)\\s+(?:unidades|units|piezas|pieces|equipos|m[aá]quinas${head ? `|${head.slice(0, Math.max(4, head.length - 2))}[a-záéíóúñ]*` : ""})\\b`), false, true],
  ];
  for (const [re, bareKind, noun] of tries) {
    const m = t.match(re);
    if (!m || !plainGroup(m, 1)) continue;
    // "300 litros en lugar de 500 litros": the word after the number is a unit, not the product
    if (m[2] !== undefined) {
      const at2 = (m.index ?? 0) + m[0].lastIndexOf(m[2]);
      if (!plainAt(t, at2, m[2].length)) continue;
    }
    const qty = Number(m[1]);
    if (!ok(qty)) continue;
    // "cambia a 300" says no field: when the product has measures it is asked, not guessed
    const after = t.slice((m.index ?? 0) + m[0].length);
    const bare = bareKind && !/^\s*(?:unidades|units|piezas|pieces|[a-záéíóúñ]{4,})/.test(after);
    return { qty, before: m[2] ? Number(m[2]) : 0, ...(bare ? { bare } : {}), ...(noun ? { noun } : {}) };
  }
  return null;
}

/** "Solo actualiza el presupuesto de compra a US$5,000", "budget to $5,000". */
export function budgetChange(text: string): { value: number; currency: "USD" | "GTQ" } | null {
  // "Q40,000": the thousands separator is read after the currency letter too
  const t = normalizeNumbers(` ${String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ").replace(/\bq\.?(?=\d)/g, "q ")} `);
  if (HYPOTHETICAL.test(t.replace(POLITE, " "))) return null;
  const m = t.match(/\b(?:presupuesto|budget)\b(?:\s+(?:de\s+compra|total|m[aá]ximo|disponible|purchase|for\s+the\s+purchase))?[^.;\d]{0,30}?(us\$|usd|\$|\bq\.?|gtq|quetzales)?\s*(\d+(?:\.\d{1,2})?)(?!\d)\s*(d[oó]lares|usd|quetzales|gtq)?/);
  if (!m) return null;
  // "no cambies el presupuesto, son 3 unidades": the number belongs to something else
  const between = m[0].slice(0, m[0].lastIndexOf(m[2]));
  if (/\b(?:no|sin|ni|not|don'?t)\b/.test(between) && !m[1]) return null;
  const value = Number(m[2]);
  if (!(value >= 1) || value > 100_000_000) return null;
  // "300 litros" after the word budget is not money
  const atN = (m.index ?? 0) + m[0].lastIndexOf(m[2]);
  if (!m[1] && !m[3] && UNIT_NEXT.test(t.slice(atN + m[2].length)) ) return null;
  const gtq = /^(?:q\.?|gtq|quetzales)$/.test((m[1] || m[3] || "").trim());
  return { value, currency: gtq ? "GTQ" : "USD" };
}

/** The previous product's quantity or budget is not reused without the client confirming it. */
function staleLine(r: ReplySpec): string {
  if (!r.newProduct || !r.stale || !(r.stale.quantity || r.stale.budget) || !r.stale.product || sameProduct(r.stale.product, r.newProduct)) return "";
  const q = r.stale.quantity ? (Number(r.stale.quantity) ? Number(r.stale.quantity).toLocaleString("en-US") : r.stale.quantity) : "";
  const b = r.stale.budget ? (/^\d/.test(r.stale.budget) ? `US$${r.stale.budget}` : r.stale.budget) : "";
  const what = [q && Lx(`cantidad ${q}`, `quantity ${q}`), b && Lx(`presupuesto ${b}`, `budget ${b}`)].filter(Boolean).join(", ");
  return "\n\n" + Lx(
    `Los datos que tenías para «${productName(r.stale.product)}» (${what}) quedan como historial y no los uso para «${productName(r.newProduct)}».${r.newQuantity ? (b ? ` ¿Cuál es tu presupuesto de compra para «${productName(r.newProduct)}»?` : "") : ` ¿Qué cantidad${b ? " y presupuesto" : ""} necesitas de «${productName(r.newProduct)}»?`}`,
    `The data you had for "${productName(r.stale.product)}" (${what}) stays as history and I won't use it for "${productName(r.newProduct)}".${r.newQuantity ? (b ? ` What is your purchase budget for "${productName(r.newProduct)}"?` : "") : ` What quantity${b ? " and budget" : ""} do you need for "${productName(r.newProduct)}"?`}`,
  );
}

/** Quantity the client gave in the chat for the product in force (a change of product resets it). */
export function quantityInForce(specs: ReplySpec[]): number {
  let q = 0;
  for (const x of specs) {
    if (x.newProduct && x.previous && !sameProduct(x.previous, x.newProduct)) q = 0;
    if (x.newQuantity) q = x.newQuantity;
  }
  return q;
}

/** The purchase budget the client last set in this chat for the product in force (US$). */
export function budgetInForce(specs: ReplySpec[]): number {
  let b = 0;
  for (const x of specs) {
    if (x.newProduct && x.previous && !sameProduct(x.previous, x.newProduct)) b = 0;
    if (x.newBudget) b = x.newBudget;
    if (x.budgetClear) b = 0;
  }
  return b;
}
export const fmtBudget = (n: number) => `US$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

function caseLine(c: NonNullable<ReplySpec["caseNow"]>): string {
  return Lx(
    `producto «${c.product}»; cantidad ${c.quantity ? c.quantity.toLocaleString("en-US") : "sin indicar"}; presupuesto de compra ${c.budget ? fmtBudget(c.budget) : "sin indicar"}`,
    `product "${c.product}"; quantity ${c.quantity ? c.quantity.toLocaleString("en-US") : "not given"}; purchase budget ${c.budget ? fmtBudget(c.budget) : "not given"}`,
  );
}

export function buildReply(r: ReplySpec): string {
  if (r.formUpdate)
    return Lx(
      `Actualizaste el producto en el formulario: ahora es «${r.newProduct}». Sigo con ese producto; lo que hablamos antes se conserva arriba.`,
      `You updated the product in the form: it is now "${r.newProduct}". I'll continue with that product; what we discussed before is kept above.`,
    ) + staleLine(r);
  const ctx: ChatCtx = { product: r.product };
  const parts: string[] = [];
  // fields of the current case updated: what changed, and the whole case as it is now saved
  if (r.caseNow && (r.fieldUpdate || r.hypothetical)) {
    const now = caseLine(r.caseNow);
    if (r.persistFailed)
      return Lx(
        `No pude guardar el cambio en este navegador, así que tu caso no cambió: ${now}. Puedes intentarlo de nuevo o corregirlo en el formulario.`,
        `I couldn't save the change in this browser, so your case did not change: ${now}. You can try again or correct it in the form.`,
      );
    if (r.qtyInvalid && (r.hold || (!r.newQuantity && !r.newBudget && !r.attrFix))) {
      const raw = r.qtyRaw ? (/^\d+$/.test(r.qtyRaw) ? Number(r.qtyRaw).toLocaleString("en-US") : r.qtyRaw) : "";
      const why = {
        decimal: Lx(
          `No se aceptan cantidades fraccionarias: la cantidad debe ser un número entero de unidades${raw ? `, así que «${raw}» no se puede registrar` : ""}.`,
          `Fractional quantities are not accepted: the quantity must be a whole number of units${raw ? `, so "${raw}" can't be recorded` : ""}.`,
        ),
        zero: Lx(`La cantidad debe ser de al menos 1 unidad${raw ? ` («${raw}» no es válida)` : ""}.`, `The quantity must be at least 1 unit${raw ? ` ("${raw}" is not valid)` : ""}.`),
        max: Lx(
          `La cantidad máxima es ${QTY_MAX.toLocaleString("en-US")} unidades${raw ? ` y «${raw}» la supera` : ""}.`,
          `The maximum quantity is ${QTY_MAX.toLocaleString("en-US")} units${raw ? ` and "${raw}" exceeds it` : ""}.`,
        ),
        ambiguous: Lx(`«${raw}» no es una cantidad exacta.`, `"${raw}" is not an exact quantity.`),
        missing: Lx("No indicaste la nueva cantidad.", "You didn't give the new quantity."),
        format: Lx(`«${raw}» está escrito en una notación (exponente o científica) que no uso como cantidad, para no interpretarla mal.`, `"${raw}" is written in a notation (exponent or scientific) that I don't use as a quantity, so as not to misread it.`),
        budgetAmbiguous: Lx(`«${raw}» no es un monto exacto.`, `"${raw}" is not an exact amount.`),
        budgetFormat: Lx(`«${raw}» está escrito en una notación (exponente o científica) que no uso como monto, para no interpretarlo mal.`, `"${raw}" is written in a notation (exponent or scientific) that I don't use as an amount, so as not to misread it.`),
        budgetMin: Lx(`El presupuesto de compra debe ser mayor a US$0${raw ? ` («${raw}» no es válido)` : ""}.`, `The purchase budget must be greater than US$0${raw ? ` ("${raw}" is not valid)` : ""}.`),
        budgetMax: Lx(`El presupuesto de compra máximo es US$100,000,000${raw ? ` y «${raw}» lo supera` : ""}.`, `The maximum purchase budget is US$100,000,000${raw ? ` and "${raw}" exceeds it` : ""}.`),
      }[r.qtyInvalid];
      if (r.qtyInvalid === "budgetMin" || r.qtyInvalid === "budgetMax" || r.qtyInvalid === "budgetFormat" || r.qtyInvalid === "budgetAmbiguous")
        return Lx(
          `${r.hold ? "Como pediste, no cambié nada. " : ""}${why} No cambié el presupuesto ni ningún otro dato; tu caso sigue así: ${now}. Si quieres cambiarlo, indícame un monto en US$ (por ejemplo: «el presupuesto es US$5,000»).`,
          `${r.hold ? "As you asked, I didn't change anything. " : ""}${why} I didn't change the budget or any other data; your case stays: ${now}. If you want to change it, give me an amount in US$ (for example: "the budget is US$5,000").`,
        );
      return Lx(
        `${r.hold ? "Como pediste, no cambié nada. " : ""}${why} No cambié la cantidad ni ningún otro dato; tu caso sigue así: ${now}. Si quieres cambiarla, indícame una cantidad entera de 1 a ${QTY_MAX.toLocaleString("en-US")} (por ejemplo: «la cantidad es 4»).`,
        `${r.hold ? "As you asked, I didn't change anything. " : ""}${why} I didn't change the quantity or any other data; your case stays: ${now}. If you want to change it, give me a whole quantity from 1 to ${QTY_MAX.toLocaleString("en-US")} (for example: "the quantity is 4").`,
      );
    }
    if (r.hold) {
      const h = r.held;
      const prop = h
        ? [
            h.attrFix ? Lx(`«${h.attrFix.from}» → «${h.attrFix.to}»`, `"${h.attrFix.from}" → "${h.attrFix.to}"`) : "",
            h.quantity ? Lx(`cantidad ${h.quantity.toLocaleString("en-US")}`, `quantity ${h.quantity.toLocaleString("en-US")}`) : "",
            h.budget ? Lx(`presupuesto de compra ${fmtBudget(h.budget)}`, `purchase budget ${fmtBudget(h.budget)}`) : "",
            h.budgetClear ? Lx("quitar el presupuesto de compra", "remove the purchase budget") : "",
          ].filter(Boolean).join("; ")
        : "";
      if (r.fromMismatch) {
        const f = r.fromMismatch;
        const n = (x: number) => x.toLocaleString("en-US");
        return Lx(
          `Dices que la cantidad pasa de ${n(f.said)} a ${n(f.to)}, pero tu caso tiene ${n(f.inCase)}, así que no cambié nada. Tu caso sigue así: ${now}. Si quieres ${n(f.to)}, escríbelo así: «la cantidad es ${f.to}».`,
          `You say the quantity goes from ${n(f.said)} to ${n(f.to)}, but your case has ${n(f.inCase)}, so I didn't change anything. Your case stays: ${now}. If you want ${n(f.to)}, write: "the quantity is ${f.to}".`,
        );
      }
      if (r.unsure?.length && !h)
        return Lx(
          `Tu mensaje incluye una negación, una condición o una pregunta que no puedo interpretar con seguridad, así que no cambié nada. Tu caso sigue así: ${now}. Si quieres cambiar algo, escríbelo directamente, por ejemplo «la cantidad es 8» o «el presupuesto es US$6,000».`,
          `Your message includes a negation, a condition or a question I can't interpret with certainty, so I didn't change anything. Your case stays: ${now}. If you want to change something, say it directly, for example "the quantity is 8" or "the budget is US$6,000".`,
        );
      if (r.unsure?.length && h)
        return Lx(
          `Tu mensaje incluye una negación, una condición o una pregunta que no puedo interpretar con seguridad, así que no cambié nada. Tu caso sigue así: ${now}.${prop ? ` Si quieres aplicar ${prop}, respóndeme «sí, aplícalo»; si no, no hace falta hacer nada.` : ""}`,
          `Your message includes a negation, a condition or a question I can't interpret with certainty, so I didn't change anything. Your case stays: ${now}.${prop ? ` If you want to apply ${prop}, reply "yes, apply it"; otherwise there is nothing to do.` : ""}`,
        );
      if (r.heldStale)
        return Lx(
          `Tu caso cambió desde que te propuse ese cambio, así que no lo apliqué. Tu caso ahora es: ${now}.${prop ? ` Si todavía quieres aplicar ${prop} sobre este caso, respóndeme «sí, aplícalo».` : ""}`,
          `Your case changed since I proposed that change, so I didn't apply it. Your case is now: ${now}.${prop ? ` If you still want to apply ${prop} to this case, reply "yes, apply it".` : ""}`,
        );
      if (r.forbidden?.length && !h) {
        const names = r.forbidden.map((f) => ({ quantity: Lx("la cantidad", "the quantity"), budget: Lx("el presupuesto", "the budget"), product: Lx("el producto", "the product"), spec: Lx("las características del producto", "the product's characteristics") })[f]);
        const list = names.join(Lx(" ni ", " or "));
        return Lx(`Como pediste, no cambié ${list}. Tu caso sigue así: ${now}.`, `As you asked, I didn't change ${list}. Your case stays: ${now}.`);
      }
      return Lx(
        `Entendido: no cambié nada. Tu caso sigue así: ${now}.${prop ? ` Cuando quieras aplicar el cambio (${prop}), respóndeme «sí, aplícalo».` : ""}`,
        `Understood: I didn't change anything. Your case stays: ${now}.${prop ? ` When you want to apply the change (${prop}), reply "yes, apply it".` : ""}`,
      );
    }
    if (r.askNumber)
      return Lx(
        `¿«${r.askNumber.toLocaleString("en-US")}» es la nueva cantidad de unidades o el valor de una característica (por ejemplo, la capacidad del tanque o el voltaje)? Escríbelo así: «la cantidad es ${r.askNumber}» o «el tanque es de ${r.askNumber} litros». No cambié nada; tu caso sigue así: ${now}.`,
        `Is "${r.askNumber.toLocaleString("en-US")}" the new number of units or the value of a characteristic (for example the tank capacity or the voltage)? Write it like this: "the quantity is ${r.askNumber}" or "the tank is ${r.askNumber} liters". I didn't change anything; your case stays: ${now}.`,
      );
    if (r.askRelative && !r.attrFix && !r.newBudget)
      return r.askRelative.from && r.askRelative.to >= 1
        ? Lx(
            `¿Quieres decir que la cantidad total pasa de ${r.askRelative.from.toLocaleString("en-US")} a ${r.askRelative.to.toLocaleString("en-US")}? Confírmamelo así: «la cantidad es ${r.askRelative.to}». No cambié nada; tu caso sigue así: ${now}.`,
            `Do you mean the total quantity goes from ${r.askRelative.from.toLocaleString("en-US")} to ${r.askRelative.to.toLocaleString("en-US")}? Confirm it like this: "the quantity is ${r.askRelative.to}". I didn't change anything; your case stays: ${now}.`,
          )
        : Lx(`¿Cuál es la cantidad total que necesitas? Escríbela así: «la cantidad es 5». No cambié nada; tu caso sigue así: ${now}.`, `What total quantity do you need? Write it like this: "the quantity is 5". I didn't change anything; your case stays: ${now}.`);
    if (r.qtyConflict && !r.attrFix && !r.newBudget)
      return Lx(
        `Dices que la cantidad sigue siendo ${r.qtyConflict.said.toLocaleString("en-US")}, pero tu caso tiene ${r.qtyConflict.inCase.toLocaleString("en-US")}. ¿Cuál es la correcta? No cambié la cantidad; tu caso sigue así: ${now}.`,
        `You say the quantity is still ${r.qtyConflict.said.toLocaleString("en-US")}, but your case has ${r.qtyConflict.inCase.toLocaleString("en-US")}. Which one is right? I didn't change the quantity; your case stays: ${now}.`,
      );
    if (r.hypothetical && !r.fieldUpdate)
      return Lx(
        `Lo tomo como una consulta hipotética: no cambié tu pedido. Tu caso sigue así: ${now}. Si quieres cambiar algo, dímelo directamente (por ejemplo «cambia la cantidad a 5»).`,
        `I'm taking this as a hypothetical question: I didn't change your order. Your case stays: ${now}. If you want to change something, tell me directly (for example "change the quantity to 5").`,
      );
    const changes = [
      r.attrFix ? Lx(`«${r.attrFix.from}» ahora es «${r.attrFix.to}»`, `"${r.attrFix.from}" is now "${r.attrFix.to}"`) : "",
      r.newQuantity ? Lx(`cantidad ${r.oldQuantity ? `${r.oldQuantity.toLocaleString("en-US")} → ` : ""}${r.newQuantity.toLocaleString("en-US")}`, `quantity ${r.oldQuantity ? `${r.oldQuantity.toLocaleString("en-US")} → ` : ""}${r.newQuantity.toLocaleString("en-US")}`) : "",
      r.newBudget ? Lx(`presupuesto de compra ${r.oldBudget ? `${fmtBudget(r.oldBudget)} → ` : ""}${fmtBudget(r.newBudget)}`, `purchase budget ${r.oldBudget ? `${fmtBudget(r.oldBudget)} → ` : ""}${fmtBudget(r.newBudget)}`) : "",
      r.budgetClear ? Lx("presupuesto de compra quitado", "purchase budget removed") : "",
    ].filter(Boolean);
    const extra = [
      r.forbidden?.length
        ? Lx(
            `Como pediste, no cambié ${r.forbidden.map((f) => ({ quantity: "la cantidad", budget: "el presupuesto", product: "el producto", spec: "las características del producto" })[f]).join(" ni ")}.`,
            `As you asked, I didn't change ${r.forbidden.map((f) => ({ quantity: "the quantity", budget: "the budget", product: "the product", spec: "the product's characteristics" })[f]).join(" or ")}.`,
          )
        : "",
      r.qtyConflict ? Lx(`No cambié la cantidad: dices ${r.qtyConflict.said.toLocaleString("en-US")} y tu caso tiene ${r.qtyConflict.inCase.toLocaleString("en-US")}; dime cuál es la correcta.`, `I didn't change the quantity: you say ${r.qtyConflict.said.toLocaleString("en-US")} and your case has ${r.qtyConflict.inCase.toLocaleString("en-US")}; tell me which one is right.`) : "",
      r.budgetAsk ? Lx("No cambié el presupuesto: en el formulario va en dólares (US$); ¿me lo indicas en US$?", "I didn't change the budget: the form uses US dollars (US$); can you give it in US$?") : "",
    ].filter(Boolean).join(" ");
    if (!changes.length)
      return extra
        ? Lx(`${extra} Tu caso sigue así: ${now}.`, `${extra} Your case stays: ${now}.`)
        : Lx(`Sin cambios: tu caso sigue así: ${now}.`, `No changes: your case stays: ${now}.`);
    return Lx(
      `Actualizado: ${changes.join("; ")}. Tu caso queda así: ${now}. Lo demás no cambió; así pasa al formulario y a tu solicitud a SEAL.${extra ? ` ${extra}` : ""}`,
      `Updated: ${changes.join("; ")}. Your case is now: ${now}. Everything else stays the same; this is what goes to the form and to your request to SEAL.${extra ? ` ${extra}` : ""}`,
    );
  }
  if (r.attrFix && r.newProduct) {
    parts.push(
      Lx(
        `Corregido: «${r.attrFix.from}» ahora es «${r.attrFix.to}». El resto de la descripción se mantiene: «${r.newProduct}».`,
        `Corrected: "${r.attrFix.from}" is now "${r.attrFix.to}". The rest of the description stays: "${r.newProduct}".`,
      ),
    );
    return parts.join("\n\n");
  }
  if (r.newQuantity && !r.newProduct) {
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
      changed && r.explicitChange && !wrongAdvice
        ? Lx(
            `Anotado el cambio de producto: ahora es «${r.newProduct}»${r.newQuantity ? `, cantidad ${r.newQuantity.toLocaleString("en-US")}` : ""}${r.newBudget && r.newProduct ? `, presupuesto de compra ${fmtBudget(r.newBudget)}` : ""} (antes «${productName(r.previous || "")}»). Lo uso para lo que sigue, para el formulario y para tu caso; lo anterior queda en el historial.`,
            `Product change noted: it is now "${r.newProduct}"${r.newQuantity ? `, quantity ${r.newQuantity.toLocaleString("en-US")}` : ""}${r.newBudget && r.newProduct ? `, purchase budget ${fmtBudget(r.newBudget)}` : ""} (before "${productName(r.previous || "")}"). I'll use it from here on, in the form and in your case; the earlier data stays as history.`,
          )
        : changed || wrongAdvice
        ? Lx(
            `Gracias por aclararlo: tu producto es «${r.newProduct}». Corrijo lo anterior: ${wrongAdvice ? "lo que dije sobre materiales en contacto con alimentos no aplica a este producto" : "lo que respondí pensando en otro producto no aplica"}; tomo «${r.newProduct}» para lo que sigue y para el formulario.`,
            `Thanks for clarifying: your product is "${r.newProduct}". Correcting what I said: ${wrongAdvice ? "what I said about food-contact materials doesn't apply to this product" : "what I answered with another product in mind doesn't apply"}; I'll use "${r.newProduct}" from here on and in the form.`,
          )
        : Lx(
            `Anotado: tu producto es «${r.newProduct}»${r.newQuantity ? `, cantidad ${r.newQuantity.toLocaleString("en-US")}` : ""}${r.newBudget && r.newProduct ? `, presupuesto de compra ${fmtBudget(r.newBudget)}` : ""}; lo uso para lo que sigue y para el formulario.`,
            `Noted: your product is "${r.newProduct}"${r.newQuantity ? `, quantity ${r.newQuantity.toLocaleString("en-US")}` : ""}${r.newBudget && r.newProduct ? `, purchase budget ${fmtBudget(r.newBudget)}` : ""}; I'll use it from here on and in the form.`,
          ),
    );
  }
  // a doubt about the product is asked before anything is kept or changed
  if (r.confirmProduct !== undefined && !r.newProduct) {
    const cur = productName(r.previous || "");
    parts.push(
      r.confirmProduct
        ? Lx(
            `Mencionas «${productName(r.confirmProduct)}», pero tu caso dice «${cur}». ¿Tu producto ahora es «${productName(r.confirmProduct)}»? Responde «sí» para cambiarlo, o «no» para mantener «${cur}». Si cambia, escríbelo con sus características (voltaje, capacidad, material…).`,
            `You mention "${productName(r.confirmProduct)}", but your case says "${cur}". Is your product now "${productName(r.confirmProduct)}"? Answer "yes" to change it, or "no" to keep "${cur}". If it changes, write it with its characteristics (voltage, capacity, material…).`,
          )
        : Lx(
            `Indicas que ya no es «${cur}». ¿Cuál es el producto ahora? Escríbelo con sus características (voltaje, capacidad, material…) y lo actualizo en tu caso; hasta entonces tu caso sigue con «${cur}».`,
            `You say it is no longer "${cur}". What is the product now? Write it with its characteristics (voltage, capacity, material…) and I'll update your case; until then your case stays with "${cur}".`,
          ),
    );
  }
  const stale = staleLine(r).trim();
  if (stale) parts.push(stale);
  if (r.combined) {
    const m = packMath(r.combined, true);
    if (m) return [...parts, packMathReply(m)].join("\n\n");
  }
  let q = r.text;
  let kinds = replyKinds(q);
  // a follow-up to an earlier calculation ("¿Y los 300 cuadernos en paquetes de 10?")
  const stockLine = kinds.every((k) => k === "supplier") && !!findStock(normalizeNumbers(q.toLowerCase()));
  const follow = (!kinds.length || stockLine) && r.previousMath ? followUpMath(q, r.previousMath) : null;
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
  if (!kinds.length && !r.newProduct && r.confirmProduct === undefined) kinds = ["general"];
  // the price and budget of a calculation are answered with it: no generic cost paragraph
  if (kinds.includes("math") && mathMoney(q)) kinds = kinds.filter((k) => k !== "cost");
  kinds.forEach((k, i) => {
    let t =
      k === "equivalence" ? oddEquivalenceReply(explain(q).odd!) : k === "math" ? ((mm) => mathReply(forMath(q)) + (mm ? `\n${mm.trim()}` : ""))(mathMoney(q)) : k === "subtotal" ? subtotalReply(q) : k === "requestStatus" ? requestStatusReply(r.sentCase) : k === "contact" ? contactReply(q) : k === "certificate" ? certificateReply(q, ctx) : k === "math" ? mathReply(q) : k === "pairs" ? pairDoubtReply(q) : (FIXED[k] ?? FIXED.general)();
    if (i === 0 && !parts.length) t = t.replace(/^Tampoco puedo/, "No puedo").replace(/^I also can't/, "I can't");
    // after the way to SEAL, no second path to the form: one next step
    if (kinds[0] === "contact" && k !== "contact")
      t = t.split(/(?<=[.!?])\s+/).filter((x) => !/formulario|\bthe form\b|\bform\b/i.test(x)).join(" ").replace(/\s*Siguiente paso:\s*$|\s*Next step:\s*$/i, "").trim();
    if (t) parts.push(t);
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
export function nextSpec(
  text: string,
  specs: ReplySpec[],
  currentProduct: string,
  currentQuantity: number,
  caseProductIn?: string,
  // the case as saved now (form draft / case): quantity and purchase budget in force
  caseFacts: { quantity?: number; budget?: number; caseId?: string; rev?: number; pending?: PendingProposal | null } = {},
): ReplySpec {
  // the product of the CASE (stated by the client); a product only mentioned in a question
  // ("¿cuántas cajas de lápices…?") guides that answer, never corrections or the case
  const caseProduct = caseProductIn || [...specs].reverse().find((x) => x.newProduct)?.newProduct || currentProduct;
  const kinds = replyKinds(text);
  const isMath = kinds.includes("math");
  // the latest earlier calculation this message follows ("¿Y los cuadernos?" can point further back)
  let lastMath = "";
  let follow: PackMath | null = null;
  // "el proveedor solo tiene 8 cajas disponibles" after a calculation is stock for it, not a
  // question about the supplier
  const stockLine = !isMath && kinds.every((k) => k === "supplier") && !!findStock(normalizeNumbers(text.toLowerCase()));
  // "mejor 5 en lugar de 2" when 2 is the case's quantity changes the quantity; it is not a
  // follow-up of an older calculation
  const caseQty = caseFacts.quantity || quantityInForce(specs) || currentQuantity;
  const caseBudget = caseFacts.budget || budgetInForce(specs) || 0;
  const low0 = normalizeNumbers(String(text || "").toLowerCase());
  // "¿y si fueran 5?", "suponiendo 300 litros…": a question about another scenario, never a change
  const hypo = HYPOTHETICAL.test(low0.replace(POLITE, " "));
  // "mantengo los mismos…", "no modifiques las especificaciones": only what is named changes
  const keepRest = KEEP_REST.test(text);
  const head = (String(caseProduct || "").toLowerCase().match(/[a-záéíóúüñ]{4,}/) || [""])[0];
  // --- mutation gate: what the message may change in the case is decided here, deterministically ---
  // "no cambies nada hasta confirmar…": nothing is applied in this message
  const holdMsg = !hypo && (HOLD.test(low0) || CONFIRM_FIRST.test(low0));
  // "Do not update the quantity to 8", "no toques el presupuesto": those fields are not changed
  const ban = hypo ? { all: false, fields: new Set<CaseField>(), spans: [] as string[], specWords: [] as string[] } : prohibitions(text);
  // a quantity that is not a whole number from 1 to 10,000,000 is never applied (nor rounded)
  const lowRaw = String(text || "").toLowerCase();
  const issue0 = !hypo && !isMath ? notationIssue(lowRaw, head) || quantityIssue(low0, head) || budgetIssue(low0) : null;
  // "no cambies nada, solo dime si aceptan 3.5": the decimal is the quantity being asked about
  const holdDecimal = !issue0 && HOLD.test(low0) && !hypo ? low0.match(/(?<![\d.,$])(\d+[.,]\d+)(?![\d.,])/) : null;
  const issue: QuantityIssue | null = issue0 || (holdDecimal && !UNIT_NEXT.test(low0.slice((holdDecimal.index ?? 0) + holdDecimal[0].length)) ? { kind: "decimal", raw: holdDecimal[1] } : null);
  // the message addresses a field of THIS case ("actualiza solo la cantidad"): it is never read as a
  // follow-up of an earlier calculation or of another product's question
  const caseDirected =
    !isMath &&
    (holdMsg || !!issue || /\b(?:actualiz\w*|cambi\w*|corrij\w*|correg\w*|modific\w*|ajust\w*|update|change|correct|set)\b[^.;]{0,40}\b(?:cantidad|presupuesto|quantity|budget)\b|\b(?:solo|s[oó]lamente|[uú]nicamente)\s+(?:la\s+cantidad|el\s+presupuesto)\b|\bonly\s+the\s+(?:quantity|budget)\b/i.test(low0));
  // "sí, aplícalo" right after a held proposal: the proposal is applied (validated again)
  const prevSpec = specs[specs.length - 1];
  // the pending proposal: the separate store when the page passes it, else the previous reply's
  const pendingIn: PendingProposal | null | undefined =
    "pending" in caseFacts ? caseFacts.pending : prevSpec?.held ? { proposal: prevSpec.held, base: prevSpec.heldBase || {} } : null;
  // the stored proposal must be the one the previous reply offered (a proposal whose removal failed,
  // or one from another tab state, is never applied by a later "sí")
  const pending = pendingIn && (!specs.length || (prevSpec?.held && JSON.stringify(prevSpec.held) === JSON.stringify(pendingIn.proposal))) ? pendingIn : null;
  // only a plain confirmation confirms: "sí, pero cambia la cantidad a 9" or "sí, mejor bombas" are
  // new instructions (handled below as such; the old proposal is dropped)
  // "si no es mucha molestia", "si es así…": "si" opening a clause is "if", never "yes"
  const ifClause = /^\s*si\s+(?!(?:aplica\w*|apl[ií]ca\w*|dale|claro|correcto|por\s+favor|gracias|c[aá]mbia\w*|confirmo|adelante)\b)[a-záéíóúñ]+/i.test(text);
  const plainConfirm =
    !ifClause &&
    !/[?¿]/.test(text) &&
    (/^\s*(?:confirm\w*|apl[ií]ca\w*|aplic[aá]\w*|adelante|proced[eé]\w*|dale|ok(?:ay)?|va|listo|h[aá]celo|hacelo|de\s+acuerdo|go\s+ahead|apply\s+it|do\s+it)\b[\s,.!]*(?:apl[ií]ca\w*|aplic[aá]\w*|h[aá]celo|por\s+favor|please|gracias)?[\s,.!]*$/i.test(text) || /^\s*s[ií]\s*[,.!]?\s*(?:apl[ií]ca\w*|aplic[aá]\w*|dale|h[aá]celo|por\s+favor|please|gracias|claro|confirmo)?[\s,.!]*$/i.test(text) || /^\s*(?:yes|yep|correct|correcto|exacto|right|claro|as[ií]\s+es|afirmativo)\s*[,.!]?\s*(?:apply\s+it|aplícalo|aplicalo|please|por\s+favor)?[\s,.!]*$/i.test(text)) &&
    !/\d/.test(text) && !productStatement(text) && !/\b(?:pero|but|mejor|instead|en\s+vez|en\s+lugar|no|not|si\s+no)\b/i.test(text.replace(/^\s*s[ií]\b/i, ""));
  if (pending && !hypo && plainConfirm && !holdMsg && !ban.all) {
    const h = pending.proposal;
    // the case changed since the proposal (the form, another message, a new case): ask again on
    // the case as it is now, never apply a proposal made for another state
    const moved =
      (pending.base.caseId !== undefined && pending.base.caseId !== caseFacts.caseId) ||
      (pending.base.rev !== undefined && pending.base.rev !== caseFacts.rev);
    if (moved)
      return {
        text, product: caseProduct, previous: caseProduct, fieldUpdate: true, hold: true, heldStale: true,
        held: h, heldBase: { caseId: caseFacts.caseId, rev: caseFacts.rev },
        caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
      };
    const q = h.quantity && validQuantity(h.quantity) && h.quantity !== caseQty ? h.quantity : undefined;
    const b = h.budget && h.budget >= 1 && h.budget <= 100_000_000 && h.budget !== caseBudget ? h.budget : undefined;
    const prod = h.attrFix && h.product ? h.product : undefined;
    const clear = !!h.budgetClear && !!caseBudget;
    return {
      text, product: prod || caseProduct, previous: caseProduct, fieldUpdate: true, heldApplied: true,
      budgetClear: clear || undefined,
      newQuantity: q, oldQuantity: q ? caseQty || undefined : undefined,
      newBudget: b, oldBudget: b && caseBudget ? caseBudget : undefined,
      attrFix: prod ? h.attrFix : undefined, newProduct: prod,
      caseNow: { product: prod || caseProduct, quantity: q || caseQty || undefined, budget: clear ? undefined : b || caseBudget || undefined },
    };
  }
  // "¿El tanque de 300 litros sirve?", "¿Tienen tanque de 300 litros?": a QUESTION about a value,
  // with no request to change it, never changes the case (it used to replace 500 L by 300 L)
  const questionOnly = /[¿?]/.test(text) && !CHANGE_REQUEST.test(low0);
  const qRaw0 = questionOnly ? null : quantityChange(text, head);
  // "agrega 2 más": the new total is confirmed with the client, never applied silently
  const askRelative = qRaw0?.relative && !hypo ? { delta: qRaw0.relative, from: caseQty, to: caseQty + qRaw0.relative } : undefined;
  // "el presupuesto sube a 6 mil": that number is the budget, not a quantity
  const bEarly = budgetChange(text);
  // "5 unidades" alone is the case's quantity; inside a calculation ("333 piezas a US$0.035",
  // "perdón, son 600 piezas" after a pack question) it belongs to that calculation
  const nounOut = !!qRaw0?.noun && (!caseProduct || kinds.length > 0 || /(?:us\$|usd|\$|\bq\s?\d)/i.test(text) || !!specs[specs.length - 1]?.mathText);
  const qRaw = qRaw0?.relative || nounOut || (bEarly && qRaw0 && qRaw0.qty === bEarly.value) ? null : qRaw0;
  // "la cantidad a 3.5 / 0 / 20,000,000": not a valid order quantity, said instead of applied
  const qtyInvalid: ReplySpec["qtyInvalid"] = issue?.kind;
  const qtySame = !!qRaw && !!caseQty && qRaw.qty === caseQty;
  const qtyConflict = qRaw?.keepSaid && caseQty && qRaw.qty !== caseQty ? { said: qRaw.qty, inCase: caseQty } : undefined;
  // "cambia a 300" names no field: with measures in the description it is asked, never guessed
  const askNumber = qRaw?.bare && caseProduct && new RegExp(MEASURE, "i").test(caseProduct) ? qRaw.qty : undefined;
  const qcEarly = qRaw && !qtySame && !qtyConflict && !askNumber ? qRaw : null;
  const isQtyChange = !!qcEarly && (qcEarly.before === caseQty || (!qcEarly.before && !specs[specs.length - 1]?.mathText));
  if (!isMath && !isQtyChange && !caseDirected && (!kinds.length || stockLine))
    for (const x of [...specs].reverse()) {
      if (!x.mathText) continue;
      follow = followUpMath(text, x.mathText);
      if (follow) { lastMath = x.mathText; break; }
    }
  // the order written in two messages: "necesito 500 piezas" then "vienen 24 por caja",
  // or "¿cuántas cajas necesito?" then "500 piezas, cajas de 24"
  let combined: string | undefined;
  if (!follow && !caseDirected && !(isMath && packMath(text) && packMath(text)!.mode !== "ask")) {
    const earlier = [...specs].reverse().filter((x) => !/^\s*(?:hola|buen[oa]s?\b|hi|hello|ok|gracias|thanks)\W*$/i.test(x.text)).slice(0, 1)[0];
    const earlierDone = earlier?.mathText ? packMath(earlier.mathText, true) : null;
    if (earlier && /\d|cu[aá]nt|how\s+many/i.test(earlier.text) && !(earlierDone && earlierDone.mode !== "ask" && !earlierDone.invalid)) {
      const joined = `${earlier.text}. ${text}`;
      const m = packMathAll(joined).length ? null : packMath(joined, true);
      if (m && m.mode !== "ask" && !m.invalid && !m.zeroOrder) combined = joined;
    }
  }
  const single = isMath && !packMathAll(text).length ? packMath(text) : null;
  // a calculation that still needs data is kept as the client wrote it
  const mathText = combined
    ? mathStatement(packMath(combined, true)!) || combined
    : isMath ? (single && mathStatement(single)) || text : follow ? mathStatement(follow) || undefined : undefined;
  // a calculation is not a product statement nor a quantity change
  // "quiero contratar a SEAL" names no product
  // an explicit change ("ahora el producto es un molino") counts in any message, also with a contact request
  const lastAiSpec = specs[specs.length - 1];
  // the answer to "¿tu producto ahora es «X»?" asked in the previous reply
  const answer = lastAiSpec?.confirmProduct !== undefined ? confirmAnswer(text) : "";
  const st0 = productStatement(text);
  // "ahora necesito 4 compresores" with «compresores industriales de tornillo, 220 V…» in force:
  // the same product named shorter, not a new description (its characteristics are kept)
  const restatedOf = (d: string | null | undefined) => !!d && !!caseProduct && sameProduct(d, caseProduct) && subsetOf(d, caseProduct);
  const restatedSt = !!st0 && restatedOf(st0.description);
  // "¿Y si cambio de producto: ahora quiero importar bombas?": a hypothesis never changes the product;
  // "en realidad son 7 unidades, no 4": "unidades, no 4" is a quantity correction, not a product
  const notAProduct = (d?: string | null) => !!d && (/^(?:\d+\s+)?(?:unidades?|units?|piezas?|pieces?|equipos?|items?|art[ií]culos?|pcs)\b/i.test(d.trim()) || /\b(?:no|not)\s+\d/.test(d.toLowerCase()));
  const st = restatedSt || hypo || notAProduct(st0?.description) ? null : st0;
  // a product confirmation must be plain ("sí, pero de 5 HP" is a new description, not a yes)
  const changedTo = st?.description || (answer === "yes" && plainConfirm && lastAiSpec?.confirmProduct ? lastAiSpec.confirmProduct : null);
  const pfm0 = !changedTo && !mathText && !hypo ? productFromMessage(text) : null;
  const pfm = notAProduct(pfm0) ? null : pfm0;
  const restated = restatedSt || restatedOf(pfm);
  // its quantity ("4 compresores") is the case's quantity
  const restDesc = restatedSt ? st0!.description : pfm || "";
  const restQtyM = restated ? normalizeNumbers(text.toLowerCase()).match(new RegExp(`\\b(\\d+)\\s+(?:de\\s+)?${(restDesc.toLowerCase().match(/[a-záéíóúüñ]{3,}/) || [""])[0]}`)) : null;
  const restQty = restatedSt && st0!.quantity ? st0!.quantity : restQtyM ? Number(restQtyM[1]) : 0;
  const qcR = !qcEarly && restQty >= 1 && restQty !== caseQty ? { qty: restQty, before: caseQty } : null;
  const qc0 = mathText ? null : qcEarly || qcR;
  // characteristics corrected ("es 440 V, no 220 V", "el tanque de 300 litros"): the rest stays
  // (never inside a calculation: "necesito 1,001 lápices…" is not a 1,001 L tank)
  const fix = !changedTo && caseProduct && !hypo && !questionOnly && !isMath && !kinds.includes("math") && !kinds.includes("subtotal") && !kinds.includes("pairs") ? attributeCorrection(text, caseProduct) : null;
  // the purchase budget ("solo actualiza el presupuesto a US$5,000") is money, never a quantity
  const bRaw = mathText || changedTo || questionOnly || kinds.includes("subtotal") || kinds.includes("pairs") || kinds.includes("math") ? null : budgetChange(text);
  const budgetAsk = bRaw?.currency === "GTQ" || undefined;
  // a budget stated WITH a new product ("ahora quiero importar bombas, presupuesto US$3,000") is that
  // product's budget: it was dropped before, so the form and the summary lost it
  const bProd = changedTo && !hypo && !mathText ? budgetChange(text) : null;
  const budgetOfNewProduct = bProd && bProd.currency === "USD" && !budgetIssue(low0) && !valueTokenIssue(text, bProd.value) ? bProd.value : undefined;
  const newBudget = (bRaw && !budgetAsk && bRaw.value !== caseBudget ? bRaw.value : undefined) ?? budgetOfNewProduct;
  // a message that updates fields of the case names no new product (its nouns are the same product)
  const budgetClear = !mathText && !hypo && /\b(?:quit\w*|elimin\w*|borr\w*|remove|delete)\s+(?:el\s+|mi\s+|the\s+)?(?:presupuesto|budget)\b|\bsin\s+presupuesto\b|\bno\s+tengo\s+presupuesto\b/i.test(text) && !!caseBudget;
  const fieldMsg = !changedTo && !hypo && !mathText && !!(fix || qc0 || newBudget || budgetAsk || askNumber || qtyConflict || qtySame || restated || askRelative || qtyInvalid || budgetClear || (bRaw && keepRest));
  // "¿y si fueran 5 unidades?", "suponiendo un presupuesto de US$6,000": answered without changing the case
  const caseUnits = new Set([...String(caseProduct || "").matchAll(new RegExp(MEASURE, "gi"))].map((m) => UNIT_KEY(m[2])));
  const hypoCase =
    hypo && !!caseProduct && !mathText && !changedTo && !follow &&
    ((!kinds.length &&
      (/\d/.test(text) || /\b(?:cantidad|presupuesto|unidades|pedido|quantity|budget|units|order)\b/i.test(text) || [...text.matchAll(new RegExp(MEASURE, "gi"))].some((m) => caseUnits.has(UNIT_KEY(m[2]))))) ||
      // another product, as a hypothesis
      !!st0 || /\b(?:producto|product|art[ií]culo)\b/i.test(text));
  const newProduct =
    changedTo ||
    fix?.description ||
    (mathText || qc0 || fieldMsg || keepRest || hypo || bRaw || qRaw || kinds.includes("pairs") || kinds.includes("contact") || kinds.includes("subtotal") ? undefined : pfm || undefined);
  // a real doubt is asked, never resolved by keeping the old product silently:
  // the current product ruled out with nothing in its place, or another product named in a request to SEAL
  let confirmProduct: string | undefined;
  if (!newProduct && caseProduct && !fieldMsg && !keepRest) {
    const head = productHeads(caseProduct);
    const neg = negatedProducts(text);
    const other = productMention(text);
    if (neg.some((n) => head.has(n))) confirmProduct = "";
    else if (kinds.includes("contact") && other && !sameProduct(other, caseProduct)) confirmProduct = other;
  }
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cq = confirmProduct ? normalizeNumbers(text.toLowerCase()).match(new RegExp(`(\\d+)\\s+(?:de\\s+)?${esc(confirmProduct.toLowerCase().split(/\s+/)[0])}`)) : null;
  const confirmQuantity = cq && Number(cq[1]) >= 1 ? Number(cq[1]) : undefined;
  const yesQty = answer === "yes" && lastAiSpec?.confirmQuantity ? { qty: lastAiSpec.confirmQuantity, before: 0 } : null;
  // a product named inside a question ("¿el CE sirve para lápices?") becomes the context silently
  const mentioned = !newProduct && !mathText && !fieldMsg && !keepRest && !hypoCase && !kinds.includes("contact") && !kinds.includes("subtotal") ? productMention(text) || undefined : undefined;
  // only a certificate answer that asked "¿qué producto?" is answered again for the new product
  const lastAi = specs[specs.length - 1];
  const askedForProduct = !!lastAi && !lastAi.product && replyKinds(lastAi.reask || lastAi.text).includes("certificate");
  // the quantity said with a new product ("3 compresores") is that product's quantity
  const qcAny = qc0 || (st?.quantity ? { qty: st.quantity, before: 0 } : null) || yesQty;
  // every path that proposes a quantity goes through the same range check (restated product,
  // new product statement, "sí" to a question): 10,000,001 is never applied by any of them
  const outOfRange: QuantityIssue | null = qcAny && !validQuantity(qcAny.qty) ? { kind: qcAny.qty > QTY_MAX ? "max" : qcAny.qty < QTY_MIN ? "zero" : "decimal", raw: String(qcAny.qty) } : null;
  const qc = outOfRange ? null : qcAny;
  // "cambia la cantidad de 7 a 8" when the case has 4: the client and the case disagree; asked
  const fromMismatch = qc && qc.before && caseQty && qc.before !== caseQty && fieldMsg && !hypo ? { said: qc.before, inCase: caseQty, to: qc.qty } : undefined;
  const spec: ReplySpec = {
    mathText,
    combined,
    previousMath: follow ? lastMath : undefined,
    newQuantity: qc?.qty,
    oldQuantity: qc && !st ? (fieldMsg ? caseQty || qc.before : qc.before || currentQuantity) || undefined : undefined,
    attrFix: fix ? { from: fix.from, to: fix.to } : undefined,
    newBudget,
    oldBudget: newBudget && caseBudget ? caseBudget : undefined,
    fieldUpdate: fieldMsg || undefined,
    askNumber,
    askRelative,
    qtyInvalid,
    budgetClear: budgetClear || undefined,
    qtyConflict,
    budgetAsk,
    hypothetical: hypoCase || undefined,
    caseNow:
      fieldMsg || hypoCase
        ? { product: fix?.description || caseProduct, quantity: (fieldMsg && qc?.qty) || caseQty || undefined, budget: budgetClear ? undefined : newBudget || caseBudget || undefined }
        : undefined,
    confirmProduct,
    confirmQuantity,
    text,
    product: newProduct || mentioned || currentProduct,
    newProduct,
    explicitChange: !!changedTo || undefined,
    mentioned,
    previous: caseProduct,
    reask: askedForProduct ? lastAi.reask || lastAi.text : undefined,
    earlierFood: specs.some((x) => (replyKinds(x.text).includes("certificate") || !!x.reask) && foodAdvice(x.product)),
  };
  // the digits each value was read from must be the whole amount ("10 000 001" is not 10, "7-8" is not 7)
  // a characteristic of zero ("0 litros", "0 Hz") is never a valid correction: asked
  const zeroFix: QuantityIssue | null = fix && /(?:^|[^\d.,])0+(?:[.,]0+)?\s*[a-z]/i.test(` ${fix.to}`) ? { kind: "ambiguous", raw: fix.to } : null;
  const tokenIssue: QuantityIssue | null = zeroFix ||
    (qc && validQuantity(qc.qty) && !hypo ? valueTokenIssue(text, qc.qty) : null) ||
    (newBudget && !hypo ? (() => { const b = valueTokenIssue(text, newBudget); return b ? { kind: "budgetAmbiguous" as const, raw: b.raw } : null; })() : null);
  const bad = issue || outOfRange || tokenIssue;
  if (!bad && fromMismatch)
    return {
      text, product: caseProduct || currentProduct, previous: caseProduct, fieldUpdate: true, hold: true, fromMismatch,
      caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
      earlierFood: spec.earlierFood,
    };
  // explicit prohibitions: a forbidden field is never changed, whatever else the message says
  const forbidden: CaseField[] = [];
  if (!bad && !holdMsg && !hypo) {
    const asks: [CaseField, boolean][] = [
      ["quantity", !!spec.newQuantity],
      ["budget", !!(spec.newBudget || spec.budgetClear)],
      ["spec", !!spec.attrFix && (ban.all || !ban.fields.has("spec") || specForbidden(ban.specWords, spec.attrFix))],
      ["product", !!spec.newProduct && !spec.attrFix],
    ];
    for (const [f, on] of asks) if (on && (ban.all || ban.fields.has(f))) forbidden.push(f);
    if (spec.attrFix && ban.fields.has("spec") && !ban.all && !specForbidden(ban.specWords, spec.attrFix)) ban.spans.push(""); // another characteristic: allowed
    // "no pongas 8 en la cantidad": a question about that number is not asked either
    if ((ban.all || ban.fields.has("quantity")) && (spec.askNumber || spec.askRelative || spec.qtyConflict) && !forbidden.includes("quantity")) {
      forbidden.push("quantity");
      spec.askNumber = undefined;
      spec.askRelative = undefined;
      spec.qtyConflict = undefined;
    }
    if (forbidden.length) {
      if (forbidden.includes("quantity")) { spec.newQuantity = undefined; spec.oldQuantity = undefined; }
      if (forbidden.includes("budget")) { spec.newBudget = undefined; spec.oldBudget = undefined; spec.budgetClear = undefined; }
      if (forbidden.includes("spec")) { spec.attrFix = undefined; if (fix && spec.newProduct === fix.description) spec.newProduct = undefined; }
      if (forbidden.includes("product")) { spec.newProduct = undefined; spec.explicitChange = undefined; spec.stale = undefined; }
      spec.forbidden = forbidden;
      const left = !!(spec.newQuantity || spec.newBudget || spec.budgetClear || spec.attrFix || spec.newProduct);
      if (!left)
        return {
          text, product: caseProduct || currentProduct, previous: caseProduct, fieldUpdate: true, hold: true, forbidden,
          caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
          earlierFood: spec.earlierFood,
        };
      spec.fieldUpdate = true;
      spec.product = spec.newProduct || caseProduct || currentProduct;
      spec.caseNow = { product: spec.attrFix && spec.newProduct ? spec.newProduct : caseProduct, quantity: spec.newQuantity || caseQty || undefined, budget: spec.budgetClear ? undefined : spec.newBudget || caseBudget || undefined };
    }
  }
  // a change whose message also carries a negation, condition, deferral or question this parser did
  // not resolve is never applied: it is proposed (fields) or asked (product). Also "cambia la
  // cantidad a 300 litros": the field named and the value given disagree.
  // (a calculation is information, not a change of the case: it is answered as before)
  if (!bad && !holdMsg && !hypo && !spec.mathText) {
    const mutating = !!(spec.newQuantity || spec.newBudget || spec.budgetClear || spec.attrFix || spec.newProduct);
    if (mutating) {
      const hints = [
        spec.newQuantity ? String(spec.newQuantity) : "",
        spec.newQuantity ? spec.newQuantity.toLocaleString("en-US") : "",
        spec.newBudget ? String(Math.trunc(spec.newBudget)) : "",
        spec.newBudget ? Math.trunc(spec.newBudget).toLocaleString("en-US") : "",
        spec.attrFix ? (spec.attrFix.to.match(/\d+/) || [""])[0] : "",
        spec.newProduct && !spec.attrFix ? (spec.newProduct.toLowerCase().match(/[a-záéíóúüñ]{4,}/) || [""])[0] : "",
        spec.budgetClear ? "presupuesto" : "",
        spec.budgetClear ? "budget" : "",
      ].filter(Boolean);
      const unsure = uncertainMarkers(text, ban.spans, hints);
      // (a quantity said WITH a new product statement is read by the product parser, not here)
      const productStated = !!spec.newProduct && !spec.attrFix;
      const productHead = productStated ? (spec.newProduct!.toLowerCase().match(/[a-záéíóúüñ]{4,}/) || [""])[0] : undefined;
      const fu = fullyUnderstood(text, { quantity: productStated ? undefined : spec.newQuantity, budget: spec.newBudget, budgetClear: spec.budgetClear, fixTo: spec.attrFix?.to, fixFrom: spec.attrFix?.from, product: spec.attrFix ? spec.newProduct || fix?.description || caseProduct : productStated ? spec.newProduct : caseProduct, head, productHead, current: { quantity: caseQty || undefined, budget: caseBudget || undefined } }, ban.spans);
      if (!fu.ok) unsure.push(`unparsed:${fu.why}`);
      if (spec.newProduct && !spec.attrFix && !cleanProductName(spec.newProduct)) unsure.push(`product:${spec.newProduct.slice(0, 40)}`);
      // the SAME product described again must not silently lose characteristics the case has
      // ("ahora son 7 compresores, gracias" is not a new description without 220 V, 60 Hz…)
      if (spec.newProduct && !spec.attrFix && caseProduct && sameProduct(spec.newProduct, caseProduct)) {
        const measures = [...caseProduct.toLowerCase().matchAll(new RegExp(MEASURE, "gi"))].map((m) => m[0].replace(/\s+/g, ""));
        const np = spec.newProduct.toLowerCase().replace(/\s+/g, "");
        if (measures.some((m) => !np.includes(m))) unsure.push("product:drops-characteristics");
      }
      if (spec.attrFix && !spec.newQuantity && /\b(?:cantidad|quantity)\b/i.test(text) && !/\b(?:tanque|tank|capacidad|capacity|voltaje|voltage)\b/i.test(text)) unsure.push("field:quantity≠unit");
      if (unsure.length) {
        // only a DEFERRAL ("antes confirmame", "pending my approval") or a field/unit clash leaves a
        // proposal that "sí" can apply; a negation or a condition ("no quiero 8", "quizás 8",
        // "¿serán 8?") leaves nothing to confirm: the client is asked to say it directly
        const proposable = unsure.every((u) => /^(?:deferral|field):/.test(u));
        if (!proposable)
          return {
            text, product: caseProduct || currentProduct, previous: caseProduct, fieldUpdate: true, hold: true, unsure,
            caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
            earlierFood: spec.earlierFood,
          };
        if (spec.newProduct && !spec.attrFix) {
          const name = productOnly(spec.newProduct);
          return { text, product: caseProduct || currentProduct, previous: caseProduct, confirmProduct: name, confirmQuantity: spec.newQuantity, unsure, earlierFood: spec.earlierFood };
        }
        const held: HeldProposal = { quantity: spec.newQuantity, budget: spec.newBudget, budgetClear: spec.budgetClear, attrFix: spec.attrFix, product: spec.attrFix ? spec.newProduct || fix?.description : undefined };
        return {
          text, product: caseProduct || currentProduct, previous: caseProduct, fieldUpdate: true, hold: true, unsure,
          held, heldBase: { caseId: caseFacts.caseId, rev: caseFacts.rev },
          caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
          earlierFood: spec.earlierFood,
        };
      }
    }
  }
  if (!bad && !holdMsg) return spec;
  // "Ahora quiero importar bombas, pero confirmame antes": the product change is asked, not applied
  if (!bad && holdMsg && spec.newProduct && !spec.attrFix && !hypo) {
    const name = productOnly(spec.newProduct);
    return { text, product: caseProduct || currentProduct, previous: caseProduct, confirmProduct: name, confirmQuantity: spec.newQuantity, earlierFood: spec.earlierFood };
  }
  // Blocked: a message with an invalid value, or one that says not to change anything, changes
  // NOTHING (all or nothing: no half-applied corrections). The case stays exactly as it was and
  // the reply is built from that unchanged case.
  const proposal = holdMsg && !bad ? { quantity: qc?.qty, budget: newBudget, attrFix: spec.attrFix, product: fix?.description } : undefined;
  const hasProposal = !!proposal && !!(proposal.quantity || proposal.budget || proposal.attrFix);
  return {
    text,
    product: caseProduct || currentProduct,
    previous: caseProduct,
    fieldUpdate: true,
    hold: holdMsg || undefined,
    held: hasProposal ? proposal : undefined,
    heldBase: hasProposal ? { caseId: caseFacts.caseId, rev: caseFacts.rev } : undefined,
    qtyInvalid: bad?.kind,
    qtyRaw: bad?.raw,
    caseNow: { product: caseProduct, quantity: caseQty || undefined, budget: caseBudget || undefined },
    earlierFood: spec.earlierFood,
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
