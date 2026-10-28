// What the selected listing says differently from what the client asked, or
// leaves unconfirmed: the same warnings the screen shows, in plain sentences,
// so they travel with the PDF and Excel reports. It compares published text
// only; nothing here is verified.
import { matchFeatures, featureText } from "./featureMatch";
import { Lx } from "./lang";
import { requestedSpecs, matchSpecs, specLabel } from "./capacity";
import { matchUse } from "./useMatch";
import { matchMaterial, partMaterialIssue } from "./materialMatch";
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
  const title = String(supplier?.productName || "").trim();
  const diffs: string[] = [];
  const toConfirm: string[] = [];
  if (!title) return { title, items: [] };

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
  else if (mat?.mixed)
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
    (i.status === "lower" || i.status === "higher" ? diffs : toConfirm).push(sentence(`${l.text}. ${l.sub}`));
  }
  return { title, items: [...diffs, ...toConfirm].filter(Boolean) };
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
