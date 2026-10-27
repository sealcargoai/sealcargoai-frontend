// Flags published prices that are probably not the real unit price
// (US$1 "starting" prices, very wide ranges, or far below the other options),
// so they are not used in the cost scenario without the client confirming them.
import { formatUSD, formatUnitUSD, formatUnitQ } from "./costCalculator";
import { Lx } from "./lang";
import { saleUnitInfo } from "./saleUnit";

export type PriceFlagCode =
  | { kind: "symbolic"; lo: number }
  | { kind: "range"; lo: number; hi: number }
  | { kind: "below"; own: number; typical: number; perPiece: boolean };

/** The warning for an atypical price, in the language in use. */
export function priceFlagText(c: PriceFlagCode): string {
  if (c.kind === "symbolic")
    return Lx(
      `El precio publicado (${formatUnitUSD(c.lo)}) parece simbólico o inicial, no el precio real de la unidad.`,
      `The published price (${formatUnitUSD(c.lo)}) looks symbolic or a starting price, not the real unit price.`,
    );
  if (c.kind === "range")
    return Lx(
      `El rango publicado es muy amplio (${formatUnitUSD(c.lo)} – ${formatUnitUSD(c.hi)}); el mínimo suele ser de un accesorio o un modelo distinto.`,
      `The published range is very wide (${formatUnitUSD(c.lo)} – ${formatUnitUSD(c.hi)}); the minimum is usually an accessory or a different model.`,
    );
  return Lx(
    `Está muy por debajo de las demás opciones de esta búsqueda, comparando el precio por pieza (${formatUnitUSD(c.own)} contra un precio típico cercano a ${formatUnitUSD(c.typical)} por pieza).`,
    `It is far below the other options in this search, comparing the price per piece (${formatUnitUSD(c.own)} against a typical price around ${formatUnitUSD(c.typical)} per piece).`,
  );
}

interface PricedSupplier {
  price?: number;
  priceRange?: string;
  priceSource?: string;
  priceFlag?: string;
  // why the price looks atypical, with its figures: the text is built in the language in use
  priceFlagCode?: PriceFlagCode;
  priceNotComparable?: boolean;
  saleUnit?: string;
  productName?: string;
}

/**
 * Price per piece, so a box of 100 is not compared with a single glove.
 * null when the listing sells per box/set/pack and doesn't say how many pieces
 * it holds: that price can't be compared until the packaging is confirmed.
 */
export function comparablePrice(s: PricedSupplier | null | undefined, productType = ""): number | null {
  const price = Number(s?.price) || 0;
  if (!s || price <= 0) return null;
  const u = saleUnitInfo(s, productType);
  if (u.multi) return u.packSize > 1 ? price / u.packSize : null;
  return price;
}

function rangeNumbers(range?: string): number[] {
  return (
    String(range || "")
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/g)
      ?.map(Number)
      .filter((n) => n > 0) ?? []
  );
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Reason the price looks atypical, or "" when it looks usable.
 * `peerPrices` are the prices of the other options in the same search.
 */
// Product types where a published unit price of US$1 or less is not realistic
const COSTLY_TYPES = new Set(["machinery", "electronics", "furniture"]);

export function priceIssue(
  s: PricedSupplier | null | undefined,
  peerPrices: number[] = [],
  productType = "",
): string {
  if (!s || s.priceSource === "client") return "";
  if (s.priceFlagCode) return priceFlagText(s.priceFlagCode);
  const code = priceIssueCode(s, peerPrices, productType);
  if (code) return priceFlagText(code);
  return s.priceFlag || "";
}

/** Why a published price looks atypical (null when it doesn't). */
export function priceIssueCode(
  s: PricedSupplier | null | undefined,
  peerPrices: number[] = [],
  productType = "",
): PriceFlagCode | null {
  if (!s || s.priceSource === "client") return null;
  if (s.priceFlagCode) return s.priceFlagCode;
  const price = s.price ?? 0;
  if (price <= 0) return null;
  const nums = rangeNumbers(s.priceRange);
  const lo = nums.length ? Math.min(...nums) : price;
  const hi = nums.length ? Math.max(...nums) : price;

  const peers = peerPrices.filter((p) => p > 0);
  const peerMedian = peers.length >= 2 ? median(peers) : 0;
  // peers are compared per piece: the client's own price per sale unit
  const own = comparablePrice(s, productType);
  // US$1 or less is normal for a pencil, not for a machine: flag it only for
  // costly product types, or when the other options cost far more
  if ((price <= 1 || lo <= 1) && (COSTLY_TYPES.has(productType) || (own !== null && own <= 1 && peerMedian >= 20))) {
    return { kind: "symbolic", lo };
  }
  if (nums.length >= 2 && hi / lo >= 20) {
    return { kind: "range", lo, hi };
  }
  if (peerMedian > 0 && own !== null) {
    const m = peerMedian;
    if (own < m * 0.2) {
      return { kind: "below", own, typical: m, perPiece: !!s.saleUnit && s.saleUnit !== "piece" };
    }
  }
  return null;
}

/** Adds `priceFlag` to each supplier, comparing it with the others in the list. */
export function flagPrices<T extends PricedSupplier>(list: T[], productType = ""): T[] {
  // only prices in the same unit (per piece) are compared with each other
  const perPiece = list.map((s) => comparablePrice(s, productType));
  return list.map((s, i) => {
    const peers = perPiece.filter((v, k) => k !== i && v !== null) as number[];
    const code = priceIssueCode({ ...s, priceFlag: undefined, priceFlagCode: undefined }, peers, productType);
    const notComparable = perPiece[i] === null && Number(s.price) > 0;
    const out = code ? { ...s, priceFlag: priceFlagText(code), priceFlagCode: code } : { ...s, priceFlag: undefined, priceFlagCode: undefined };
    return notComparable ? { ...out, priceNotComparable: true } : out;
  });
}
