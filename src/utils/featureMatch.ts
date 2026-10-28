// Characteristics the client asked for that are neither a material, a capacity nor an
// electrical value: "libre de aceite", "sin polvo", "con variador", "impermeable".
// Each one is compared with the listing title: stated, contradicted, or not stated (to confirm).
// Only reads what is written; a title that says nothing is never taken as compliant.
import { Lx } from "./lang";

interface Feature { es: string; en: string; ask: RegExp; yes: RegExp; no?: RegExp }
const FEATURES: Feature[] = [
  { es: "libre de aceite", en: "oil-free", ask: /\blibres?\s+de\s+aceite|\bsin\s+aceite|\boil[\s-]?free|\boil[\s-]?less|\bexentos?\s+de\s+aceite/i, yes: /\boil[\s-]?free|\boil[\s-]?less|\boilless|\bsin\s+aceite|\blibres?\s+de\s+aceite|\bdry\s+screw/i, no: /\boil[\s-]?(?:injected|lubricated|flooded|cooled\s+screw)|\blubricad[oa]s?\s+(?:con|por)\s+aceite/i },
  { es: "sin polvo", en: "powder-free", ask: /\bsin\s+polvo|\blibres?\s+de\s+polvo|\bpowder[\s-]?free/i, yes: /\bpowder[\s-]?free|\bsin\s+polvo|\blibres?\s+de\s+polvo/i, no: /\bpowdered\b|\bcon\s+polvo/i },
  { es: "con variador de velocidad", en: "with variable speed drive", ask: /\bvariador|\bvelocidad\s+variable|\binverter\b|\bvsd\b|\bvariable\s+speed/i, yes: /\binverter\b|\bvsd\b|\bvariable\s+(?:speed|frequency)|\bvariador|\bpm\s*vsd/i, no: /\bfixed\s+speed|\bvelocidad\s+fija/i },
  { es: "impermeable", en: "waterproof", ask: /\bimpermeable|\ba\s+prueba\s+de\s+agua|\bwaterproof|\bwater[\s-]?resistant/i, yes: /\bwaterproof|\bimpermeable|\bwater[\s-]?resistant|\bip6[5-8]\b/i },
];
export interface FeatureResult { label: string; status: "match" | "other" | "unknown" }
/** One result per characteristic the client asked for (what it says is ruled out is not asked). */
export function matchFeatures(description: string, title?: string): FeatureResult[] {
  const d = String(description || "");
  const t = String(title || "");
  const out: FeatureResult[] = [];
  for (const f of FEATURES) {
    const m = d.match(f.ask);
    if (!m || m.index === undefined) continue;
    // "no necesito que sea libre de aceite" is not a requirement
    if (/\b(?:no|sin\s+que|not|don'?t\s+need)\s+(?:\w+\s+){0,4}$/i.test(d.slice(Math.max(0, m.index - 40), m.index))) continue;
    const label = Lx(f.es, f.en);
    out.push({ label, status: f.no?.test(t) ? "other" : f.yes.test(t) ? "match" : "unknown" });
  }
  return out;
}
/** Tag and report texts for one result. */
export function featureText(r: FeatureResult): { tag: string; sub: string; sentence: string } {
  if (r.status === "match") return { tag: Lx(`Indica: ${r.label}`, `States: ${r.label}`), sub: "", sentence: "" };
  if (r.status === "other")
    return {
      tag: Lx(`Contradice lo pedido: no es ${r.label}`, `Contradicts your request: not ${r.label}`),
      sub: Lx(`Pediste ${r.label}`, `You asked for ${r.label}`),
      sentence: Lx(`La publicación indica algo distinto de «${r.label}», que pediste`, `The listing states something other than "${r.label}", which you asked for`),
    };
  return {
    tag: Lx(`La publicación no indica: ${r.label}`, `The listing doesn't state: ${r.label}`),
    sub: Lx("Confírmalo con el proveedor", "Confirm it with the supplier"),
    sentence: Lx(`La publicación no indica «${r.label}», que pediste; confírmalo con el proveedor`, `The listing doesn't state "${r.label}", which you asked for; confirm it with the supplier`),
  };
}
