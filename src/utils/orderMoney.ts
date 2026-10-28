// Deterministic order money and explanatory phrases for the chat.
//
// 1. Explanations are not orders: "Aclaro la equivalencia: 1 par = 2 zapatos",
//    "un par equivale a 2 zapatos", "es un solo pedido" are removed before any
//    calculation (their numbers are never read as quantities or as a 2nd order).
//    A pack equivalence ("1 set = 12 lápices") is rewritten as the pack content.
//    A standard equivalence with an unusual value ("1 par = 3 zapatos") is asked.
// 2. Money is read apart from quantities: the price (and what it is the price
//    of: unit, pair, box, set…), the client's purchase budget, and the currency.
//    All arithmetic is done in integer ten-thousandths of a currency unit, so
//    US$0.03 × 2,000 is exactly US$60.00 and US$59.99 leaves US$0.01 short.
import { Lx } from "./lang";

// ── 1. Explanations ─────────────────────────────────────────────────────────
const STD: [RegExp, number, string][] = [
  [/^(?:par|pares|pair|pairs)$/, 2, "pair"],
  [/^(?:docena|docenas|dozen|dozens)$/, 12, "dozen"],
];
const NOUN = "[a-záéíóúüñ]+";
const EQ_VERB = "(?:=|equivale(?:n)?\\s+a|es\\s+igual\\s+a|son\\s+igual\\s+a|equals?|is\\s+equal\\s+to|corresponde(?:n)?\\s+a)";
const LEAD = "(?:(?:aclaro|aclaraci[oó]n|ojo|nota|note|para\\s+que\\s+quede\\s+claro|to\\s+be\\s+clear|just\\s+to\\s+clarify)(?:\\s+(?:la|que\\s+la|the))?(?:\\s+(?:equivalencia|equivalence))?\\s*(?:es|is)?\\s*[:,.-]?\\s*|(?:la\\s+|the\\s+)?(?:equivalencia|equivalence)\\s*(?:es|is)?\\s*[:,-]?\\s*)?";

export interface Explained {
  text: string; // the message without its explanations (what the calculator reads)
  removed: string[]; // the explanations, as written
  odd?: { unit: string; n: number; std: number }; // "1 par = 3 zapatos"
  assumedUsd?: boolean; // a price written without currency ("cuesta 3"): read as US$, and said so
}

