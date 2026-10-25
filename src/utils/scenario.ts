// One cost scenario per supplier, shared by the supplier list, the costs page
// and the exports: the price the client typed or confirmed, whether their
// quantity is in pieces or sets, and the price basis. Everything is converted
// to the platform's sale unit before calculating or checking the minimum order.
import { priceIssue } from "./priceCheck";
import { saleUnitInfo, quantityIntent, packSizeFromTitle, unitWordFor, type SaleUnitInfo } from "./saleUnit";
import { formatUSD } from "./costCalculator";
import { Lx } from "./lang";

export interface CostChoices {
  customPrice?: number;
  usePublished?: boolean;
  qtyMode?: "sets" | "pieces";
  customPack?: number;
  priceBasis?: "unit" | "piece"; // the published price is per sale unit or per piece
}

interface Ctx {
  requestedQty: number;
  productType: string;
  description: string;
}

// Below this per-piece price (US$) the price basis must be confirmed: a box of
// 100 gloves at US$0.03 would be US$0.0003 per glove.
const MIN_PIECE_PRICE = 0.01;

export interface Scenario {
  supplier: any; // supplier with the price actually used
  priceFlag: string;
  needsPriceDecision: boolean;
  needsUnitDecision: boolean;
  needsBasisDecision: boolean;
  unitInfo: SaleUnitInfo;
  intent: "piece" | "pack" | "";
  qtyMode: "sets" | "pieces" | null;
  packSize: number;
  piecesPerUnit: number;
  quantity: number; // in sale units
  price: number; // per sale unit
  ownPrice: boolean;
  publishedPerPiece: number; // published price ÷ pieces per unit (0 when not applicable)
  notes: string[]; // assumptions to keep in the reports
  moqNote: string; // "" when the order meets the minimum or there is none
}

