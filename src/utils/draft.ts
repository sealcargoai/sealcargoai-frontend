// The qualification form keeps a draft in sessionStorage so nothing typed is
// lost after an error or a reload. Starting a new analysis must clear it, or
// the next case would inherit quantity, budget and step from the previous one.
export const DRAFT_KEY = "seal_qualify_draft";

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}
