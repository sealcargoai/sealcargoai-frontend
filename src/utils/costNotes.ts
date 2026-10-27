// Sentences about the cost scenario that the screen shows and the PDF / Excel
// must carry too: the purchase budget (compared with the supplier purchase,
// never with the landed total) and the weight of fixed charges in small orders.
import { Lx } from "./lang";
import { formatUSD, type CostResult } from "./costCalculator";

/** The supplier purchase against the client's purchase budget; "" without a budget. */
export function budgetNote(costs: CostResult, budget: number, Q: (usd: number) => string): string {
  if (!(budget > 0)) return "";
  const diff = budget - costs.productCost;
  const extra = costs.totalCost - costs.productCost;
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
        ` El presupuesto es solo para la compra al proveedor: traerla a Guatemala suma aparte ${Q(extra)} en seguro, impuestos y gastos; el flete se cotiza aparte y no está incluido.`,
        ` The budget covers only the supplier purchase: bringing it to Guatemala adds ${Q(extra)} in insurance, taxes and charges; freight is quoted separately and not included.`,
      )
    : Lx(
        ` El presupuesto es solo para la compra al proveedor: traerla a Guatemala suma aparte ${Q(extra)} en flete, seguro, impuestos y gastos.`,
        ` The budget covers only the supplier purchase: bringing it to Guatemala adds ${Q(extra)} in freight, insurance, taxes and charges.`,
      );
  return head + tail;
}

/** Small orders: fixed charges weigh more than the product itself; "" otherwise. */
export function smallOrderNote(costs: CostResult, unitOne: string, Q: (usd: number) => string): string {
  const ins = costs.lines.find((l) => l.key === "insurance")?.amount ?? 0;
  const insuranceMin = ins > costs.productCost * 0.0101;
  const fixed = costs.lines
    .filter((l) => l.key === "insurance" || l.key === "customs" || l.key === "local")
    .reduce((a, l) => a + l.amount, 0);
  if (!(costs.totalCost > 0 && costs.productCost < fixed)) return "";
  return Lx(
    `En este pedido, los cargos que no dependen de la cantidad (seguro mínimo, honorarios de aduana y gastos en destino) suman ${Q(fixed)}, más que el producto (${Q(costs.productCost)}). Por eso el costo por ${unitOne} sale alto; con una cantidad mayor se reparte entre más unidades.${insuranceMin ? " Además, el seguro mínimo forma parte del valor CIF, así que también sube la base del DAI y del IVA." : ""}`,
    `In this order, the charges that don't depend on quantity (minimum insurance, customs fee and destination charges) add up to ${Q(fixed)}, more than the product (${Q(costs.productCost)}). That's why the cost per ${unitOne} is high; with a larger quantity it is spread over more units.${insuranceMin ? " Also, the minimum insurance is part of the CIF value, so it also raises the DAI and IVA base." : ""}`,
  );
}
