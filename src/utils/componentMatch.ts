// Tells a complete product from a part or accessory of it: "Steel toe cap for
// safety shoes" is not a pair of shoes, and its US$0.44 is not the price of one.
// Only reads the listing title; when it can't tell, the client confirms.
import { Lx } from "./lang";
import { splitExclusions } from "./useMatch";
import { comparablePrice } from "./priceCheck";
import { inferCategory } from "./category";

// minPrice: below this price per unit (US$) a "complete" product with a part in
// its title is checked with the client (it is only a reason to ask, never shown as data)
interface Family { complete: RegExp; parts: [RegExp, string, string][]; minPrice: number }
const P = (re: RegExp, es: string, en: string): [RegExp, string, string] => [re, es, en];

const FAMILIES: Family[] = [
  {
    complete: /\b(zapatos?|botas?|botines?|calzado|tenis|shoes?|boots?|footwear|sneakers?|clogs?|zuecos?)\b/i,
    parts: [
      P(/\b(punteras?|toe\s*caps?|toecaps?|toe\s*guards?)\b/i, "puntera", "toe cap"),
      P(/\b(plantillas?|insoles?)\b/i, "plantilla", "insole"),
      P(/\b(suelas?|outsoles?|soles?)\b/i, "suela", "sole"),
      P(/\b(cordones|agujetas|shoe\s*laces?|laces)\b/i, "cordones", "laces"),
    ],
    minPrice: 2,
  },
  {
    complete: /\b(sillas?|sillones?|chairs?|stools?|bancos?)\b/i,
    parts: [
      P(/\b(rodajas|ruedas|casters?|castors?|wheels?)\b/i, "rodajas", "casters"),
      P(/\b(pist[oó]n|cilindros?|gas\s*lifts?|gas\s*cylinders?|gas\s*springs?)\b/i, "pistón de gas", "gas lift"),
      P(/\b(descansabrazos|brazos|armrests?)\b/i, "descansabrazos", "armrests"),
      P(/\b(bases?\s+(?:de|para|for)|chair\s+bases?)\b/i, "base", "base"),
    ],
    minPrice: 8,
  },
  {
    complete: /\b(m[aá]quinas?|machines?|molinos?|mills?|grinders?|moledoras?|tostadoras?|roasters?|bordadoras?|mezcladoras?|mixers?|hornos?|ovens?|selladoras?|sealers?)\b/i,
    parts: [
      P(/\b(cuchillas?|blades?)\b/i, "cuchilla", "blade"),
      P(/\b(cribas?|tamices|screens?|sieves?|mesh)\b/i, "criba", "screen"),
      P(/\b(rodamientos?|bearings?)\b/i, "rodamiento", "bearing"),
      P(/\b(bandas?|correas?|belts?)\b/i, "banda", "belt"),
      P(/\b(engranajes?|gears?)\b/i, "engranaje", "gear"),
      P(/\b(boquillas?|nozzles?)\b/i, "boquilla", "nozzle"),
      P(/\b(filtros?|filters?)\b/i, "filtro", "filter"),
    ],
    minPrice: 50,
  },
  {
    complete: /\b(aud[ií]fonos|auriculares|earbuds|earphones|headphones|headsets?|tel[eé]fonos?|celulares?|phones?|laptops?|tablets?|bocinas?|speakers?)\b/i,
    parts: [
      P(/\b(fundas?|estuches?|cases?|covers?)\b/i, "funda o estuche", "case"),
      P(/\b(ear\s*tips?|eartips|almohadillas|ear\s*pads?|cushions?)\b/i, "almohadillas", "ear tips"),
      P(/\b(protectores?\s+de\s+pantalla|screen\s*protectors?|tempered\s+glass)\b/i, "protector de pantalla", "screen protector"),
      P(/\b(cables?|cargadores?|chargers?)\b/i, "cable o cargador", "cable or charger"),
    ],
    minPrice: 1,
  },
];
// words that say it is a part whatever the product
const GENERIC = /\breplacements?\s*$|\b(spare\s+parts?|parts?\s+for|replacement\s+(?:parts?|for)|repuestos?|refacci[oó]n(?:es)?|accesorios?\s+para|accessor(?:y|ies)\s+for|repair\s+kit|kit\s+de\s+reparaci[oó]n)\b/i;

