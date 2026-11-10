// ─── SEAL landed-cost calculator (Guatemala) ────────────────────────────────
// Single source of truth for the costs, PDF and Excel screens.
// Rates come from the backend (/api/rates → Google Sheet) with these defaults.
import { useEffect, useState } from "react";
import { Lx } from "./lang";
import { unitWordFor } from "./saleUnit";

export interface Rates {
  container40: number;      // USD per 40' container, all-in China → warehouse around Guatemala City
  lclRatePerCbm: number;    // USD per m³ consolidated, all-in China → warehouse (0 = container40/m³ × lclFactor)
  container20: number;      // USD per 20' container (0 = not offered, use 40')
  container40Cbm: number;   // usable m³ in a 40'
  container20Cbm: number;   // usable m³ in a 20'
  lclFactor: number;        // markup over pure container cost per m³ for consolidated cargo
  lclMinCbm: number;        // minimum chargeable m³ in consolidated
  lclMaxCbm: number;        // above this volume we quote full container (FCL)
  dutyRate: number;         // DAI (on CIF)
  vatRate: number;          // IVA (on CIF + DAI)
  insuranceRate: number;    // on FOB
  insuranceMin: number;     // minimum insurance premium
  customsFees: number;      // SEAL customs brokerage fee (USD, legacy — used only if the GTQ value is 0)
  localCharges: number;     // destination charges (USD, legacy — used only if the GTQ value is 0)
  customsFeesGTQ: number;   // SEAL customs brokerage fee, fixed in quetzales
  localChargesGTQ: number;  // destination charges (handling, inspection, storage…), fixed in quetzales
  transitDays: string;      // shown to the user
  exchangeRate: number;     // reference GTQ per 1 USD (costs are shown in quetzales)
}

export const DEFAULT_RATES: Rates = {
  // 10-11: SEAL's all-in reference freight (China → warehouse on the outskirts of Guatemala City, every
  // charge included): consolidated US$2,045 per m³, 40' container US$11,750. Insurance and destination
  // charges are inside the freight, so they are 0; the SEAL customs fee stays.
  container40: 11750,
  lclRatePerCbm: 2045,
  container20: 0,
  container40Cbm: 55,
  container20Cbm: 25,
  lclFactor: 1.8,
  lclMinCbm: 1,
  lclMaxCbm: 15,
  dutyRate: 0.15,
  vatRate: 0.12,
  insuranceRate: 0,
  insuranceMin: 0,
  customsFees: 200,
  localCharges: 0,
  customsFeesGTQ: 1200,
  localChargesGTQ: 0,
  transitDays: "30-45",
  exchangeRate: 7.9,
};

// Shown wherever a cost appears: this tool estimates, SEAL quotes
export function estimateNote(): string {
  return Lx(
    "Estimación referencial, no es una cotización ni un costo final. Si lo deseas, un ejecutivo de SEAL puede revisarla contigo antes del embarque.",
    "Reference estimate, not a quote or a final cost. If you wish, a SEAL executive can review it with you before shipment.",
  );
}

/** 02-11j: a rate as a percentage with up to 2 decimals and no trailing zeros («15%», «7.5%», «0.35%»). */
export const ratePct = (r: number): string => `${Number((Number(r) * 100).toFixed(2))}%`;

