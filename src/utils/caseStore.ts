// The current case: ONE place to read and write the product, quantity and purchase budget.
//
// Before, four copies were kept and read independently: the chat's own replies (what the
// parser understood), the form draft, the stored case sent to SEAL and the product key. A
// change written to one copy and read from another made the chat say one thing while the
// form, the summary or the request to SEAL said another (e.g. the request carried the
// quantity of the last estimate after the client changed it in the form).
//
// Rule now: the form draft of the product in force is the source of truth (the form edits it
// and the chat writes it through writeCase). The stored case (seal_case) mirrors those three
// fields and keeps the scenario of the last estimate (supplier, price, total, assumptions),
// tagged with the product/quantity/budget it was computed for. Every surface reads
// currentCase(); an estimate made for other values is never sent or shown as current.
import { caseContext, switchedCase, SCENARIO_KEYS, factsLine, type CaseContext, type ProductFacts } from "./caseContext";
import { DRAFT_KEY, PRODUCT_KEY, PENDING_KEY, savedProduct } from "./draft";
import { fmtBudget, sameProduct, type PendingProposal } from "./chatReply";

const CASE_KEY = "seal_case";
import { cleanDescription } from "./descriptionCheck";
import { inferCategory } from "./category";

export interface CaseFields {
  product: string;
  quantity?: number; // whole units, 1..10,000,000
  budget?: number; // US$ for the purchase from the supplier
}

const norm = (x: unknown) => String(x ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/** "4 unidades de 12 piezas…" → 4; "2,000" → 2000; "" → undefined. */
export function leadingNumber(v: unknown): number | undefined {
  // "1.000" typed in a quantity is a thousand, as the form reads it (utils/plainNumber)
  const raw = String(v ?? "").trim();
  const m = (/^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw).replace(/^\s*(?:us\$|usd|\$)\s*/i, "").match(/^\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, "") + (m[2] ? `.${m[2]}` : ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Whole units from 1 to 10,000,000, else undefined (never rounded). */
const validQty = (n: number | undefined) => (n !== undefined && Number.isInteger(n) && n >= 1 && n <= 10_000_000 ? n : undefined);
/** Purchase budget up to US$100,000,000, else undefined. */
const validBudget = (n: number | undefined) => (n !== undefined && n > 0 && n <= 100_000_000 ? n : undefined);

type Draft = { formData?: Record<string, string>; step?: number; prev?: unknown; caseId?: string; rev?: number };
/**
 * The form draft, validated. A damaged draft (not an object, formData not a plain object) is no
 * draft; field values that are not text or numbers are dropped, never turned into "[object Object]".
 */
function readDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    const out: Draft = {};
    if (d.formData !== undefined) {
      if (!d.formData || typeof d.formData !== "object" || Array.isArray(d.formData)) return null;
      const f: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.formData as Record<string, unknown>)) if (typeof v === "string" || (typeof v === "number" && Number.isFinite(v))) f[k] = String(v);
      out.formData = f;
    }
    const st = Number(d.step);
    if (Number.isInteger(st) && st >= 1 && st <= 3) out.step = st;
    if (d.prev && typeof d.prev === "object" && !Array.isArray(d.prev) && typeof (d.prev as { product?: unknown }).product === "string") out.prev = d.prev;
    if (typeof d.caseId === "string" && d.caseId) out.caseId = d.caseId.slice(0, 64);
    if (Number.isInteger(d.rev) && d.rev >= 0) out.rev = d.rev;
    return out;
  } catch {
    return null;
  }
}

const newCaseId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Which case is in force and which saved version of it (the draft is the authority). */
export function caseVersion(): { caseId?: string; rev: number } {
  const d = readDraft();
  if (d?.formData) return { caseId: d.caseId, rev: d.rev || 0 };
  const c = caseContext();
  return { caseId: c.caseId, rev: Number(c.rev) || 0 };
}

/**
 * Writes the draft, the stored case and the product pointer as ONE operation: either every key is
 * written and reads back exactly as written, or every key is restored to what it was before and
 * the result is false. A failure in the middle (quota, blocked storage) can never leave the form
 * with the new value and the case for SEAL with the old one.
 */
