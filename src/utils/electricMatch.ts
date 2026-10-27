// Compares the power supply the client asked for ("molino 220 V trifásico 60 Hz,
// eléctrico, no diésel") with what a listing title states ("single phase 220V
// diesel"). Phase, voltage, frequency and engine type are checked separately:
// one property that matches never hides another that doesn't. Only reads what is
// written: a title that says nothing about it is "to confirm", never a match.
import { Lx } from "./lang";

export type Phase = "single" | "three" | "";
export type Engine = "electric" | "diesel" | "gasoline";
export interface Electric {
  phase: Phase;
  volts: number[];
  ranges: [number, number][]; // "220-240V"
  hz: number[];
  engines: Engine[];
}

const SINGLE = /\b(?:monof[aá]sic[oa]s?|mono\s*-?\s*f[aá]sic[oa]|single[\s-]*phase|one[\s-]*phase|1[\s-]*(?:phase|fase|ph)\b|1\s*-?\s*φ|1\s*~|1\s*f\b|una\s+fase)/;
const THREE = /\b(?:trif[aá]sic[oa]s?|tri\s*-?\s*f[aá]sic[oa]|three[\s-]*phase|3[\s-]*(?:phase|fases?|ph)\b|3\s*-?\s*φ|3\s*~|3\s*f\b|tres\s+fases)/;

// "single/three phase", "monofásico o trifásico": both offered
const BOTH = /\b(?:single|one|1)\s*(?:\/|or|and|&|-)\s*(?:three|3)[\s-]*(?:phases?|ph)\b|\bmonof[aá]sic[oa]s?\s*(?:\/|o|y|-)\s*trif[aá]sic|\btrif[aá]sic[oa]s?\s*(?:\/|o|y|-)\s*monof[aá]sic/;
const hasSingle = (t: string) => SINGLE.test(t) || BOTH.test(t);
const hasThree = (t: string) => THREE.test(t) || BOTH.test(t);

const ENGINE_RE: Record<Engine, RegExp> = {
  diesel: /\bdi[eé]sel\b/,
  gasoline: /\bgasolin[ae]\b|\bpetrol\b|\bgas(?:oline)?\s+engine\b|\bmotor\s+a\s+gasolina\b/,
  electric: /\bel[eé]ctric[oa]s?\b|\belectric(?:al)?\b|\bmotor\s+el[eé]ctrico\b/,
};

// what the client rules out ("excluyendo los monofásicos", "no 110V", "sin motor diésel")
const NEG = "(?:no|ni|sin|excepto|salvo|menos|excluy\\w*|exclu[iy]\\w*|descart\\w*|evit\\w*|not|nor|no\\s+quiero|except|excluding|exclude\\w*|without|avoid\\w*)";
const PHASE_WORDS = `(?:monof[aá]sic[oa]s?|mono\\s*-?\\s*f[aá]sic[oa]s?|single[\\s-]*phase|one[\\s-]*phase|1[\\s-]*(?:phase|fase|ph)|trif[aá]sic[oa]s?|tri\\s*-?\\s*f[aá]sic[oa]s?|three[\\s-]*phase|3[\\s-]*(?:phase|fases?|ph))`;
const NEGATED = new RegExp(`\\b${NEG}\\s+(?:[a-záéíóúüñ]+\\s+){0,4}?${PHASE_WORDS}(?:\\s*(?:,|y|o|ni|or|and|nor)\\s*${PHASE_WORDS})*`, "g");
const NEG_VOLTS = new RegExp(`\\b${NEG}\\s+(?:[a-záéíóúüñ]+\\s+){0,3}?(\\d{2,3})\\s*(?:v|volts?|voltios?|vac)\\b`, "g");
const NEG_ENGINE = new RegExp(`\\b${NEG}\\s+(?:[a-záéíóúüñ]+\\s+){0,3}?(di[eé]sel|gasolin[ae]|petrol|el[eé]ctric[oa]?)`, "g");

