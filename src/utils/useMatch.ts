// Compares the use the client asked for ("molino para maíz y especias") with
// the uses a listing title mentions ("for ink, pigment and paint"), so a mill
// for paint is not recommended for corn. Only reads what is written.
import { Lx } from "./lang";

// Materials (wood, plastic, cotton…) are not uses: "lápices de madera" says what it is made of
type Group = "food" | "feed" | "paint" | "pharma" | "mineral";

// Spanish and English words for each use (lowercase, matched as word starts)
const GROUPS: Record<Group, string[]> = {
  food: [
    "maíz", "maiz", "corn", "maize", "especia", "spice", "chile", "chili", "pimienta", "pepper", "grano", "grain",
    "harina", "flour", "trigo", "wheat", "arroz", "rice", "café", "cafe", "coffee", "cacao", "cocoa", "azúcar",
    "azucar", "sugar", "sal ", "salt", "aliment", "food", "frijol", "bean", "soya", "soy", "nuez", "nut", "almendra",
    "almond", "maní", "peanut", "semilla", "seed", "hierba", "herb", "té ", "tea ", "masa", "tortilla", "panader",
    "bakery", "carne", "meat", "fruta", "fruit", "verdura", "vegetable",
  ],
  feed: ["pienso", "forraje", "concentrado animal", "animal feed", "livestock", "poultry", "aves", "ganado", "fodder"],
  paint: [
    "pintura", "paint", "tinta", "ink", "pigment", "barniz", "varnish", "laca", "lacquer", "coating", "recubrimiento",
    "esmalte", "enamel", "resina", "resin", "adhesiv", "glue", "pegamento", "químic", "chemical",
  ],
  pharma: ["farmac", "pharma", "medicin", "medicina", "cosmétic", "cosmetic", "laboratorio", "laboratory", "lab "],
  mineral: [
    "roca", "rock", "mineral", "minería", "mining", "cemento", "cement", "carbón",
    "coal", "cal ", "arena", "sand", "vidrio", "glass", "cerámic", "ceramic",
  ],
};

const LABEL_ES: Record<Group, string> = {
  food: "alimentos (granos, especias…)", feed: "alimento para animales", paint: "pintura, tinta o químicos",
  pharma: "farmacéutico o cosmético", mineral: "minerales o cemento",
};
const LABEL_EN: Record<Group, string> = {
  food: "food (grains, spices…)", feed: "animal feed", paint: "paint, ink or chemicals",
  pharma: "pharma or cosmetics", mineral: "minerals or cement",
};

function usesIn(text?: string): Set<Group> {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/g, " ")} `;
  const found = new Set<Group>();
  (Object.keys(GROUPS) as Group[]).forEach((g) => {
    if (GROUPS[g].some((w) => t.includes(` ${w}`))) found.add(g);
  });
  return found;
}

export type UseStatus = "match" | "other" | "unknown";

export interface UseMatch {
  status: UseStatus;
  asked: string; // uses the client asked for
  listed: string; // uses the listing mentions
}

/** null when the client did not say what the product is for. */
export function matchUse(description: string, productTitle?: string): UseMatch | null {
  const asked = usesIn(description);
  if (!asked.size) return null;
  const listed = usesIn(productTitle);
  const label = (s: Set<Group>) => [...s].map((g) => Lx(LABEL_ES[g], LABEL_EN[g])).join(", ");
  const shared = [...listed].some((g) => asked.has(g));
  const status: UseStatus = shared ? "match" : listed.size ? "other" : "unknown";
  return { status, asked: label(asked), listed: label(listed) };
}

const RANK: Record<UseStatus, number> = { match: 0, unknown: 1, other: 2 };

/** Stable re-order: listings for the requested use first, those for another use last. */
export function orderByUse<T extends { productName?: string }>(list: T[], description: string): T[] {
  if (!usesIn(description).size) return list;
  return list
    .map((s, i) => ({ s, i, r: RANK[matchUse(description, s.productName)!.status] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
