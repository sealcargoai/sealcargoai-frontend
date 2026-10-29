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
import { caseContext, SCENARIO_KEYS, factsLine, type CaseContext } from "./caseContext";
import { DRAFT_KEY, saveProduct, savedProduct } from "./draft";
import { fmtBudget, sameProduct } from "./chatReply";
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

type Draft = { formData?: Record<string, string>; step?: number; prev?: unknown };
function readDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    return d && typeof d === "object" ? d : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

/** The case in force, as every screen must show it. */
export function currentCase(): CaseFields {
  const d = readDraft()?.formData || {};
  const c = caseContext();
  // the form's text wins (an emptied field means no product typed yet, not the stored one)
  const hasDraft = !!readDraft()?.formData;
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

/**
 * Writes fields of the case in force (undefined = unchanged, null = removed) to the form draft
 * and to the stored case together, and returns the case as read back from storage — what the
 * chat confirms is what was saved. A product that differs from the draft's starts a new draft
 * for it; the previous product's data stays as "prev" (shown as previous data, never current).
 */
export function writeCase(patch: { product?: string; quantity?: number | null; budget?: number | null }): CaseFields {
  try {
    const before = currentCase();
    const product = String(patch.product ?? before.product ?? "").trim();
    if (!product) return before;
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
    // the last guard before storage: an out-of-range value is never written (the read-back then
    // shows the change did not happen, and the chat says so)
    if (patch.quantity !== undefined && (patch.quantity === null || validQty(patch.quantity))) f.quantity = patch.quantity === null ? "" : String(patch.quantity);
    if (patch.budget !== undefined && (patch.budget === null || validBudget(patch.budget))) f.budget = patch.budget === null ? "" : String(patch.budget);
    d.formData = f;
    if (!d.step) d.step = 1;
    writeDraft(d);
    saveProduct(product);
    // the stored case mirrors the three fields (its estimate scenario stays tagged with its own values)
    const c = caseContext() as Record<string, unknown>;
    const wasProduct = String(c.product || c.productDescription || "");
    c.product = product;
    if (c.productDescription && norm(wasProduct) === norm(before.product)) c.productDescription = product;
    const q = validQty(leadingNumber(f.quantity));
    const b = validBudget(leadingNumber(f.budget));
    if (q) c.quantity = String(q);
    else delete c.quantity;
    if (b) c.budget = fmtBudget(b);
    else delete c.budget;
    sessionStorage.setItem("seal_case", JSON.stringify(c));
  } catch {
    /* storage unavailable: the read-back below shows what is really saved */
  }
  return currentCase();
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
