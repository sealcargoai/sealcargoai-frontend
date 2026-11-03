// 02-11k: proof of control of an email. The server mails a 6-digit code; the code gives a session
// (12 h, used by searches of a QA account) and a single-use report grant (30 min). Nothing here is
// trusted by the server: it checks every token itself. Storage only saves the client retyping a code.
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const KEY = "seal_verified_session";

// the old search token (before 02-11k) is no longer used by the server: removed once
try {
  localStorage.removeItem("seal_report_token");
} catch {
  /* storage unavailable */
}

const norm = (e: string) => String(e || "").trim().toLowerCase();

/** The stored session for this email, if still valid ("" otherwise). */
export function verifiedSessionFor(email: string): string {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (v && typeof v.session === "string" && v.email === norm(email) && Number(v.exp) > Date.now()) return v.session;
  } catch {
    /* storage unavailable */
  }
  return "";
}

export function rememberVerifiedSession(email: string, session: string, seconds: number): void {
  try {
    if (typeof session !== "string" || !session) return;
    const s = Math.max(60, Math.min(Number(seconds) || 0, 12 * 3600));
    localStorage.setItem(KEY, JSON.stringify({ email: norm(email), session, exp: Date.now() + s * 1000 - 60_000 }));
  } catch {
    /* storage unavailable */
  }
}

export type StartResult = "sent" | "limit" | "not_supported" | "invalid" | "error";
/** Asks the server to email a code. «sent» never confirms the address exists or will receive it. */
export async function startVerification(email: string, lang: "es" | "en"): Promise<StartResult> {
  try {
    const res = await fetch(`${API}/api/email/verify/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), lang }),
    });
    if (res.ok) return "sent";
    if (res.status === 429) return "limit";
    if (res.status === 400) {
      const j = await res.json().catch(() => ({}));
      return j?.error === "email_not_supported" ? "not_supported" : "invalid";
    }
    return "error";
  } catch {
    return "error";
  }
}

export type ConfirmResult = { ok: true; reportGrant: string } | { ok: false; reason: "wrong" | "format" | "limit" | "error" };
/** Checks the code. On success stores the session and returns the single-use report grant. */
export async function confirmVerification(email: string, code: string): Promise<ConfirmResult> {
  const c = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return { ok: false, reason: "format" };
  try {
    const res = await fetch(`${API}/api/email/verify/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: c }),
    });
    if (res.status === 403) return { ok: false, reason: "wrong" };
    if (res.status === 400) return { ok: false, reason: "format" };
    if (res.status === 429) return { ok: false, reason: "limit" };
    if (!res.ok) return { ok: false, reason: "error" };
    const j = await res.json().catch(() => ({}));
    if (typeof j?.reportGrant !== "string" || !j.reportGrant) return { ok: false, reason: "error" };
    rememberVerifiedSession(email, j.session, j.sessionSeconds);
    return { ok: true, reportGrant: j.reportGrant };
  } catch {
    return { ok: false, reason: "error" };
  }
}