function commit(values: Record<string, string>): boolean {
  const keys = Object.keys(values);
  let snapshot: (string | null)[];
  try {
    snapshot = keys.map((k) => sessionStorage.getItem(k));
  } catch {
    return false; // storage not readable: nothing is written
  }
  const restore = () => {
    keys.forEach((k, i) => {
      try {
        if (snapshot[i] === null) sessionStorage.removeItem(k);
        else sessionStorage.setItem(k, snapshot[i] as string);
      } catch {
        /* best effort: the read-back of the caller reports the real state */
      }
    });
  };
  try {
    for (const k of keys) sessionStorage.setItem(k, values[k]);
    if (keys.some((k) => sessionStorage.getItem(k) !== values[k])) {
      restore();
      return false;
    }
    return true;
  } catch {
    restore();
    return false;
  }
}

/** The stored case mirroring the draft's fields, version and product (no storage access). */
function mirrored(c: Record<string, unknown>, f: Record<string, string>, meta: { caseId: string; rev: number }, product: string, beforeProduct: string): Record<string, unknown> {
  const out = { ...c };
  const wasProduct = String(out.product || out.productDescription || "");
  out.product = product;
  if (out.productDescription && norm(wasProduct) === norm(beforeProduct)) out.productDescription = product;
  const q = validQty(leadingNumber(f.quantity));
  const b = validBudget(leadingNumber(f.budget));
  if (q) out.quantity = String(q);
  else delete out.quantity;
  if (b) out.budget = fmtBudget(b);
  else delete out.budget;
  out.caseId = meta.caseId;
  out.rev = meta.rev;
  return out;
}

/** The case in force, as every screen must show it. */
export function currentCase(): CaseFields {
  const draft = readDraft();
  const d = draft?.formData || {};
  const c = caseContext();
  // the form's text wins (an emptied field means no product typed yet, not the stored one)
  const hasDraft = !!draft?.formData;
  if (hasDraft && !String(d.productType || "").trim()) return { product: "" };
  const product = String((hasDraft ? d.productType : "") || savedProduct() || c.product || c.productDescription || "").trim();
  if (!product) return { product: "" };
  // the draft, when it was typed for this product
  if (d.productType && norm(d.productType) === norm(product)) {
    // a quantity typed in the form but not valid yet ("3.5", "0", "10000001") is not the case's quantity
    const quantity = validQty(leadingNumber(d.quantity));
    const budget = validBudget(leadingNumber(d.budget));
    return { product, ...(quantity ? { quantity } : {}), ...(budget ? { budget } : {}) };
  }
  // no draft for it (a chat-only case, a contact from the start page): the stored case, when it is this product
  if (norm(c.product || c.productDescription) === norm(product)) {
    const quantity = validQty(leadingNumber(c.quantity));
    const budget = validBudget(leadingNumber(c.budget));
    return { product, ...(quantity ? { quantity } : {}), ...(budget ? { budget } : {}) };
  }
  return { product };
}

export interface CaseWrite {
  ok: boolean; // every key was written and read back; false = nothing changed
  conflict?: boolean; // the case was changed by someone else since `expectRev`: nothing written
  case: CaseFields; // the case as read back from storage after the attempt
  version: { caseId?: string; rev: number };
  switched?: ProductFacts | null; // the previous product's facts, when the product changed
}

/**
 * Writes fields of the case in force (undefined = unchanged, null = removed) to the form draft
 * and to the stored case together (one transaction: utils/caseStore commit), and returns the case
 * as read back from storage — what the chat confirms is what was saved. A product that differs
 * from the draft's starts a new draft for it; the previous product's data stays as "prev" (shown
 * as previous data, never current) and, in the stored case, as history.
 * `expectRev`: the version the caller read; if the case moved since, nothing is written.
 */
