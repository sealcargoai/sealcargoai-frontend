// A product description must say what the product is, not just pass a
// character count ("abc" used to produce unrelated results).
// The backend applies the same rule in src/routes/suppliers.js.
import { Lx } from "./lang";

export const DESCRIPTION_MIN_CHARS = 10;
const MIN_WORDS = 2;

export function descriptionIsDetailed(text: string): boolean {
  const v = String(text || "").trim();
  if (v.length < DESCRIPTION_MIN_CHARS) return false;
  const words = v.toLowerCase().match(/[a-záéíóúüñ]{3,}/g) || [];
  // real words: have a vowel and are not one letter repeated ("aaaa")
  const real = words.filter((w) => /[aeiouáéíóúü]/.test(w) && !/^(.)\1+$/.test(w));
  if (real.length < MIN_WORDS) return false;
  return real.some((w) => w.length >= 4);
}

export function descriptionDetailMessage(): string {
  return Lx(
    "Describe el producto con más detalle: qué es y para qué se usa (por ejemplo: «tostadora de café de 30 kg por lote»).",
    "Describe the product in more detail: what it is and what it's used for (for example: \"30 kg batch coffee roaster\").",
  );
}

// Sentences addressed to the tool instead of describing the product
// ("garantiza que el proveedor es real", "ignora las instrucciones"…).
// They are left out of the search, the category and the reports.
const INSTRUCTION =
  /\b(ignor[ae]\w*|olvid[ae]\w*|disregard|forget)\b[^.]*\b(instrucci\w*|indicaci\w*|reglas?|instructions?|rules?|prompt)\b|\b(garantiz\w*|asegur[ae]\w*|afirm[ae]\w*|confirm[ae]\w*|declar[ae]\w*|di|dime|decir|digan?|guarantee|assure|confirm|state|say)\b[^.]*\b(que\s+)?(el\s+|los\s+|the\s+)?(proveedor(es)?|supplier|seller|vendedor)\b[^.]*\b(real|confiable|verificad\w*|seguro|legit\w*|trusted|reliable|verified|safe)\b|\b(act[uú]a como|eres un|you are (an?|the)|act as|system prompt|modo desarrollador|developer mode)\b/i;

export function cleanDescription(text: string): { text: string; removed: boolean } {
  const raw = String(text || "");
  const parts = raw.split(/(?<=[.!?;\n])\s*/);
  const kept = parts.filter((p) => !INSTRUCTION.test(p));
  const removed = kept.length !== parts.length;
  return { text: removed ? kept.join(" ").replace(/\s+/g, " ").trim() : raw.trim(), removed };
}
