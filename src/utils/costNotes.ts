// Sentences about the cost scenario that the screen shows and the PDF / Excel
// must carry too: the purchase budget (compared with the supplier purchase,
// never with the landed total) and the weight of fixed charges in small orders.
import { Lx } from "./lang";
import { formatUSD, formatQAmount, groupQ, linesTotalQ, type CostResult } from "./costCalculator";

/** The supplier purchase against the client's purchase budget; "" without a budget. */
export function budgetNote(costs: CostResult, budget: number, Q: (usd: number) => string): string {
  if (!(budget > 0)) return "";
  const diff = budget - costs.productCost;
  // 02-11c: from the printed lines (centavos), so it is exactly the printed total minus the printed FOB
  const extraQ = Math.round((linesTotalQ(costs, costs.exchangeRate) - groupQ(costs, ["product"], costs.exchangeRate)) * 100) / 100;
  void Q;
  const head = diff >= 0
    ? Lx(
        `Compra al proveedor: ${formatUSD(costs.productCost, 2)}, dentro de tu presupuesto de compra de ${formatUSD(budget, 2)} (sobran ${formatUSD(diff, 2)}).`,
        `Purchase from the supplier: ${formatUSD(costs.productCost, 2)}, within your purchase budget of ${formatUSD(budget, 2)} (${formatUSD(diff, 2)} left).`,
      )
    : Lx(
        `Compra al proveedor: ${formatUSD(costs.productCost, 2)}, supera tu presupuesto de compra de ${formatUSD(budget, 2)} por ${formatUSD(-diff, 2)}.`,
        `Purchase from the supplier: ${formatUSD(costs.productCost, 2)}, exceeds your purchase budget of ${formatUSD(budget, 2)} by ${formatUSD(-diff, 2)}.`,
      );
  const tail = costs.freightPending
    ? Lx(
        ` El presupuesto es solo para la compra al proveedor: traerla a Guatemala suma aparte ${formatQAmount(extraQ)} en impuestos y honorarios de aduana; el flete se cotiza aparte y no está incluido.`,
        ` The budget covers only the supplier purchase: bringing it to Guatemala adds ${formatQAmount(extraQ)} in taxes and customs fees; freight is quoted separately and not included.`,
      )
    : Lx(
        ` El presupuesto es solo para la compra al proveedor: traerla a Guatemala suma aparte ${formatQAmount(extraQ)} en flete (todo incluido), impuestos y honorarios de aduana.`,
        ` The budget covers only the supplier purchase: bringing it to Guatemala adds ${formatQAmount(extraQ)} in freight (all-in), taxes and customs fees.`,
      );
  return head + tail;
}

/** 10-11: the names of the fixed charges present in this estimate («honorarios de aduana» by default). */
export function fixedChargesNames(costs: CostResult): string {
  const has = (k: string) => costs.lines.some((l) => l.key === k && l.amount > 0);
  const es = [has("insurance") && "seguro mínimo", has("customs") && "honorarios de aduana", has("local") && "gastos en destino"].filter(Boolean) as string[];
  const en = [has("insurance") && "minimum insurance", has("customs") && "customs fee", has("local") && "destination charges"].filter(Boolean) as string[];
  const join = (a: string[], and: string) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} ${and} ${a[a.length - 1]}` : a[0] || "");
  return Lx(join(es, "y"), join(en, "and"));
}

/** Small orders: fixed charges weigh more than the product itself; "" otherwise. */
export function smallOrderNote(costs: CostResult, unitOne: string, Q: (usd: number) => string): string {
  const ins = costs.lines.find((l) => l.key === "insurance")?.amount ?? 0;
  // the insurance is the minimum premium when it is above the plain rate on FOB
  const insuranceMin = ins > costs.productCost * (costs.insuranceRate || 0.01) * 1.0001;
  const fixed = costs.lines
    .filter((l) => l.key === "insurance" || l.key === "customs" || l.key === "local")
    .reduce((a, l) => a + l.amount, 0);
  if (!(costs.totalCost > 0 && costs.productCost < fixed)) return "";
  // 02-11c: the amounts as printed (centavos)
  const fixedQ = groupQ(costs, ["insurance", "customs", "local"], costs.exchangeRate);
  const productQ = groupQ(costs, ["product"], costs.exchangeRate);
  void Q;
  return Lx(
    `En este pedido, los cargos que no dependen de la cantidad (${fixedChargesNames(costs)}) suman ${formatQAmount(fixedQ)}, más que el producto (${formatQAmount(productQ)}). Por eso el costo por ${unitOne} sale alto; con una cantidad mayor se reparte entre más unidades.${insuranceMin ? " Además, el seguro mínimo forma parte del valor CIF, así que también sube la base del DAI y del IVA." : ""}`,
    `In this order, the charges that don't depend on quantity (${fixedChargesNames(costs)}) add up to ${formatQAmount(fixedQ)}, more than the product (${formatQAmount(productQ)}). That's why the cost per ${unitOne} is high; with a larger quantity it is spread over more units.${insuranceMin ? " Also, the minimum insurance is part of the CIF value, so it also raises the DAI and IVA base." : ""}`,
  );
}