export interface Exclusions {
  phase: Phase;
  volts: number[];
  engines: Engine[];
  rest: string;
}
/** What the client rules out, and the text without those parts. */
export function exclusions(text?: string): Exclusions {
  let t = ` ${String(text || "").toLowerCase()} `;
  let phase: Phase = "";
  const volts: number[] = [];
  const engines: Engine[] = [];
  t = t.replace(NEGATED, (m) => {
    if (hasSingle(m) && !hasThree(m)) phase = "single";
    else if (hasThree(m) && !hasSingle(m)) phase = "three";
    return " ";
  });
  t = t.replace(NEG_VOLTS, (_m, v) => {
    volts.push(Number(v));
    return " ";
  });
  t = t.replace(NEG_ENGINE, (_m, w: string) => {
    engines.push(/di/.test(w) ? "diesel" : /gas|petrol/.test(w) ? "gasoline" : "electric");
    return " ";
  });
  return { phase, volts, engines, rest: t };
}
/** Kept for older imports: the phase the client rules out. */
export function excludedPhase(text?: string): { phase: Phase; rest: string } {
  const e = exclusions(text);
  return { phase: e.phase, rest: e.rest };
}

/** Phase, voltages, frequency and engine written in a text, or null when it names none. */
export function parseElectric(text?: string): Electric | null {
  const t = ` ${String(text || "").toLowerCase()} `;
  const single = hasSingle(t);
  const three = hasThree(t);
  const phase: Phase = single && !three ? "single" : three && !single ? "three" : "";
  const ranges: [number, number][] = [];
  const rest = t.replace(/(\d{3})\s*(?:-|–|~|to|a)\s*(\d{3})\s*(?:v|volts?|voltios?|vac|vca)\b/g, (_m, a, b) => {
    const lo = Math.min(Number(a), Number(b));
    const hi = Math.max(Number(a), Number(b));
    if (lo >= 100 && hi <= 690) ranges.push([lo, hi]);
    return " ";
  });
  const volts = [
    ...new Set(
      [...rest.matchAll(/(\d{2,3})(?:\s*\/\s*(\d{2,3}))*\s*(?:v|volts?|voltios?|vac|vca)\b/g)].flatMap((m) =>
        m[0].match(/\d{2,3}/g)!.map(Number).filter((v) => v >= 100 && v <= 690),
      ),
    ),
  ];
  const hz = [...new Set([...t.matchAll(/\b(50|60)\s*(?:\/\s*(50|60)\s*)?hz\b/g)].flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number)))];
  const engines = (Object.keys(ENGINE_RE) as Engine[]).filter((e) => ENGINE_RE[e].test(t));
  if (!phase && !volts.length && !ranges.length && !hz.length && !engines.length && !(single && three)) return null;
  return { phase: single && three ? "" : phase, volts, ranges, hz, engines };
}

const phaseWord = (p: Phase) => (p === "single" ? Lx("monofásico", "single-phase") : Lx("trifásico", "three-phase"));
const engineWord = (e: Engine) => (e === "electric" ? Lx("eléctrico", "electric") : e === "diesel" ? Lx("motor diésel", "diesel engine") : Lx("motor a gasolina", "gasoline engine"));
const voltText = (e: Electric) => [...e.ranges.map(([a, b]) => `${a}-${b} V`), ...e.volts.map((v) => `${v} V`)].join(" / ");
const describe = (e: Electric) =>
  [voltText(e), e.phase ? phaseWord(e.phase) : "", e.hz.length ? e.hz.map((h) => `${h} Hz`).join("/") : ""].filter(Boolean).join(" ");
/** A requested voltage is offered: the same figure, or inside a published range (and the other way round). */
const voltsMeet = (want: Electric, got: Electric) => {
  const wantAll = [...want.volts, ...want.ranges.flat()];
  return (
    want.volts.some((v) => got.volts.includes(v) || got.ranges.some(([a, b]) => v >= a && v <= b)) ||
    want.ranges.some(([a, b]) => got.volts.some((v) => v >= a && v <= b) || got.ranges.some(([c, d]) => c <= b && d >= a)) ||
    (!wantAll.length && false)
  );
};
const hasVolts = (e?: Electric | null) => !!e && (e.volts.length > 0 || e.ranges.length > 0);

export interface ElectricMatch {
  status: "match" | "other" | "unknown";
  asked: string;
  listed: string;
  text: string; // tag text, the same words go to the reports
  sub: string;
}

