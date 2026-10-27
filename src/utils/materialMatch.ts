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
  M("cuero", "leather", ["cuero", "piel ", "genuine leather", "cowhide", "leather"]),
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
  /\b[a-záéíóúüñ]+[\s-]+free\b|\b(?:libres?\s+de|sin|free\s+of|without|no\s+de|no\s+es\s+de|no\s+sea\s+de|non|no)[\s-]+[a-záéíóúüñ]+/g;
const notMadeOf = (text: string) =>
  (String(text || "").toLowerCase().match(NOT_MADE_OF) || [])
    .map((m) => m.replace(/[\s-]+free$/, "").replace(/^(?:libres?\s+de|sin|free\s+of|without|no\s+de|no\s+es\s+de|no\s+sea\s+de|non|no)[\s-]+/, ""))
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
  // the title also names other materials ("vinyl nitrile blend"): all of them, to confirm the composition
  mixed?: string;
}

/** null when the client named no material or the listing names none. */
// ── Materials of a part: "puntera de acero", "fiberglass toe cap", "rubber sole".
// They describe that part, not the whole product: a fiberglass toe cap does not
// make a leather shoe "a different material".
const PART_WORDS: [RegExp, string, string][] = [
  [/punteras?|toe\s*caps?|toecaps?|toes?/, "puntera", "toe cap"],
  [/suelas?|outsoles?|soles?/, "suela", "sole"],
  [/entresuelas?|midsoles?/, "entresuela", "midsole"],
  [/plantillas?|insoles?/, "plantilla", "insole"],
  [/forros?|linings?/, "forro", "lining"],
  [/palmas?|palms?/, "palma", "palm"],
  [/recubrimientos?|coatings?|coated/, "recubrimiento", "coating"],
];
const PART_MATS: [RegExp, string, string][] = [
  [/acero(?:\s+inoxidable)?|steel|stainless|met[aá]lic[oa]s?|metal(?:lic)?/, "acero", "steel"],
  [/fibra\s+de\s+vidrio|fiberglass|fibreglass|fibra/, "fibra de vidrio", "fiberglass"],
  [/compuest[oa]s?|composite|compositas?/, "material compuesto", "composite"],
  [/aluminio|aluminum|aluminium/, "aluminio", "aluminum"],
  [/caucho|hule|goma|rubber/, "caucho", "rubber"],
  [/pu|poliuretano|polyurethane/, "PU", "PU"],
  [/pvc/, "PVC", "PVC"],
  [/eva/, "EVA", "EVA"],
  [/tpu/, "TPU", "TPU"],
  [/cuero|piel|leather/, "cuero", "leather"],
  [/nitrilo|nitrile/, "nitrilo", "nitrile"],
  [/l[aá]tex/, "látex", "latex"],
];
const alt = (xs: [RegExp, string, string][]) => xs.map(([r]) => r.source).join("|");
// "puntera de acero": the material follows the part only with "de"/"en" (otherwise
// "fiberglass toe cap leather shoes" would read as a leather toe cap)
const PART_A = new RegExp(`\\b(${alt(PART_WORDS)})\\s+(?:(no|sin)\\s+)?(?:de|en)\\s+(?:(no|sin)\\s+)?(${alt(PART_MATS)})\\b`, "gi");
const PART_A_NOMAT = new RegExp(`\\b(${alt(PART_WORDS)})\\s+(no|non)[\\s-]+(${alt(PART_MATS)})\\b`, "gi");
const PART_B = new RegExp(`\\b(?:(non|no|sin)[\\s-]+)?(${alt(PART_MATS)})[\\s-]+(${alt(PART_WORDS)})\\b`, "gi");
const nameOf = (xs: [RegExp, string, string][], w: string) => xs.find(([r]) => new RegExp(`^(?:${r.source})$`, "i").test(w.trim()));

