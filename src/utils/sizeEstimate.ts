// 10-11: approximate packed size of the order (m³ and kg) when the client gave no volume or weight,
// estimated by the backend's AI from the product and the quantity. The freight then follows the SIZE of
// the cargo; the page says it is an estimate and lets the client enter the real figures.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface SizeEstimate {
  cbm: number;
  kg: number;
}

const cache = new Map<string, Promise<SizeEstimate | null>>();

export function fetchSizeEstimate(product: string, quantity: number, unit: string): Promise<SizeEstimate | null> {
  const p = String(product || "").trim().slice(0, 300);
  if (!p || !(quantity > 0)) return Promise.resolve(null);
  const key = `${p}|${quantity}|${unit}`;
  if (!cache.has(key)) {
    const qs = new URLSearchParams({ product: p, quantity: String(quantity), unit: unit || "" });
    cache.set(
      key,
      fetch(`${API_URL}/api/ai/size?${qs}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const cbm = Number(d?.size?.cbm) || 0;
          const kg = Number(d?.size?.kg) || 0;
          return cbm > 0 || kg > 0 ? { cbm, kg } : null;
        })
        .catch(() => null),
    );
  }
  return cache.get(key)!;
}