/** Removes explanatory equivalences and "es un solo pedido" from a message. */
export function explain(raw: string): Explained {
  let t = String(raw || "");
  const removed: string[] = [];
  let odd: Explained["odd"];
  const take = (re: RegExp, fn: (m: string, ...g: string[]) => string | null) => {
    t = t.replace(re, (m: string, ...g: string[]) => {
      const out = fn(m, ...g);
      if (out === null) return m;
      removed.push(m.trim());
      return out;
    });
  };
  // "1 par = 2 zapatos", "un par equivale a 2 zapatos", "cada par son 2 zapatos", "a pair is 2 shoes"
  take(
    new RegExp(`${LEAD}\\b(?:1|un|una|cada|a|one|each)\\s+(par|pair|docena|dozen)\\s*(?:${EQ_VERB}|son|es|tiene|trae|contiene|is|has|contains|=)\\s*(\\d+(?:[.,]\\d+)?|dos|doce|two|twelve)(?:\\s+(${NOUN}))?(?:\\s+(?:individuales|sueltos|sueltas|single))?\\s*[.;,]?`, "gi"),
    (_m, unit, num) => {
      const n = ({ dos: 2, doce: 12, two: 2, twelve: 12 } as Record<string, number>)[num.toLowerCase()] ?? Number(num.replace(",", "."));
      const std = STD.find(([r]) => r.test(unit.toLowerCase()));
      if (!std) return null;
      if (n !== std[1]) odd = { unit: unit.toLowerCase(), n, std: std[1] };
      return " ";
    },
  );
  // "2 zapatos = 1 par", "2 zapatos hacen un par", "12 piezas forman una docena"
  take(
    new RegExp(`${LEAD}\\b(\\d+|dos|doce|two|twelve)\\s+${NOUN}\\s*(?:=|hacen|forman|equivalen\\s+a|son|make|equal)\\s+(?:1|un|una|a|one)\\s+(par|pair|docena|dozen)\\b\\s*[.;,]?`, "gi"),
    (_m, num, unit) => {
      const n = ({ dos: 2, doce: 12, two: 2, twelve: 12 } as Record<string, number>)[num.toLowerCase()] ?? Number(num);
      const std = STD.find(([r]) => r.test(unit.toLowerCase()))!;
      if (n !== std[1]) odd = { unit: unit.toLowerCase(), n, std: std[1] };
      return " ";
    },
  );
  // a pack equivalence is the pack content: "1 set = 12 lápices" → "cada set trae 12 lápices"
  take(
    new RegExp(`\\b(?:1|un|una|cada|each|one)\\s+(sets?|juegos?|cajas?|box|paquetes?|packs?|bolsas?|bags?|kits?|estuches?|cases?)\\s*${EQ_VERB}\\s*(\\d+)\\s+(${NOUN})`, "gi"),
    (_m, pack, n, noun) => ` cada ${pack.toLowerCase()} trae ${n} ${noun} `,
  );
  // "es un solo pedido", "no son dos pedidos", "it's a single order"
  take(
    /(?:\b(?:y\s+)?(?:es|son|ser[aá]|is|it'?s|this\s+is)\s+)?\b(?:un|una|a)\s+(?:sol[oa]|[uú]nic[oa]|single)\s+(?:pedido|orden|compra|order|purchase)\b\s*[.;,]?|\b(?:solo\s+es|es\s+solo)\s+un\s+pedido\b\s*[.;,]?|\bno\s+(?:es|son)\s+(?:otro|dos|varios)\s+pedidos?\b\s*[.;,]?|\b(?:just\s+)?one\s+order(?:\s+only)?\b\s*[.;,]?|\bnot\s+(?:two|separate)\s+orders\b\s*[.;,]?/gi,
    () => " ",
  );
  // a bare figure after a price word is money, never a pack content ("precio 3 por caja")
  let assumedUsd = false;
  t = t.replace(/(\b(?:cuesta|cuestan|vale|valen|precio(?:\s+unitario)?(?:\s+(?:es|de))*|costs?|price(?:\s+is)?)\s*:?\s*)(?=\d)(?!\d+(?:[.,]\d+)?\s*(?:quetzales?|gtq|d[oó]lares?|dollars?|usd)\b)/gi, (m) => {
    assumedUsd = true;
    return `${m}US$`;
  });
  t = t.replace(/\s+([.,;?])/g, "$1").replace(/([.;,])\s*([.;,])+/g, "$1").replace(/\s{2,}/g, " ").trim();
  return { text: t, removed, ...(odd ? { odd } : {}), ...(assumedUsd ? { assumedUsd } : {}) };
}

/** The message as the calculator should read it: no explanations and no money (idempotent). */
export const forMath = (text: string): string =>
  explain(text).text.replace(new RegExp(MONEY_RE.source, "gi"), (m, ...g) => {
    // "q" inside a word is not money
    const at = g[g.length - 2] as number;
    const str = g[g.length - 1] as string;
    return /^q/i.test(m) && /[a-záéíóúüñ]/i.test(str.slice(at - 1, at)) ? m : " ";
  }).replace(/\s{2,}/g, " ").trim();

/** The reply when an equivalence contradicts the usual one ("1 par = 3 zapatos"). */
export function oddEquivalenceReply(o: NonNullable<Explained["odd"]>): string {
  const es = /^(?:par|pares|pair|pairs)$/.test(o.unit) ? "par" : "docena";
  const en = es === "par" ? "pair" : "dozen";
  return Lx(
    `Indicaste que 1 ${es} = ${o.n}, pero normalmente 1 ${es} = ${o.std}. Antes de calcular, confírmame: ¿cada ${es} de tu proveedor trae ${o.n} o ${o.std}? Si el proveedor usa otra medida, escríbela como contenido del empaque (por ejemplo «cada set trae ${o.n} piezas»).`,
    `You wrote 1 ${en} = ${o.n}, but usually 1 ${en} = ${o.std}. Before calculating, please confirm: does each ${en} from your supplier hold ${o.n} or ${o.std}? If the supplier uses another measure, write it as the pack content (for example "each set holds ${o.n} pieces").`,
  );
}

// ── 2. Money ────────────────────────────────────────────────────────────────
export type Currency = "USD" | "GTQ";
export interface Money { e4: number; cur: Currency; raw: string }
/** "unit" (cada uno / pieza / unidad / the item), "pair", "dozen", a pack word ("caja", "set"…), or "" when not said. */
export interface Price extends Money { basis: string }
export interface OrderMoney {
  price?: Price;
  budget?: Money & { scope: "compra" | "importacion" };
  conflict?: "twoPrices" | "badPrice" | "badBudget";
  assumedUsd?: boolean;
}

const E4 = 10000;
const toE4 = (s: string): number | null => {
  let v = s.trim();
  // "1,200.50" / "1.200,50" / "0,03" / "59.99"
  if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?$/.test(v)) v = v.replace(/,/g, "");
  else if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(v)) return null;
  const [i, d = ""] = v.split(".");
  if (d.length > 4) return Math.round(Number(v) * E4);
  return Number(i) * E4 + Number((d + "0000").slice(0, 4));
};
const AMOUNT = "(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)";
const CUR_BEFORE = "(us\\$|usd|u\\$s|\\$|q\\.?|gtq)";
const CUR_AFTER = "(usd|d[oó]lares?|dollars?|quetzales?|gtq)";
const MONEY_RE = new RegExp(`(?:(-|−)\\s*)?(?:${CUR_BEFORE}\\s*${AMOUNT}(?:\\s*${CUR_AFTER})?|${AMOUNT}\\s*${CUR_AFTER})`, "gi");
const curOf = (a?: string, b?: string): Currency => (/^q|quetzal|gtq/i.test(`${a || ""}${b || ""}`) ? "GTQ" : "USD");

