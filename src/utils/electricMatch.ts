// Compares the electrical supply the client asked for ("molino 220 V trifásico")
// with what a listing title states ("single phase 220V"). Only reads what is
// written: a title that says nothing about it is "to confirm", never a match.
import { Lx } from "./lang";

export type Phase = "single" | "three" | "";
export interface Electric {
  phase: Phase;
  volts: number[];
}

const SINGLE = /\b(?:monof[aá]sic[oa]s?|mono\s*-?\s*f[aá]sic[oa]|single[\s-]*phase|one[\s-]*phase|1[\s-]*(?:phase|fase|ph)\b|1\s*-?\s*φ|una\s+fase)/;
const THREE = /\b(?:trif[aá]sic[oa]s?|tri\s*-?\s*f[aá]sic[oa]|three[\s-]*phase|3[\s-]*(?:phase|fases?|ph)\b|3\s*-?\s*φ|tres\s+fases)/;

// "single/three phase", "monofásico o trifásico": both offered
const BOTH = /\b(?:single|one|1)\s*(?:\/|or|and|&|-)\s*(?:three|3)[\s-]*(?:phases?|ph)\b|\bmonof[aá]sic[oa]s?\s*(?:\/|o|y|-)\s*trif[aá]sic|\btrif[aá]sic[oa]s?\s*(?:\/|o|y|-)\s*monof[aá]sic/;
const hasSingle = (t: string) => SINGLE.test(t) || BOTH.test(t);
const hasThree = (t: string) => THREE.test(t) || BOTH.test(t);

/** Phase and voltages written in a text, or null when it names neither. */
export function parseElectric(text?: string): Electric | null {
  const t = ` ${String(text || "").toLowerCase()} `;
  const single = hasSingle(t);
  const three = hasThree(t);
  // both written ("single/three phase", "220V single or 380V three phase"): the listing offers both
  const phase: Phase = single && !three ? "single" : three && !single ? "three" : "";
  const volts = [
    ...new Set(
      [...t.matchAll(/(\d{2,3})(?:\s*\/\s*(\d{2,3}))*\s*(?:v|volts?|voltios?|vac|vca)\b/g)].flatMap((m) =>
        m[0].match(/\d{2,3}/g)!.map(Number).filter((v) => v >= 100 && v <= 690),
      ),
    ),
  ];
  if (!phase && !volts.length && !(single && three)) return null;
  return { phase: single && three ? "" : phase, volts };
}

const phaseWord = (p: Phase) => (p === "single" ? Lx("monofásico", "single-phase") : Lx("trifásico", "three-phase"));
const describe = (e: Electric) =>
  [e.volts.length ? e.volts.map((v) => `${v} V`).join(" / ") : "", e.phase ? phaseWord(e.phase) : ""].filter(Boolean).join(" ");

export interface ElectricMatch {
  status: "match" | "other" | "unknown";
  asked: string;
  listed: string;
  text: string; // tag text, the same words go to the reports
  sub: string;
}

/** null when the client asked nothing about voltage or phase. */
export function matchElectric(description: string, productTitle?: string): ElectricMatch | null {
  const want = parseElectric(description);
  if (!want || (!want.phase && !want.volts.length)) return null;
  const got = parseElectric(productTitle);
  const asked = describe(want);
  // both phases in the title ("single/three phase"): it offers both, confirm which one is quoted
  const lowTitle = ` ${String(productTitle || "").toLowerCase()} `;
  const bothPhases = hasSingle(lowTitle) && hasThree(lowTitle);
  const phaseOff = !!want.phase && !!got?.phase && got.phase !== want.phase;
  const voltsOff = want.volts.length > 0 && !!got?.volts.length && !got.volts.some((v) => want.volts.includes(v));
  if (got && (phaseOff || voltsOff)) {
    const parts: string[] = [];
    if (phaseOff) parts.push(Lx(`indica ${phaseWord(got.phase)}; pediste ${phaseWord(want.phase)}`, `states ${phaseWord(got.phase)}; you asked for ${phaseWord(want.phase)}`));
    if (voltsOff) parts.push(Lx(`indica ${got.volts.join(" / ")} V; pediste ${want.volts.join(" / ")} V`, `states ${got.volts.join(" / ")} V; you asked for ${want.volts.join(" / ")} V`));
    const text = Lx(`Alimentación eléctrica distinta: ${parts.join("; ")}`, `Different power supply: ${parts.join("; ")}`);
    return {
      status: "other",
      asked,
      listed: describe(got),
      text,
      sub: Lx(
        "Un equipo con otra fase o voltaje puede no funcionar con tu instalación; confírmalo con el proveedor",
        "Equipment with another phase or voltage may not work with your installation; confirm it with the supplier",
      ),
    };
  }
  const phaseOk = !want.phase || got?.phase === want.phase;
  const voltsOk = !want.volts.length || !!got?.volts.some((v) => want.volts.includes(v));
  if (got && phaseOk && voltsOk && !bothPhases)
    return { status: "match", asked, listed: describe(got), text: Lx(`Indica la alimentación pedida: ${asked}`, `States the requested power supply: ${asked}`), sub: "" };
  const missing = [
    want.phase && !(got?.phase === want.phase) ? Lx("la fase", "the phase") : "",
    want.volts.length && !voltsOk ? Lx("el voltaje", "the voltage") : "",
  ].filter(Boolean).join(Lx(" ni ", " or "));
  return {
    status: "unknown",
    asked,
    listed: got ? describe(got) : "",
    text: bothPhases
      ? Lx("El título menciona monofásico y trifásico", "The title mentions single- and three-phase")
      : Lx(`La publicación no indica ${missing || "la alimentación eléctrica"}`, `The listing does not state ${missing || "the power supply"}`),
    sub: Lx(`Pediste ${asked}: confírmalo con el proveedor`, `You asked for ${asked}: confirm it with the supplier`),
  };
}

/** Stable re-order: listings with another phase or voltage go last. */
export function orderByElectric<T extends { productName?: string }>(list: T[], description: string): T[] {
  return list
    .map((s, i) => ({ s, i, r: matchElectric(description, s.productName)?.status === "other" ? 1 : 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
