// One chat message applied to the case: what it is (utils/chatReply nextSpec) and what it
// changes in the case in force (utils/caseStore). Only the fields the message changed are
// written, and the reply confirms the case AS READ BACK FROM STORAGE after the write, so the
// chat can never say a field changed while the form, the summary or the request say otherwise.
import { nextSpec, quantityInForce, sameProduct, type ReplySpec } from "./chatReply";
import { switchCaseProduct } from "./caseContext";
import { draftFacts } from "./draft";
import { currentCase, writeCase } from "./caseStore";

export function applyChatMessage(text: string, earlier: ReplySpec[], ctx: { currentProduct: string; currentQuantity: number; startQuery?: string }): ReplySpec {
  const saved = currentCase();
  // the case's product: the one in force (form or chat), else the last one stated here, else the request
  const stated = saved.product || [...earlier].reverse().find((x) => x.newProduct)?.newProduct || String(ctx.startQuery || "").trim();
  const spec = nextSpec(text, earlier, ctx.currentProduct, ctx.currentQuantity, stated, {
    quantity: saved.product ? saved.quantity : quantityInForce(earlier) || undefined,
    budget: saved.product ? saved.budget : undefined,
  });
  const otherProduct = !!spec.newProduct && !!stated && !sameProduct(stated, spec.newProduct);
  if (spec.newProduct && (otherProduct || !stated)) {
    // another product: the previous one's quantity, budget, supplier and estimate become history
    const old = switchCaseProduct(spec.newProduct, stated ? { product: stated, quantity: saved.quantity ? String(saved.quantity) : undefined, budget: saved.budget ? String(saved.budget) : undefined } : draftFacts());
    if (old) spec.stale = { product: old.product, quantity: old.quantity, budget: old.budget };
    writeCase({ product: spec.newProduct, quantity: spec.newQuantity ?? null, budget: null });
  } else if (spec.newProduct || spec.newQuantity || spec.newBudget || spec.budgetClear) {
    // the same product: only the fields this message changed
    writeCase({
      product: spec.newProduct || (!saved.product && stated ? stated : undefined),
      quantity: spec.newQuantity || undefined,
      budget: spec.newBudget ? spec.newBudget : spec.budgetClear ? null : undefined,
    });
  }
  // the reply states the saved case, never what the parser alone understood
  const after = currentCase();
  if (spec.caseNow) spec.caseNow = { product: after.product, quantity: after.quantity, budget: after.budget };
  if (spec.newQuantity && after.quantity !== spec.newQuantity) spec.newQuantity = after.quantity;
  return spec;
}
