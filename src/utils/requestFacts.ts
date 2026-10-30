// The client's first request ("Quiero importar 4 compresores industriales de tornillo de 220 V con un
// presupuesto de US$5,000") holds up to three facts of the case: the product description, the
// quantity and the purchase budget. Before, the whole sentence became the "product" and the
// quantity and budget were never part of the case (the form and the summary for SEAL lost them).
// Here the request is split into those fields with the SAME rules the chat applies: a value is
// taken only when it is exact and valid (whole units 1..10,000,000; a plain US$ amount up to
// US$100,000,000). Anything doubtful is left out of the case and reported, never guessed.
import { valueTokenIssue, notationIssue, validQuantity, stripControl } from "./chatReply";

export interface RequestFacts {
  product: string;
  quantity?: number;
  budget?: number;
  /** values written in the request that were NOT taken (shown to the client, never applied) */
  issues: { field: "quantity" | "budget"; raw: string; why: "decimal" | "zero" | "max" | "format" | "ambiguous" | "currency" }[];
  /** notes for testers removed from the request ("No enviar caso comercial", "PRUEBA QA"): never case data */
  control: string[];
}

const INTRO =
  /^\s*(?:(?:hola|buen[oa]s(?:\s+(?:d[ií]as|tardes|noches))?)[,.!\s]+)?(?:(?:yo\s+)?(?:quiero|queremos|quisiera|necesito|necesitamos|deseo|deseamos|busco|buscamos|vamos\s+a|voy\s+a|planeo|me\s+interesa)\s+(?:importar|comprar|traer|cotizar)|importar|i\s+(?:want|need|plan)\s+to\s+(?:import|buy)|we\s+(?:want|need)\s+to\s+(?:import|buy)|import)\s+/i;
const UNIT_WORDS = "(?:unidades|unidad|units?|piezas?|pieces?|pzas?|equipos?)";

function plainInt(raw: string): number | undefined {
  const v = raw.trim();
  if (/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(v)) return Number(v.replace(/[.,]/g, ""));
  if (/^\d+$/.test(v)) return Number(v);
  return undefined;
}

