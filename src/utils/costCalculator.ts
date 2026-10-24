// ─── SEAL landed-cost calculator (Guatemala) ────────────────────────────────
// Single source of truth for the costs, PDF and Excel screens.
// Rates come from the backend (/api/rates → Google Sheet) with these defaults.
import { useEffect, useState } from "react";

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
export const ESTIMATE_NOTE =
  "Estimación referencial, no es una cotización. Un ejecutivo de SEAL le confirma el costo antes del embarque.";

// Rates and costs are kept in USD; everything shown to the client is in quetzales
export function formatQ(usdAmount: number, exchangeRate: number, decimals = 0): string {
  return `Q${(usdAmount * exchangeRate).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatUSD(usdAmount: number, decimals = 0): string {
  return `US$${usdAmount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
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
}


export function calculateFreight(
  volumeCbm: number,
  weightKg: number,
  rates: Rates,
): { amount: number; mode: "LCL" | "FCL" | null; detail: string; chargeableCbm: number } {
  // W/M: the greater of m³ and metric tons (1,000 kg = 1 m³)
  const chargeable = Math.max(volumeCbm || 0, (weightKg || 0) / 1000);
  if (!chargeable) {
    return { amount: 0, mode: null, detail: "Por cotizar — indique volumen o peso", chargeableCbm: 0 };
  }

  if (chargeable <= rates.lclMaxCbm) {
    const perCbm = (rates.container40 / rates.container40Cbm) * rates.lclFactor;
    const cbm = Math.max(rates.lclMinCbm, chargeable);
    return {
      amount: Math.round(perCbm * cbm),
      mode: "LCL",
      detail: `Carga consolidada • ${cbm.toFixed(2)} m³ × ${formatQ(perCbm, rates.exchangeRate)}/m³ • ${rates.transitDays} días`,
      chargeableCbm: cbm,
    };
  }

  // Full containers: use 20' when it fits and is offered, otherwise 40'
  if (rates.container20 > 0 && chargeable <= rates.container20Cbm) {
    return {
      amount: rates.container20,
      mode: "FCL",
      detail: `1 contenedor de 20' (${chargeable.toFixed(1)} m³) • ${rates.transitDays} días`,
      chargeableCbm: chargeable,
    };
  }
  const n40 = Math.ceil(chargeable / rates.container40Cbm);
  return {
    amount: n40 * rates.container40,
    mode: "FCL",
    detail: `${n40} contenedor${n40 > 1 ? "es" : ""} de 40' (${chargeable.toFixed(1)} m³) • ${rates.transitDays} días`,
    chargeableCbm: chargeable,
  };
}

export function calculateCosts(
  params: { price: number; quantity: number; volumeCbm?: number; weightKg?: number },
  rates: Rates = DEFAULT_RATES,
): CostResult {
  const quantity = params.quantity || 1;
  const productCost = Math.round(params.price * quantity); // FOB

  const freight = calculateFreight(params.volumeCbm || 0, params.weightKg || 0, rates);
  const shipping = freight.amount;

  // Insurance: 1% of FOB, minimum USD 250
  const insurance = Math.round(Math.max(productCost * rates.insuranceRate, rates.insuranceMin));

  // Guatemala: DAI on CIF, IVA on CIF + DAI
  const cif = productCost + shipping + insurance;
  const importDuties = Math.round(cif * rates.dutyRate);
  const taxes = Math.round((cif + importDuties) * rates.vatRate);

  // Fixed quetzal fees are kept exact (not rounded in USD) so they show as Q1,200 / Q9,500
  const customsFees = rates.customsFeesGTQ > 0 ? rates.customsFeesGTQ / rates.exchangeRate : Math.round(rates.customsFees);
  const localCharges = rates.localChargesGTQ > 0 ? rates.localChargesGTQ / rates.exchangeRate : Math.round(rates.localCharges);

  const totalCost = productCost + shipping + insurance + importDuties + taxes + customsFees + localCharges;

  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const lines: CostLine[] = [
    {
      key: "product",
      label: "Costo de producto (FOB)",
      detail: `${quantity.toLocaleString("en-US")} unidades × ${formatUSD(Number(params.price), 2)} (${formatQ(Number(params.price), rates.exchangeRate, 2)} c/u)`,
      amount: productCost,
      color: "#0B3C5D",
    },
    {
      key: "freight",
      label: freight.mode === "FCL" ? "Flete marítimo (contenedor)" : "Flete marítimo",
      detail: freight.detail,
      amount: shipping,
      color: "#3B82F6",
    },
    {
      key: "insurance",
      label: "Seguro de carga",
      detail: `${pct(rates.insuranceRate)} del valor FOB • mínimo ${formatQ(rates.insuranceMin, rates.exchangeRate)}`,
      amount: insurance,
      color: "#BFDBFE",
    },
    {
      key: "duties",
      label: "DAI (arancel)",
      detail: `${pct(rates.dutyRate)} sobre valor CIF ${formatQ(cif, rates.exchangeRate)}`,
      amount: importDuties,
      color: "#60A5FA",
    },
    {
      key: "vat",
      label: "IVA",
      detail: `${pct(rates.vatRate)} sobre CIF + DAI`,
      amount: taxes,
      color: "#93C5FD",
    },
    {
      key: "customs",
      label: "Honorarios de aduana",
      detail: "Agente aduanero SEAL",
      amount: customsFees,
      color: "#8B5CF6",
    },
    {
      key: "local",
      label: "Gastos en destino",
      detail: "Manejo y gastos locales, revisión, almacenaje, etc.",
      amount: localCharges,
      color: "#A78BFA",
    },
  ];

  return {
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
    fxNote: `Montos en quetzales con tipo de cambio referencial de Q${rates.exchangeRate.toFixed(2)} por US$1. El monto final depende del tipo de cambio del día.`,
  };
}
