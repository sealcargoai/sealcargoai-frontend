// Alibaba text can arrive HTML-escaped ("A&amp;B"): decode it before showing it.
export function decodeEntities(t: unknown): string {
  return String(t ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Same supplier with its visible texts decoded. */
export function cleanSupplier<T extends { name?: string; productName?: string } | null | undefined>(s: T): T {
  if (!s) return s;
  return { ...s, name: decodeEntities(s.name), productName: s.productName ? decodeEntities(s.productName) : s.productName };
}
