// The client's case as it builds up (product, quantity, supplier, price,
// estimate, assumptions, warnings) so any "talk to SEAL" request carries all of
// it, from any screen. SEAL receives the case first; any internal transfer is
// validated by a person on SEAL's side.
import { getLang } from "./lang";
import { track, pushDataLayer } from "./funnel";

const KEY = "seal_case";
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface CaseContext {
  product?: string;
  productDescription?: string;
  quantity?: string;
  supplierName?: string;
  supplierUrl?: string;
  price?: string;
  totalCostText?: string;
  budget?: string;
  destination?: string;
  assumptions?: string[];
  warnings?: string[];
  chat?: string[];
  caseRef?: string;
}

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);

export function caseContext(): CaseContext {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** Adds what this screen knows; empty values never erase earlier data. */
export function rememberCase(part: CaseContext): void {
  try {
    const cur = caseContext();
    let changed = false;
    for (const [k, v] of Object.entries(part)) {
      if (empty(v)) continue;
      if (JSON.stringify((cur as Record<string, unknown>)[k]) !== JSON.stringify(v)) {
        (cur as Record<string, unknown>)[k] = v;
        changed = true;
      }
    }
    if (changed) sessionStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* storage unavailable */
  }
}

/** A new analysis starts a new case. */
export function clearCase(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export interface SealRequest extends CaseContext {
  requestType: string; // what SEAL sees in the subject (Spanish: SEAL's team reads Spanish)
  source: string; // screen: landing, chat, resultados, costos, proveedor, informe, formulario
  intent?: string; // contratar, hablar_persona, proforma, carga_en_camino, ya_tiene_proveedor
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  totalCost?: number;
  [extra: string]: unknown; // other screen data (productType…) passes through
}
export interface SealResult {
  ok: boolean;
  status: number;
  id?: string; // case number (SEAL-YYYYMMDD-XXXXXX)
  duplicate?: boolean; // it was already an open case: updated, not duplicated
  notified?: boolean; // SEAL's inbox got it (false = registered only: SEAL sees it in the registry)
}

/** Sends the request to SEAL with the whole case (this screen's data wins over the stored one). */
export async function sendToSeal(req: SealRequest): Promise<SealResult> {
  const body: Record<string, unknown> = { ...caseContext() };
  for (const [k, v] of Object.entries(req)) if (!empty(v)) body[k] = v;
  body.lang = getLang();
  try {
    const res = await fetch(`${API}/api/email/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = res.ok ? await res.json().catch(() => ({})) : {};
    const out: SealResult = { ok: res.ok && !!j.id, status: res.status, id: j.id, duplicate: !!j.duplicate, notified: j.notified !== false };
    if (out.ok) {
      // a lead counts only once the server registered it
      track("solicitud_enviada", { seal_case_id: out.id, seal_source: req.source, seal_intent: req.intent || "", seal_duplicate: out.duplicate });
      if (!out.duplicate) pushDataLayer({ event: "seal_lead_recibido", seal_case_id: out.id, seal_source: req.source, seal_intent: req.intent || "" });
    }
    return out;
  } catch {
    return { ok: false, status: 0 };
  }
}

/** The line the client sees after sending (case number, duplicate or not notified). */
export function receiptText(r: SealResult, L: (es: string, en: string) => string): string {
  if (!r.id) return "";
  if (r.duplicate)
    return L(
      `Ya teníamos tu caso ${r.id}: lo actualizamos con esta información, sin duplicarlo. SEAL te contactará.`,
      `We already had your case ${r.id}: we updated it with this information, without duplicating it. SEAL will contact you.`,
    );
  if (!r.notified)
    return L(
      `Tu caso quedó registrado con el número ${r.id}. Si no te contactamos hoy, escríbenos al WhatsApp +502 5996 4664 con ese número.`,
      `Your case was registered as ${r.id}. If we don't contact you today, message us on WhatsApp +502 5996 4664 with that number.`,
    );
  return L(
    `Recibido. Tu número de caso es ${r.id}. Un ejecutivo de SEAL te contactará; si quieres adelantar, escríbenos por WhatsApp con ese número.`,
    `Received. Your case number is ${r.id}. A SEAL executive will contact you; to move faster, message us on WhatsApp with that number.`,
  );
}
