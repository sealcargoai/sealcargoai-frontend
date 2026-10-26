// ─── SEAL landed-cost calculator (Guatemala) ────────────────────────────────
// Single source of truth for the costs, PDF and Excel screens.
// Rates come from the backend (/api/rates → Google Sheet) with these defaults.
import { useEffect, useState } from "react";
import { Lx } from "./lang";
import { unitWordFor } from "./saleUnit";

export interface Rates {
  container40: number;      // USD per 40' container, origin → Guatemala
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
  container40: 6000,
  container20: 0,
  container40Cbm: 55,
  container20Cbm: 25,
  lclFactor: 1.8,
  lclMinCbm: 1,
  lclMaxCbm: 15,
  dutyRate: 0.15,
  vatRate: 0.12,
  insuranceRate: 0.01,
  insuranceMin: 250,
  customsFees: 200,
  localCharges: 450,
  customsFeesGTQ: 1200,
  localChargesGTQ: 9500, // Q4,500 + Q5,000
  transitDays: "30-45",
  exchangeRate: 7.9,
};

// Shown wherever a cost appears: this tool estimates, SEAL quotes
export function estimateNote(): string {
  return Lx(
    "Estimación referencial, no es una cotización. Un ejecutivo de SEAL te confirma el costo antes del embarque.",
    "Reference estimate, not a quote. A SEAL executive confirms the cost before shipment.",
  );
}

/** What can move this preliminary scenario (shown on screen, PDF and Excel). */
export function scenarioVariables(costs: { freightPending: boolean; dutyRate: number }, opts: { priceIsMidpoint?: boolean } = {}): string[] {
  return [
    costs.freightPending
      ? Lx("Flete: no está incluido; se cotiza con el volumen y el peso reales.", "Freight: not included; quoted with the actual volume and weight.")
      : Lx("Flete: tarifa real de la naviera o consolidador y volumen/peso confirmados.", "Freight: actual carrier or consolidator rate and confirmed volume/weight."),
    Lx(
      `DAI: depende de la partida arancelaria; se usó ${Math.round(costs.dutyRate * 100)}% como referencia.`,
      `DAI duty: depends on the tariff heading; ${Math.round(costs.dutyRate * 100)}% was used as reference.`,
    ),
    opts.priceIsMidpoint
      ? Lx("Precio: se usó el precio medio del rango publicado; el precio negociado puede ser otro.", "Price: the midpoint of the published range was used; the negotiated price may differ.")
      : Lx("Precio: el precio final lo confirma la proforma del proveedor.", "Price: the final price is confirmed by the supplier's proforma."),
    Lx("Tipo de cambio del día de pago y de la DUCA.", "Exchange rate on the payment and DUCA dates."),
    Lx("Gastos en destino: almacenaje, revisión física y días en puerto.", "Destination charges: storage, physical inspection and days at port."),
  ];
}

// Rates and costs are kept in USD; everything shown to the client is in quetzales
export function formatQ(usdAmount: number, exchangeRate: number, decimals = 0): string {
  const q = usdAmount * exchangeRate;
  // Small unit amounts (Q0.0024) keep their decimals instead of showing Q0.00
  const small = decimals > 0 && q > 0 && q < 1;
  return `Q${q.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: small ? 4 : decimals,
  })}`;
}

export function formatUSD(usdAmount: number, decimals = 0): string {
  // Small unit prices (US$0.035) keep their decimals instead of showing US$0.00
  const small = decimals > 0 && usdAmount > 0 && usdAmount < 1;
  return `US$${usdAmount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: small ? 4 : decimals,
  })}`;
}

