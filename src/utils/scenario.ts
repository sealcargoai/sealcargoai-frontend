// One cost scenario per supplier, shared by the supplier list, the costs page
// and the exports: the price the client typed or confirmed, whether their
// quantity is in pieces or sets, and the price basis. Everything is converted
// to the platform's sale unit before calculating or checking the minimum order.
import { priceIssue } from "./priceCheck";
import { saleUnitInfo, quantityIntent, packSizeFromTitle, unitWordFor, type SaleUnitInfo } from "./saleUnit";
import { formatUSD, formatUnitUSD, formatUnitQ } from "./costCalculator";
import { Lx } from "./lang";

/** A quantity from the form or state ("1e7", "1,000", 500): whole units, 1 when unusable. */
export function qtyFrom(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 10_000_000) : 1000;
}

export interface CostChoices {
  customPrice?: number;
  usePublished?: boolean;
  qtyMode?: "sets" | "pieces";
  customPack?: number;
  priceBasis?: "unit" | "piece"; // the published price is per sale unit or per piece
  confirmedPack?: number; // pieces per pack when the price was confirmed (a change asks again)
  completeConfirmed?: boolean; // the client confirmed the listing is the complete product
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
  requestedPieces: number; // the client's quantity in pieces (pairs × 2, dozens × 12 when the listing sells another unit)
  countedIn: "pair" | "dozen" | ""; // the client counted pairs/dozens and they were converted to pieces
  priceFlag: string;
  needsPriceDecision: boolean;
  needsCompleteDecision: boolean;
  confirmationReset: boolean; // a price confirmation was dropped because the pack content changed
  needsUnitDecision: boolean;
  needsBasisDecision: boolean;
  unitInfo: SaleUnitInfo;
  intent: "piece" | "pack" | "pair" | "dozen" | "";
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
  // A price confirmation holds only for the pack content it was made with:
  // 1.67 per box of 200 is not 1.67 per box of 1,000
  const packNow = (() => {
    const u = saleUnitInfo(original, productType);
    return u.packSize > 1 ? u.packSize : Number(choices.customPack) || 0;
  })();
  // 0 = confirmed before the pack content was known: entering it the first time keeps the confirmation
  const confirmationValid = !choices.confirmedPack || choices.confirmedPack === packNow;
  if (!confirmationValid) choices = { ...choices, usePublished: undefined, priceBasis: undefined };
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
  // a listing that may be a part (toe cap, casters…) waits for the client
  const needsCompleteDecision = !!original?.componentFlag && !choices.completeConfirmed;

  const unitInfo = saleUnitInfo(supplier, productType);
  const intent = quantityIntent(ctx.description);
  const requested = Math.max(1, Math.floor(ctx.requestedQty) || 1);
  // "1000 pares de guantes": 2,000 pieces, unless the listing also sells by the pair
  // (a dozen likewise is 12 pieces). A listing that doesn't say its unit is not
  // converted: its price may well be per pair, so the note asks to confirm it.
  const countMult = intent === "pair" ? 2 : intent === "dozen" ? 12 : 1;
  const sameCountUnit = (intent === "pair" && unitInfo.unit === "pair") || (intent === "dozen" && unitInfo.unit === "dozen");
  const countedIn = countMult > 1 && !sameCountUnit && (unitInfo.multi || unitInfo.unit === "piece");
  const requestedPieces = countedIn ? requested * countMult : requested;
  const countWord = intent === "pair" ? Lx("pares", "pairs") : Lx("docenas", "dozens");
  // "200 zapatos" with a price per pair could mean 200 pairs: ask instead of halving it
  const qtyMode =
    choices.qtyMode ??
    (sameCountUnit ? "sets" : countedIn ? "pieces" : intent === "pack" ? "sets" : intent === "piece" && unitInfo.unit !== "pair" ? "pieces" : null);
  const packSize = unitInfo.packSize > 1 ? unitInfo.packSize : Number(choices.customPack) || 0;
  // a client counting pairs ("100 pares") needs no per-piece figures
  const piecesPerUnit =
    unitInfo.multi && qtyMode !== null && packSize > 1 && !(unitInfo.unit === "pair" && qtyMode === "sets") ? packSize : 0;
  const needsUnitDecision = unitInfo.multi && (qtyMode === null || (qtyMode === "pieces" && !(packSize > 1)));
  let quantity =
    unitInfo.multi && qtyMode === "pieces" && packSize > 1
      ? Math.ceil(requestedPieces / packSize)
      : countedIn && !unitInfo.multi && qtyMode !== "sets"
        ? requestedPieces
        : requested;

