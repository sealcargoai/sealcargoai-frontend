// What the selected listing says differently from what the client asked, or
// leaves unconfirmed: the same warnings the screen shows, in plain sentences,
// so they travel with the PDF and Excel reports. It compares published text
// only; nothing here is verified.
import { matchFeatures, featureText } from "./featureMatch";
import { Lx } from "./lang";
import { requestedSpecs, matchSpecs, specLabel } from "./capacity";
import { matchUse } from "./useMatch";
import { matchMaterial, partMaterialIssue, materialUnstated } from "./materialMatch";
import { matchElectric } from "./electricMatch";
import { componentText, type ComponentFlag } from "./componentMatch";

export interface ListingDifferences {
  title: string; // the listing title as published
  items: string[]; // differences first, then data to confirm
}

const sentence = (s: string) => {
  const t = s.trim().replace(/[.;:\s]+$/, "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};

export function listingDifferences(
  description: string,
  supplier?: { productName?: string; componentFlag?: ComponentFlag } | null,
): ListingDifferences {
  const { title, diffs, toConfirm } = compare(description, supplier);
  return { title, items: [...diffs, ...toConfirm].filter(Boolean) };
}

/**
 * 02-11s: one verdict per listing, from the same comparison the screen and the reports use:
 * - "incompatible": the title contradicts the request (another voltage, a material the client ruled out,
 *   a steel toe cap when a composite one was asked, a part instead of the product…). It is not recommended.
 * - "confirm": nothing contradicts, but something asked is not stated (or several options are offered).
 * - "match": everything asked that can be read in a title is stated as asked. Still published data only.
 */
export type Verdict = "match" | "confirm" | "incompatible";
export function listingVerdict(
  description: string,
  supplier?: { productName?: string; componentFlag?: ComponentFlag } | null,
): { verdict: Verdict; reasons: string[]; toConfirm: string[] } {
  const { diffs, toConfirm } = compare(description, supplier);
  const reasons = diffs.filter(Boolean);
  const open = toConfirm.filter(Boolean);
  return { verdict: reasons.length ? "incompatible" : open.length ? "confirm" : "match", reasons, toConfirm: open };
}

function compare(
  description: string,
  supplier?: { productName?: string; componentFlag?: ComponentFlag } | null,
): { title: string; diffs: string[]; toConfirm: string[] } {
  const title = String(supplier?.productName || "").trim();
  const diffs: string[] = [];
  const toConfirm: string[] = [];
  if (!title) return { title, diffs, toConfirm };

  if (supplier?.componentFlag) diffs.push(sentence(componentText(supplier.componentFlag).warn));

  const use = matchUse(description, title);
  if (use?.status === "other")
    diffs.push(
      sentence(
        use.hitsExcluded
          ? Lx(`La publicación menciona ${use.hitsExcluded}, un uso que excluiste`, `The listing mentions ${use.hitsExcluded}, a use you ruled out`)
          : Lx(`La publicación parece destinada a ${use.listed}, no a ${use.asked}`, `The listing seems meant for ${use.listed}, not ${use.asked}`),
      ),
    );
  else if (use?.status !== "match" && use?.mentions)
    toConfirm.push(sentence(Lx(`El título menciona ${use.mentions}; confirma que cumple tus requisitos`, `The title mentions ${use.mentions}; confirm it meets your requirements`)));
  else if (use && use.status !== "match")
    toConfirm.push(
      sentence(
        use.asked
          ? Lx(`La publicación no dice para qué uso es; confirma que sirva para ${use.asked}`, `The listing doesn't say what it's for; confirm it works for ${use.asked}`)
          : Lx(`La publicación no dice para qué uso es; confirma que no sea para ${use.excluded}`, `The listing doesn't say what it's for; confirm it isn't meant for ${use.excluded}`),
      ),
    );

  const el = matchElectric(description, title);
  if (el?.status === "other") diffs.push(sentence(`${el.text}. ${el.sub}`));
  else if (el?.status === "unknown") toConfirm.push(sentence(`${el.text}. ${el.sub}`));

  const part = partMaterialIssue(description, title);
  if (part) diffs.push(sentence(part.text));
  const mat = matchMaterial(description, title);
  if (mat?.status === "other")
    diffs.push(
      sentence(
        mat.asked
          ? Lx(`La publicación indica ${mat.listed}, no ${mat.asked}`, `The listing states ${mat.listed}, not ${mat.asked}`)
          : Lx(`La publicación indica ${mat.listed}, un material que excluiste`, `The listing states ${mat.listed}, a material you ruled out`),
      ),
    );
  else if (!mat && !part) {
    // 02-11s: «sin látex» / «puntera compuesta» asked and the title says nothing about it
    const unstated = materialUnstated(description, title);
    if (unstated) toConfirm.push(sentence(Lx(`La publicación no indica ${unstated}; confírmalo con el proveedor`, `The listing does not state ${unstated}; confirm it with the supplier`)));
  }
  if (mat?.status !== "other" && mat?.mixed)
    toConfirm.push(
      sentence(Lx(`El título menciona varios materiales (${mat.mixed}); puede ser una mezcla y no ${mat.asked} puro: pide la ficha técnica`, `The title names several materials (${mat.mixed}); it may be a blend rather than pure ${mat.asked}: ask for the technical sheet`)),
    );

  // characteristics like "libre de aceite": never taken as met when the title doesn't say so
  for (const f of matchFeatures(description, title)) {
    if (f.status === "match") continue;
    (f.status === "other" ? diffs : toConfirm).push(sentence(featureText(f).sentence));
  }

  const specs = matchSpecs(requestedSpecs(description), title);
  for (const i of specs?.items ?? []) {
    if (i.status === "meets" && !i.edge) continue;
    const l = specLabel(i);
    // a larger capacity than asked is a difference to weigh, not a contradiction (02-11s)
    (i.status === "lower" ? diffs : toConfirm).push(sentence(`${l.text}. ${l.sub}`));
  }
  return { title, diffs, toConfirm };
}

/** The heading and closing line the reports use with these items. */
export function differencesHeading(): string {
  return Lx("Diferencias y datos por confirmar", "Differences and data to confirm");
}
export function differencesFootnote(): string {
  return Lx(
    "Compara lo que pediste con la información publicada por el proveedor; no está verificada y debe confirmarse antes de comprar.",
    "Compares what you asked for with the information the supplier published; it is not verified and must be confirmed before buying.",
  );
}
