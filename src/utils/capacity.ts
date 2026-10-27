// Compares the specifications the client asked for (in their own description)
// with what each Alibaba product title states: capacity (kg, litres),
// number of needles and number of heads.
// Only reads what is written; when a title says nothing, it says so.
import { Lx } from "./lang";

type Family = "mass" | "volume" | "needles" | "heads" | "power";
type Per = "h" | "d" | "";
export interface Spec {
  min: number;
  max: number;
  family: Family;
  rate: boolean; // has a time unit (mass/volume only)
  per: Per; // "h" per hour, "d" per day, "" per batch / no time unit
  text: string;
  at?: number; // position in the text
  atLeast?: boolean; // the client asked for a minimum ("mínimo 100 kg/h")
  hp?: boolean; // power written in HP: shown in HP, compared in kW
}
const AT_LEAST = /(m[ií]nimo|m[ií]nima|al\s+menos|por\s+lo\s+menos|como\s+m[ií]nimo|no\s+menos\s+de|at\s+least|minimum|min\.?|>=|≥|más\s+de|mas\s+de|over|more\s+than)(\s+(de|of|una?|capacidad|producci[oó]n|capacity|output))*\s*$/i;
/** Kept for older imports. */
export type Capacity = Spec;

const UNITS: Record<string, { family: Family; k: number }> = {};
const add = (family: Family, k: number, words: string[]) => words.forEach((w) => (UNITS[w] = { family, k }));
add("mass", 1, ["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"]);
add("mass", 1000, ["t", "ton", "tons", "tonelada", "toneladas", "tonne", "tonnes"]);
add("volume", 1, ["l", "lt", "lts", "litro", "litros", "liter", "liters", "litre", "litres"]);
add("needles", 1, ["aguja", "agujas", "needle", "needles"]);
add("heads", 1, ["cabeza", "cabezas", "cabezal", "cabezales", "head", "heads"]);
// motor power, kept in kW ("15 kW", "20 HP", "7.5kw")
add("power", 1, ["kw", "kws", "kilowatt", "kilowatts", "kilovatio", "kilovatios"]);
add("power", 0.7457, ["hp", "cv", "caballos"]);

const UNIT =
  "(kgs?|kilos?|kilogramos?|toneladas?|tonnes?|tons?|t|litros?|liters?|litres?|lts?|l|agujas?|needles?|cabezal(?:es)?|cabezas?|heads?|kws?|kilowatts?|kilovatios?|hp|cv|caballos)";
// Time unit after the figure: per hour, per minute (converted to hours), per day.
// "por lote" / "per batch" is the same as no time unit.
const RATE =
  "(\\s*\\/\\s*(?:h(?:r|rs|ora|oras|our|ours)?|min(?:uto|ute)?s?|d(?:ay|ía|ia)?|24\\s*h)\\b|\\s+(?:por|per|x|cada|a\\s+la|al|an|each|every|in\\s+an?|en\\s+una?|a)\\s+(?:hora|hour|h|minuto|minute|min|día|dia|day|jornada)\\b|\\s*ph\\b|\\s*(?:\\/|por|per|x)\\s*(?:lote|batch|carga|tanda)\\b)?";
