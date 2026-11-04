// 02-11k: proof of control of an email. The server mails a 10-character code (02-11n; 8 in 02-11m, 6 digits before); the code gives a session
// (12 h, used by searches of a QA account) and a single-use report grant (30 min). Nothing here is
// trusted by the server: it checks every token itself. Storage only saves the client retyping a code.
import { solveChallenge } from "./pow";
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

export type StartResult = "sent" | "limit" | "not_supported" | "invalid" | "unavailable" | "cancelled" | "too_slow" | "error";
/** Seconds the server asked to wait after a «limit» answer (02-11l: progressive wait), 0 if unknown. */
export let lastRetryAfterSeconds = 0;
/** 02-11o: called while the browser solves the server's short check: running, and progress 0..1. */
export type OnCheck = (running: boolean, progress?: number) => void;
/**
 * Asks the server to email a code. «sent» never confirms the address exists or will receive it.
 * 02-11o: while the service is receiving many requests the server answers 428 with a small challenge; the
 * browser solves it (a second or two) and asks again, at most 3 times.
 */
export async function startVerification(email: string, lang: "es" | "en", onCheck?: OnCheck, signal?: AbortSignal, maxMs = 30_000): Promise<StartResult> {
  try {
    let extra: Record<string, string> = {};
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${API}/api/email/verify/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang, ...extra }),
      });
      if (res.ok) return "sent";
      if (res.status === 428 && attempt < 3) {
        const j = await res.json().catch(() => ({}));
        const bits = Number(j?.difficulty);
        if (typeof j?.challenge !== "string" || !(bits > 0 && bits <= 24)) return "error";
        onCheck?.(true, 0);
        const nonce = await solveChallenge(j.challenge, bits, { signal, maxMs, onProgress: (p) => onCheck?.(true, p) });
        onCheck?.(false);
        if (!nonce) return signal?.aborted ? "cancelled" : "too_slow";
        extra = { challenge: j.challenge, nonce };
        continue;
      }
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        lastRetryAfterSeconds = Math.max(0, Math.min(3600, Number(j?.retryAfterSeconds) || 0));
        return "limit";
      }
      if (res.status === 503) return "unavailable";
      if (res.status === 400) {
        const j = await res.json().catch(() => ({}));
        return j?.error === "email_not_supported" ? "not_supported" : "invalid";
      }
      return "error";
    }
    return "error";
  } catch {
    onCheck?.(false);
    return "error";
  }
}

/**
 * 02-11o: with a verified session of this email (12 h) the server gives a new single-use report grant
 * without emailing a new code. "" when there is no session or the server refuses it (then: code).
 */
export async function renewGrant(email: string): Promise<string> {
  const session = verifiedSessionFor(email);
  if (!session) return "";
  try {
    const res = await fetch(`${API}/api/email/verify/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), session }),
    });
    if (!res.ok) return "";
    const j = await res.json().catch(() => ({}));
    return typeof j?.reportGrant === "string" ? j.reportGrant : "";
  } catch {
    return "";
  }
}

export type ConfirmResult = { ok: true; reportGrant: string } | { ok: false; reason: "wrong" | "format" | "limit" | "unavailable" | "error" };
/** Checks the code. On success stores the session and returns the single-use report grant. */
export async function confirmVerification(email: string, code: string): Promise<ConfirmResult> {
  // 02-11n: 10 letters/digits; spaces, dashes and lowercase are accepted and normalized
  const c = String(code || "").toUpperCase().replace(/[\s-]+/g, "");
  if (!/^[A-Z0-9]{10}$/.test(c)) return { ok: false, reason: "format" };
  try {
    const res = await fetch(`${API}/api/email/verify/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: c }),
    });
    if (res.status === 403) return { ok: false, reason: "wrong" };
    if (res.status === 400) return { ok: false, reason: "format" };
    if (res.status === 429) return { ok: false, reason: "limit" };
    if (res.status === 503) return { ok: false, reason: "unavailable" };
    if (!res.ok) return { ok: false, reason: "error" };
    const j = await res.json().catch(() => ({}));
    if (typeof j?.reportGrant !== "string" || !j.reportGrant) return { ok: false, reason: "error" };
    rememberVerifiedSession(email, j.session, j.sessionSeconds);
    return { ok: true, reportGrant: j.reportGrant };
  } catch {
    return { ok: false, reason: "error" };
  }
}
