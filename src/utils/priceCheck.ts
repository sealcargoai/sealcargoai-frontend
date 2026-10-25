// Flags published prices that are probably not the real unit price
// (US$1 "starting" prices, very wide ranges, or far below the other options),
// so they are not used in the cost scenario without the client confirming them.
import { formatUSD } from "./costCalculator";
import { Lx } from "./lang";

interface PricedSupplier {
  price?: number;
  priceRange?: string;
  priceSource?: string;
  priceFlag?: string;
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
  if (s.priceFlag) return s.priceFlag;
  const price = s.price ?? 0;
  if (price <= 0) return "";
  const nums = rangeNumbers(s.priceRange);
  const lo = nums.length ? Math.min(...nums) : price;
  const hi = nums.length ? Math.max(...nums) : price;

  const peers = peerPrices.filter((p) => p > 0);
  const peerMedian = peers.length >= 2 ? median(peers) : 0;
  // US$1 or less is normal for a pencil, not for a machine: flag it only for
  // costly product types, or when the other options cost far more
  if ((price <= 1 || lo <= 1) && (COSTLY_TYPES.has(productType) || peerMedian >= 20)) {
    return Lx(
      `El precio publicado (${formatUSD(lo, 2)}) parece simbólico o inicial, no el precio real de la unidad.`,
      `The published price (${formatUSD(lo, 2)}) looks symbolic or a starting price, not the real unit price.`,
    );
  }
  if (nums.length >= 2 && hi / lo >= 20) {
    return Lx(
      `El rango publicado es muy amplio (${formatUSD(lo, 2)} – ${formatUSD(hi, 2)}); el mínimo suele ser de un accesorio o un modelo distinto.`,
      `The published range is very wide (${formatUSD(lo, 2)} – ${formatUSD(hi, 2)}); the minimum is usually an accessory or a different model.`,
    );
  }
  if (peerMedian > 0) {
    const m = peerMedian;
    if (price < m * 0.2) {
      return Lx(
        `Está muy por debajo de las demás opciones de esta búsqueda (precio típico cercano a ${formatUSD(m, m < 10 ? 2 : 0)}).`,
        `It is far below the other options in this search (typical price around ${formatUSD(m, m < 10 ? 2 : 0)}).`,
      );
    }
  }
  return "";
}

/** Adds `priceFlag` to each supplier, comparing it with the others in the list. */
export function flagPrices<T extends PricedSupplier>(list: T[], productType = ""): T[] {
  const prices = list.map((s) => s.price ?? 0);
  return list.map((s, i) => {
    const peers = prices.filter((_, k) => k !== i);
    const flag = priceIssue({ ...s, priceFlag: undefined }, peers, productType);
    return flag ? { ...s, priceFlag: flag } : s;
  });
}
