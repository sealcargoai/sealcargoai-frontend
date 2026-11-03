// 02-11h: the same rule as the server: an email is written in printable ASCII only. The server refuses
// SMTPUTF8/IDN addresses and invisible characters («email_not_supported») instead of converting them
// (a Unicode look-alike could become another, real address); the page says so before sending anything.
export const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const ASCII = /^[\x21-\x7e]+$/;

/** "unsupported" (accents, ñ, look-alike or invisible characters), "format" (not name@domain.tld) or null. */
export function emailProblem(value: string): "unsupported" | "format" | null {
  const v = String(value || "").trim();
  if (v && !ASCII.test(v)) return "unsupported";
  return EMAIL_FORMAT.test(v) ? null : "format";
}