export function requestFacts(text: string): RequestFacts {
  // notes for the people testing ("PRUEBA QA – No enviar caso comercial") are not part of the case
  const control = stripControl(String(text || "").trim());
  const original = control.text.trim();
  let rest = original;
  const issues: RequestFacts["issues"] = [];
  let budget: number | undefined;
  let quantity: number | undefined;

  // ── budget clause: "con un presupuesto de US$5,000", ", presupuesto: 5000 dólares", "budget US$5,000"
  const bRe =
    /(?:[,;.]\s*|\s+(?:y|e|con|and|with)\s+|^)(?:(?:un|mi|el|nuestro|a|my|our|the)\s+)?(?:presupuesto|budget)(?:\s+(?:de\s+compra|total|m[aá]ximo|disponible|aproximado|of\s+purchase|for\s+the\s+purchase))?\s*(?:de|es|ser[aá]|of|is|:|=)?\s*(?:de\s+)?((?:unos|unas|aprox\w*|about|around|alrededor\s+de|hasta|m[aá]ximo|up\s+to)\s+)?(us\s?\$|usd|\$|q\.?\s?|gtq|€|eur)?\s*(\d(?:[\d.,]*\d)?(?:e[+-]?\d+)?(?:\s*(?:k|mil|millones?|mill[oó]n|mm|m)(?![a-záéíóúüñ]))?)?\s*(usd|d[oó]lares|dollars|quetzales|gtq|euros?|pesos|mxn)?(?=[\s,;.!?)]|$)/i;
  const bm = rest.match(bRe);
  if (bm) {
    const approx = !!bm[1];
    const cur = `${bm[2] || ""} ${bm[4] || ""}`.toLowerCase();
    const rawNum = (bm[3] || "").trim();
    const num = rawNum.match(/^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/);
    const value = num ? Number(num[1].replace(/,/g, "") + (num[2] ? `.${num[2]}` : "")) : NaN;
    if (!rawNum) {
      /* "presupuesto" mentioned without an amount: nothing to take */
    } else if (/q|gtq|quetzal|€|eur|peso|mxn/.test(cur)) issues.push({ field: "budget", raw: `${bm[2] || ""}${rawNum}${bm[4] ? ` ${bm[4]}` : ""}`.trim(), why: "currency" });
    else if (approx) issues.push({ field: "budget", raw: `${bm[1]}${rawNum}`.trim(), why: "ambiguous" });
    else if (!num || notationIssue(`presupuesto ${rawNum}`)) issues.push({ field: "budget", raw: rawNum, why: "format" });
    else if (valueTokenIssue(original, value)) issues.push({ field: "budget", raw: rawNum, why: "ambiguous" });
    else if (!(value > 0) || value > 100_000_000) issues.push({ field: "budget", raw: rawNum, why: value > 100_000_000 ? "max" : "zero" });
    else budget = value;
    rest = (rest.slice(0, bm.index) + rest.slice((bm.index ?? 0) + bm[0].length)).trim();
  }

  // ── intro verb ("Quiero importar …")
  rest = rest.replace(INTRO, "");

  // ── quantity: "4 compresores …" at the start, or "…, 4 unidades" / "cantidad: 4"
  const lead = rest.match(/^\s*([\d][\d.,]*(?:e[+-]?\d+)?)\s+(?=[a-záéíóúüñ])/i);
  const tail = rest.match(
    new RegExp(
      `(?:[,;.]\\s*|\\s+(?:y|e|and)\\s+)(?:(?:la\\s+)?cantidad\\s*(?:de|es|:|=)?\\s*)?([\\d][\\d.,]*(?:e[+-]?\\d+)?)\\s+${UNIT_WORDS}\\b|(?:[,;.]\\s*|\\s+)(?:(?:la\\s+)?cantidad|quantity)\\s*(?:de|es|:|=|is)?\\s*([\\d][\\d.,]*(?:e[+-]?\\d+)?)(?=[\\s,;.]|$)`,
      "i",
    ),
  );
  const take = (raw: string): void => {
    const n = plainInt(raw);
    if (/e/i.test(raw)) issues.push({ field: "quantity", raw, why: "format" });
    else if (n === undefined) issues.push({ field: "quantity", raw, why: /[.,]\d{1,2}$|[.,]\d{4,}/.test(raw) ? "decimal" : "format" });
    else if (n < 1) issues.push({ field: "quantity", raw, why: "zero" });
    else if (n > 10_000_000) issues.push({ field: "quantity", raw, why: "max" });
    else if (valueTokenIssue(original, n)) issues.push({ field: "quantity", raw, why: "ambiguous" });
    else if (validQuantity(n)) quantity = n;
  };
  if (lead && !/^\s*[\d.,]+\s*(?:v|vac|hz|l|lt|litros?|kg|ml|cm|mm|m|hp|kw|w|psi|bar|"|pulgadas?|toneladas?|ton|t)\b/i.test(rest)) {
    take(lead[1]);
    rest = rest.slice(lead[0].length);
  } else if (tail) {
    take(tail[1] || tail[2]);
    rest = (rest.slice(0, tail.index) + rest.slice((tail.index ?? 0) + tail[0].length)).trim();
  }

  // ── what remains is the description (articles and joining punctuation removed)
  let product = rest
    .replace(/^\s*(?:de\s+|of\s+)?(?:(?:un|una|unos|unas|el|la|los|las|a|an|the)\s+)?/i, "")
    .replace(/\s+(?:y|e|con|and|with)\s*$/i, "")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim();
  // too little left to be a description: the request text (without the budget clause) is kept
  if ((product.match(/[a-záéíóúüñ]{3,}/gi) || []).length < 1) product = rest.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim() || original;
  return { product, ...(quantity ? { quantity } : {}), ...(budget ? { budget } : {}), issues, control: control.removed };
}