  const notes: string[] = [];
  // pairs/dozens counted against a listing sold by the piece
  if (countedIn && !unitInfo.multi && qtyMode !== "sets")
    notes.push(
      Lx(
        `Pediste ${requested.toLocaleString("en-US")} ${countWord} = ${requestedPieces.toLocaleString("en-US")} piezas (${intent === "pair" ? "cada par son 2" : "cada docena son 12"}), y la publicación vende por pieza. Si el proveedor cuenta cada ${intent === "pair" ? "par" : "docena"} como una unidad, serían ${requested.toLocaleString("en-US")} unidades: confírmalo.`,
        `You asked for ${requested.toLocaleString("en-US")} ${countWord} = ${requestedPieces.toLocaleString("en-US")} pieces (${intent === "pair" ? "each pair is 2" : "each dozen is 12"}), and the listing sells per piece. If the supplier counts each ${intent === "pair" ? "pair" : "dozen"} as one unit, it would be ${requested.toLocaleString("en-US")} units: confirm it.`,
      ),
    );
  // pairs/dozens against a listing that doesn't say its unit
  if (countMult > 1 && !sameCountUnit && !countedIn)
    notes.push(
      Lx(
        `Tu cantidad está en ${countWord} y la publicación no indica si su precio es por ${intent === "pair" ? "par" : "docena"} o por pieza: calculamos ${requested.toLocaleString("en-US")} unidades tomando el precio como precio por ${intent === "pair" ? "par" : "docena"}. Si es por pieza, serían ${(requested * countMult).toLocaleString("en-US")} piezas; confírmalo con el proveedor.`,
        `Your quantity is in ${countWord} and the listing doesn't say whether its price is per ${intent === "pair" ? "pair" : "dozen"} or per piece: we calculate ${requested.toLocaleString("en-US")} units taking the price as per ${intent === "pair" ? "pair" : "dozen"}. If it is per piece, it would be ${(requested * countMult).toLocaleString("en-US")} pieces; confirm it with the supplier.`,
      ),
    );
  // a listing priced per meter, kilo or ton: the quantity is read in that measure
  if (unitInfo.unit === "meter" || unitInfo.unit === "kilogram" || unitInfo.unit === "ton") {
    // a quantity written in that measure ("500 metros", "1,000 kg"); "médico" is not "m"
    const said = new RegExp(
      `\\d\\s*(?:${{ meter: "m|mts?|metros?|meters?|metres?", kilogram: "kg|kgs|kilos?|kilogramos?|kilograms?", ton: "t|tons?|toneladas?|tonnes?" }[unitInfo.unit]})(?![a-záéíóúüñ])`,
    ).test(String(ctx.description || "").toLowerCase());
    if (!said)
      notes.push(
        Lx(
          `La publicación vende por ${unitWordFor(unitInfo.unit, 1)}: tomamos tu cantidad como ${requested.toLocaleString("en-US")} ${unitWordFor(unitInfo.unit, requested)}. Si tu cantidad está en piezas u otra unidad, ajústala o confirma la equivalencia con el proveedor.`,
          `The listing sells per ${unitWordFor(unitInfo.unit, 1)}: we take your quantity as ${requested.toLocaleString("en-US")} ${unitWordFor(unitInfo.unit, requested)}. If your quantity is in pieces or another unit, adjust it or confirm the equivalence with the supplier.`,
        ),
      );
  }
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
        supplier = {
          ...supplier,
          price,
          priceRange: "",
          basisConverted: { perPiece, piecesPerUnit, unit: one },
          priceBasisNote: Lx(
            `precio publicado ${formatUnitUSD(perPiece)} por pieza × ${piecesPerUnit} piezas`,
            `published price ${formatUnitUSD(perPiece)} per piece × ${piecesPerUnit} pieces`,
          ),
        };
        notes.push(
          Lx(
            `Precio publicado ${formatUnitUSD(perPiece)} tomado como precio por pieza, según indicaste: ${formatUnitUSD(price)} por ${one} de ${piecesPerUnit} piezas.`,
            `Published price ${formatUnitUSD(perPiece)} taken as a per-piece price, as you indicated: ${formatUnitUSD(price)} per ${one} of ${piecesPerUnit} pieces.`,
          ),
        );
      } else if (choices.priceBasis === "unit") {
        notes.push(
          Lx(
            `Confirmaste que ${formatUnitUSD(price)} es el precio por ${one} de ${piecesPerUnit} piezas (unos ${formatUSD(publishedPerPiece, 4)} por pieza).`,
            `You confirmed ${formatUnitUSD(price)} is the price per ${one} of ${piecesPerUnit} pieces (about ${formatUSD(publishedPerPiece, 4)} per piece).`,
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
      const pairsTitle = unitInfo.pairsPerUnit ? Lx(` (${unitInfo.pairsPerUnit} pares)`, ` (${unitInfo.pairsPerUnit} pairs)`) : "";
      const askedEs = countedIn
        ? `${requested.toLocaleString("en-US")} ${countWord} = ${requestedPieces.toLocaleString("en-US")} piezas (${intent === "pair" ? "cada par son 2" : "cada docena son 12"})`
        : `${requested.toLocaleString("en-US")} piezas`;
      const askedEn = countedIn
        ? `${requested.toLocaleString("en-US")} ${countWord} = ${requestedPieces.toLocaleString("en-US")} pieces (${intent === "pair" ? "each pair is 2" : "each dozen is 12"})`
        : `${requested.toLocaleString("en-US")} pieces`;
      const totalPieces = quantity * piecesPerUnit;
      const backEs = countedIn ? ` (${(totalPieces / countMult).toLocaleString("en-US")} ${countWord})` : "";
      const backEn = backEs ? ` (${(totalPieces / countMult).toLocaleString("en-US")} ${countWord})` : "";
      notes.push(
        Lx(
          `Pediste ${askedEs}. Con ${piecesPerUnit} piezas${pairsTitle} por ${one} (${unitInfo.unit === "pair" ? "cada par son 2 piezas" : `${fromTitle ? "según el título de la publicación" : "dato que escribiste"}, supuesto por confirmar con el proveedor`}) se calculan ${quantity.toLocaleString("en-US")} ${many} = ${totalPieces.toLocaleString("en-US")} piezas${backEs}.`,
          `You asked for ${askedEn}. With ${piecesPerUnit} pieces${pairsTitle} per ${one} (${unitInfo.unit === "pair" ? "each pair is 2 pieces" : `${fromTitle ? "from the listing title" : "figure you entered"}, an assumption to confirm with the supplier`}) we calculate ${quantity.toLocaleString("en-US")} ${many} = ${totalPieces.toLocaleString("en-US")} pieces${backEn}.`,
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
    supplier, requestedPieces, countedIn: countedIn ? (intent as "pair" | "dozen") : "", priceFlag, needsPriceDecision, needsCompleteDecision, confirmationReset: !confirmationValid, needsUnitDecision, needsBasisDecision, unitInfo, intent, qtyMode,
    packSize, piecesPerUnit, quantity, price, ownPrice, publishedPerPiece, notes, moqNote,
  };
}

/** How the price used was obtained, for the reports ("" = the published price as is). */
export function priceNoteFor(s: any): string {
  if (!s) return "";
  if (s.priceBasisNote) return String(s.priceBasisNote);
  if (s.priceSource === "client") return Lx("precio indicado por el cliente", "price entered by the client");
  const nums = String(s.priceRange || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (nums.length >= 2 && nums[0] !== nums[1]) {
    const pub = `${formatUnitUSD(nums[0])} – ${formatUnitUSD(nums[1])}`;
    const used = Number(s.price) || 0;
    const isMid = used > 0 && Math.abs(used - (nums[0] + nums[1]) / 2) <= Math.max(0.005, used * 0.005);
    return isMid ? Lx(`precio medio del rango ${pub}`, `midpoint of the range ${pub}`) : Lx(`rango publicado ${pub}`, `published range ${pub}`);
  }
  if (s.priceConfirmed) return Lx("precio publicado atípico, usado a pedido del cliente", "atypical published price, used at the client's request");
  return "";
}

/** The assumptions every report keeps (same on screen, PDF and Excel), in the current language. */
export function reportNotesFor(sc: Scenario, perUnitUsd: number, Q: (usd: number, decimals?: number) => string): string[] {
  const one = unitWordFor(sc.unitInfo.unit, 1);
  return [
    ...sc.notes,
    ...(sc.piecesPerUnit > 1
      ? [
          Lx(
            `Equivalente por pieza: unos ${Q(perUnitUsd / sc.piecesPerUnit, 2)} por pieza (${Q(perUnitUsd, 2)} por ${one} de ${sc.piecesPerUnit} piezas).`,
            `Per-piece equivalent: about ${Q(perUnitUsd / sc.piecesPerUnit, 2)} per piece (${Q(perUnitUsd, 2)} per ${one} of ${sc.piecesPerUnit} pieces).`,
          ),
        ]
      : []),
    ...(sc.ownPrice ? [Lx("Precio usado: el que indicaste tú, no el publicado.", "Price used: the one you entered, not the published one.")] : []),
    ...(!sc.ownPrice && sc.supplier?.priceConfirmed
      ? [Lx("Precio usado: el publicado, aunque parecía atípico, porque lo confirmaste.", "Price used: the published one, although it looked atypical, because you confirmed it.")]
      : []),
  ];
}