/** What can move this preliminary scenario (shown on screen, PDF and Excel). */
export function scenarioVariables(costs: { freightPending: boolean; dutyRate: number; freightEstimated?: boolean }, opts: { priceIsMidpoint?: boolean } = {}): string[] {
  return [
    costs.freightPending
      ? Lx("Flete: no está incluido; se cotiza con el volumen y el peso reales.", "Freight: not included; quoted with the actual volume and weight.")
      : costs.freightEstimated
      ? Lx("Flete: no indicaste volumen ni peso, así que se usó un tamaño de carga aproximado según el producto y la cantidad; con los m³ o kg reales el flete puede cambiar.", "Freight: no volume or weight was given, so an approximate cargo size based on the product and quantity was used; with the real m³ or kg the freight may change.")
      : Lx("Flete: es una tarifa aproximada todo incluido hasta bodega en el perímetro de la capital; el monto real lo confirma SEAL con el volumen y peso reales.", "Freight: an approximate all-in rate to a warehouse around Guatemala City; SEAL confirms the real amount with the actual volume and weight."),
    Lx(
      `DAI: depende de la partida arancelaria; se usó ${ratePct(costs.dutyRate)} como referencia.`,
      `DAI duty: depends on the tariff heading; ${ratePct(costs.dutyRate)} was used as reference.`,
    ),
    opts.priceIsMidpoint
      ? Lx("Precio: se usó el precio medio del rango publicado; el precio negociado puede ser otro.", "Price: the midpoint of the published range was used; the negotiated price may differ.")
      : Lx("Precio: el precio final lo confirma la proforma del proveedor.", "Price: the final price is confirmed by the supplier's proforma."),
    Lx("Tipo de cambio del día de pago y de la DUCA.", "Exchange rate on the payment and DUCA dates."),
    Lx("Revisión física, almacenaje extra o días adicionales en puerto, si los hubiera.", "Physical inspection, extra storage or additional days at port, if any."),
  ];
}

// Rates and costs are kept in USD; everything shown to the client is in quetzales
export function formatQ(usdAmount: number, exchangeRate: number, decimals = 0): string {
  const q = usdAmount * exchangeRate;
  // Small unit amounts (Q0.0024) keep their decimals instead of showing Q0.00
  const small = decimals > 0 && q > 0 && q < 1;
  return `Q${q.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: small ? Math.max(4, unitDigits(q)) : decimals,
  })}`;
}

/** 30-f: a line amount in quetzales rounded to centavos, the way it is printed in the PDF and Excel. */
export function qCents(usdAmount: number, exchangeRate: number): number {
  return round2(usdAmount * exchangeRate);
}
/**
 * 02-11j: half a centavo rounds UP, as it is written. «+ Number.EPSILON» did nothing above 1: a product of
 * Q32.785 is stored as 32.78499… and was printed Q32.78 (and the CIF base text then differed from the sum
 * of the printed lines). The value is first read at 12 significant digits (its decimal meaning), then
 * rounded with a decimal exponent, so no binary error reaches the centavos.
 */
export function round2(x: number): number {
  if (!Number.isFinite(x)) return x;
  const s = Math.sign(x) || 1;
  const a = Math.abs(x);
  // (review) outside the range where toPrecision writes plain decimals: below half a centavo it is 0
  // («1e-7e2» was NaN), and from 1e15 the double has no centavos to correct
  if (a < 0.005) return 0;
  if (a >= 1e15) return x;
  return s * Number(`${Math.round(Number(`${Number(a.toPrecision(15))}e2`))}e-2`);
}
/** 30-f: the total of the printed lines (each already in centavos), so the rows add up to the total. */
export function linesTotalQ(costs: { lines?: { key: string; amount: number }[]; freightPending?: boolean; totalCost: number }, exchangeRate: number): number {
  if (!costs.lines || !costs.lines.length) return qCents(costs.totalCost, exchangeRate);
  const sum = costs.lines.filter((l) => !(l.key === "freight" && costs.freightPending)).reduce((a, l) => a + qCents(l.amount, exchangeRate), 0);
  return round2(sum);
}

/**
 * 02-11: the share of each printed line in the total, with `decimals` digits, adding up to exactly
 * 100 (largest remainder). Every place that shows shares (cost page, legend, PDF, Excel) uses it, so
 * the same line never shows 62% in one place and 61% in another, and the shares never add to 101%.
 * `null` entries (freight still to be quoted) have no share.
 */