export type ComponentStatus = "part" | "ambiguous" | "machine";
export interface ComponentFlag { status: ComponentStatus; part: string }

interface Ctx { familyIdx: number; askedParts: Set<string> }
function ctxFor(description: string): Ctx | null {
  const wanted = splitExclusions(description).wanted;
  const familyIdx = FAMILIES.findIndex((f) => f.complete.test(wanted));
  if (familyIdx < 0) return null;
  // the client asks for the part itself ("punteras de acero para calzado") when the
  // part comes before the product; "zapatos con puntera de acero" still wants shoes
  const fam = FAMILIES[familyIdx];
  const completeAt = wanted.search(fam.complete);
  const askedParts = new Set(
    fam.parts
      .filter(([re]) => {
        const at = wanted.search(re);
        return at >= 0 && at < completeAt;
      })
      .map(([, es]) => es),
  );
  return { familyIdx, askedParts };
}

/** What a single title says, before looking at the other listings. */
function readTitle(ctx: Ctx, title: string): { status: ComponentStatus | "feature"; part: string } | null {
  const fam = FAMILIES[ctx.familyIdx];
  const t = String(title || "");
  if (GENERIC.test(t)) return { status: "part", part: Lx("repuesto o accesorio", "spare part or accessory") };
  for (const [re, es, en] of fam.parts) {
    if (ctx.askedParts.has(es)) continue; // the client asked about that part ("sin puntera de acero")
    const m = t.match(re);
    if (!m) continue;
    const label = Lx(es, en);
    const after = t.slice((m.index ?? 0) + m[0].length);
    const before = t.slice(0, m.index ?? 0);
    // "shoes with steel toe cap", "earbuds with charging case": a feature of the complete product
    if (/\b(?:with|con|w\/|featuring|incl(?:uding|uye)?|and|y)\s+(?:\S+\s+){0,3}$/i.test(before)) return null;
    // "toe cap for safety shoes", "case for earbuds": a part — but "chair … for home office" is not
    const forWhat = after.match(/^\s*(?:\S+\s+){0,2}(?:for|para)\s+(.*)$/i);
    if (forWhat && (fam.complete.test(forWhat[1]) || /^(?:\S+\s+){0,2}(?:replacement|repuesto)/i.test(forWhat[1])))
      return { status: "part", part: label };
    // no shoe / chair / machine named at all: a part
    if (!fam.complete.test(t)) return { status: "part", part: label };
    // "office chair casters", "hammer mill screen mesh": the title ends with the part
    const rest = after
      .replace(new RegExp(fam.parts.map(([r]) => r.source).join("|"), "gi"), " ")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:pcs|pc|pieces|sets?|mm|cm|inch|")?\b/gi, " ")
      .replace(/[^a-záéíóúüñ]+/gi, " ")
      .trim();
    const lastComplete = [...before.matchAll(new RegExp(fam.complete.source, "gi"))].pop();
    if (!rest && lastComplete && /^\s*$/.test(before.slice((lastComplete.index ?? 0) + lastComplete[0].length)))
      return { status: "part", part: label };
    return { status: "feature", part: label };
  }
  return null;
}

/**
 * Marks listings that look like a part ("part") or that might be one
 * ("ambiguous": the title names the product and a part, and either few other
 * listings mention that part or the price is far below the rest).
 */
