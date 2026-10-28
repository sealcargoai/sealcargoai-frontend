// One chat message applied to the case: what it is (utils/chatReply nextSpec) and what it
// changes in the data the other screens read (form draft, case sent to SEAL). Only the
// fields the message changed are written; the rest of the case stays as it was.
import { nextSpec, quantityInForce, budgetInForce, fmtBudget, type ReplySpec } from "./chatReply";
import { switchCaseProduct, rememberCase, setCaseScenario } from "./caseContext";
import { savedProduct, saveProduct, draftFacts, draftFor, updateDraft, switchDraftProduct } from "./draft";
import { sameProduct } from "./chatReply";

export function applyChatMessage(text: string, earlier: ReplySpec[], ctx: { currentProduct: string; currentQuantity: number; startQuery?: string }): ReplySpec {
  // the case's product: the last one the client stated here, else the form's, else the request
  const stated = [...earlier].reverse().find((x) => x.newProduct)?.newProduct || savedProduct() || String(ctx.startQuery || "").trim();
  // the case as saved now (form draft of this product, else this chat)
  const saved = draftFor(stated);
  const spec = nextSpec(text, earlier, ctx.currentProduct, ctx.currentQuantity, stated, {
    quantity: Number(saved.quantity) || quantityInForce(earlier) || undefined,
    budget: Number(saved.budget) || budgetInForce(earlier) || undefined,
  });
  // the product named here is the one the form and the case use; data typed for
  // another product (quantity, budget, supplier, estimate) stays as history and is asked again
  if (spec.newProduct) {
    // what this tab knows of the previous product: the quantity said here, else the form draft
    const chatQty = quantityInForce(earlier);
    const old = switchCaseProduct(spec.newProduct, chatQty && stated ? { product: stated, quantity: String(chatQty) } : draftFacts());
    if (old) spec.stale = { product: old.product, quantity: old.quantity, budget: old.budget };
    // another product: the form draft follows it (its quantity only), the previous data stays as "prev"
    if (stated && !sameProduct(stated, spec.newProduct)) switchDraftProduct(spec.newProduct, spec.newQuantity);
    saveProduct(spec.newProduct);
  }
  // the quantity the client gave here is the case's quantity on every screen (start page included)
  if (spec.newQuantity) rememberCase({ quantity: String(spec.newQuantity) });
  if (spec.fieldUpdate) {
    updateDraft(
      {
        productType: spec.attrFix ? spec.newProduct : undefined,
        quantity: spec.newQuantity ? String(spec.newQuantity) : undefined,
        budget: spec.newBudget ? String(spec.newBudget) : spec.budgetClear ? null : undefined,
      },
      stated,
    );
    if (spec.newBudget) rememberCase({ budget: fmtBudget(spec.newBudget) });
    if (spec.budgetClear) setCaseScenario({}, ["budget"]);
  }
  return spec;
}
