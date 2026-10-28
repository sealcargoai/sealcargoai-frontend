// The client's case as it builds up (product, quantity, supplier, price,
// estimate, assumptions, warnings) so any "talk to SEAL" request carries all of
// it, from any screen. SEAL receives the case first; any internal transfer is
// validated by a person on SEAL's side.
import { getLang } from "./lang";
import { track, pushDataLayer, isQaSession } from "./funnel";
import { sameProduct } from "./chatReply";

const KEY = "seal_case";
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface CaseContext {
  product?: string;
  productDescription?: string;
  quantity?: string;
  supplierName?: string;
  supplierUrl?: string;
  price?: string; // the price the estimate uses
  priceSource?: "publicado" | "usuario"; // from the listing, or typed by the client
  publishedPrice?: string; // the listing's price (kept when the client typed another)
  totalCostText?: string;
  budget?: string;
  destination?: string;
  assumptions?: string[];
  warnings?: string[];
  chat?: string[];
  caseRef?: string;
  // data of an earlier product of this same case, kept as history, never as current data
  earlier?: string[];
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

/** What belongs to the scenario on screen (supplier, price, estimate, its assumptions and warnings). */
export const SCENARIO_KEYS: (keyof CaseContext)[] = ["supplierName", "supplierUrl", "price", "priceSource", "publishedPrice", "totalCostText", "assumptions", "warnings"];

/**
 * The current screen is the source of truth for these keys: present values replace,
 * missing or empty ones are REMOVED (a new supplier without warnings must not keep the
 * previous supplier's warnings; a new search without budget must not keep the old one).
 */
export function setCaseScenario(part: CaseContext, keys: (keyof CaseContext)[]): void {
  try {
    const cur = caseContext() as Record<string, unknown>;
    for (const k of keys) {
      const v = (part as Record<string, unknown>)[k];
      if (empty(v)) delete cur[k];
      else cur[k] = v;
    }
    sessionStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* storage unavailable */
  }
}

/** What one product of the case carried (the facts a product change leaves behind). */
export interface ProductFacts { product: string; quantity?: string; budget?: string; supplierName?: string; price?: string; totalCostText?: string }

/** One readable history line: "guantes de nitrilo · cantidad 2,000 · presupuesto US$60". */
export function factsLine(f: ProductFacts): string {
  return [
    f.product,
    f.quantity ? `cantidad ${Number(f.quantity) ? Number(f.quantity).toLocaleString("en-US") : f.quantity}` : "",
    f.budget ? `presupuesto ${/^\d/.test(f.budget) ? `US$${f.budget}` : f.budget}` : "",
    f.supplierName ? `proveedor ${f.supplierName}` : "",
    f.price ? `precio ${f.price}` : "",
    f.totalCostText ? `estimación ${f.totalCostText}` : "",
  ].filter(Boolean).join(" · ").slice(0, 300);
}

/**
 * The client named another product (in the chat or in the form): it becomes the product of
 * the case, and what belonged to the previous one (quantity, budget, supplier, price, estimate,
 * assumptions, warnings) stops being current. It is kept as history ("earlier") so SEAL sees
 * the change, never sent as data of the new product. `alsoKnown` are facts this tab knows from
 * elsewhere (the form draft). Returns the previous product's facts when there was a real change.
 */
export function switchCaseProduct(product: string, alsoKnown: Partial<ProductFacts> = {}): ProductFacts | null {
  const next = String(product || "").trim();
  if (!next) return null;
  try {
    const cur = caseContext();
    const before = String(cur.product || cur.productDescription || alsoKnown.product || "").trim();
    if (before && sameProduct(before, next)) {
      if (cur.product !== next) {
        cur.product = next;
        sessionStorage.setItem(KEY, JSON.stringify(cur));
      }
      return null;
    }
    const sameAsDraft = !!alsoKnown.product && !!before && sameProduct(alsoKnown.product, before);
    const facts: ProductFacts = {
      product: before,
      quantity: cur.quantity || (sameAsDraft ? alsoKnown.quantity : undefined),
      budget: cur.budget || (sameAsDraft ? alsoKnown.budget : undefined),
      supplierName: cur.supplierName,
      price: cur.price,
      totalCostText: cur.totalCostText,
    };
    for (const k of ["quantity", "budget", "productDescription", ...SCENARIO_KEYS] as (keyof CaseContext)[]) delete cur[k];
    cur.product = next;
    if (before) cur.earlier = [...(cur.earlier || []), factsLine(facts)].slice(-5);
    sessionStorage.setItem(KEY, JSON.stringify(cur));
    return before ? facts : null;
  } catch {
    return null;
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
  caseUrl?: string; // signed page: what SEAL received and the case status
  test?: boolean; // the server identified it as a test record (not a commercial lead)
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
    const out: SealResult = { ok: res.ok && !!j.id, status: res.status, id: j.id, duplicate: !!j.duplicate, notified: j.notified !== false, caseUrl: typeof j.caseUrl === "string" && /^https?:\/\//.test(j.caseUrl) ? j.caseUrl : undefined , test: !!j.test};
    if (out.ok) {
      // the chat can answer "¿ya llegó mi solicitud?" with the real case number
      try {
        sessionStorage.setItem("seal_last_case", String(out.id));
      } catch {
        /* storage unavailable */
      }
      // a lead counts only once the server registered it
      // a test record, or a send from a QA session (?qa=1, e.g. a controlled test with real
      // contact data), is never a commercial conversion; the routing is decided by the server alone
      const qa = !!out.test || isQaSession();
      track("solicitud_enviada", { seal_case_id: out.id, seal_source: req.source, seal_intent: req.intent || "", seal_duplicate: out.duplicate }, qa);
      if (!out.duplicate) pushDataLayer({ event: qa ? "seal_lead_qa" : "seal_lead_recibido", seal_case_id: out.id, seal_source: req.source, seal_intent: req.intent || "", seal_qa: qa });
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

/** The case number sent from this tab, if any. */
export function lastSentCase(): string {
  try {
    return sessionStorage.getItem("seal_last_case") || "";
  } catch {
    return "";
  }
}