function perOf(r?: string): { per: Per; k: number } {
  const t = String(r || "").toLowerCase();
  if (!t.trim() || /lote|batch|carga|tanda/.test(t)) return { per: "", k: 1 };
  if (/min/.test(t)) return { per: "h", k: 60 };
  if (/24|d[ií]a|day|jornada|\/\s*d\b/.test(t)) return { per: "d", k: 1 };
  return { per: "h", k: 1 };
}
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
  if (c.family === "power") {
    const kw = (v: number) => (c.hp ? `${+(v / 0.7457).toFixed(1)} HP (${+v.toFixed(1)} kW)` : `${+v.toFixed(2)} kW`);
    return c.min === c.max ? kw(c.min) : `${+c.min.toFixed(2)}–${kw(c.max)}`;
  }
  const unit = c.family === "mass" ? "kg" : "L";
  const r = c.per === "h" ? Lx("/hora", "/hour") : c.per === "d" ? Lx("/día", "/day") : "";
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
    // "2tph", "500kgph" = per hour
    .replace(/(\d)\s*(t|kg)ph\b/g, "$1 $2/h")
    .replace(/(\d)\s*(t|kg)h\b/g, "$1 $2/h")
    .replace(/(\d)\s*(t|kg)pd\b/g, "$1 $2/d")
    .replace(/\b(?:double|two|dos)\s*-?\s*(heads?|cabezal(?:es)?|cabezas?)\b/g, "2 $1");
  const out: Spec[] = [];
  const used: [number, number][] = [];
  const free = (at: number) => !used.some(([a, b]) => at >= a && at < b);
  const unitOk = (u: string, end: number) => {
    // single letters (t, l) only count when not followed by another letter
    if (u === "t" || u === "l") return !/[a-záéíóúüñ]/.test(s[end] || " ");
    return true;
  };
  const push = (vals: number[], u: string, rateText?: string, at = 0) => {
    const info = UNITS[u];
    if (!info) return;
    const pr = isCount(info.family) || info.family === "power" ? { per: "" as Per, k: 1 } : perOf(rateText);
    const v = vals.map((x) => x * info.k * pr.k).filter((x) => x > 0);
    if (!v.length) return;
    out.push({ min: Math.min(...v), max: Math.max(...v), family: info.family, rate: pr.per !== "", per: pr.per, text: "", at, ...(info.family === "power" && info.k !== 1 ? { hp: true } : {}) });
  };

  // Lists: "12/15 needles", "6, 9, 12 agujas"
  // separators: "/" or ", " (comma + space), so "1,000 kg" stays one number
  const list = new RegExp(`${NUM}((?:\\s*\\/\\s*\\d+(?:[.,]\\d+)?|,\\s+\\d+(?:[.,]\\d+)?)+)${JOIN}${UNIT}\\b${RATE}`, "g");
  let m: RegExpExecArray | null;
  while ((m = list.exec(s))) {
    if (!unitOk(m[3], m.index + m[0].length)) continue;
    const nums = [m[1], ...m[2].split(/[\/,]/).map((x) => x.trim()).filter(Boolean)].map(toNum);
    nums.forEach((n) => push([n], m![3], m![4], m!.index));
    used.push([m.index, m.index + m[0].length]);
  }
  const range = new RegExp(`${NUM}\\s*(?:-|–|~|to|a|hasta)\\s*${NUM}${JOIN}${UNIT}\\b${RATE}`, "g");
  while ((m = range.exec(s))) {
    if (!free(m.index) || !unitOk(m[3], m.index + m[0].length)) continue;
    push([toNum(m[1]), toNum(m[2])], m[3], m[4], m.index);
    used.push([m.index, m.index + m[0].length]);
  }
  const single = new RegExp(`${NUM}${JOIN}${UNIT}\\b${RATE}`, "g");
  while ((m = single.exec(s))) {
    if (!free(m.index) || !unitOk(m[2], m.index + m[0].length)) continue;
    push([toNum(m[1])], m[2], m[3], m.index);
  }
  return out.map((c) => ({ ...c, text: fmt(c) }));
}

/** The specifications the client wrote: the first one of each kind. */
export function requestedSpecs(description: string): Spec[] {
  const all = parseSpecs(description);
  const out: Spec[] = [];
  const families = [...new Set(all.map((c) => c.family))];
  // per family: a figure with a time unit ("100 kg/h") is the machine's
  // capacity; "sacos de 50 kg" in the same sentence is not
  families.forEach((f) => {
    const of = all.filter((c) => c.family === f);
    out.push(of.find((c) => c.rate) ?? of[0]);
  });
  // parseSpecs pads the text with one leading space
  const low = ` ${String(description || "").toLowerCase()} `;
  return out.map((c) => {
    const before = low.slice(Math.max(0, (c.at ?? 0) - 40), c.at ?? 0);
    return AT_LEAST.test(before) && !isCount(c.family) ? { ...c, atLeast: true, text: `${Lx("mínimo", "at least")} ${c.text}` } : c;
  });
}