export function shareValues(amounts: (number | null)[], decimals = 1): (number | null)[] {
  const scale = 10 ** decimals;
  const vals = amounts.map((a) => (a === null || !(a > 0) ? 0 : a));
  const total = vals.reduce((x, y) => x + y, 0);
  if (!(total > 0)) return amounts.map((a) => (a === null ? null : 0));
  const raw = vals.map((v) => (v / total) * 100 * scale);
  const base = raw.map((r) => Math.floor(r + 1e-9));
  let left = 100 * scale - base.reduce((x, y) => x + y, 0);
  raw
    .map((r, i) => ({ i, rem: r - base[i] }))
    .filter(({ i }) => vals[i] > 0)
    .sort((a, b) => b.rem - a.rem || vals[b.i] - vals[a.i])
    .forEach(({ i }) => {
      if (left > 0) {
        base[i] += 1;
        left -= 1;
      }
    });
  return amounts.map((a, i) => (a === null ? null : base[i] / scale));
}
/** The shares of the cost lines as printed (centavos), keyed like costs.lines; freight to be quoted → null. */
export function lineShares(costs: { lines?: { key: string; amount: number }[]; freightPending?: boolean }, exchangeRate: number, decimals = 1): (number | null)[] {
  return shareValues((costs.lines || []).map((l) => (l.key === "freight" && costs.freightPending ? null : qCents(l.amount, exchangeRate))), decimals);
}
/** «61.6%», «<0.1%» for a positive line too small to round up, «—» without a share. */
export function shareText(share: number | null, amount: number, decimals = 1, none = "—"): string {
  if (share === null || !Number.isFinite(share)) return none;
  if (share === 0 && amount > 0) return `<${decimals ? (0.1).toFixed(decimals) : "1"}%`;
  return `${share.toFixed(decimals)}%`;
}
const qText = (q: number) => `Q${q.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** 30-f: a line in quetzales with centavos, printed from qCents (the same value the total adds). */
export function formatQCents(usdAmount: number, exchangeRate: number): string {
  return qText(qCents(usdAmount, exchangeRate));
}
export function formatQTotal(costs: { lines?: { key: string; amount: number }[]; freightPending?: boolean; totalCost: number }, exchangeRate: number): string {
  return qText(linesTotalQ(costs, exchangeRate));
}

// ── 02-11c: ONE total everywhere ─────────────────────────────────────────────────────────────
// The total the client sees (headline, chart center, report card, case summary SEAL receives,
// report email, PDF and Excel) is the sum of the printed lines in centavos — Q64,140.15, never
// Q64,140 in one place and Q64,140.15 in another. Groups are sums of those same printed lines.
type LinesLike = { lines?: { key: string; amount: number }[]; freightPending?: boolean; totalCost: number; perUnit?: number };
/** Sum of the printed lines of the given keys (centavos), excluding freight still to be quoted. */
export function groupQ(costs: LinesLike, keys: string[], exchangeRate: number): number {
  const sum = (costs.lines || [])
    .filter((l) => keys.includes(l.key) && !(l.key === "freight" && costs.freightPending))
    .reduce((a, l) => a + qCents(l.amount, exchangeRate), 0);
  return round2(sum);
}
/** A quetzal amount already in quetzales, with centavos («Q64,140.15»). */
export const formatQAmount = (q: number): string =>
  q > 0 && q < 1 ? `Q${q.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: Math.max(4, unitDigits(q)) })}` : qText(q);
/** The total per unit, from the printed total (so 4 × the unit figure matches the total). */
export function perUnitQ(costs: LinesLike, exchangeRate: number): number {
  if (!(costs.totalCost > 0) || !(Number(costs.perUnit) > 0)) return 0;
  const units = costs.totalCost / Number(costs.perUnit);
  const v = linesTotalQ(costs, exchangeRate) / units;
  // under Q1 the figure keeps its significant digits (Q0.0044, never Q0.00), like every unit amount
  if (v < 1) return Number(v.toPrecision(3));
  return round2(v);
}
/** The US$ equivalent of the printed total, with cents. */
export function totalUSDText(costs: LinesLike, exchangeRate: number): string {
  return formatUSD(linesTotalQ(costs, exchangeRate) / exchangeRate, 2);
}
/** The estimate as SEAL receives it and as the reports print it: «Q64,140.15 (US$8,119.01), sin flete». */
export function totalSummary(costs: LinesLike, exchangeRate: number, noFreightWords: string): string {
  return `${formatQTotal(costs, exchangeRate)} (${totalUSDText(costs, exchangeRate)})${costs.freightPending ? noFreightWords : ""}`;
}

export function formatUSD(usdAmount: number, decimals = 0): string {
  // Small unit prices (US$0.035) keep their decimals instead of showing US$0.00
  const small = decimals > 0 && usdAmount > 0 && usdAmount < 1;
  return `US$${usdAmount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: small ? Math.max(4, unitDigits(usdAmount)) : decimals,
  })}`;
}

// Unit prices: as many decimals as the value really has (2 to 4), so the price
// shown × the quantity gives the same total the calculator uses (US$2.425, not US$2.43).
// below US$0.0001 the figure keeps 3 significant digits (US$0.0000400), never US$0.00
function unitDigits(v: number): number {
  const a = Math.abs(v);
  if (a > 0 && a < 0.0001) return Math.min(10, Math.ceil(-Math.log10(a)) + 2);
  for (let d = 2; d < 4; d++) if (Math.abs(Math.round(v * 10 ** d) - v * 10 ** d) < 1e-6) return d;
  return 4;
}
export function formatUnitUSD(usd: number): string {
  return `US$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: unitDigits(usd) })}`;
}
export function formatUnitQ(usd: number, exchangeRate: number): string {
  const q = usd * exchangeRate;
  return `Q${q.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: unitDigits(q) })}`;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
let ratesCache: Rates | null = null;
let ratesPromise: Promise<Rates> | null = null;

/** The rates in use (from the server once loaded, the defaults before). */
export function currentRates(): Rates {
  return ratesCache || DEFAULT_RATES;
}

/**
 * 02-11j: the server's rates merged over the defaults, keeping the default for any value that would break or
 * distort the estimate: not a finite number («7.80» as text, undefined), an exchange rate outside 1–50 (0
 * gave «QNaN»), a container of 0 m³ (division by zero), negative amounts, or a percentage outside 0–1.
 */
export function sanitizeRates(raw: unknown): Rates {
  const out: Rates = { ...DEFAULT_RATES };
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const k of Object.keys(DEFAULT_RATES) as (keyof Rates)[]) {
    if (!(k in src)) continue;
    const def = DEFAULT_RATES[k];
    if (typeof def === "string") {
      if (typeof src[k] === "string" && String(src[k]).trim()) (out as unknown as Record<string, unknown>)[k] = String(src[k]).trim();
      continue;
    }
    const n = typeof src[k] === "number" ? (src[k] as number) : typeof src[k] === "string" && /^\s*\d+(?:\.\d+)?\s*$/.test(src[k] as string) ? Number(src[k]) : NaN;
    if (!Number.isFinite(n) || n < 0) continue;
    if (k === "exchangeRate" && !(n >= 1 && n <= 50)) continue;
    if (/Cbm$/.test(k) && k !== "lclMinCbm" && !(n > 0)) continue;
    if (/Rate$/.test(k) && k !== "exchangeRate" && n > 1) continue;
    (out as unknown as Record<string, unknown>)[k] = n;
  }
  return out;
}

export function fetchRates(): Promise<Rates> {
  if (ratesCache) return Promise.resolve(ratesCache);
  if (!ratesPromise) {
    ratesPromise = fetch(`${API_URL}/api/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const r = sanitizeRates(data?.rates);
        ratesCache = r;
        return r;
      })
      .catch(() => DEFAULT_RATES);
  }
  return ratesPromise as Promise<Rates>;
}