export function writeCaseTx(patch: { product?: string; quantity?: number | null; budget?: number | null }, opts: { expectRev?: number; alsoKnown?: Partial<ProductFacts> } = {}): CaseWrite {
  const result = (ok: boolean, extra: Partial<CaseWrite> = {}): CaseWrite => ({ ok, case: currentCase(), version: caseVersion(), ...extra });
  const before = currentCase();
  const product = String(patch.product ?? before.product ?? "").trim();
  if (!product) return result(false);
  const ver = caseVersion();
  if (opts.expectRev !== undefined && opts.expectRev !== ver.rev) return result(false, { conflict: true });
  // the last guard before storage: an out-of-range value is never written
  if (patch.quantity !== undefined && patch.quantity !== null && !validQty(patch.quantity)) return result(false);
  if (patch.budget !== undefined && patch.budget !== null && !validBudget(patch.budget)) return result(false);
  const d: Draft = readDraft() || { formData: {}, step: 1, prev: null };
  const f = { ...(d.formData || {}) };
  // another product (or a draft left from another one): its data is kept only as previous data
  const switching = !!before.product && norm(product) !== norm(before.product) && !sameProduct(product, before.product);
  const draftOfOther = !!f.productType && norm(f.productType) !== norm(before.product);
  if (switching || draftOfOther) {
    if (f.productType && (f.quantity || f.budget || f.volumeCbm || f.weightKg)) d.prev = { product: f.productType, quantity: f.quantity, budget: f.budget, volumeCbm: f.volumeCbm, weightKg: f.weightKg };
    f.quantity = "";
    f.budget = "";
    f.volumeCbm = "";
    f.weightKg = "";
    d.step = Math.min(Number(d.step) || 1, 2);
  } else {
    // the draft carries the quantity and budget in force even when it had none yet (a chat-only case)
    if (!f.quantity && before.quantity) f.quantity = String(before.quantity);
    if (!f.budget && before.budget) f.budget = String(before.budget);
  }
  f.productType = product;
  if (patch.quantity !== undefined) f.quantity = patch.quantity === null ? "" : String(patch.quantity);
  if (patch.budget !== undefined) f.budget = patch.budget === null ? "" : String(patch.budget);
  const meta = { caseId: d.caseId || caseContext().caseId || newCaseId(), rev: ver.rev + 1 };
  d.formData = f;
  if (!d.step) d.step = 1;
  d.caseId = meta.caseId;
  d.rev = meta.rev;
  // the stored case: product switch (previous product → history) and the mirrored fields, together
  let c = caseContext() as Record<string, unknown>;
  let switched: ProductFacts | null = null;
  if (switching || !before.product) {
    const sw = switchedCase(c as CaseContext, product, opts.alsoKnown || (before.product ? { product: before.product, quantity: before.quantity ? String(before.quantity) : undefined, budget: before.budget ? String(before.budget) : undefined } : {}));
    c = sw.next as Record<string, unknown>;
    switched = sw.facts;
  }
  const ok = commit({ [DRAFT_KEY]: JSON.stringify(d), [CASE_KEY]: JSON.stringify(mirrored(c, f, meta, product, before.product)), [PRODUCT_KEY]: product });
  return result(ok, { switched: ok ? switched : null });
}

/** writeCaseTx, returning only the case as read back (kept for the callers that need just that). */
export function writeCase(patch: { product?: string; quantity?: number | null; budget?: number | null }): CaseFields {
  return writeCaseTx(patch).case;
}

/**
 * The form saves what the client types. It writes through here so the draft keeps the case's
 * identity and version, and the stored case mirrors it in the same transaction. `lastRev` is the
 * version this form wrote last (or loaded): if the case moved since (a newer write by the chat or
 * another screen), the stale form does NOT overwrite it — it gets `conflict` and must reload.
 */
export function saveFormDraft(formData: Record<string, string>, step: number, prev: unknown, lastRev?: number): CaseWrite {
  const ver = caseVersion();
  if (lastRev !== undefined && lastRev !== ver.rev) return { ok: false, conflict: true, case: currentCase(), version: ver };
  const old = readDraft();
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries(formData || {})) if (typeof v === "string" || typeof v === "number") f[k] = String(v);
  const same = !!old && JSON.stringify(old.formData || {}) === JSON.stringify(f) && old.step === step && JSON.stringify(old.prev ?? null) === JSON.stringify(prev ?? null);
  if (same) return { ok: true, case: currentCase(), version: ver };
  const meta = { caseId: old?.caseId || caseContext().caseId || newCaseId(), rev: ver.rev + 1 };
  const d: Draft = { formData: f, step, prev: prev ?? null, caseId: meta.caseId, rev: meta.rev };
  const product = String(f.productType || "").trim();
  const values: Record<string, string> = { [DRAFT_KEY]: JSON.stringify(d) };
  const c = caseContext() as Record<string, unknown>;
  // the stored case mirrors the version always, and the fields when it is the same product
  const sameProd = !!product && (!c.product || norm(String(c.product)) === norm(product));
  values[CASE_KEY] = JSON.stringify(sameProd ? mirrored(c, f, meta, product, String(c.product || "")) : { ...c, caseId: meta.caseId, rev: meta.rev });
  if (product) values[PRODUCT_KEY] = product;
  const ok = commit(values);
  return { ok, case: currentCase(), version: caseVersion() };
}