export function flagComponents<T extends { productName?: string; price?: number; saleUnit?: string }>(
  list: T[],
  description: string,
  productType = "",
): (T & { componentFlag?: ComponentFlag })[] {
  // "pencil making machine" for a client who wants pencils: another product
  const wanted = splitExclusions(description).wanted;
  const MACHINE_TITLE = /\b(?:making|production|manufacturing|processing|packing|packaging|forming|molding|moulding)\s+(?:machines?|lines?|equipment|plants?)\b|\b(?:machines?|m[aá]quinas?|equipment|equipos?|molds?|moulds?|moldes?)\b/i;
  const clientWantsMachine = inferCategory(description) === "machinery" || MACHINE_TITLE.test(wanted) || /\b(molinos?|mills?|grinders?|tostadoras?|roasters?|bordadoras?|hornos?|ovens?|mezcladoras?|mixers?|selladoras?|sealers?|compresor|generador|bomba|pump)\b/i.test(wanted);
  const markMachine = <U extends { productName?: string }>(s: U) =>
    !clientWantsMachine && MACHINE_TITLE.test(String(s.productName || ""))
      ? { ...s, componentFlag: { status: "machine" as const, part: Lx("máquina o equipo", "machine or equipment") } }
      : s;
  const ctx = ctxFor(description);
  if (!ctx) return list.map(markMachine);
  const reads = list.map((s) => readTitle(ctx, s.productName || ""));
  const prices = list.map((s) => comparablePrice(s as never, productType));
  return list.map((s, i) => {
    const m = markMachine(s);
    if (m !== s) return m;
    const r = reads[i];
    if (!r) return s;
    if (r.status !== "feature") return { ...s, componentFlag: { status: r.status, part: r.part } };
    // a feature of the complete product ("steel toe" safety shoes), unless this
    // one costs far less than the others or than a complete product can cost
    const others = prices.filter((p, k) => k !== i && p !== null) as number[];
    const med = others.length ? [...others].sort((a, b) => a - b)[Math.floor(others.length / 2)] : 0;
    const fam = FAMILIES[ctx.familyIdx];
    const unitPrice = Number(s.price) || 0;
    const cheap =
      (prices[i] !== null && med > 0 && (prices[i] as number) < med * 0.35) || (unitPrice > 0 && unitPrice < fam.minPrice);
    if (cheap) return { ...s, componentFlag: { status: "ambiguous" as const, part: r.part } };
    return s;
  });
}

export function componentText(f: ComponentFlag): { tag: string; warn: string } {
  if (f.status === "machine")
    return {
      tag: Lx("Parece una máquina o equipo para fabricarlo, no el producto", "Looks like a machine or equipment to make it, not the product"),
      warn: Lx(
        "El título describe una máquina o equipo, no el producto que pediste. Si calculamos con su precio, el escenario no correspondería a lo que buscas.",
        "The title describes a machine or equipment, not the product you asked for. Calculating with its price would not match what you're looking for.",
      ),
    };
  return f.status === "part"
    ? {
        tag: Lx(`Parece un componente o accesorio («${f.part}»), no el producto completo`, `Looks like a part or accessory ("${f.part}"), not the complete product`),
        warn: Lx(
          `El título indica «${f.part}»: puede ser solo esa pieza y no el producto completo. Confirma con el proveedor qué incluye el precio antes de usarlo.`,
          `The title says "${f.part}": it may be only that part and not the complete product. Confirm with the supplier what the price includes before using it.`,
        ),
      }
    : {
        tag: Lx(`Confirma que sea el producto completo: el título menciona «${f.part}»`, `Confirm it is the complete product: the title mentions "${f.part}"`),
        warn: Lx(
          `El título menciona «${f.part}» y no queda claro si el precio es del producto completo o solo de esa pieza. Confírmalo con el proveedor o con las fotos de la publicación.`,
          `The title mentions "${f.part}" and it's not clear whether the price is for the complete product or only that part. Confirm it with the supplier or the listing photos.`,
        ),
      };
}

/** Stable re-order: parts last, ambiguous ones after the clear complete products. */
export function orderByComponent<T extends { componentFlag?: ComponentFlag }>(list: T[]): T[] {
  const r = (s: T) => (s.componentFlag?.status === "part" || s.componentFlag?.status === "machine" ? 2 : s.componentFlag?.status === "ambiguous" ? 1 : 0);
  return list.map((s, i) => ({ s, i })).sort((a, b) => r(a.s) - r(b.s) || a.i - b.i).map((x) => x.s);
}