interface PartMat { part: string; partEn: string; mat: string; matEn: string; negated: boolean }
function partMaterials(text?: string): { pairs: PartMat[]; rest: string } {
  const pairs: PartMat[] = [];
  const t = String(text || "").toLowerCase();
  const add = (pw: string, mw: string, neg: boolean, before: string) => {
    const p = nameOf(PART_WORDS, pw);
    const m = nameOf(PART_MATS, mw);
    if (p && m) pairs.push({ part: p[1], partEn: p[2], mat: m[1], matEn: m[2], negated: neg || /\b(?:sin|no|without|non)\s*$/.test(before) });
  };
  let rest = t.replace(PART_A, (all, pw, neg1, neg2, mw, off) => (add(pw, mw, !!(neg1 || neg2), t.slice(Math.max(0, off - 8), off)), " "));
  // "puntera no metálica"
  rest = rest.replace(PART_A_NOMAT, (all, pw, neg, mw) => (add(pw, mw, true, ""), " "));
  const t2 = rest;
  rest = rest.replace(PART_B, (all, neg, mw, pw, off) => (add(pw, mw, !!neg, t2.slice(Math.max(0, off - 8), off)), " "));
  return { pairs, rest };
}

export interface PartIssue { text: string }

// Stainless steel grades: 304 is not 201 (it corrodes, and costs less)
const GRADE = "(201|202|301|304l?|316l?|410|430)";
const SS = "(?:ss|sus|aisi|inox(?:idable)?|stainless(?:\\s+steel)?|acero\\s+inoxidable)";
const GRADE_RES = [new RegExp(`\\b${SS}\\s*-?\\s*${GRADE}\\b`, "g"), new RegExp(`\\b${GRADE}\\s*-?\\s*${SS}`, "g")];
// grades written alone next to a stainless mention elsewhere ("acero inoxidable 304, no 201")
// only after a separator or the word grade ("201/304", "grado 304"): "430 mesas" is a quantity
const BARE_GRADE = new RegExp(`(?:\\/\\s*|\\b(?:grado|grade|tipo|type)\\s+)${GRADE}\\b`, "g");
const NEG_GRADE = new RegExp(`\\b(?:no|ni|sin|excepto|salvo|not|except|excluding|without)\\s+(?:(?:acero|steel|de|en|grado|grade)\\s+)*(?:${SS}\\s*-?\\s*)?${GRADE}\\b`, "g");
function gradesIn(text: string): { wanted: string[]; excluded: string[] } {
  let t = ` ${String(text || "").toLowerCase()} `;
  if (!new RegExp(SS).test(t)) return { wanted: [], excluded: [] };
  const excluded: string[] = [];
  t = t.replace(NEG_GRADE, (m) => {
    excluded.push(m.match(/\d{3}l?/)![0].replace(/l$/, ""));
    return " ";
  });
  const found = new Set<string>();
  for (const re of GRADE_RES) for (const m of t.matchAll(re)) found.add((m[1].match(/\d/) ? m[1] : m[2]).replace(/l$/, ""));
  for (const m of t.matchAll(BARE_GRADE)) found.add(m[1].replace(/l$/, ""));
  return { wanted: [...found].filter((g) => !excluded.includes(g)), excluded };
}
/** A stainless grade other than the one asked (or one the client ruled out). */
function gradeIssue(description: string, productTitle?: string): PartIssue | null {
  const want = gradesIn(description);
  if (!want.wanted.length && !want.excluded.length) return null;
  const got = gradesIn(productTitle || "").wanted;
  if (!got.length) return null;
  const ruled = got.filter((g) => want.excluded.includes(g));
  const ok = got.filter((g) => want.wanted.includes(g));
  if (ruled.length && !ok.length)
    return { text: Lx(`Indica acero inoxidable ${ruled.join("/")}, un grado que excluiste`, `States ${ruled.join("/")} stainless steel, a grade you ruled out`) };
  if (want.wanted.length && !ok.length)
    return { text: Lx(`Indica acero inoxidable ${got.join("/")}; pediste ${want.wanted.join(" o ")}`, `States ${got.join("/")} stainless steel; you asked for ${want.wanted.join(" or ")}`) };
  if (ok.length && got.length > ok.length)
    return { text: Lx(`Menciona acero inoxidable ${got.join(" y ")}; confirma que te coticen ${ok.join(" o ")}`, `It mentions ${got.join(" and ")} stainless steel; confirm they quote ${ok.join(" or ")}`) };
  return null;
}

