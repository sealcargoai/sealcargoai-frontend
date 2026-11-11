// 10-11: approximate packed size of the order (m³ and kg) when the client gave no volume or weight,
// estimated by the backend's AI from the product and the quantity. The freight then follows the SIZE of
// the cargo; the page says it is an estimate and lets the client enter the real figures.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface SizeEstimate {
  cbm: number;
  kg: number;
  // 10-11: where the size comes from: the supplier's packing data on Alibaba («package»), the listing's
  // equipment dimensions («specs») or the AI («ai»)
  source?: "package" | "specs" | "ai";
  text?: string; // the supplier's figures as published (e.g. «200X200X225 cm»)
}

const cache = new Map<string, Promise<SizeEstimate | null>>();

export function fetchSizeEstimate(product: string, quantity: number, unit: string, price = 0): Promise<SizeEstimate | null> {
  const p = String(product || "").trim().slice(0, 300);
  if (!p || !(quantity > 0)) return Promise.resolve(null);
  const key = `${p}|${quantity}|${unit}|${price}`;
  if (!cache.has(key)) {
    const qs = new URLSearchParams({ product: p, quantity: String(quantity), unit: unit || "", price: price > 0 ? String(price) : "" });
    cache.set(
      key,
      fetch(`${API_URL}/api/ai/size?${qs}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const cbm = Number(d?.size?.cbm) || 0;
          const kg = Number(d?.size?.kg) || 0;
          return cbm > 0 || kg > 0 ? { cbm, kg, source: "ai" as const } : null;
        })
        .catch(() => null),
    );
  }
  return cache.get(key)!;
}

// 10-11: the supplier's packing size and weight from the Alibaba product page (per package of `batch` units)
interface Packaging {
  source: "package" | "specs";
  cbm: number;
  kg: number;
  batch: number;
  text: string;
}
const packCache = new Map<string, Promise<Packaging | null>>();
const PACK_WAIT_MS = 25000;

export function fetchPackaging(productUrl: string): Promise<Packaging | null> {
  const u = String(productUrl || "").trim();
  if (!/alibaba\.com\/product-detail\//.test(u)) return Promise.resolve(null);
  if (!packCache.has(u)) {
    // 10-11b: reading a product page can take long; after PACK_WAIT_MS the page goes on with the AI estimate
    // (the server keeps reading and caches it, so the next visit gets the supplier's figures). A failed or
    // timed-out read is forgotten here so a later visit asks again.
    let settled = false;
    const read = fetch(`${API_URL}/api/suppliers/packaging?${new URLSearchParams({ url: u })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.packaging;
        const cbm = Number(p?.cbm) || 0;
        const kg = Number(p?.kg) || 0;
        if (!(cbm > 0 || kg > 0)) {
          if (!d || d.reason) packCache.delete(u);
          return null;
        }
        settled = true;
        return { source: p.source === "specs" ? "specs" : "package", cbm, kg, batch: Math.max(1, Number(p.batch) || 1), text: String(p.text || "") } as Packaging;
      })
      .catch(() => {
        packCache.delete(u);
        return null;
      });
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        if (!settled) packCache.delete(u);
        resolve(null);
      }, PACK_WAIT_MS),
    );
    packCache.set(u, Promise.race([read, timeout]));
  }
  return packCache.get(u)!;
}

/** The order's cargo size: the supplier's packing data × packages, else the AI estimate. */
export async function orderSize(o: { productUrl: string; product: string; quantity: number; unit: string; price: number }): Promise<SizeEstimate | null> {
  const pack = await fetchPackaging(o.productUrl);
  if (pack) {
    const packages = Math.ceil(o.quantity / pack.batch);
    return { cbm: Math.round(pack.cbm * packages * 100) / 100, kg: Math.round(pack.kg * packages), source: pack.source, text: pack.text };
  }
  return fetchSizeEstimate(o.product, o.quantity, o.unit, o.price);
}
