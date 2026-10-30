// One chat message applied to the case. Every change follows the same path:
//   intention (utils/chatReply nextSpec: what the message asks, what it forbids, whether it is a
//   question, a hypothesis or a request to confirm first) → proposed fields → authorization (a
//   prohibition removes a field; "pídeme confirmación" leaves a pending proposal) → validation
//   (range and type, again in writeCaseTx) → application (one transaction over the form draft,
//   the stored case and the product pointer) → read-back → the reply states the case AS SAVED.
// A write that does not land (storage full or blocked, or the case moved since it was read)
// changes nothing anywhere and is never announced as done.
import { nextSpec, quantityInForce, sameProduct, type ReplySpec } from "./chatReply";
import { draftFacts } from "./draft";
import { caseVersion, currentCase, readPending, setPending, writeCaseTx } from "./caseStore";

export function applyChatMessage(text: string, earlier: ReplySpec[], ctx: { currentProduct: string; currentQuantity: number; startQuery?: string }): ReplySpec {
  const saved = currentCase();
  const version = caseVersion();
  // the pending proposal lives in its own store; it belongs to this case only
  const pendingStored = readPending();
  const pending = pendingStored && (!pendingStored.base.caseId || !version.caseId || pendingStored.base.caseId === version.caseId) ? pendingStored : null;
  // the case's product: the one in force (form or chat), else the last one stated here, else the request
  const stated = saved.product || [...earlier].reverse().find((x) => x.newProduct)?.newProduct || String(ctx.startQuery || "").trim();
  const spec = nextSpec(text, earlier, ctx.currentProduct, ctx.currentQuantity, stated, {
    quantity: saved.product ? saved.quantity : quantityInForce(earlier) || undefined,
    budget: saved.product ? saved.budget : undefined,
    caseId: version.caseId,
    rev: version.rev,
    pending,
  });
  // a proposal lasts exactly one turn: this message either confirms it, replaces it or drops it
  const nextPending = spec.held ? { proposal: spec.held, base: spec.heldBase || { caseId: version.caseId, rev: version.rev } } : null;
  if (!setPending(nextPending) && nextPending) {
    // the proposal could not be kept: say the case did not change and do not offer "sí, aplícalo"
    spec.held = undefined;
  }
  // a blocked message (an invalid value, a hold, a prohibition) writes nothing:
  // the reply states the case exactly as it is saved now
  if (spec.hold || spec.qtyInvalid) {
    const now = currentCase();
    spec.caseNow = { product: now.product || stated, quantity: now.quantity, budget: now.budget };
    return spec;
  }
  const otherProduct = !!spec.newProduct && !!stated && !sameProduct(stated, spec.newProduct);
  let write: ReturnType<typeof writeCaseTx> | null = null;
  if (spec.newProduct && (otherProduct || !stated)) {
    // another product: the previous one's quantity, budget, supplier and estimate become history
    write = writeCaseTx(
      { product: spec.newProduct, quantity: spec.newQuantity ?? null, budget: null },
      {
        expectRev: version.rev,
        alsoKnown: stated ? { product: stated, quantity: saved.quantity ? String(saved.quantity) : undefined, budget: saved.budget ? String(saved.budget) : undefined } : draftFacts(),
      },
    );
    if (write.ok && write.switched) spec.stale = { product: write.switched.product, quantity: write.switched.quantity, budget: write.switched.budget };
  } else if (spec.newProduct || spec.newQuantity || spec.newBudget || spec.budgetClear) {
    // the same product: only the fields this message changed
    write = writeCaseTx(
      {
        product: spec.newProduct || (!saved.product && stated ? stated : undefined),
        quantity: spec.newQuantity || undefined,
        budget: spec.newBudget ? spec.newBudget : spec.budgetClear ? null : undefined,
      },
      { expectRev: version.rev },
    );
  }
  // the reply states the saved case, never what the parser alone understood
  const after = currentCase();
  if (spec.caseNow) spec.caseNow = { product: after.product, quantity: after.quantity, budget: after.budget };
  // a change that did not land is never announced as done: the transaction result decides, and the
  // read-back must show exactly the requested values
  const lost =
    (write && !write.ok) ||
    (spec.newQuantity && after.quantity !== spec.newQuantity) ||
    (spec.newBudget && after.budget !== spec.newBudget) ||
    (spec.budgetClear && after.budget) ||
    (spec.newProduct && write && !sameProduct(after.product, spec.newProduct) && after.product !== spec.newProduct);
  if (lost)
    return {
      text: spec.text,
      product: saved.product || stated,
      previous: spec.previous,
      fieldUpdate: true,
      persistFailed: true,
      caseNow: { product: after.product || stated, quantity: after.quantity, budget: after.budget },
    };
  return spec;
}
