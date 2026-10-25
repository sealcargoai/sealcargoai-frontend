// Compares the specifications the client asked for (in their own description)
// with what each Alibaba product title states: capacity (kg, litres),
// number of needles and number of heads.
// Only reads what is written; when a title says nothing, it says so.
import { Lx } from "./lang";

type Family = "mass" | "volume" | "needles" | "heads";
export interface Spec {
  min: number;
  max: number;
  family: Family;
  rate: boolean; // per hour (mass/volume only)
  text: string;
}
/** Kept for older imports. */
export type Capacity = Spec;

const UNITS: Record<string, { family: Family; k: number }> = {};
const add = (family: Family, k: number, words: string[]) => words.forEach((w) => (UNITS[w] = { family, k }));
add("mass", 1, ["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"]);
add("mass", 1000, ["t", "ton", "tons", "tonelada", "toneladas", "tonne", "tonnes"]);
add("volume", 1, ["l", "lt", "lts", "litro", "litros", "liter", "liters", "litre", "litres"]);
add("needles", 1, ["aguja", "agujas", "needle", "needles"]);
add("heads", 1, ["cabeza", "cabezas", "cabezal", "cabezales", "head", "heads"]);

const UNIT =
  "(kgs?|kilos?|kilogramos?|toneladas?|tonnes?|tons?|t|litros?|liters?|litres?|lts?|l|agujas?|needles?|cabezal(?:es)?|cabezas?|heads?)";
const RATE = "(\\s*\\/\\s*h(?:r|ora|our)?\\b|\\s*(?:por|per)\\s*(?:hora|hour)|\\s*ph\\b)?";
const NUM = "(\\d+(?:[.,]\\d+)?)";
const JOIN = "\\s*-?\\s*"; // "15 needles", "15-needle", "15needle"

function toNum(s: string) {
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) return parseFloat(s.replace(/[.,]/, "")); // 1,000 / 1.000
  return parseFloat(s.replace(",", "."));
}

const isCount = (f: Family) => f === "needles" || f === "heads";

function countWord(f: Family, n: number) {
  const one = n === 1;
  if (f === "needles") return one ? Lx("aguja", "needle") : Lx("agujas", "needles");
  return one ? Lx("cabezal", "head") : Lx("cabezales", "heads");
}

function fmt(c: Spec) {
  if (isCount(c.family)) {
    return c.min === c.max ? `${c.min} ${countWord(c.family, c.min)}` : `${c.min}–${c.max} ${countWord(c.family, c.max)}`;
  }
  const unit = c.family === "mass" ? "kg" : "L";
  const r = c.rate ? Lx("/hora", "/hour") : "";
  const n = (v: number) => (v >= 1000 && c.family === "mass" ? `${+(v / 1000).toFixed(2)} t` : `${+v.toFixed(2)} ${unit}`);
  if (c.min === c.max) return `${n(c.min)}${r}`;
  const sameScale = !(c.family === "mass" && (c.min >= 1000) !== (c.max >= 1000));
  return sameScale ? `${n(c.min).replace(/\s*(kg|t|L)$/, "")}–${n(c.max)}${r}` : `${n(c.min)}–${n(c.max)}${r}`;
}

/** All specifications written in a text ("1-6kg", "30 kg/h", "15 needles", "12/15 agujas"). */
export function parseSpecs(text: string): Spec[] {
  const s = ` ${String(text || "").toLowerCase()} `
    // words for 1 and 2 heads ("single head", "un cabezal", "double head")
    .replace(/\b(?:single|one|un|una)\s*-?\s*(heads?|cabezal(?:es)?|cabezas?)\b/g, "1 $1")
    .replace(/\b(?:double|two|dos)\s*-?\s*(heads?|cabezal(?:es)?|cabezas?)\b/g, "2 $1");
  const out: Spec[] = [];
  const used: [number, number][] = [];
  const free = (at: number) => !used.some(([a, b]) => at >= a && at < b);
  const unitOk = (u: string, end: number) => {
    // single letters (t, l) only count when not followed by another letter
    if (u === "t" || u === "l") return !/[a-záéíóúüñ]/.test(s[end] || " ");
    return true;
  };
  const push = (vals: number[], u: string, rate: boolean) => {
    const info = UNITS[u];
    if (!info) return;
    const v = vals.map((x) => x * info.k).filter((x) => x > 0);
    if (!v.length) return;
    out.push({ min: Math.min(...v), max: Math.max(...v), family: info.family, rate: !isCount(info.family) && rate, text: "" });
  };

  // Lists: "12/15 needles", "6, 9, 12 agujas"
  // separators: "/" or ", " (comma + space), so "1,000 kg" stays one number
  const list = new RegExp(`${NUM}((?:\\s*\\/\\s*\\d+(?:[.,]\\d+)?|,\\s+\\d+(?:[.,]\\d+)?)+)${JOIN}${UNIT}\\b${RATE}`, "g");
  let m: RegExpExecArray | null;
  while ((m = list.exec(s))) {
    if (!unitOk(m[3], m.index + m[0].length)) continue;
    const nums = [m[1], ...m[2].split(/[\/,]/).map((x) => x.trim()).filter(Boolean)].map(toNum);
    nums.forEach((n) => push([n], m![3], !!m![4]));
    used.push([m.index, m.index + m[0].length]);
  }
  const range = new RegExp(`${NUM}\\s*(?:-|–|~|to|a|hasta)\\s*${NUM}${JOIN}${UNIT}\\b${RATE}`, "g");
  while ((m = range.exec(s))) {
    if (!free(m.index) || !unitOk(m[3], m.index + m[0].length)) continue;
    push([toNum(m[1]), toNum(m[2])], m[3], !!m[4]);
    used.push([m.index, m.index + m[0].length]);
  }
  const single = new RegExp(`${NUM}${JOIN}${UNIT}\\b${RATE}`, "g");
  while ((m = single.exec(s))) {
    if (!free(m.index) || !unitOk(m[2], m.index + m[0].length)) continue;
    push([toNum(m[1])], m[2], !!m[3]);
  }
  return out.map((c) => ({ ...c, text: fmt(c) }));
}

