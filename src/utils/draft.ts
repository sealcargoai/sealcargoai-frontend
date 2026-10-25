// The qualification form keeps a draft in sessionStorage so nothing typed is
// lost after an error or a reload. Starting a new analysis must clear it, or
// the next case would inherit quantity, budget and step from the previous one.
export const DRAFT_KEY = "seal_qualify_draft";

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem("seal_cost_choices");
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