/**
 * Recovery: a stored case whose version is not the draft's (an interrupted write from an older
 * version of the page, a damaged record) is rebuilt from the draft, the authority.
 */
export function repairCase(): boolean {
  const d = readDraft();
  if (!d?.formData) return false;
  const c = caseContext() as Record<string, unknown>;
  if (d.rev !== undefined && c.rev === d.rev && c.caseId === d.caseId) return false;
  const product = String(d.formData.productType || "").trim();
  if (!product) return false;
  const meta = { caseId: d.caseId || newCaseId(), rev: d.rev || 0 };
  const fixedDraft = { ...d, caseId: meta.caseId, rev: meta.rev };
  const sameProd = !c.product || norm(String(c.product)) === norm(product) || sameProduct(String(c.product), product);
  const base = sameProd ? c : switchedCase(c as CaseContext, product).next as Record<string, unknown>;
  return commit({ [DRAFT_KEY]: JSON.stringify(fixedDraft), [CASE_KEY]: JSON.stringify(mirrored(base, d.formData, meta, product, String(c.product || product))) });
}

/** The change waiting for the client's confirmation, if any (validated; damaged = none). */
export function readPending(): PendingProposal | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (!p || typeof p !== "object" || !p.proposal || typeof p.proposal !== "object" || !p.base || typeof p.base !== "object") return null;
    const pr = p.proposal as Record<string, unknown>;
    const proposal: PendingProposal["proposal"] = {};
    if (validQty(pr.quantity as number)) proposal.quantity = pr.quantity as number;
    if (validBudget(typeof pr.budget === "number" ? pr.budget : undefined)) proposal.budget = pr.budget as number;
    if (pr.attrFix && typeof pr.attrFix === "object" && typeof (pr.attrFix as { from?: unknown }).from === "string" && typeof (pr.attrFix as { to?: unknown }).to === "string" && typeof pr.product === "string") {
      proposal.attrFix = { from: (pr.attrFix as { from: string }).from, to: (pr.attrFix as { to: string }).to };
      proposal.product = pr.product;
    }
    if (pr.budgetClear === true) proposal.budgetClear = true;
    if (!proposal.quantity && !proposal.budget && !proposal.attrFix && !proposal.budgetClear) return null;
    return { proposal, base: { caseId: typeof p.base.caseId === "string" ? p.base.caseId : undefined, rev: Number.isInteger(p.base.rev) ? p.base.rev : undefined } };
  } catch {
    return null;
  }
}
export function setPending(p: PendingProposal | null): boolean {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

/** The values an estimate was computed for (set with its scenario on the costs page). */
export interface ScenarioFor {
  product: string;
  quantity?: number;
  budget?: number;
}
/** Whether a stored estimate still describes the case in force. */
export function scenarioMatches(s: ScenarioFor | undefined, cur: CaseFields): boolean {
  if (!s) return true;
  // the search uses the description without sentences addressed to the tool (utils/descriptionCheck)
  const same = norm(s.product) === norm(cur.product) || norm(s.product) === norm(cleanDescription(cur.product).text);
  return same && (s.quantity || 0) === (cur.quantity || 0) && (s.budget || 0) === (cur.budget || 0);
}

/**
 * The case as SEAL must receive it (and as the "talk to SEAL" summary shows it): the stored case,
 * this screen's data, and the product/quantity/budget IN FORCE. An estimate computed for other
 * values (the client changed the quantity in the form or the chat afterwards) is not sent as
 * current: it goes as one history line, marked as no longer current.
 */
export function caseForSeal(screen: Partial<CaseContext> & Record<string, unknown> = {}): CaseContext & Record<string, unknown> {
  type Out = CaseContext & Record<string, unknown>;
  const stored = caseContext() as CaseContext & { scenarioFor?: ScenarioFor };
  const out: Record<string, unknown> = { ...stored };
  for (const [k, v] of Object.entries(screen)) if (v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) out[k] = v;
  const cur = currentCase();
  if (!cur.product) {
    // no product in force (e.g. the client emptied the field): nothing stored is current
    for (const k of ["product", "productDescription", "quantity", "budget", "productType", "totalCost", ...SCENARIO_KEYS]) delete out[k];
    return out as Out;
  }
  // what the estimate on screen (or stored) was computed for; a screen of another product
  // (the report of an earlier estimate, after a product change) is that product's estimate
  const screenProduct = String(screen.productDescription || screen.product || "");
  const screenEstimate = !!(screen.totalCostText || screen.totalCost);
  const sf: ScenarioFor | undefined =
    (screen.scenarioFor as ScenarioFor | undefined) ||
    stored.scenarioFor ||
    // (only the product is compared then: the screen's quantity may be in sets or boxes)
    (screenEstimate && screenProduct && !scenarioMatches({ product: screenProduct, quantity: cur.quantity, budget: cur.budget }, cur) ? { product: screenProduct, quantity: leadingNumber(screen.quantity), budget: leadingNumber(screen.budget) } : undefined);
  const hasScenario = [...SCENARIO_KEYS, "totalCost"].some((k) => out[k] !== undefined && out[k] !== "");
  if (hasScenario && sf && !scenarioMatches(sf, cur)) {
    const line = `Estimación anterior (ya no vigente): ${factsLine({ product: sf.product, quantity: sf.quantity ? String(sf.quantity) : undefined, budget: sf.budget ? String(sf.budget) : undefined, supplierName: out.supplierName as string, price: out.price as string, totalCostText: out.totalCostText as string })}`;
    const earlier = (out.earlier as string[]) || [];
    // a product change already listed that estimate (switchCaseProduct): not twice
    const listed = !!out.totalCostText && earlier.some((x) => x.includes(String(out.totalCostText)));
    out.earlier = (listed ? earlier : [...earlier, line]).slice(-5);
    for (const k of [...SCENARIO_KEYS, "totalCost"]) delete out[k];
  }
  // the category goes with the product in force, never with an earlier one
  if (out.productType && sf && norm(sf.product) !== norm(cur.product) && norm(sf.product) !== norm(cleanDescription(cur.product).text)) out.productType = inferCategory(cur.product);
  // the product, quantity and budget in force (a "4 unidades de 12 piezas" text is kept when it is the same number)
  out.product = cur.product;
  if (out.productDescription && norm(out.productDescription) !== norm(cur.product)) out.productDescription = cur.product;
  // the estimate's own wording ("42 sets de 12 piezas c/u = 504 piezas") is kept while it is the estimate in force
  const screenQtyOk = !!screen.quantity && (sf && screen.totalCostText ? scenarioMatches(sf, cur) : leadingNumber(screen.quantity) === cur.quantity);
  if (cur.quantity) {
    if (!screenQtyOk && leadingNumber(out.quantity) !== cur.quantity) out.quantity = String(cur.quantity);
  } else if (!screenQtyOk) delete out.quantity;
  if (cur.budget) out.budget = fmtBudget(cur.budget);
  else delete out.budget;
  delete out.scenarioFor;
  // the browser's version counters are internal: SEAL receives the case, not the bookkeeping
  delete out.rev;
  delete out.caseId;
  return out as Out;
}

export type StaleData = { product: string; quantity?: string; budget?: string; volumeCbm?: string; weightKg?: string };
/**
 * What the qualification form opens with: the draft of the product in force (quantity, budget,
 * volume, weight, step). Data typed for another product is not reused: it comes back as `stale`
 * (shown as previous data the client may choose to reuse). A quantity carried by the navigation
 * from the chat is used only when the draft has none (that state survives reloads).
 */
export function formStart(userQuery = "", stateQuantity?: unknown): { formData: Record<string, string>; stale: StaleData | null; step: number } {
  const draft = readDraft();
  const df = draft?.formData || {};
  // the same product currentCase() reports: the draft's (the form and the chat write it), else the pointer, else the request
  const product = String(draft?.formData ? df.productType || userQuery || "" : savedProduct() || userQuery || "");
  const draftProduct = String(df.productType || "");
  const freshStale: StaleData | null =
    draftProduct && product && !sameProduct(draftProduct, product) && (df.quantity || df.budget || df.volumeCbm || df.weightKg)
      ? { product: draftProduct, quantity: df.quantity, budget: df.budget, volumeCbm: df.volumeCbm, weightKg: df.weightKg }
      : null;
  const formData: Record<string, string> = { ...df, ...(freshStale ? { quantity: "", budget: "", volumeCbm: "", weightKg: "" } : {}), productType: product };
  const q = Number(stateQuantity);
  if (Number.isInteger(q) && q >= 1 && q <= 10_000_000 && !(df.quantity && !freshStale)) formData.quantity = String(q);
  const step = draft?.formData && draft.step ? (freshStale ? Math.min(draft.step, 2) : draft.step) : 1;
  return { formData, stale: freshStale || (draft?.prev as StaleData | null) || null, step };
}