/** The specifications the client wrote: the first one of each kind. */
export function requestedSpecs(description: string): Spec[] {
  const seen = new Set<Family>();
  return parseSpecs(description).filter((c) => (seen.has(c.family) ? false : (seen.add(c.family), true)));
}

export type SpecStatus = "meets" | "higher" | "lower" | "unknown";
export interface SpecItem {
  req: Spec;
  status: SpecStatus;
  found: string;
  closeness: number; // 1 = exact; lower = further away
}
export interface SpecMatch {
  items: SpecItem[];
  overall: SpecStatus | "mixed";
  rank: number;
}

function matchOne(req: Spec, title: string): SpecItem {
  const all = parseSpecs(title).filter((c) => c.family === req.family && (req.rate ? true : !c.rate));
  if (!all.length) return { req, status: "unknown", found: "", closeness: 0 };
  const target = req.max;
  const [lo, hi] = isCount(req.family) ? [1, 1] : [0.9, 1.1];
  const found = all.map((c) => c.text).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const closeness = Math.max(...all.map((c) => (c.max < target ? c.max / target : c.min > target ? target / c.min : 1)));
  if (all.some((c) => c.min * lo <= target && target <= c.max * hi)) return { req, status: "meets", found, closeness: 1 };
  if (all.every((c) => c.max < target)) return { req, status: "lower", found, closeness };
  if (all.every((c) => c.min > target)) return { req, status: "higher", found, closeness };
  return { req, status: "unknown", found, closeness };
}

const SCORE: Record<SpecStatus, number> = { meets: 0, higher: 1, unknown: 2, lower: 3 };

export function matchSpecs(reqs: Spec[], productTitle?: string): SpecMatch | null {
  if (!reqs.length) return null;
  const items = reqs.map((r) => matchOne(r, productTitle || ""));
  const worst = Math.max(...items.map((i) => SCORE[i.status]));
  const statuses = [...new Set(items.map((i) => i.status))];
  const overall = statuses.length === 1 ? statuses[0] : "mixed";
  return { items, overall, rank: worst };
}

/**
 * Stable re-order: listings that state what was asked first, then larger ones,
 * then those that don't say, then smaller ones (closest first).
 */
export function orderBySpecs<T extends { productName?: string }>(list: T[], reqs: Spec[]): T[] {
  if (!reqs.length) return list;
  return list
    .map((s, i) => {
      const m = matchSpecs(reqs, s.productName)!;
      const meets = m.items.filter((x) => x.status === "meets").length;
      const close = m.items.reduce((a, x) => a + x.closeness, 0);
      return { s, i, rank: m.rank, meets, close };
    })
    .sort((a, b) => a.rank - b.rank || b.meets - a.meets || b.close - a.close || a.i - b.i)
    .map((x) => x.s);
}

const KIND = (f: Family) =>
  f === "needles" ? Lx("agujas", "needles") : f === "heads" ? Lx("cabezales", "heads") : Lx("capacidad", "capacity");

export function specLabel(i: SpecItem) {
  const { req } = i;
  switch (i.status) {
    case "meets":
      return {
        tone: "green" as const,
        text: Lx(`Indica lo pedido: ${req.text}`, `States what you asked: ${req.text}`),
        sub: Lx(`En la publicación: ${i.found}`, `In the listing: ${i.found}`),
      };
    case "higher":
      return {
        tone: "blue" as const,
        text: Lx(`Diferente: ${i.found} (más de lo pedido)`, `Different: ${i.found} (more than asked)`),
        sub: Lx(`Pediste ${req.text}`, `You asked for ${req.text}`),
      };
    case "lower":
      return {
        tone: "amber" as const,
        text: Lx(`Diferente: ${i.found} (menos de lo pedido)`, `Different: ${i.found} (less than asked)`),
        sub: Lx(`Pediste ${req.text}`, `You asked for ${req.text}`),
      };
    default:
      return {
        tone: "slate" as const,
        text: i.found
          ? Lx(`${KIND(req.family)} por confirmar (${i.found})`, `${KIND(req.family)} to confirm (${i.found})`)
          : Lx(`La publicación no indica ${KIND(req.family)}`, `The listing does not state ${KIND(req.family)}`),
        sub: Lx(`Pediste ${req.text}: confírmalo con el proveedor`, `You asked for ${req.text}: confirm it with the supplier`),
      };
  }
}
