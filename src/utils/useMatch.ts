// Compares the use the client asked for ("molino para maíz y especias") with
// the uses a listing title mentions ("for ink, pigment and paint"), so a mill
// for paint is not recommended for corn. Only reads what is written.
import { Lx } from "./lang";

// Materials (wood, plastic, cotton…) are not uses: "lápices de madera" says what it is made of
type Group = "food" | "feed" | "paint" | "pharma" | "mineral";

// Each use concept: label in Spanish and English, the group it belongs to and
// its words in both languages (lowercase, matched as word starts). Concepts let
// the client rule out "carne" while still asking for "maíz" (both food).
// k: kind of material inside a group. A meat grinder is not a corn mill even
// though both are "food"; "any" (food in general) goes with every kind.
type Kind = "dry" | "meat" | "fresh" | "any";
interface Concept { g: Group; es: string; en: string; w: string[]; k: Kind }
const C = (g: Group, es: string, en: string, w: string[], k: Kind = "any"): Concept => ({ g, es, en, w, k });
const CONCEPTS: Concept[] = [
  C("food", "maíz", "corn", ["maíz", "maiz", "corn", "maize", "elote"], "dry"),
  C("food", "especias", "spices", ["especia", "spice", "chile", "chili", "pimienta", "pepper", "condiment"], "dry"),
  C("food", "granos", "grains", ["grano", "grain", "cereal"], "dry"),
  C("food", "harina", "flour", ["harina", "flour", "trigo", "wheat"], "dry"),
  C("food", "arroz", "rice", ["arroz", "rice"], "dry"),
  C("food", "café", "coffee", ["café", "cafe", "coffee"], "dry"),
  C("food", "cacao", "cocoa", ["cacao", "cocoa", "chocolate"], "dry"),
  C("food", "azúcar", "sugar", ["azúcar", "azucar", "sugar"], "dry"),
  C("food", "sal", "salt", ["sal ", "salt"], "dry"),
  C("food", "frijol y soya", "beans and soy", ["frijol", "bean", "soya", "soy"], "dry"),
  C("food", "nueces y semillas", "nuts and seeds", ["nuez", "nueces", "nut", "almendra", "almond", "maní", "mani ", "peanut", "semilla", "seed"], "dry"),
  C("food", "hierbas y té", "herbs and tea", ["hierba", "herb", "té ", "tea "], "dry"),
  C("food", "masa y panadería", "dough and bakery", ["masa", "tortilla", "panader", "bakery", "dough"], "dry"),
  C("food", "carne", "meat", ["carne", "meat", "embutido", "sausage", "hueso", "bone"], "meat"),
  C("food", "frutas y verduras", "fruit and vegetables", ["fruta", "fruit", "verdura", "vegetable", "hortaliza"], "fresh"),
  C("food", "alimentos", "food", ["aliment", "food", "comida"]),
  C("feed", "alimento para animales", "animal feed", ["pienso", "forraje", "concentrado animal", "animal feed", "livestock", "poultry", "aves", "ganado", "fodder"]),
  C("paint", "pintura", "paint", ["pintura", "paint"]),
  C("paint", "tinta", "ink", ["tinta", "ink"]),
  C("paint", "pigmentos", "pigments", ["pigment"]),
  C("paint", "barniz y recubrimientos", "varnish and coatings", ["barniz", "varnish", "laca", "lacquer", "coating", "recubrimiento", "esmalte", "enamel"]),
  C("paint", "resinas y adhesivos", "resins and adhesives", ["resina", "resin", "adhesiv", "glue", "pegamento"]),
  C("paint", "químicos", "chemicals", ["químic", "quimic", "chemical"]),
  C("pharma", "farmacéutico", "pharma", ["farmac", "pharma", "medicin"]),
  C("pharma", "cosméticos", "cosmetics", ["cosmétic", "cosmetic"]),
  C("pharma", "laboratorio", "laboratory", ["laboratorio", "laboratory", "lab "]),
  C("mineral", "minerales", "minerals", ["roca", "rock", "mineral", "minería", "mineria", "mining", "arena", "sand", "carbón", "carbon ", "coal"]),
  C("mineral", "cemento y cal", "cement and lime", ["cemento", "cement", "cal "]),
  C("mineral", "vidrio y cerámica", "glass and ceramics", ["vidrio", "glass", "cerámic", "ceramic"]),
];