/** null when the client asked nothing about voltage, phase, frequency or engine. */
export function matchElectric(description: string, productTitle?: string): ElectricMatch | null {
  // "trifásico, excluyendo los monofásicos", "no 110V", "sin motor diésel": exclusions are
  // not something asked for
  const ex = exclusions(description);
  const want: Electric = parseElectric(ex.rest) || { phase: "", volts: [], ranges: [], hz: [], engines: [] };
  if (!want.phase && ex.phase) want.phase = ex.phase === "single" ? "three" : "single";
  want.volts = want.volts.filter((v) => !ex.volts.includes(v));
  want.engines = want.engines.filter((e) => !ex.engines.includes(e));
  const got = parseElectric(productTitle);
  // the engine type only matters when a fuel engine is in play ("eléctrico" alone, as in an
  // electric kettle, says nothing to compare)
  const fuel = (es: Engine[]) => es.some((e) => e !== "electric");
  if (!(ex.engines.length || fuel(want.engines) || fuel(got?.engines || []))) want.engines = [];
  const asksAnything = !!want.phase || hasVolts(want) || want.hz.length > 0 || want.engines.length > 0 || ex.volts.length > 0 || ex.engines.length > 0;
  if (!asksAnything) return null;
  const asked = [describe(want), want.engines.map(engineWord).join(" / ")].filter(Boolean).join(", ") || Lx("la alimentación indicada", "the stated power supply");
  const lowTitle = ` ${String(productTitle || "").toLowerCase()} `;
  const bothPhases = hasSingle(lowTitle) && hasThree(lowTitle);
  const sub = Lx(
    "Un equipo con otra fase, voltaje, frecuencia o tipo de motor puede no funcionar con tu instalación; confírmalo con el proveedor",
    "Equipment with another phase, voltage, frequency or engine type may not work with your installation; confirm it with the supplier",
  );

  // a title with several options ("single phase 220V or three phase 380V"): is the
  // requested combination one of them?
  if (got && bothPhases && want.phase && hasVolts(want)) {
    const segs = lowTitle
      .split(/\bor\b|\bo\b|\/(?!\s*\d)|;|,|\band\b|\by\b/)
      .map((x) => parseElectric(x))
      .filter((e): e is Electric => !!e && !!e.phase && hasVolts(e));
    if (segs.length >= 2) {
      const ok = segs.some((e) => e.phase === want.phase && voltsMeet(want, e));
      const offers = segs.map((e) => `${phaseWord(e.phase)} ${voltText(e)}`).join(Lx(" o ", " or "));
      return ok
        ? { status: "unknown", asked, listed: offers, text: Lx(`Ofrece varias opciones (${offers}); una es ${asked}`, `It offers several options (${offers}); one is ${asked}`), sub: Lx("Confirma que te coticen esa opción", "Confirm they quote that option") }
        : { status: "other", asked, listed: offers, text: Lx(`Esta publicación ofrece ${offers}; ninguna opción es ${asked}`, `This listing offers ${offers}; none of them is ${asked}`), sub };
    }
  }

  // what contradicts the request, each property on its own
  const parts: string[] = [];
  const g = got || { phase: "" as Phase, volts: [], ranges: [], hz: [], engines: [] };
  const phaseOff = !!want.phase && !!g.phase && g.phase !== want.phase;
  if (phaseOff) parts.push(Lx(`Esta publicación indica ${phaseWord(g.phase)}; solicitaste ${phaseWord(want.phase)}`, `This listing states ${phaseWord(g.phase)}; you asked for ${phaseWord(want.phase)}`));
  const voltsOff = hasVolts(want) && hasVolts(g) && !voltsMeet(want, g);
  const lead = (es: string, en: string) => (parts.length ? Lx(es.toLowerCase(), en.toLowerCase()) : Lx(`Esta publicación ${es.toLowerCase()}`, `This listing ${en.toLowerCase()}`));
  if (voltsOff) parts.push(Lx(`${lead("indica", "states")} ${voltText(g)}; solicitaste ${voltText(want)}`, `${lead("indica", "states")} ${voltText(g)}; you asked for ${voltText(want)}`));
  // a voltage the client ruled out
  const ruledVolts = hasVolts(g) && !voltsMeet(want, g) ? g.volts.filter((v) => ex.volts.includes(v)) : [];
  if (ruledVolts.length && !voltsOff) parts.push(Lx(`${lead("indica", "states")} ${ruledVolts.join(" / ")} V, que excluiste`, `${lead("indica", "states")} ${ruledVolts.join(" / ")} V, which you ruled out`));
  const hzOff = want.hz.length > 0 && g.hz.length > 0 && !g.hz.some((h) => want.hz.includes(h));
  if (hzOff) parts.push(Lx(`${lead("indica", "states")} ${g.hz.join("/")} Hz; solicitaste ${want.hz.join("/")} Hz`, `${lead("indica", "states")} ${g.hz.join("/")} Hz; you asked for ${want.hz.join("/")} Hz`));
  // engine: fuel when the client asked electric (or ruled the fuel out), and the other way round
  const engOnly = g.engines.length === 1 ? g.engines[0] : "";
  const engOff =
    !!engOnly &&
    ((want.engines.length > 0 && !want.engines.includes(engOnly)) || ex.engines.includes(engOnly));
  if (engOff)
    parts.push(
      ex.engines.includes(engOnly) && !want.engines.length
        ? Lx(`${lead("indica", "states")} ${engineWord(engOnly)}, que excluiste`, `${lead("indica", "states")} ${engineWord(engOnly)}, which you ruled out`)
        : Lx(`${lead("indica", "states")} ${engineWord(engOnly)}; solicitaste ${want.engines.map(engineWord).join(" o ")}`, `${lead("indica", "states")} ${engineWord(engOnly)}; you asked for ${want.engines.map(engineWord).join(" or ")}`),
    );
  if (phaseOff && !voltsOff && hasVolts(want) && voltsMeet(want, g))
    parts.push(Lx(`el voltaje (${voltText(want)}) coincide, pero la fase no`, `the voltage (${voltText(want)}) matches, but the phase does not`));
  if (parts.length) return { status: "other", asked, listed: got ? describe(got) : "", text: parts.join("; "), sub };

  // nothing contradicts: what matches and what is still unstated
  const phaseOk = !want.phase || g.phase === want.phase;
  const voltsOk = !hasVolts(want) || voltsMeet(want, g);
  const hzOk = !want.hz.length || g.hz.some((h) => want.hz.includes(h));
  const engOk = !want.engines.length || (!!engOnly && want.engines.includes(engOnly));
  // Guatemala's grid is 60 Hz: a title stating only 50 Hz is worth a check
  const only50 = !want.hz.length && g.hz.length > 0 && !g.hz.includes(60);
  if (got && phaseOk && voltsOk && hzOk && engOk && !bothPhases && !only50) {
    const okText = describe(want) || want.engines.map(engineWord).join(" / ");
    return { status: "match", asked, listed: describe(got), text: Lx(`Indica la alimentación pedida: ${okText}`, `States the requested power supply: ${okText}`), sub: "" };
  }
  // "diesel engine or electric motor": the requested one is offered among others
  if (want.engines.length && g.engines.length > 1 && g.engines.some((e) => want.engines.includes(e)))
    return {
      status: "unknown",
      asked,
      listed: g.engines.map(engineWord).join(Lx(" o ", " or ")),
      text: Lx(`Menciona ${g.engines.map(engineWord).join(" y ")}`, `It mentions ${g.engines.map(engineWord).join(" and ")}`),
      sub: Lx(`Confirma que te coticen ${want.engines.map(engineWord).join(" o ")}`, `Confirm they quote the ${want.engines.map(engineWord).join(" or ")}`),
    };
  const missing = [
    want.phase && !(g.phase === want.phase) ? Lx("la fase", "the phase") : "",
    hasVolts(want) && !voltsOk ? Lx("el voltaje", "the voltage") : "",
    want.hz.length && !hzOk ? Lx("la frecuencia (Hz)", "the frequency (Hz)") : "",
    want.engines.length && !engOk ? Lx("el tipo de motor", "the engine type") : "",
  ].filter(Boolean);
  const missingTxt = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} ${Lx("ni", "or")} ${missing[missing.length - 1]}` : missing[0] || "";
  return {
    status: "unknown",
    asked,
    listed: got ? describe(got) : "",
    text: bothPhases
      ? Lx("El título menciona monofásico y trifásico", "The title mentions single- and three-phase")
      : only50 && !missingTxt
        ? Lx(`Indica ${g.hz.join("/")} Hz; en Guatemala la red eléctrica es de 60 Hz`, `States ${g.hz.join("/")} Hz; Guatemala's grid is 60 Hz`)
        : Lx(`La publicación no indica ${missingTxt || "la alimentación eléctrica"}${only50 ? ` e indica ${g.hz.join("/")} Hz (en Guatemala la red es de 60 Hz)` : ""}`, `The listing does not state ${missingTxt || "the power supply"}${only50 ? ` and states ${g.hz.join("/")} Hz (Guatemala's grid is 60 Hz)` : ""}`),
    sub: Lx(`Pediste ${asked}: confírmalo con el proveedor`, `You asked for ${asked}: confirm it with the supplier`),
  };
}

/** Stable re-order: listings with another phase, voltage, frequency or engine go last. */
export function orderByElectric<T extends { productName?: string }>(list: T[], description: string): T[] {
  return list
    .map((s, i) => ({ s, i, r: matchElectric(description, s.productName)?.status === "other" ? 1 : 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