export function resolveScenario(original: any, choices: CostChoices, ctx: Ctx): Scenario {
  const productType = String(ctx.productType || "");
  const priceFlag = priceIssue(original, [], productType);
  const customPrice = original?.priceSource === "client" ? Number(original.price) || 0 : Number(choices.customPrice) || 0;
  const usePublished = !!original?.priceConfirmed || !!choices.usePublished;
  let supplier =
    original && customPrice > 0 && original.priceSource !== "client"
      ? { ...original, price: customPrice, priceRange: "", priceSource: "client", priceFlag: undefined, priceConfirmed: undefined }
      : original && customPrice > 0
        ? { ...original, price: customPrice }
        : original && usePublished && priceFlag
          ? { ...original, priceConfirmed: true }
          : original;
  const ownPrice = customPrice > 0;
  const needsPriceDecision = !!priceFlag && !usePublished && !ownPrice;

  const unitInfo = saleUnitInfo(supplier, productType);
  const intent = quantityIntent(ctx.description);
  const requested = Math.max(1, Math.floor(ctx.requestedQty) || 1);
  const qtyMode = choices.qtyMode ?? (intent === "piece" ? "pieces" : intent === "pack" ? "sets" : null);
  const packSize = unitInfo.packSize > 1 ? unitInfo.packSize : Number(choices.customPack) || 0;
  const piecesPerUnit = unitInfo.multi && qtyMode !== null && packSize > 1 ? packSize : 0;
  const needsUnitDecision = unitInfo.multi && (qtyMode === null || (qtyMode === "pieces" && !(packSize > 1)));
  let quantity = unitInfo.multi && qtyMode === "pieces" && packSize > 1 ? Math.ceil(requested / packSize) : requested;

  const notes: string[] = [];
  const one = unitWordFor(unitInfo.unit, 1);
  let price = Number(supplier?.price) > 0 ? Number(supplier.price) : 0;

  // Price basis: a published price that would be a fraction of a cent per piece
  let publishedPerPiece = 0;
  let needsBasisDecision = false;
  if (!ownPrice && price > 0 && piecesPerUnit > 1) {
    publishedPerPiece = price / piecesPerUnit;
    if (publishedPerPiece < MIN_PIECE_PRICE) {
      if (choices.priceBasis === "piece") {
        const perPiece = price;
        price = perPiece * piecesPerUnit;
        supplier = { ...supplier, price };
        notes.push(
          Lx(
            `Precio publicado ${formatUSD(perPiece, 2)} tomado como precio por pieza, según indicaste: ${formatUSD(price, 2)} por ${one} de ${piecesPerUnit} piezas.`,
            `Published price ${formatUSD(perPiece, 2)} taken as a per-piece price, as you indicated: ${formatUSD(price, 2)} per ${one} of ${piecesPerUnit} pieces.`,
          ),
        );
      } else if (choices.priceBasis === "unit") {
        notes.push(
          Lx(
            `Confirmaste que ${formatUSD(price, 2)} es el precio por ${one} de ${piecesPerUnit} piezas (unos ${formatUSD(publishedPerPiece, 4)} por pieza).`,
            `You confirmed ${formatUSD(price, 2)} is the price per ${one} of ${piecesPerUnit} pieces (about ${formatUSD(publishedPerPiece, 4)} per piece).`,
          ),
        );
      } else needsBasisDecision = true;
    }
  }

  // Price per piece while the client counts boxes: "500 cajas" of "100pcs/box"
  if (!unitInfo.multi && intent === "pack" && (unitInfo.unit === "piece" || !unitInfo.unit)) {
    const titlePack = packSizeFromTitle(supplier?.productName);
    if (titlePack > 1) {
      quantity = requested * titlePack;
      notes.push(
        Lx(
          `El precio es por pieza y pediste ${requested.toLocaleString("en-US")} paquetes o cajas: con ${titlePack} piezas por caja (según el título, por confirmar) se calculan ${quantity.toLocaleString("en-US")} piezas.`,
          `The price is per piece and you asked for ${requested.toLocaleString("en-US")} packs or boxes: with ${titlePack} pieces per box (from the title, to be confirmed) we calculate ${quantity.toLocaleString("en-US")} pieces.`,
        ),
      );
    }
  }

  if (piecesPerUnit > 1) {
    const fromTitle = unitInfo.packSize > 1;
    const many = unitWordFor(unitInfo.unit, quantity);
    if (qtyMode === "pieces") {
      notes.push(
        Lx(
          `Pediste ${requested.toLocaleString("en-US")} piezas. Con ${piecesPerUnit} piezas por ${one} (${fromTitle ? "según el título de la publicación" : "dato que escribiste"}, supuesto por confirmar con el proveedor) se calculan ${quantity.toLocaleString("en-US")} ${many} = ${(quantity * piecesPerUnit).toLocaleString("en-US")} piezas.`,
          `You asked for ${requested.toLocaleString("en-US")} pieces. With ${piecesPerUnit} pieces per ${one} (${fromTitle ? "from the listing title" : "figure you entered"}, an assumption to confirm with the supplier) we calculate ${quantity.toLocaleString("en-US")} ${many} = ${(quantity * piecesPerUnit).toLocaleString("en-US")} pieces.`,
        ),
      );
    } else {
      notes.push(
        Lx(
          `Cantidad en ${unitWordFor(unitInfo.unit, 2)}: ${quantity.toLocaleString("en-US")} ${many} de ${piecesPerUnit} piezas = ${(quantity * piecesPerUnit).toLocaleString("en-US")} piezas (supuesto por confirmar con el proveedor).`,
          `Quantity in ${unitWordFor(unitInfo.unit, 2)}: ${quantity.toLocaleString("en-US")} ${many} of ${piecesPerUnit} pieces = ${(quantity * piecesPerUnit).toLocaleString("en-US")} pieces (assumption to confirm with the supplier).`,
        ),
      );
    }
  }

  // Minimum order, in the same unit as the quantity
  let moqNote = "";
  const moq = Number(String(supplier?.moq ?? "").replace(/,/g, ""));
  if (moq > 1) {
    const moqUnit = String(supplier?.saleUnit || "");
    if (!moqUnit && (unitInfo.multi || packSizeFromTitle(supplier?.productName) > 1)) {
      moqNote = Lx(
        `El pedido mínimo publicado es ${moq.toLocaleString("en-US")}, sin indicar si son piezas o ${unitWordFor(unitInfo.unit || "set", 2)}. Tu pedido equivale a ${quantity.toLocaleString("en-US")} ${unitWordFor(unitInfo.unit, quantity)}${piecesPerUnit > 1 ? ` (${(quantity * piecesPerUnit).toLocaleString("en-US")} piezas)` : ""}: confirma el mínimo con el proveedor.`,
        `The published minimum order is ${moq.toLocaleString("en-US")}, without saying whether pieces or ${unitWordFor(unitInfo.unit || "set", 2)}. Your order equals ${quantity.toLocaleString("en-US")} ${unitWordFor(unitInfo.unit, quantity)}${piecesPerUnit > 1 ? ` (${(quantity * piecesPerUnit).toLocaleString("en-US")} pieces)` : ""}: confirm the minimum with the supplier.`,
      );
    } else {
      // the minimum is in the platform's sale unit (a machine: 1 unit)
      const sameUnit = !moqUnit || moqUnit === unitInfo.unit || (unitInfo.unit === "piece" && !unitInfo.multi);
      const ordered = sameUnit ? quantity : moqUnit === "piece" && piecesPerUnit > 1 ? quantity * piecesPerUnit : quantity;
      if (ordered < moq) {
        const w = unitWordFor(moqUnit || unitInfo.unit, moq);
        moqNote = Lx(
          `El pedido mínimo publicado es ${moq.toLocaleString("en-US")} ${w} y tu pedido equivale a ${ordered.toLocaleString("en-US")} ${unitWordFor(moqUnit || unitInfo.unit, ordered)}: está por debajo del mínimo. Confirma con el proveedor si acepta esa cantidad o ajusta el pedido.`,
          `The published minimum order is ${moq.toLocaleString("en-US")} ${w} and your order equals ${ordered.toLocaleString("en-US")} ${unitWordFor(moqUnit || unitInfo.unit, ordered)}: it is below the minimum. Confirm with the supplier whether they accept that quantity, or adjust the order.`,
        );
      }
    }
  }
  if (moqNote) notes.push(moqNote);

  return {
    supplier, priceFlag, needsPriceDecision, needsUnitDecision, needsBasisDecision, unitInfo, intent, qtyMode,
    packSize, piecesPerUnit, quantity, price, ownPrice, publishedPerPiece, notes, moqNote,
  };
}