export function useRates(): Rates {
  const [rates, setRates] = useState<Rates>(ratesCache || DEFAULT_RATES);
  useEffect(() => {
    let alive = true;
    fetchRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, []);
  return rates;
}

export interface CostLine {
  key: string;
  label: string;
  detail: string;
  amount: number;
  color: string;
  noVat?: boolean; // shown with the "sin IVA" footnote
}

export interface CostResult {
  productCost: number;
  shipping: number;
  freightPending: boolean;
  freightEstimated: boolean; // 10-11: cargo size estimated (no volume or weight given by the client)
  freightMode: "LCL" | "FCL" | null;
  freightDetail: string;
  chargeableCbm: number;
  insurance: number;
  cif: number;
  importDuties: number;
  taxes: number;
  customsFees: number;
  localCharges: number;
  totalCost: number;
  perUnit: number;
  dutyRate: number;
  vatRate: number;
  insuranceRate: number;
  insuranceMin: number;
  lines: CostLine[];
  noVatNote: string;
  exchangeRate: number;
  fxNote: string;
  saleUnit: string; // unit the price is per ("" or "piece" = one unit)
}


// 02-11: where the freight figure comes from, said on the line itself (it is not a carrier quote)
const FREIGHT_ORIGIN = () => Lx(" • todo incluido de China a bodega en el perímetro de la capital • tarifa aproximada de SEAL, a confirmar con ventas", " • all-in from China to a warehouse around Guatemala City • approximate SEAL rate, to be confirmed with sales");

/** USD per m³ consolidated, all-in. */
export function lclPerCbm(rates: Rates): number {
  return rates.lclRatePerCbm > 0 ? rates.lclRatePerCbm : (rates.container40 / rates.container40Cbm) * rates.lclFactor;
}

/** 10-11: the m³ from which one 40' container costs less than consolidated (≈5.75 m³ at 11,750 / 2,045). */
export function lclToFclBreakevenCbm(rates: Rates): number {
  const per = lclPerCbm(rates);
  return per > 0 ? Math.min(rates.lclMaxCbm, rates.container40 / per) : rates.lclMaxCbm;
}

export function calculateFreight(
  volumeCbm: number,
  weightKg: number,
  rates: Rates,
): { amount: number; mode: "LCL" | "FCL" | null; detail: string; chargeableCbm: number } {
  // W/M: the greater of m³ and metric tons (1,000 kg = 1 m³)
  const chargeable = Math.max(volumeCbm || 0, (weightKg || 0) / 1000);
  if (!chargeable) {
    return { amount: 0, mode: null, detail: Lx("Por cotizar — indica volumen o peso", "To be quoted — enter volume or weight"), chargeableCbm: 0 };
  }

  // 10-11: consolidated while it is cheaper than a full container (and within lclMaxCbm); a 40' container
  // otherwise. The line is exactly «m³ shown × rate shown» in quetzales with centavos.
  const perCbmQ = round2(lclPerCbm(rates) * rates.exchangeRate);
  const lclCbm = round2(Math.max(rates.lclMinCbm, chargeable));
  const lclAmount = round2(perCbmQ * lclCbm) / rates.exchangeRate;
  const fclAmount = rates.container20 > 0 && chargeable <= rates.container20Cbm
    ? rates.container20
    : Math.ceil(chargeable / rates.container40Cbm) * rates.container40;
  if (chargeable <= rates.lclMaxCbm && lclAmount <= fclAmount) {
    const perCbm = perCbmQ / rates.exchangeRate;
    const cbm = lclCbm;
    return {
      amount: lclAmount,
      mode: "LCL",
      detail: `${Lx("Carga consolidada", "Consolidated cargo")} • ${cbm.toFixed(2)} m³${chargeable < rates.lclMinCbm ? Lx(" (mínimo cobrable)", " (minimum chargeable)") : (weightKg || 0) / 1000 > (volumeCbm || 0) ? Lx(" (por peso: 1,000 kg = 1 m³)", " (by weight: 1,000 kg = 1 m³)") : ""} × ${formatQ(perCbm, rates.exchangeRate, 2)}/m³ • ${rates.transitDays} ${Lx("días", "days")}${FREIGHT_ORIGIN()}`,
      chargeableCbm: cbm,
    };
  }

  // Full containers: use 20' when it fits and is offered, otherwise 40'
  if (rates.container20 > 0 && chargeable <= rates.container20Cbm) {
    return {
      amount: rates.container20,
      mode: "FCL",
      detail: `${Lx("1 contenedor de 20'", "1 × 20' container")} (${chargeable.toFixed(1)} m³) • ${rates.transitDays} ${Lx("días", "days")}${FREIGHT_ORIGIN()}`,
      chargeableCbm: chargeable,
    };
  }
  const n40 = Math.ceil(chargeable / rates.container40Cbm);
  return {
    amount: n40 * rates.container40,
    mode: "FCL",
    detail: `${Lx(`${n40} contenedor${n40 > 1 ? "es" : ""} de 40'`, `${n40} × 40' container${n40 > 1 ? "s" : ""}`)} (${chargeable.toFixed(1)} m³) • ${rates.transitDays} ${Lx("días", "days")}${FREIGHT_ORIGIN()}`,
    chargeableCbm: chargeable,
  };
}

export function calculateCosts(
  params: { price: number; quantity: number; volumeCbm?: number; weightKg?: number; saleUnit?: string; sizeEstimated?: boolean; sizeSource?: "package" | "specs" | "ai" },
  rates: Rates = DEFAULT_RATES,
): CostResult {
  const quantity = params.quantity || 1;
  // Everything is kept unrounded; amounts are rounded only when shown
  const productCost = params.price * quantity; // FOB

  const freight = calculateFreight(params.volumeCbm || 0, params.weightKg || 0, rates);
  const shipping = freight.amount;
  const freightEstimated = !!params.sizeEstimated && !!freight.mode;

  // Insurance: 0 by default since 10-11 (it is inside the all-in freight); the rate/minimum can still be set
  const insurance = Math.max(productCost * rates.insuranceRate, rates.insuranceMin);

  // Guatemala: DAI on CIF, IVA on CIF + DAI
  const cif = productCost + shipping + insurance;
  const importDuties = cif * rates.dutyRate;
  const taxes = (cif + importDuties) * rates.vatRate;

  // Fixed quetzal fees are kept exact (not rounded in USD) so they show as Q1,200 / Q9,500
  const customsFees = rates.customsFeesGTQ > 0 ? rates.customsFeesGTQ / rates.exchangeRate : Math.round(rates.customsFees);
  const localCharges = rates.localChargesGTQ > 0 ? rates.localChargesGTQ / rates.exchangeRate : Math.round(rates.localCharges);

  const totalCost = productCost + shipping + insurance + importDuties + taxes + customsFees + localCharges;
  // 02-11j: the bases printed in the DAI and IVA details are the sums of the printed lines (centavos), so
  // «FOB + seguro Q2,059.14» is exactly the FOB line plus the insurance line on the same page
  const baseCifQ = round2(qCents(productCost, rates.exchangeRate) + qCents(shipping, rates.exchangeRate) + qCents(insurance, rates.exchangeRate));
  const baseVatQ = round2(baseCifQ + qCents(importDuties, rates.exchangeRate));

  // 02-11j: the rate as used (7.5%, never «8%» for a 7.5% calculation)
  const pct = ratePct;
  const allLines: CostLine[] = [
    {
      key: "product",
      label: Lx("Costo de producto (FOB)", "Product cost (FOB)"),
      detail: `${quantity.toLocaleString("en-US")} ${unitWordFor(params.saleUnit, quantity)} × ${formatUnitUSD(Number(params.price))} (${formatUnitQ(Number(params.price), rates.exchangeRate)} ${Lx("por", "per")} ${unitWordFor(params.saleUnit, 1)})`,
      amount: productCost,
      color: "#0B3C5D",
    },
    {
      key: "freight",
      label: freight.mode === "FCL" ? Lx("Flete China → Guatemala, todo incluido (contenedor)", "Freight China → Guatemala, all-in (container)") : Lx("Flete China → Guatemala, todo incluido", "Freight China → Guatemala, all-in"),
      detail: freightEstimated
        ? `${freight.detail} • ${
            params.sizeSource === "package"
              ? Lx("medidas del empaque publicadas por el proveedor en Alibaba", "packing size published by the supplier on Alibaba")
              : params.sizeSource === "specs"
              ? Lx("medidas del equipo publicadas en Alibaba (no del empaque)", "equipment size published on Alibaba (not packed)")
              : Lx("tamaño de carga aproximado según el producto y la cantidad (no indicaste m³ ni peso)", "approximate cargo size based on the product and quantity (no m³ or weight given)")
          }`
        : freight.detail,
      amount: shipping,
      color: "#3B82F6",
    },
    {
      key: "insurance",
      label: Lx("Seguro de carga", "Cargo insurance"),
      detail: `${pct(rates.insuranceRate)} ${Lx("del valor FOB • mínimo", "of FOB value • minimum")} ${formatQ(rates.insuranceMin, rates.exchangeRate)} • ${Lx("forma parte del valor CIF", "part of the CIF value")}`,
      amount: insurance,
      color: "#BFDBFE",
    },
    {
      key: "duties",
      // reference rate: the real one depends on the tariff heading
      label: Lx("DAI (arancel) referencial", "DAI (import duty), reference"),
      detail: `${pct(rates.dutyRate)} ${shipping > 0 ? (insurance > 0 ? Lx("sobre valor CIF (FOB + flete + seguro)", "on CIF value (FOB + freight + insurance)") : Lx("sobre valor CIF (FOB + flete)", "on CIF value (FOB + freight)")) : Lx("sobre FOB (falta sumar el flete al CIF)", "on FOB (freight still to be added to CIF)")} ${qText(baseCifQ)}`,
      amount: importDuties,
      color: "#60A5FA",
    },
    {
      key: "vat",
      label: Lx("IVA", "IVA (VAT)"),
      detail: `${pct(rates.vatRate)} ${shipping > 0 ? Lx("sobre CIF + DAI", "on CIF + DAI") : Lx("sobre FOB + DAI (sin flete)", "on FOB + DAI (without freight)")} ${qText(baseVatQ)}`,
      amount: taxes,
      color: "#93C5FD",
    },
    {
      key: "customs",
      label: Lx("Honorarios de aduana", "Customs brokerage fee"),
      // SEAL's fixed amounts already include IVA (confirmed by SEAL): never add IVA to them.
      // Not said on screen: the tool is only an estimate (SEAL's decision)
      detail: Lx("Agente aduanero SEAL", "SEAL customs broker"),
      amount: customsFees,
      color: "#8B5CF6",
    },
    {
      key: "local",
      label: Lx("Gastos en destino", "Destination charges"),
      detail: Lx("Manejo y gastos locales, revisión, almacenaje, etc.", "Handling and local charges, inspection, storage, etc."),
      amount: localCharges,
      color: "#A78BFA",
    },
  ];
  // 10-11: insurance and destination charges are inside the all-in freight: no «Q0.00» lines for them
  const lines = allLines.filter((l) => !((l.key === "insurance" || l.key === "local") && !(l.amount > 0)));

  return {
    saleUnit: params.saleUnit || "",
    productCost,
    shipping,
    freightPending: !freight.mode,
    freightEstimated,
    freightMode: freight.mode,
    freightDetail: freight.detail,
    chargeableCbm: freight.chargeableCbm,
    insurance,
    cif,
    importDuties,
    taxes,
    customsFees,
    localCharges,
    totalCost,
    perUnit: totalCost / quantity, // unrounded: shown in quetzales with 2 decimals
    dutyRate: rates.dutyRate,
    vatRate: rates.vatRate,
    insuranceRate: rates.insuranceRate,
    insuranceMin: rates.insuranceMin,
    lines,
    noVatNote: "", // no VAT footnote: the tool is only an estimate
    exchangeRate: rates.exchangeRate,
    fxNote: Lx(
      `Montos en quetzales con tipo de cambio referencial de Q${rates.exchangeRate.toFixed(2)} por US$1. El monto final depende del tipo de cambio del día.`,
      `Amounts in quetzales at a reference exchange rate of Q${rates.exchangeRate.toFixed(2)} per US$1. The final amount depends on the exchange rate of the day.`,
    ),
  };
}
