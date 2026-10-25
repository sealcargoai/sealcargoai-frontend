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
