// Compares the material the client asked for ("camisas de algodón") with the
// material a listing title names ("polyester polo shirt"). Only reads what is
// written; a title that names no material says nothing either way.
import { Lx } from "./lang";
import { splitExclusions } from "./useMatch";

interface Mat { es: string; en: string; w: string[] }
const M = (es: string, en: string, w: string[]): Mat => ({ es, en, w });
// words are matched as word starts on lowercase text
const MATERIALS: Mat[] = [
  M("algodón", "cotton", ["algodón", "algodon", "cotton"]),
  M("poliéster", "polyester", ["poliéster", "poliester", "polyester"]),
  M("nylon", "nylon", ["nylon", "nailon", "poliamida", "polyamide"]),
  M("lana", "wool", ["lana ", "wool", "merino"]),
  M("seda", "silk", ["seda ", "silk"]),
  M("lino", "linen", ["lino ", "linen"]),
  M("acero inoxidable", "stainless steel", ["acero inoxidable", "inoxidable", "stainless", "inox", "ss304", "ss316"]),
  M("aluminio", "aluminum", ["aluminio", "aluminum", "aluminium"]),
  M("cuero", "leather", ["cuero", "piel ", "genuine leather", "cowhide"]),
  M("cuero sintético", "synthetic leather", ["cuero sintético", "cuero sintetico", "piel sintética", "piel sintetica", "cuero pu", "piel pu", "polipiel", "ecocuero", "pu leather", "faux leather", "synthetic leather", "vegan leather", "leatherette"]),
  M("madera", "wood", ["madera", "wood", "wooden"]),
  M("bambú", "bamboo", ["bambú", "bambu", "bamboo"]),
  // "glass " as a whole word: "safety glasses" are not made of glass
  M("vidrio", "glass", ["vidrio", "glass ", "glassware"]),
  M("cerámica", "ceramic", ["cerámic", "ceramic", "porcelan", "porcelain"]),
  M("plástico", "plastic", ["plástico", "plastico", "plastic", "pvc", "polipropileno", "polypropylene", "abs "]),
  M("nitrilo", "nitrile", ["nitrilo", "nitrile"]),
  M("látex", "latex", ["látex", "latex"]),
  M("vinilo", "vinyl", ["vinilo", "vinyl"]),
];

// "sin látex", "libre(s) de látex", "latex free", "free of latex", "without latex", "no de látex"
// "sin látex", "libre(s) de látex", "latex free", "free of latex", "without latex", "no de látex".
// Only the word right after the negation counts ("sin polvo nitrilo": nitrilo is wanted);
// a two-word material ("sin acero inoxidable") is caught by its first word.
const NOT_MADE_OF =
  /\b[a-záéíóúüñ]+[\s-]+free\b|\b(?:libres?\s+de|sin|free\s+of|without|no\s+de|no\s+es\s+de|no\s+sea\s+de)\s+[a-záéíóúüñ]+/g;
const notMadeOf = (text: string) =>
  (String(text || "").toLowerCase().match(NOT_MADE_OF) || [])
    .map((m) => m.replace(/[\s-]+free$/, "").replace(/^(?:libres?\s+de|sin|free\s+of|without|no\s+de|no\s+es\s+de|no\s+sea\s+de)\s+/, ""))
    .join(" ");

function matsIn(text?: string): Mat[] {
  let t = ` ${String(text || "")
    .toLowerCase()
    // "latex free", "libre de látex", "sin látex" say what it is NOT made of
    .replace(NOT_MADE_OF, " ")
    .replace(/[^a-z0-9áéíóúüñ]+/g, " ")} `;
  const found: Mat[] = [];
  // longer names first, so "pu leather" is synthetic leather and not leather
  const order = [...MATERIALS].sort((a, b) => Math.max(...b.w.map((x) => x.length)) - Math.max(...a.w.map((x) => x.length)));
  for (const m of order) {
    const hit = m.w.find((w) => t.includes(` ${w}`));
    if (hit) {
      found.push(m);
      t = t.split(` ${hit}`).join(" ");
    }
  }
  return found;
}

export type MaterialStatus = "match" | "other";
export interface MaterialMatch {
  status: MaterialStatus;
  asked: string;
  listed: string;
}

/** null when the client named no material or the listing names none. */
export function matchMaterial(description: string, productTitle?: string): MaterialMatch | null {
  const { wanted, excluded } = splitExclusions(description);
  const asked = matsIn(wanted);
  const ruledOut = matsIn(`${excluded} ${notMadeOf(description)}`).filter((m) => !asked.includes(m));
  if (!asked.length && !ruledOut.length) return null;
  const listed = matsIn(productTitle);
  if (!listed.length) return null;
  const label = (ms: Mat[]) => ms.map((m) => Lx(m.es, m.en)).join(", ");
  const hitsRuledOut = listed.filter((m) => ruledOut.includes(m));
  const shared = listed.some((m) => asked.includes(m));
  if (shared && !hitsRuledOut.length) return { status: "match", asked: label(asked), listed: label(listed.filter((m) => asked.includes(m))) };
  if (!asked.length && !hitsRuledOut.length) return null;
  return { status: "other", asked: label(asked), listed: label(hitsRuledOut.length ? hitsRuledOut : listed) };
}

/** Stable re-order: listings naming another material go last. */
export function orderByMaterial<T extends { productName?: string }>(list: T[], description: string): T[] {
  return list
    .map((s, i) => ({ s, i, r: matchMaterial(description, s.productName)?.status === "other" ? 1 : 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