const UNIT_W = /^(?:un[oa]|unidad(?:es)?|pieza|piezas|pz|pza|unit|units|piece|pieces|item|items|each|apiece|c\/u|individual)$/i;
const PACK_W = /^(?:sets?|juegos?|cajas?|box(?:es)?|paquetes?|packs?|estuches?|cases?|bolsas?|bags?|kits?|cartones|cart[oó]n|cartons?|rollos?|rolls?|pacas?|bales?|bultos?|fardos?|bundles?|bandejas?|trays?|tarimas?|pallets?|displays?|masters?|inners?)$/i;
const PAIR_W = /^(?:par|pares|pair|pairs)$/i;
const DOZ_W = /^(?:docena|docenas|dozen|dozens)$/i;
function basisOf(word: string, item: string): string {
  const w = word.toLowerCase().replace(/[.]/g, "");
  if (!w) return "";
  if (UNIT_W.test(w)) return "unit";
  if (PAIR_W.test(w)) return "pair";
  if (DOZ_W.test(w)) return "dozen";
  if (PACK_W.test(w)) return w.replace(/(?:es|s)$/, "").replace(/^box$/, "caja").replace(/^juego$/, "set").replace(/^pack$/, "paquete").replace(/^bag$/, "bolsa").replace(/^carton$/, "cartón");
  // the item itself ("cada guante cuesta", "US$0.03 por lápiz") is a unit price
  if (item && w.slice(0, 4) === item.toLowerCase().slice(0, 4)) return "unit";
  return "";
}

const BUDGET_BEFORE = /(?:presupuesto|budget|dispongo\s+de|cuento\s+con|tengo\s+(?:solo|s[oó]lamente|nada\s+m[aá]s|un\s+total\s+de)?|puedo\s+(?:gastar|pagar|invertir)|me\s+alcanza\s+con|i\s+(?:only\s+)?have|i\s+can\s+spend|can\s+(?:only\s+)?spend|max(?:imo|imum)?\s+(?:de\s+)?(?:gasto|spend))[^.;\d$]{0,40}$/i;
const IMPORT_SCOPE = /(?:total|todo\s+incluido|puesto\s+en\s+guatemala|con\s+(?:flete|impuestos|importaci[oó]n)|de\s+(?:la\s+)?importaci[oó]n|para\s+importar|landed|all[- ]in|including\s+(?:freight|taxes|import))/i;
const PURCHASE_SCOPE = /(?:de\s+compra|para\s+(?:la\s+)?compra|para\s+comprar|al\s+proveedor|del\s+producto|purchase|for\s+the\s+product|to\s+buy)/i;