// Unit prices: as many decimals as the value really has (2 to 4), so the price
// shown × the quantity gives the same total the calculator uses (US$2.425, not US$2.43).
function unitDigits(v: number): number {
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

export function fetchRates(): Promise<Rates> {
  if (ratesCache) return Promise.resolve(ratesCache);
  if (!ratesPromise) {
    ratesPromise = fetch(`${API_URL}/api/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        ratesCache = { ...DEFAULT_RATES, ...(data?.rates || {}) };
        return ratesCache;
      })
      .catch(() => DEFAULT_RATES);
  }
  return ratesPromise;
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
  lines: CostLine[];
  noVatNote: string;
  exchangeRate: number;
  fxNote: string;
  saleUnit: string; // unit the price is per ("" or "piece" = one unit)
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

  if (chargeable <= rates.lclMaxCbm) {
    const perCbm = (rates.container40 / rates.container40Cbm) * rates.lclFactor;
    const cbm = Math.max(rates.lclMinCbm, chargeable);
    return {
      amount: perCbm * cbm,
      mode: "LCL",
      detail: `${Lx("Carga consolidada", "Consolidated cargo")} • ${cbm.toFixed(2)} m³ × ${formatQ(perCbm, rates.exchangeRate)}/m³ • ${rates.transitDays} ${Lx("días", "days")}`,
      chargeableCbm: cbm,
    };
  }

  // Full containers: use 20' when it fits and is offered, otherwise 40'
  if (rates.container20 > 0 && chargeable <= rates.container20Cbm) {
    return {
      amount: rates.container20,
      mode: "FCL",
      detail: `${Lx("1 contenedor de 20'", "1 × 20' container")} (${chargeable.toFixed(1)} m³) • ${rates.transitDays} ${Lx("días", "days")}`,
      chargeableCbm: chargeable,
    };
  }
  const n40 = Math.ceil(chargeable / rates.container40Cbm);
  return {
    amount: n40 * rates.container40,
    mode: "FCL",
    detail: `${Lx(`${n40} contenedor${n40 > 1 ? "es" : ""} de 40'`, `${n40} × 40' container${n40 > 1 ? "s" : ""}`)} (${chargeable.toFixed(1)} m³) • ${rates.transitDays} ${Lx("días", "days")}`,
    chargeableCbm: chargeable,
  };
}

export function calculateCosts(
  params: { price: number; quantity: number; volumeCbm?: number; weightKg?: number; saleUnit?: string },
  rates: Rates = DEFAULT_RATES,
): CostResult {
  const quantity = params.quantity || 1;
  // Everything is kept unrounded; amounts are rounded only when shown
  const productCost = params.price * quantity; // FOB

  const freight = calculateFreight(params.volumeCbm || 0, params.weightKg || 0, rates);
  const shipping = freight.amount;

  // Insurance: 1% of FOB, minimum USD 250
  const insurance = Math.max(productCost * rates.insuranceRate, rates.insuranceMin);

  // Guatemala: DAI on CIF, IVA on CIF + DAI
  const cif = productCost + shipping + insurance;
  const importDuties = cif * rates.dutyRate;
  const taxes = (cif + importDuties) * rates.vatRate;

  // Fixed quetzal fees are kept exact (not rounded in USD) so they show as Q1,200 / Q9,500
  const customsFees = rates.customsFeesGTQ > 0 ? rates.customsFeesGTQ / rates.exchangeRate : Math.round(rates.customsFees);
  const localCharges = rates.localChargesGTQ > 0 ? rates.localChargesGTQ / rates.exchangeRate : Math.round(rates.localCharges);

  const totalCost = productCost + shipping + insurance + importDuties + taxes + customsFees + localCharges;

  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const lines: CostLine[] = [
    {
      key: "product",
      label: Lx("Costo de producto (FOB)", "Product cost (FOB)"),
      detail: `${quantity.toLocaleString("en-US")} ${unitWordFor(params.saleUnit, quantity)} × ${formatUnitUSD(Number(params.price))} (${formatUnitQ(Number(params.price), rates.exchangeRate)} ${Lx("por", "per")} ${unitWordFor(params.saleUnit, 1)})`,
      amount: productCost,
      color: "#0B3C5D",
    },
    {
      key: "freight",
      label: freight.mode === "FCL" ? Lx("Flete marítimo (contenedor)", "Ocean freight (container)") : Lx("Flete marítimo", "Ocean freight"),
      detail: freight.detail,
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
      label: Lx("DAI (arancel)", "DAI (import duty)"),
      detail: `${pct(rates.dutyRate)} ${shipping > 0 ? Lx("sobre valor CIF (FOB + flete + seguro)", "on CIF value (FOB + freight + insurance)") : Lx("sobre FOB + seguro (falta sumar el flete al CIF)", "on FOB + insurance (freight still to be added to CIF)")} ${formatQ(cif, rates.exchangeRate, 2)}`,
      amount: importDuties,
      color: "#60A5FA",
    },
    {
      key: "vat",
      label: Lx("IVA", "IVA (VAT)"),
      detail: `${pct(rates.vatRate)} ${Lx("sobre CIF + DAI", "on CIF + DAI")} ${formatQ(cif + importDuties, rates.exchangeRate, 2)}`,
      amount: taxes,
      color: "#93C5FD",
    },
    {
      key: "customs",
      label: Lx("Honorarios de aduana", "Customs brokerage fee"),
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

  return {
    saleUnit: params.saleUnit || "",
    productCost,
    shipping,
    freightPending: !freight.mode,
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
    lines,
    noVatNote: "", // no VAT footnote: the tool is only an estimate
    exchangeRate: rates.exchangeRate,
    fxNote: Lx(
      `Montos en quetzales con tipo de cambio referencial de Q${rates.exchangeRate.toFixed(2)} por US$1. El monto final depende del tipo de cambio del día.`,
      `Amounts in quetzales at a reference exchange rate of Q${rates.exchangeRate.toFixed(2)} per US$1. The final amount depends on the exchange rate of the day.`,
    ),
  };
}
