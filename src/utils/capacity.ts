// Compares the capacity the client asked for (from their own description)
// with the capacity written in each Alibaba product title.
// Only reads what is written; when a title says nothing, it says so.
import { Lx } from "./lang";

type Family = "mass" | "volume";
export interface Capacity {
  min: number;
  max: number;
  family: Family;
  rate: boolean; // per hour
  text: string;
}

const MASS: Record<string, number> = { kg: 1, kgs: 1, kilo: 1, kilos: 1, kilogramo: 1, kilogramos: 1, t: 1000, ton: 1000, tons: 1000, tonelada: 1000, toneladas: 1000, tonne: 1000 };
const VOL: Record<string, number> = { l: 1, lt: 1, lts: 1, litro: 1, litros: 1, liter: 1, liters: 1, litre: 1, litres: 1 };
const UNIT = "(kgs?|kilos?|kilogramos?|toneladas?|tonnes?|tons?|t|litros?|liters?|litres?|lts?|l)";
const RATE = "(\\s*\\/\\s*h(?:r|ora|our)?\\b|\\s*(?:por|per)\\s*(?:hora|hour)|\\s*ph\\b)?";
const NUM = "(\\d+(?:[.,]\\d+)?)";

function toNum(s: string) {
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) return parseFloat(s.replace(/[.,]/, "")); // 1,000 / 1.000
  return parseFloat(s.replace(",", "."));
}

function unitInfo(u: string): { family: Family; k: number } | null {
  const x = u.toLowerCase();
  if (x in MASS) return { family: "mass", k: MASS[x] };
  if (x in VOL) return { family: "volume", k: VOL[x] };
  return null;
}

function fmt(c: Capacity) {
  const unit = c.family === "mass" ? "kg" : "L";
  const r = c.rate ? (getHourWord()) : "";
  const n = (v: number) => (v >= 1000 && c.family === "mass" ? `${+(v / 1000).toFixed(2)} t` : `${+v.toFixed(2)} ${unit}`);
  if (c.min === c.max) return `${n(c.min)}${r}`;
  const sameScale = !(c.family === "mass" && (c.min >= 1000) !== (c.max >= 1000));
  return sameScale ? `${n(c.min).replace(/\s*(kg|t|L)$/, "")}–${n(c.max)}${r}` : `${n(c.min)}–${n(c.max)}${r}`;
}
function getHourWord() {
  return Lx("/hora", "/hour");
}

/** All capacities written in a text ("1-6kg", "30 kg/h", "500 litros"). */
export function parseCapacities(text: string): Capacity[] {
  const s = ` ${String(text || "").toLowerCase()} `;
  const out: Capacity[] = [];
  const used: [number, number][] = [];
  const range = new RegExp(`${NUM}\\s*(?:-|–|~|to|a|hasta)\\s*${NUM}\\s*${UNIT}\\b${RATE}`, "g");
  const single = new RegExp(`${NUM}\\s*${UNIT}\\b${RATE}`, "g");
  let m: RegExpExecArray | null;
  while ((m = range.exec(s))) {
    const u = unitInfo(m[3]);
    if (!u) continue;
    const a = toNum(m[1]) * u.k, b = toNum(m[2]) * u.k;
    out.push({ min: Math.min(a, b), max: Math.max(a, b), family: u.family, rate: !!m[4], text: "" });
    used.push([m.index, m.index + m[0].length]);
  }
  while ((m = single.exec(s))) {
    const at = m.index;
    if (used.some(([a, b]) => at >= a && at < b)) continue;
    // "220v 3 phase" etc. never match because a unit is required right after the number
    const u = unitInfo(m[2]);
    if (!u) continue;
    if (m[2] === "t" || m[2] === "l") {
      // single letters only count when glued to the number or followed by a separator
      const next = s[at + m[0].length] || " ";
      if (/[a-z]/.test(next)) continue;
    }
    const v = toNum(m[1]) * u.k;
    if (!v) continue;
    out.push({ min: v, max: v, family: u.family, rate: !!m[3], text: "" });
  }
  return out.map((c) => ({ ...c, text: fmt(c) }));
}

/** First capacity the client wrote, if any. */
export function requestedCapacity(description: string): Capacity | null {
  return parseCapacities(description)[0] ?? null;
}

export type CapacityMatch = "meets" | "higher" | "lower" | "unknown";

export function matchCapacity(req: Capacity | null, productTitle?: string): { status: CapacityMatch; found: string } | null {
  if (!req) return null;
  const all = parseCapacities(productTitle || "").filter(
    (c) => c.family === req.family && (req.rate ? true : !c.rate),
  );
  if (!all.length) return { status: "unknown", found: "" };
  const target = req.max;
  const found = all.map((c) => c.text).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  if (all.some((c) => c.min * 0.9 <= target && target <= c.max * 1.1)) return { status: "meets", found };
  if (all.every((c) => c.max < target)) return { status: "lower", found };
  if (all.every((c) => c.min > target)) return { status: "higher", found };
  return { status: "unknown", found };
}

const ORDER: Record<CapacityMatch, number> = { meets: 0, higher: 1, unknown: 2, lower: 3 };

/** Stable re-order: options that state the requested capacity first, smaller ones last. */
export function orderByCapacity<T extends { productName?: string }>(list: T[], req: Capacity | null): T[] {
  if (!req) return list;
  return list
    .map((s, i) => ({ s, i, o: ORDER[matchCapacity(req, s.productName)!.status] }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.s);
}

export function capacityLabel(req: Capacity, m: { status: CapacityMatch; found: string }) {
  switch (m.status) {
    case "meets":
      return {
        tone: "green" as const,
        text: Lx(`Indica la capacidad pedida (${req.text})`, `States the requested capacity (${req.text})`),
        sub: Lx(`En la publicación: ${m.found}`, `In the listing: ${m.found}`),
      };
    case "higher":
      return {
        tone: "blue" as const,
        text: Lx(`Alternativa de mayor capacidad: ${m.found}`, `Higher-capacity alternative: ${m.found}`),
        sub: Lx(`Pediste ${req.text}`, `You asked for ${req.text}`),
      };
    case "lower":
      return {
        tone: "amber" as const,
        text: Lx(`Alternativa de menor capacidad: ${m.found}`, `Lower-capacity alternative: ${m.found}`),
        sub: Lx(`No llega a los ${req.text} que pediste`, `Below the ${req.text} you asked for`),
      };
    default:
      return {
        tone: "slate" as const,
        text: m.found
          ? Lx(`Capacidad por confirmar (${m.found})`, `Capacity to confirm (${m.found})`)
          : Lx("La publicación no indica la capacidad", "The listing does not state the capacity"),
        sub: Lx(`Confirma con el proveedor si llega a ${req.text}`, `Confirm with the supplier whether it reaches ${req.text}`),
      };
  }
}