/** A part whose material differs from what the client asked, or that the client ruled out. */
export function partMaterialIssue(description: string, productTitle?: string): PartIssue | null {
  const want = partMaterials(description).pairs;
  if (!want.length) return gradeIssue(description, productTitle);
  const got = partMaterials(productTitle).pairs.filter((x) => !x.negated);
  for (const g of got) {
    const ruled = want.find((w) => w.negated && w.part === g.part && w.mat === g.mat);
    if (ruled)
      return { text: Lx(`Indica ${g.part} de ${g.mat}, que excluiste`, `States a ${g.matEn} ${g.partEn}, which you ruled out`) };
    const asked = want.filter((w) => !w.negated && w.part === g.part);
    if (asked.length && !asked.some((w) => w.mat === g.mat))
      return {
        text: Lx(`Indica ${g.part} de ${g.mat}; pediste ${g.part} de ${asked.map((w) => w.mat).join(" o ")}`, `States a ${g.matEn} ${g.partEn}; you asked for ${asked.map((w) => w.matEn).join(" or ")}`),
      };
  }
  return gradeIssue(description, productTitle);
}

export function matchMaterial(description: string, productTitle?: string): MaterialMatch | null {
  // part materials ("puntera de acero") are compared separately (partMaterialIssue)
  const descRest = partMaterials(description).rest;
  const { wanted, excluded } = splitExclusions(descRest);
  const asked = matsIn(wanted);
  const ruledOut = matsIn(`${excluded} ${notMadeOf(descRest)}`).filter((m) => !asked.includes(m));
  if (!asked.length && !ruledOut.length) return null;
  const listed = matsIn(partMaterials(productTitle).rest);
  if (!listed.length) return null;
  const label = (ms: Mat[]) => ms.map((m) => Lx(m.es, m.en)).join(", ");
  const hitsRuledOut = listed.filter((m) => ruledOut.includes(m));
  const shared = listed.some((m) => asked.includes(m));
  if (shared && !hitsRuledOut.length) {
    const others = listed.filter((m) => !asked.includes(m));
    return { status: "match", asked: label(asked), listed: label(listed.filter((m) => asked.includes(m))), ...(others.length ? { mixed: label(listed) } : {}) };
  }
  // "nitrile coated nylon gloves": the requested material is in a part (the coating),
  // the body is another one; that is a combination to confirm, not simply another material
  const askedInPart = partMaterials(productTitle).pairs.filter((p) => !p.negated && asked.some((m) => m.es === p.mat || m.en === p.matEn));
  if (askedInPart.length && !hitsRuledOut.length) {
    const parts = askedInPart.map((p) => Lx(`${p.mat} (${p.part})`, `${p.matEn} (${p.partEn})`));
    return { status: "match", asked: label(asked), listed: parts.join(", "), mixed: [...parts, label(listed)].join(", ") };
  }
  if (!asked.length && !hitsRuledOut.length) return null;
  return { status: "other", asked: label(asked), listed: label(hitsRuledOut.length ? hitsRuledOut : listed) };
}

/** Stable re-order: listings naming another material go last, mixed materials after pure matches. */
export function orderByMaterial<T extends { productName?: string }>(list: T[], description: string): T[] {
  return list
    .map((s, i) => {
      const m = matchMaterial(description, s.productName);
      // a title that mixes the requested material with others goes after the pure matches
      return { s, i, r: m?.status === "other" || partMaterialIssue(description, s.productName) ? 2 : m?.mixed ? 1 : 0 };
    })
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