function conceptsIn(text?: string): Set<Concept> {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/g, " ")} `;
  return new Set(CONCEPTS.filter((c) => c.w.some((w) => t.includes(` ${w}`))));
}
const groupsOf = (cs: Set<Concept>) => new Set([...cs].map((c) => c.g));

// What the client rules out: "no para carne ni pintura", "excepto pintura",
// "not for paint or ink". The excluded part runs until the end of the clause
// (punctuation, "sino", "pero", "solo", "but", "only") or a new "para"/"for".
const NEG_START =
  /\b(?:sin\s+(?:usarl[oa]s?|usar|uso|utilizarl[oa]|emplearl[oa])(?:\s+(?:en|para|con))?|nada\s+de|evit(?:ar|ando|o|e)(?:\s+(?:usarlo\s+)?(?:en|para|con))?|nunca(?:\s+para)?|jam[aá]s(?:\s+para)?|avoid(?:ing)?|never(?:\s+for)?|without(?:\s+(?:using\s+it\s+)?(?:for|on|with))?|que\s+no\s+sea(?:\s+para)?|no\s+(?:es\s+|sea\s+|sirve\s+|lo\s+quiero\s+|apt[oa]s?\s+)?(?:para|de)\b|no(?=\s)|ni(?:\s+para)?|excepto(?:\s+para)?|salvo(?:\s+para)?|menos\s+para|excluyendo|not(?:\s+(?:for|suitable\s+for|used\s+for|meant\s+for))?|nor(?:\s+for)?|except(?:\s+for)?|other\s+than|excluding)\b/g;
const NEG_END = /[.,;:!?()]|\b(?:sino|pero|solo|sólo|solamente|únicamente|unicamente|but|only|para|for)\b/;

/** Splits a description into what the client wants and what they rule out. */
export function splitExclusions(description?: string): { wanted: string; excluded: string } {
  const raw = String(description || "");
  const lower = raw.toLowerCase();
  // match on lowercase, keep the client's own casing when the lengths line up
  const t = lower;
  const src = lower.length === raw.length ? raw : lower;
  let wanted = "";
  let excluded = "";
  let pos = 0;
  NEG_START.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NEG_START.exec(t))) {
    if (m.index < pos) continue;
    wanted += src.slice(pos, m.index) + " ";
    const from = m.index + m[0].length;
    const rest = t.slice(from);
    const end = rest.search(NEG_END);
    const len = end === -1 ? rest.length : end;
    excluded += src.slice(from, from + len) + " ";
    pos = from + len;
    NEG_START.lastIndex = pos;
  }
  if (pos === 0) return { wanted: raw, excluded: "" };
  wanted += src.slice(pos);
  return { wanted, excluded };
}

/** The description without the uses the client rules out (for topics like food). */
export function wantedText(description?: string): string {
  return splitExclusions(description).wanted;
}

export type UseStatus = "match" | "other" | "unknown";

export interface UseMatch {
  status: UseStatus;
  asked: string; // uses the client asked for ("" when they only ruled some out)
  listed: string; // uses the listing mentions
  excluded: string; // uses the client ruled out ("carne, pintura")
  hitsExcluded: string; // uses the listing mentions that the client ruled out ("" if none)
}

/** null when the client did not say what the product is (or is not) for. */
export function matchUse(description: string, productTitle?: string): UseMatch | null {
  const parts = splitExclusions(description);
  const askedC = conceptsIn(parts.wanted);
  const excludedC = new Set([...conceptsIn(parts.excluded)].filter((c) => !askedC.has(c)));
  const asked = groupsOf(askedC);
  if (!asked.size && !excludedC.size) return null;
  const listedC = conceptsIn(productTitle);
  const listed = groupsOf(listedC);
  const hit = [...listedC].filter((c) => excludedC.has(c));
  // The listing names a use asked for (the concept itself, or its group when
  // that group was not partly ruled out)
  const excludedGroups = groupsOf(excludedC);
  const sameKind = (c: Concept) =>
    [...askedC].some((a) => a.g === c.g && (a.k === c.k || a.k === "any" || c.k === "any"));
  const shared = [...listedC].some(
    (c) =>
      askedC.has(c) ||
      (asked.has(c.g) && sameKind(c) && !excludedC.has(c) && !(excludedGroups.has(c.g) && hit.length)),
  );
  const status: UseStatus = shared ? "match" : hit.length ? "other" : listed.size && asked.size ? "other" : "unknown";
  const conceptLabel = (cs: Concept[]) => cs.map((c) => Lx(c.es, c.en)).join(", ");
  return {
    status,
    asked: conceptLabel([...askedC]),
    listed: conceptLabel(hit.length ? hit : [...listedC]),
    excluded: conceptLabel([...excludedC]),
    hitsExcluded: conceptLabel(hit),
  };
}

const RANK: Record<UseStatus, number> = { match: 0, unknown: 1, other: 2 };

/** Stable re-order: listings for the requested use first, those for another (or excluded) use last. */
export function orderByUse<T extends { productName?: string }>(list: T[], description: string): T[] {
  if (!matchUse(description, "")) return list;
  return list
    .map((s, i) => ({ s, i, r: RANK[matchUse(description, s.productName)!.status] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