/** Price and budget the message states (null fields when not stated). */
export function readMoney(text: string, item = ""): OrderMoney {
  // a bare figure after a price or budget word is money ("cada caja cuesta 4", "presupuesto de 35"):
  // the form and the estimate work in US dollars, so it is read as US$ unless quetzales are named
  const src = ` ${String(text || "").toLowerCase().replace(/[¿?¡!]/g, " ")} `.replace(
    /(\b(?:cuesta|cuestan|vale|valen|precio(?:\s+unitario)?(?:\s+(?:es|de|por\s+[a-záéíóúüñ]+))*|presupuesto(?:\s+de\s+compra)?(?:\s+(?:es|de|total))*|budget(?:\s+(?:is|of))*|costs?|price(?:\s+is)?)\s*:?\s*)(?=\d)/g,
    "$1us$",
  );
  const out: OrderMoney = {};
  const prices: Price[] = [];
  for (const m of src.matchAll(MONEY_RE)) {
    const at = m.index ?? 0;
    const neg = !!m[1];
    const cur = curOf(m[2] || "", m[4] || m[6] || "");
    // "q" alone must be a currency, not a word ending: "q25" or "q 25" after a space
    if (m[2] && /^q/i.test(m[2]) && /[a-záéíóúüñ]$/i.test(src.slice(at - 1, at))) continue;
    const amount = toE4(m[3] || m[5] || "");
    if (amount === null) continue;
    const before = src.slice(Math.max(0, at - 60), at);
    const clause = before.split(/[.;]/).pop() || "";
    const after = src.slice(at + m[0].length, at + m[0].length + 40);
    if (BUDGET_BEFORE.test(clause)) {
      if (neg || amount <= 0) { out.conflict = "badBudget"; continue; }
      const ctx = `${clause} ${after.split(/[.;]/)[0]}`;
      const scope = IMPORT_SCOPE.test(ctx) && !PURCHASE_SCOPE.test(ctx) ? "importacion" : "compra";
      out.budget = { e4: amount, cur, raw: m[0].trim(), scope };
      continue;
    }
    // the price and what it is the price of
    const aft = after.match(/^\s*(?:(?:cada|por|per|el|la|\/|x|a)\s+)?(?:(?:un|una|1)\s+)?([a-záéíóúüñ/]+)/i);
    const bef = clause.match(/(?:cada|each|la|el|por|per|una?|1)\s+([a-záéíóúüñ]+)(?:\s+(?:de\s+|of\s+)?\d+(?:\s+[a-záéíóúüñ]+)?)?\s+(?:cuesta|cuestan|vale|valen|sale|salen|costs?|is|a|at|@|en|=|:)?\s*$/i)
      || clause.match(/precio\s+(?:por|de\s+cada|del|de\s+la|per|of\s+each)\s+([a-záéíóúüñ]+)\s*(?:es|de|:|=)?\s*(?:de\s+)?$/i)
      // "cada caja trae 100 y cuesta US$3": the pack named at the start of the clause
      || clause.match(/(?:cada|each)\s+([a-záéíóúüñ]+)\b[^.;]{0,50}?\b(?:y\s+|and\s+)?(?:cuesta|cuestan|vale|valen|sale|salen|costs?)\s*$/i)
      // "cajas de 100 a US$2.49": the price of the pack it follows
      || clause.match(/\b(cajas?|boxes|box|paquetes?|packs?|sets?|juegos?|bolsas?|bags?|kits?|estuches?|cases?|cartones|cart[oó]n|cartons?|rollos?|rolls?|pares|par|pairs?|docenas?|dozens?)\s+(?:de|of|con|with)\s+\d+(?:\s+[a-záéíóúüñ]+)?\s+(?:a|at|@)\s*$/i)
      || clause.match(/\b([a-záéíóúüñ]+)\s+(?:a|at|@)\s*$/i);
    let basis = "";
    if (aft && /^(?:cada|por|per|el|la|\/|x)/i.test(after.trim()) ) basis = basisOf(aft[1].replace(/^\//, ""), item);
    if (!basis && aft && /^(?:c\/u|each|apiece)/i.test(aft[1])) basis = "unit";
    if (!basis && bef) basis = basisOf(bef[1], item);
    const priceWord = /cuesta|cuestan|vale|valen|precio|price|costs?|sale|salen|\ba\s*$|\bat\s*$|@\s*$/i.test(clause.slice(-30)) || !!basis;
    if (!priceWord) continue;
    if (neg || amount <= 0) { out.conflict = "badPrice"; continue; }
    prices.push({ e4: amount, cur, raw: m[0].trim(), basis });
  }
  if (prices.length) {
    const uniq = new Map(prices.map((p) => [`${p.e4}|${p.basis}|${p.cur}`, p]));
    if (uniq.size > 1) out.conflict = out.conflict || "twoPrices";
    out.price = prices[prices.length - 1];
  }
  return out;
}

// ── 3. Money lines for a calculated order ───────────────────────────────────
export const fmtMoney = (e4: number, cur: Currency): string => {
  const neg = e4 < 0;
  const a = Math.abs(e4);
  const cents = a % 100 === 0; // exact to the cent
  const v = (cents ? (Math.round(a / 100) / 100).toFixed(2) : (a / E4).toFixed(4).replace(/0+$/, ""));
  const [i, d] = v.split(".");
  return `${neg ? "-" : ""}${cur === "GTQ" ? "Q" : "US$"}${Number(i).toLocaleString("en-US")}.${d}`;
};

/** What the calculator knows about the order, in counts the price can apply to. */
export interface OrderCounts {
  packs?: number; // packs to order (after minimum and multiples)
  packWord?: [RegExp, string, string, string, string]; // the pack those packs are
  innerPacks?: { word: [RegExp, string, string, string, string]; count: number }; // sets inside the boxes
  pieces: number; // pieces received (or wanted, with no packs)
  pairs?: number; // pairs received, when counted in pairs
  item: string;
  stockShort?: boolean; // the supplier's stock doesn't cover the order
}

/** The product value lines: subtotal and budget, or the question that is missing. "" when no money. */
export function moneyLines(money: OrderMoney, c: OrderCounts): string {
  if (!money.price && !money.budget && !money.conflict) return "";
  if (money.conflict === "twoPrices")
    return Lx(
      " Tu mensaje trae dos precios distintos; ¿cuál uso y a qué corresponde (unidad, par, caja o set)? Con eso calculo el subtotal.",
      " Your message has two different prices; which one should I use and what is it for (unit, pair, box or set)? With that I'll calculate the subtotal.",
    );
  if (money.conflict === "badPrice")
    return Lx(" El precio debe ser mayor a cero; revísalo y te calculo el subtotal.", " The price must be above zero; check it and I'll calculate the subtotal.");
  if (money.conflict === "badBudget" && !money.price)
    return Lx(" El presupuesto debe ser mayor a cero.", " The budget must be above zero.");
  const p = money.price;
  const b = money.budget;
  if (!p) {
    return b
      ? Lx(
          ` Para saber si tu presupuesto de ${fmtMoney(b.e4, b.cur)} alcanza necesito el precio y a qué corresponde (por unidad, por par o por caja).`,
          ` To tell whether your budget of ${fmtMoney(b.e4, b.cur)} is enough I need the price and what it is for (per unit, pair or box).`,
        )
      : "";
  }
  const label = (es: string, en: string) => Lx(es, en);
  let qty = 0;
  let what = "";
  const packName = (n: number, w?: OrderCounts["packWord"]) => (w ? (n === 1 ? Lx(w[1], w[3]) : Lx(w[2], w[4])) : "");
  if (p.basis === "unit") {
    if (!(c.pieces >= 0)) return Lx(` Con un precio por unidad necesito saber cuántas unidades recibes en total; confírmalo y te calculo el subtotal.`, ` With a per-unit price I need the total units you receive; confirm it and I'll calculate the subtotal.`);
    qty = c.pieces;
    what = `${c.pieces.toLocaleString("en-US")} ${c.item || Lx("piezas", "pieces")}`;
  } else if (p.basis === "pair") {
    if (c.pairs === undefined) {
      if (c.pieces % 2) return Lx(` El precio es por par, pero ${c.pieces.toLocaleString("en-US")} piezas no forman pares completos; confírmame cuántos pares compras.`, ` The price is per pair, but ${c.pieces.toLocaleString("en-US")} pieces don't make whole pairs; confirm how many pairs you buy.`);
      qty = c.pieces / 2;
    } else qty = c.pairs;
    what = `${qty.toLocaleString("en-US")} ${qty === 1 ? Lx("par", "pair") : Lx("pares", "pairs")}`;
  } else if (p.basis === "dozen") {
    if (c.pieces % 12) return Lx(" El precio es por docena, pero la cantidad no forma docenas completas; confírmame cuántas docenas compras.", " The price is per dozen, but the quantity doesn't make whole dozens; confirm how many dozens you buy.");
    qty = c.pieces / 12;
    what = `${qty.toLocaleString("en-US")} ${qty === 1 ? Lx("docena", "dozen") : Lx("docenas", "dozens")}`;
  } else if (p.basis && c.packWord && c.packWord[0].test(p.basis) && c.packs !== undefined) {
    qty = c.packs;
    what = `${qty.toLocaleString("en-US")} ${packName(qty, c.packWord)}`;
  } else if (p.basis && c.innerPacks && c.innerPacks.word[0].test(p.basis)) {
    qty = c.innerPacks.count;
    what = `${qty.toLocaleString("en-US")} ${packName(qty, c.innerPacks.word)}`;
  } else {
    // the price is not said per what, or it is per a pack this order doesn't use: ask
    return Lx(
      ` Indicaste el precio ${fmtMoney(p.e4, p.cur)}, pero no queda claro a qué corresponde. ¿Es por unidad, por par, por ${c.packWord ? c.packWord[1] : "caja"} o por set? Con eso calculo el subtotal${b ? " y si te alcanza el presupuesto" : ""}.`,
      ` You gave the price ${fmtMoney(p.e4, p.cur)}, but it isn't clear what it is for. Is it per unit, per pair, per ${c.packWord ? c.packWord[3] : "box"} or per set? With that I'll calculate the subtotal${b ? " and whether the budget is enough" : ""}.`,
    );
  }
  const sub = qty * p.e4;
  const subTxt = fmtMoney(sub, p.cur);
  let line = label(
    ` ${what} × ${fmtMoney(p.e4, p.cur)} = ${subTxt} de producto, con el precio que indicaste.`,
    ` ${what} × ${fmtMoney(p.e4, p.cur)} = ${subTxt} of product, using the price you gave.`,
  );
  if (money.assumedUsd) line += Lx(" Tomé el precio en dólares (US$) porque no indicaste la moneda; si es otra, dímelo.", " I took the price in US dollars because no currency was given; tell me if it is another one.");
  if (c.stockShort) line += Lx(" Es el valor del pedido completo, aunque hoy el proveedor no tenga existencias suficientes.", " It is the value of the full order, even though the supplier's stock is short today.");
  if (b) {
    if (b.cur !== p.cur)
      line += Lx(
        ` Tu presupuesto (${fmtMoney(b.e4, b.cur)}) está en otra moneda que el precio; escríbelos en la misma moneda para compararlos.`,
        ` Your budget (${fmtMoney(b.e4, b.cur)}) is in a different currency from the price; write both in the same currency to compare them.`,
      );
    else {
      const diff = b.e4 - sub;
      const scopeNote = b.scope === "importacion"
        ? Lx(" Ojo: comparo solo el valor del producto; tu presupuesto parece incluir la importación, que además suma flete, seguro, impuestos y gastos en destino.", " Note: I compare only the product value; your budget seems to include the import, which also adds freight, insurance, taxes and destination charges.")
        : "";
      line += diff >= 0
        ? Lx(
            ` Con tu presupuesto de compra de ${fmtMoney(b.e4, b.cur)} sí te alcanza${diff > 0 ? `: te quedan ${fmtMoney(diff, p.cur)}` : " exacto"}.${scopeNote}`,
            ` Your purchase budget of ${fmtMoney(b.e4, b.cur)} is enough${diff > 0 ? `: ${fmtMoney(diff, p.cur)} left` : " exactly"}.${scopeNote}`,
          )
        : Lx(
            ` Con tu presupuesto de compra de ${fmtMoney(b.e4, b.cur)} no te alcanza: te faltan ${fmtMoney(-diff, p.cur)}.${scopeNote}`,
            ` Your purchase budget of ${fmtMoney(b.e4, b.cur)} is not enough: you are ${fmtMoney(-diff, p.cur)} short.${scopeNote}`,
          );
    }
  }
  line += Lx(
    " Es solo el valor del producto, no una cotización confirmada: el costo de importarlo suma además flete, seguro, impuestos (DAI e IVA) y gastos en destino.",
    " It's only the product value, not a confirmed quote: importing it also adds freight, insurance, taxes (DAI and IVA) and destination charges.",
  );
  return line;
}