export type SpecStatus = "meets" | "higher" | "lower" | "unknown";
export interface SpecItem {
  req: Spec;
  status: SpecStatus;
  found: string;
  closeness: number; // 1 = exact; lower = further away
  incomparable?: boolean; // the listing gives the same kind of figure with or without "per hour"
  edge?: boolean; // a range that reaches the requested minimum only at its top
}
export interface SpecMatch {
  items: SpecItem[];
  overall: SpecStatus | "mixed";
  rank: number;
}

function matchOne(req: Spec, title: string): SpecItem {
  const family = parseSpecs(title).filter((c) => c.family === req.family);
  // Per hour, per day and per batch can't be compared: "30 t" is not "more than 100 kg/h"
  const all = family.filter((c) => c.per === req.per);
  if (!all.length) {
    const other = family.filter((c) => c.per !== req.per);
    const found = other.map((c) => c.text).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    return { req, status: "unknown", found, closeness: 0, incomparable: other.length > 0 };
  }
  const target = req.max;
  const [lo, hi] = isCount(req.family) ? [1, 1] : [0.9, 1.1];
  const found = all.map((c) => c.text).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const closeness = Math.max(...all.map((c) => (c.max < target ? c.max / target : c.min > target ? target / c.min : 1)));
  if (req.atLeast) {
    // a minimum: anything that starts at or above it meets it
    if (all.some((c) => c.min >= target * lo)) return { req, status: "meets", found, closeness: 1 };
    if (all.some((c) => c.max >= target * lo)) return { req, status: "meets", found, closeness: 0.95, edge: true };
    return { req, status: "lower", found, closeness };
  }
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
      const meets = m.items.filter((x) => x.status === "meets" && !x.edge).length;
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
      if (i.edge)
        return {
          tone: "blue" as const,
          text: Lx(`Coincide solo en su máximo: ${i.found}`, `Matches only at its maximum: ${i.found}`),
          sub: Lx(`Pediste ${req.text}: confirma que la producción real llegue a esa cifra`, `You asked for ${req.text}: confirm the real output reaches that figure`),
        };
      return {
        tone: "green" as const,
        text: req.atLeast
          ? Lx(`Cumple lo pedido: ${req.text}`, `Meets what you asked: ${req.text}`)
          : Lx(`Indica lo pedido: ${req.text}`, `States what you asked: ${req.text}`),
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
      if (i.incomparable) {
        return {
          tone: "slate" as const,
          text:
            req.per === "h" && !/\/(hora|hour|día|day)/.test(i.found)
              ? Lx(`Capacidad no comparable: ${i.found} sin «por hora»`, `Capacity not comparable: ${i.found} without "per hour"`)
              : req.per === "d" && !/\/(hora|hour|día|day)/.test(i.found)
                ? Lx(`Capacidad no comparable: ${i.found} sin «por día»`, `Capacity not comparable: ${i.found} without "per day"`)
                : Lx(`Capacidad no comparable: ${i.found}`, `Capacity not comparable: ${i.found}`),
          sub: req.per === "d"
            ? Lx(`Pediste ${req.text}: confirma con el proveedor la producción por día y las horas de trabajo`, `You asked for ${req.text}: confirm the daily output and working hours with the supplier`)
            : req.rate
            ? Lx(`Pediste ${req.text}: confirma con el proveedor la producción por hora`, `You asked for ${req.text}: confirm the hourly output with the supplier`)
            : Lx(`Pediste ${req.text}: confirma con el proveedor la capacidad por carga`, `You asked for ${req.text}: confirm the batch capacity with the supplier`),
        };
      }
      return {
        tone: "slate" as const,
        text: i.found
          ? Lx(`${KIND(req.family)} por confirmar (${i.found})`, `${KIND(req.family)} to confirm (${i.found})`)
          : Lx(`La publicación no indica ${KIND(req.family)}`, `The listing does not state ${KIND(req.family)}`),
        sub: Lx(`Pediste ${req.text}: confírmalo con el proveedor`, `You asked for ${req.text}: confirm it with the supplier`),
      };
  }
}
