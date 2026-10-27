/**
 * How people type numbers here: "1,000" or "1.000" units, "50,000" dollars, "3,5" m³.
 * A browser number box drops what it can't read ("50,000" became an empty budget), so
 * the fields are text and the value is put in plain form when the field is left:
 * thousands separators go, a decimal comma becomes a point. Anything else stays as
 * typed and gets a clear error instead of being read as another number.
 */
export function plainNumber(name: string, raw: string): string {
  const v = raw.trim().replace(/\s+/g, "").replace(/^(?:us\$|\$|q)/i, "");
  if (!v) return "";
  if (name === "quantity") {
    // a quantity has no decimals, so "1.000" and "1,000" are both a thousand
    if (/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(v)) return v.replace(/[.,]/g, "");
    return v;
  }
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(v)) return v.replace(/,/g, "");
  if (/^\d+,\d{1,2}$/.test(v)) return v.replace(",", ".");
  return v;
}
