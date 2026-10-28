// The qualification form keeps a draft in sessionStorage so nothing typed is
// lost after an error or a reload. Starting a new analysis must clear it, or
// the next case would inherit quantity, budget and step from the previous one.
export const DRAFT_KEY = "seal_qualify_draft";

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem("seal_cost_choices");
    // the chat of the previous case (its quantity changes would carry over)
    sessionStorage.removeItem("seal_chat");
    // the case SEAL would receive (supplier, price, warnings of the previous case)
    sessionStorage.removeItem("seal_case");
    // the product the client last set, in the chat or in the form
    sessionStorage.removeItem(PRODUCT_KEY);
  } catch {
    /* storage unavailable */
  }
}

// The product in force, shared by the chat and the form: whichever the client
// edited last wins, so going back and forth never brings an old product back.
const PRODUCT_KEY = "seal_product";
export function savedProduct(): string {
  try {
    return sessionStorage.getItem(PRODUCT_KEY) || "";
  } catch {
    return "";
  }
}
/** The product, quantity and budget the form draft holds (what they were typed for). */
export function draftFacts(): { product?: string; quantity?: string; budget?: string } {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    const f = d?.formData || {};
    return { product: f.productType || undefined, quantity: f.quantity || undefined, budget: f.budget || undefined };
  } catch {
    return {};
  }
}
export function saveProduct(value: string): void {
  try {
    if (value && value.trim()) sessionStorage.setItem(PRODUCT_KEY, value.trim());
  } catch {
    /* storage unavailable */
  }
}

// Choices made on the costs page (price the client typed, sets/pieces…) are
// kept per supplier, so going back to the list and returning keeps them.
const CHOICES_KEY = "seal_cost_choices";

export function supplierKey(s?: { productUrl?: string; storeUrl?: string; name?: string; productName?: string } | null, description = ""): string {
  if (!s) return "";
  return `${description.trim().toLowerCase()}|${s.productUrl || s.storeUrl || ""}|${s.name || ""}|${s.productName || ""}`;
}

function readAll(): Record<string, unknown> {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHOICES_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function loadCostChoices<T = Record<string, unknown>>(key: string): T | null {
  if (!key) return null;
  const v = readAll()[key];
  return v && typeof v === "object" ? (v as T) : null;
}

export function saveCostChoices(key: string, choices: unknown): void {
  if (!key) return;
  try {
    const all = readAll();
    all[key] = choices;
    sessionStorage.setItem(CHOICES_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function clearCostChoices(): void {
  try {
    sessionStorage.removeItem(CHOICES_KEY);
  } catch {
    /* storage unavailable */
  }
}
