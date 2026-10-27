import { supplierKey, loadCostChoices, saveCostChoices } from "../../utils/draft";
import { componentText, type ComponentFlag } from "../../utils/componentMatch";
import { qtyFrom, resolveScenario, priceNoteFor, reportNotesFor, type CostChoices } from "../../utils/scenario";
import { useEffect, useState } from "react";
import { cleanSupplier } from "../../utils/text";
import { useNavigate, useLocation } from "react-router";
import { priceIssue } from "../../utils/priceCheck";
import {
  DollarSign,
  Ship,
  FileText,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Download,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { buildCostPdf } from "../../utils/costPdf";
import { listingDifferences } from "../../utils/differences";
import { Lx } from "../../utils/lang";
import { saleUnitInfo, unitWordFor, quantityIntent, productNoun } from "../../utils/saleUnit";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import {
  SelectedSupplierCard,
  NoSupplierNotice,
  hasUsableSupplier,
  supplierPriceInfo,
  SupplierDisclaimer,
  sealDisclaimer,
} from "./SelectedSupplier";
import {
  SEAL_COMPANY,
  drawCompanyInfoBox,
  drawCompanyFooter,
  generateBeautifulExcel,
} from "../../utils/reportExports";
import {
  calculateCosts,
  useRates,
  formatQ,
  formatUSD, formatUnitUSD, formatUnitQ,
  estimateNote,
  scenarioVariables,
  type CostResult,
} from "../../utils/costCalculator";

// Cost logic lives in utils/costCalculator (shared with report, PDF and Excel)
type Costs = CostResult;

// ─── PDF Export (with company info) ───────────────────────────────────────────
function exportToPDF(
  costs: Costs,
  supplierName: string,
  quantity: number,
  price: number,
  productDescription: string,
  priceNote = "",
  notes: string[] = [],
  differences?: { title: string; items: string[] },
) {
  buildCostPdf({
    notes,
    differences,
    title: Lx("Escenario estimado de costos de importación (no es cotización)", "Estimated import cost scenario (not a quote)"),
    supplierName,
    productDescription,
    quantity,
    price,
    priceNote,
    costs,
    disclaimer: sealDisclaimer(),
    fileName: `SEAL_${Lx("Estimacion", "Estimate")}_${supplierName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
  });
}

async function exportToExcel(
  costs: Costs,
  supplierName: string,
  quantity: number,
  price: number,
  destination: string,
  productType: string,
  priceNote = "",
  notes: string[] = [],
  differences?: { title: string; items: string[] },
) {
  await generateBeautifulExcel({
    notes,
    differences,
    reportTitle: Lx("Escenario estimado de costos de importación", "Estimated import cost scenario"),
    supplierName,
    productType,
    destination,
    quantity,
    price,
    priceNote,
    costs,
    vatRate: costs.vatRate,
    insuranceRate: costs.insuranceRate,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CostBreakdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, L } = useLanguage();

  // ── Read state ────────────────────────────────────────────────────────────
  const originalSupplier = cleanSupplier(location.state?.supplier ?? null);
  // Atypical published prices (US$1, very wide ranges…) are not used until the
  // client confirms them or types the price they were quoted.
  // Choices for this supplier: from this page's history entry, or from an
  // earlier visit (back to the list and forward again creates a new entry)
  const choiceKey = supplierKey(originalSupplier, String(location.state?.productDescription ?? ""));
  const storedChoices = (location.state?.costChoices ?? loadCostChoices(choiceKey) ?? {}) as CostChoices;
  const [customPrice, setCustomPrice] = useState<number>(Number(storedChoices.customPrice) || 0);
  const [usePublished, setUsePublished] = useState<boolean>(!!storedChoices.usePublished);
  const [qtyModeChoice, setQtyMode] = useState<"sets" | "pieces" | undefined>(storedChoices.qtyMode);
  const [customPack, setCustomPack] = useState(Number(storedChoices.customPack) || 0);
  const [priceBasis, setPriceBasis] = useState<"unit" | "piece" | undefined>(storedChoices.priceBasis);
  const [confirmedPack, setConfirmedPack] = useState<number | undefined>(storedChoices.confirmedPack);
  const [completeConfirmed, setCompleteConfirmed] = useState<boolean>(!!storedChoices.completeConfirmed);
  const [packChanged, setPackChanged] = useState(false);
  const stateQuantity = location.state?.quantity ?? "1000";
  const stateBudget = location.state?.budget ?? "";
  const stateDestination = location.state?.destination ?? "GT";
  const stateProductType = location.state?.productType ?? "";
  const requestedQty = qtyFrom(String(stateQuantity));
  // Price, sale unit, pieces per set, price basis and minimum order: one
  // scenario shared with the supplier list and the reports (utils/scenario)
  const sc = resolveScenario(
    originalSupplier,
    { customPrice, usePublished, qtyMode: qtyModeChoice, customPack, priceBasis, confirmedPack, completeConfirmed },
    { requestedQty, productType: String(stateProductType), description: String(location.state?.productDescription ?? "") },
  );
  const { priceFlag, needsPriceDecision, needsUnitDecision, needsBasisDecision, unitInfo, intent, qtyMode, packSize, piecesPerUnit, quantity } = sc;
  const stateSupplier = sc.supplier;
  // confirm the price for the pack content in use; changing it asks again
  const confirmPublished = () => { setUsePublished(true); setConfirmedPack(sc.packSize); };
  const confirmBasis = (b: "unit" | "piece") => { setPriceBasis(b); setConfirmedPack(sc.packSize); };
  // a confirmation made before the pack content was known now refers to that content
  useEffect(() => {
    if ((usePublished || priceBasis) && !confirmedPack && sc.packSize > 0) setConfirmedPack(sc.packSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.packSize]);
  useEffect(() => {
    if (!sc.confirmationReset) return;
    setUsePublished(false);
    setPriceBasis(undefined);
    setConfirmedPack(undefined);
    setPackChanged(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.confirmationReset]);
  // 0 = the client didn't give a budget (never invent one)
  const budget = parseFloat(String(stateBudget)) || 0;
  const destination = String(stateDestination);
  const productType = String(stateProductType);

  // Real supplier only: no demo name or price (see NoSupplierNotice below)
  const price = stateSupplier?.price > 0 ? stateSupplier.price : 0;
  const supplierName = stateSupplier?.name || "";
  const isLiveData = hasUsableSupplier(stateSupplier);
  const priceInfo = supplierPriceInfo(stateSupplier);
  const productDescription = String(location.state?.productDescription ?? "");
  const priceNote = priceNoteFor(stateSupplier);


  const volumeCbm = parseFloat(String(location.state?.volumeCbm ?? "")) || 0;
  const weightKg = parseFloat(String(location.state?.weightKg ?? "")) || 0;
  const rates = useRates();
  useEffect(() => {
    // only what the client chose; the default read from the description is recomputed
    const choices: CostChoices = { qtyMode: qtyModeChoice, customPack, customPrice, usePublished, priceBasis, confirmedPack, completeConfirmed: completeConfirmed || undefined };
    saveCostChoices(choiceKey, choices);
    if (JSON.stringify(location.state?.costChoices ?? {}) === JSON.stringify(choices)) return;
    navigate(location.pathname, { replace: true, state: { ...(location.state ?? {}), costChoices: choices } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtyModeChoice, customPack, customPrice, usePublished, priceBasis, confirmedPack, completeConfirmed]);
  if (!isLiveData) return <NoSupplierNotice hasSupplierWithoutPrice={!!stateSupplier?.name} />;
  const packChangedNote = packChanged ? (
    <div role="alert" className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 mb-4">
      {L(
        "Cambiaste el contenido del empaque, así que el precio por pieza cambió: vuelve a confirmar a qué corresponde el precio.",
        "You changed the pack content, so the price per piece changed: confirm again what the price refers to.",
      )}
    </div>
  ) : null;
  if (sc.needsCompleteDecision) {
    const f = originalSupplier.componentFlag as { status: string; part: string };
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 text-sm text-slate-600 hover:text-[#0B3C5D]">
            ← {L("Volver a proveedores", "Back to suppliers")}
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-4">{t("cost.title")}</h1>
          <SelectedSupplierCard supplier={stateSupplier} description={productDescription} pending />
          <div role="alert" className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-amber-900 mb-6">
            <p className="font-semibold mb-2">
              {L("Antes de calcular: ¿esta publicación es el producto completo?", "Before calculating: is this listing the complete product?")}
            </p>
            <p className="text-sm mb-4">
              {f.status === "machine"
                ? componentText(f as ComponentFlag).warn
                : f.status === "part"
                ? L(
                    `El título indica «${f.part}» y parece ser solo esa pieza o un accesorio, no ${productDescription ? `«${productDescription.length > 60 ? productDescription.slice(0, 57).trim() + "…" : productDescription}»` : "el producto completo"}. Si calculamos con su precio, el escenario no correspondería a lo que buscas.`,
                    `The title says "${f.part}" and it seems to be only that part or an accessory, not ${productDescription ? `"${productDescription.length > 60 ? productDescription.slice(0, 57).trim() + "…" : productDescription}"` : "the complete product"}. Calculating with its price would not match what you're looking for.`,
                  )
                : L(
                    `El título menciona «${f.part}» y no queda claro si el precio es del producto completo o solo de esa pieza. Revisa las fotos de la publicación o pregúntale al proveedor.`,
                    `The title mentions "${f.part}" and it's not clear whether the price is for the complete product or only that part. Check the listing photos or ask the supplier.`,
                  )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold">
                {L("Escoger otra opción", "Choose another option")}
              </button>
              <button onClick={() => setCompleteConfirmed(true)} className="px-4 py-2 rounded-lg border border-amber-400 bg-white text-sm font-semibold">
                {L("Confirmé que es el producto completo", "I confirmed it is the complete product")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!needsPriceDecision && needsUnitDecision) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 text-sm text-slate-600 hover:text-[#0B3C5D]">
            ← {L("Volver a proveedores", "Back to suppliers")}
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-4">{t("cost.title")}</h1>
          <SelectedSupplierCard supplier={stateSupplier} description={productDescription} pending />
          <SaleUnitNotice
            unit={unitInfo.unit}
            packSize={packSize}
            packFromTitle={unitInfo.packSize > 1}
            requested={requestedQty}
            pieceCount={sc.requestedPieces}
            countedIn={sc.countedIn}
            mode={qtyMode}
            fromDescription={intent !== ""}
            onMode={setQtyMode}
            onPack={setCustomPack}
            item={productNoun(productDescription)}
            mixedWith={unitInfo.mixedWith || ""}
            blocking
          />
        </div>
      </div>
    );
  }
  if (!needsPriceDecision && !needsUnitDecision && needsBasisDecision) {
    const one = unitWordFor(unitInfo.unit, 1);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 text-sm text-slate-600 hover:text-[#0B3C5D]">
            ← {L("Volver a proveedores", "Back to suppliers")}
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-4">{t("cost.title")}</h1>
          <SelectedSupplierCard supplier={stateSupplier} description={productDescription} pending />
          {packChangedNote}
          <div role="alert" className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-amber-900 mb-6">
            <p className="font-semibold mb-2">{L("Confirma a qué corresponde el precio publicado", "Confirm what the published price refers to")}</p>
            <p className="text-sm mb-4">
              {L(
                `El precio publicado es ${formatUnitUSD(sc.price)}. Si fuera por ${one} de ${piecesPerUnit} piezas, cada pieza costaría unos ${formatUSD(sc.publishedPerPiece, 4)}, una cifra poco realista. Antes de calcular, indica a qué corresponde ese precio o escribe el que te cotizaron.`,
                `The published price is ${formatUnitUSD(sc.price)}. If it were per ${one} of ${piecesPerUnit} pieces, each piece would cost about ${formatUSD(sc.publishedPerPiece, 4)}, an unrealistic figure. Before calculating, say what that price refers to or enter the one you were quoted.`,
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => confirmBasis("piece")} className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold">
                {L(`Es por pieza (${formatUnitUSD(sc.price * piecesPerUnit)} por ${one})`, `It's per piece (${formatUnitUSD(sc.price * piecesPerUnit)} per ${one})`)}
              </button>
              <button onClick={() => confirmBasis("unit")} className="px-4 py-2 rounded-lg border border-amber-400 bg-white text-sm font-semibold">
                {L(`Es por ${one} de ${piecesPerUnit} piezas`, `It's per ${one} of ${piecesPerUnit} pieces`)}
              </button>
            </div>
          </div>
          <OwnPrice current={customPrice} unit={unitInfo.unit} onChange={(v) => setCustomPrice(v)} />
        </div>
      </div>
    );
  }
  if (needsPriceDecision) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-sm text-slate-600 hover:text-[#0B3C5D]"
          >
            ← {L("Volver a proveedores", "Back to suppliers")}
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-4">{t("cost.title")}</h1>
          <SelectedSupplierCard supplier={stateSupplier} description={productDescription} pending />
          {packChangedNote}
          <PriceDecision
            unit={unitInfo.unit}
            reason={priceFlag}
            published={priceInfo.published}
            onCustom={(v) => setCustomPrice(v)}
            onUsePublished={confirmPublished}
            onBack={() => navigate(-1)}
          />
        </div>
      </div>
    );
  }
  const costs = calculateCosts({ price, quantity, volumeCbm, weightKg, saleUnit: unitInfo.unit }, rates);
  const Q = (usd: number, decimals = 0) => formatQ(usd, costs.exchangeRate, decimals);
  // Assumptions shown on screen that the PDF and Excel must keep
  const reportNotes = reportNotesFor(sc, costs.perUnit, Q);
  // the listing title and what differs from the request: the same warnings as on screen
  const reportDiffs = listingDifferences(productDescription, stateSupplier);

  // ── Chart data ────────────────────────────────────────────────────────────
  const costData = costs.lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ name: l.label.replace("*", ""), value: l.amount, color: l.color }))
    .sort((a, b) => b.value - a.value); // largest to smallest

  // "¿En qué se va tu dinero?": the real calculator lines grouped in 4 blocks
  const sumKeys = (keys: string[]) =>
    costs.lines.filter((l) => keys.includes(l.key)).reduce((a, l) => a + l.amount, 0);
  const moneyGroups = [
    { key: "product", name: L("Producto (FOB)", "Product (FOB)"), desc: L("Lo que le pagas al proveedor", "What you pay the supplier"), amount: sumKeys(["product"]), color: "#0B3C5D" },
    { key: "logistics", name: L("Traerlo a Guatemala", "Bringing it to Guatemala"), desc: L("Flete, seguro y gastos en destino", "Freight, insurance and destination charges"), amount: sumKeys(["freight", "insurance", "local"]), color: "#3B82F6" },
    { key: "taxes", name: L("Impuestos SAT", "SAT taxes"), desc: L("DAI e IVA de importación", "Import DAI and IVA"), amount: sumKeys(["duties", "vat"]), color: "#60A5FA" },
    { key: "seal", name: L("Servicio de aduana SEAL", "SEAL customs service"), desc: L("Honorarios del agente aduanero", "Customs broker fee"), amount: sumKeys(["customs"]), color: "#8B5CF6" },
  ];
  // Whole "of each US$100" shares that add up to exactly 100 (largest remainder)
  {
    const raw = moneyGroups.map((g) => (costs.totalCost > 0 ? (g.amount / costs.totalCost) * 100 : 0));
    const base = raw.map(Math.floor);
    let left = costs.totalCost > 0 ? 100 - base.reduce((x, y) => x + y, 0) : 0;
    raw
      .map((r, i) => ({ i, rem: r - base[i] }))
      .sort((x, y) => y.rem - x.rem)
      .forEach(({ i }) => { if (left > 0) { base[i] += 1; left -= 1; } });
    moneyGroups.forEach((g, i) => Object.assign(g, { pct: raw[i], share: base[i] }));
  }
  moneyGroups.sort((a, b) => b.amount - a.amount); // largest to smallest

  const LINE_STYLE: Record<string, { icon: typeof DollarSign; color: string }> = {
    product: { icon: DollarSign, color: "blue" },
    freight: { icon: Ship, color: "cyan" },
    insurance: { icon: AlertCircle, color: "orange" },
    duties: { icon: FileText, color: "purple" },
    vat: { icon: TrendingUp, color: "green" },
    customs: { icon: FileText, color: "indigo" },
    local: { icon: Ship, color: "slate" },
  };

  const breakdownRows = costs.lines.map((l) => ({
    icon: LINE_STYLE[l.key]?.icon ?? DollarSign,
    label: l.label,
    amount: l.amount,
    details: l.detail,
    color: LINE_STYLE[l.key]?.color ?? "blue",
    displayPercent:
      (l.key === "freight" && costs.freightPending) || !(costs.totalCost > 0)
        ? "—"
        : `${((l.amount / costs.totalCost) * 100).toFixed(1)}%`,
    pending: l.key === "freight" && costs.freightPending,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        {/* FIX: Added lg:flex lg:items-center lg:justify-between and lg:gap-4 to merge the rows side-by-side on desktop */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 lg:flex lg:items-center lg:justify-between lg:gap-4">
          {/* Left Side: Logo + Language toggle */}
          {/* FIX: Removed mb-3 completely on desktop via lg:mb-0 */}
          <div className="flex items-center justify-between mb-3 lg:mb-0 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logo} alt="SEAL" className="h-12 sm:h-14 md:h-[60px]" />
              <span className="text-base sm:text-xl font-bold text-[#0B3C5D] hidden xs:block">
                SmartTrade AI
              </span>
            </div>
            <div className="lg:hidden">
              <LanguageToggle />
            </div>
          </div>

          {/* Right Side: action buttons */}
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end w-full">
            <button
              onClick={() => navigate(-1)}
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              {t("cost.backToSuppliers")}
            </button>
            <button
              onClick={() =>
                exportToPDF(costs, supplierName, quantity, price, productDescription, priceNote, reportNotes, reportDiffs)
              }
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-red-300 text-red-700 rounded-xl hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm hover:shadow-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t("cost.exportPDF")}</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={() =>
                exportToExcel(costs, supplierName, quantity, price, destination, productDescription || productType, priceNote, reportNotes, reportDiffs)
              }
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-green-300 text-green-700 rounded-xl hover:bg-green-50 transition-all flex items-center gap-2 shadow-sm hover:shadow-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t("cost.exportExcel")}</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <button
              onClick={() =>
                navigate("/risk", {
                  state: {
                    supplier: stateSupplier,
                    quantity: String(quantity),
                    piecesPerUnit,
                    reportNotes,
                    // the final report rebuilds the same scenario (in the language in use)
                    scenarioInput: {
                      supplier: originalSupplier,
                      choices: { customPrice, usePublished, qtyMode: qtyModeChoice, customPack, priceBasis, confirmedPack, completeConfirmed },
                      requestedQty,
                    },
                    budget: stateBudget,
                    destination: stateDestination,
                    productType: stateProductType,
                    volumeCbm: location.state?.volumeCbm,
                    weightKg: location.state?.weightKg,
                    productDescription: location.state?.productDescription,
                    suppliersData: location.state?.suppliersData,
                  },
                })
              }
              className="px-3 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              <span className="hidden sm:inline">
                {t("cost.riskAssessment")}
              </span>
              <span className="sm:hidden">{L("Revisar", "Review")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="hidden lg:block flex-shrink-0">
              <LanguageToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-2">
            {t("cost.title")}
          </h1>
          <p className="text-slate-600">
            {t("cost.subtitle")}{" "}
            <span className="font-semibold text-[#0B3C5D]">{supplierName}</span>
          </p>
          <p className="text-xs mt-1 font-medium">
            {isLiveData ? (
              <span className="text-green-600">
                ✅ {t("cost.dynamicCalc")} — {quantity.toLocaleString()}{" "}
                {unitWordFor(unitInfo.unit, quantity)} × {formatUnitUSD(Number(price))} ({formatUnitQ(Number(price), costs.exchangeRate)}) →{" "}
                {t("cost.destination")} Guatemala
              </span>
            ) : null}
          </p>
        </div>

        <SelectedSupplierCard supplier={stateSupplier} description={productDescription} />
        <OwnPrice current={customPrice} unit={unitInfo.unit} onChange={(v) => setCustomPrice(v)} />
        {unitInfo.multi && (
          <SaleUnitNotice
            unit={unitInfo.unit}
            packSize={packSize}
            packFromTitle={unitInfo.packSize > 1}
            requested={requestedQty}
            pieceCount={sc.requestedPieces}
            countedIn={sc.countedIn}
            mode={qtyMode}
            fromDescription={intent !== ""}
            onMode={setQtyMode}
            onPack={setCustomPack}
            item={productNoun(productDescription)}
            mixedWith={unitInfo.mixedWith || ""}
          />
        )}
        {sc.moqNote && (
          <div role="note" className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 mb-6">
            <span className="font-semibold">{L("Pedido mínimo: ", "Minimum order: ")}</span>
            {sc.moqNote}
          </div>
        )}
        <SupplierDisclaimer
          supplier={stateSupplier}
          productDescription={location.state?.productDescription ?? ""}
          quantity={`${quantity.toLocaleString("en-US")} ${unitWordFor(unitInfo.unit, quantity)}${piecesPerUnit > 1 ? ` (${(quantity * piecesPerUnit).toLocaleString("en-US")} ${L("piezas", "pieces")})` : ""}`}
        />

        {/* Total Cost Hero */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-[#0B3C5D] to-purple-700 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 md:p-10 mb-8 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-blue-100 mb-2 sm:mb-3 text-sm sm:text-lg">
                {costs.freightPending
                  ? L("Costo parcial estimado en Guatemala (sin flete)", "Estimated partial cost in Guatemala (without freight)")
                  : t("cost.totalLandedCost")}
              </div>
              <div className="text-3xl sm:text-5xl md:text-6xl font-bold drop-shadow-lg mb-2 sm:mb-3 break-all">
                {Q(costs.totalCost)}
              </div>
              {costs.freightPending && (
                <div className="mb-2 sm:mb-3 inline-block bg-amber-400 text-amber-950 rounded-lg px-3 py-1 text-xs sm:text-sm font-semibold">
                  {L("Estimación parcial, sin flete", "Partial estimate, without freight")}
                </div>
              )}
              <div className="text-blue-100 text-xs sm:text-base md:text-lg">
                {quantity.toLocaleString()} {unitWordFor(unitInfo.unit, quantity)} •{" "}
                <span className="font-bold text-white">
                  {Q(costs.perUnit, 2)} {Lx("por", "per")} {unitWordFor(unitInfo.unit, 1)}
                  {piecesPerUnit > 1 && (
                    <span className="block text-xs sm:text-sm font-normal text-blue-100">
                      {Lx(
                        `≈ ${Q(costs.perUnit / piecesPerUnit, 2)} por pieza (supuesto: ${piecesPerUnit} piezas por ${unitWordFor(unitInfo.unit, 1)}, por confirmar)`,
                        `≈ ${Q(costs.perUnit / piecesPerUnit, 2)} per piece (assumption: ${piecesPerUnit} pieces per ${unitWordFor(unitInfo.unit, 1)}, to be confirmed)`,
                      )}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-blue-200 text-xs sm:text-sm mt-1">
                <span>
                  {L(
                    `Equivale a ${formatUSD(costs.totalCost)} • tipo de cambio referencial Q${costs.exchangeRate.toFixed(2)} por US$1`,
                    `Equals ${formatUSD(costs.totalCost)} • reference exchange rate Q${costs.exchangeRate.toFixed(2)} per US$1`,
                  )}
                </span>
              </div>
              <div className="mt-3 inline-block bg-white/15 border border-white/25 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white">
                <span>{estimateNote()}</span>
              </div>
            </div>
            <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl flex-shrink-0">
              <DollarSign className="w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 min-w-0">
            <h2 className="font-semibold text-[#0B3C5D] mb-6">
              {t("cost.costDistribution")}
            </h2>
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={costData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={95}
                    paddingAngle={1}
                    dataKey="value"
                    stroke="#fff"
                  >
                    {costData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      Q(value),
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* fits inside the ring (inner radius 62 px) */}
                <span className="text-[10px] leading-tight text-slate-500 text-center max-w-[96px]">
                  {costs.freightPending ? L("Total parcial, sin flete", "Partial total, no freight") : L("Total estimado", "Estimated total")}
                </span>
                <span className="text-base font-bold text-[#0B3C5D] max-w-[110px] truncate">
                  {Q(costs.totalCost)}
                </span>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {costData.map((d) => {
                const pct = costs.totalCost > 0 ? (d.value / costs.totalCost) * 100 : 0;
                return (
                  <li key={d.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-slate-700 flex-1 min-w-0 truncate">{d.name}</span>
                    <span className="text-slate-500 tabular-nums w-12 text-right shrink-0">
                      {pct < 1 ? "<1" : Math.round(pct)}%
                    </span>
                    <span className="font-medium text-slate-800 tabular-nums min-w-[6rem] text-right whitespace-nowrap shrink-0">
                      {Q(d.value)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {costs.freightPending && (
              <p className="text-xs text-slate-500 mt-3">
                {L("El flete marítimo no está incluido: se cotiza con el volumen o peso de tu carga.", "Ocean freight is not included: it's quoted with the volume or weight of your cargo.")}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 min-w-0">
            <h2 className="font-semibold text-[#0B3C5D] mb-1">
              {L("¿En qué se va tu dinero?", "Where does your money go?")}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              {L("Porcentaje del costo total estimado", "Share of the estimated total cost")}
            </p>
            <div className="space-y-5">
              {moneyGroups.map((g) => {
                const { pct, share } = g as typeof g & { pct: number; share: number };
                const pendingFreight = g.key === "logistics" && costs.freightPending;
                return (
                  <div key={g.key}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                        <p className="text-xs text-slate-500">
                          {g.desc}
                          {pendingFreight ? L(" (flete por cotizar)", " (freight to be quoted)") : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {share}%
                        </p>
                        <p className="text-xs text-slate-500">
                          {Q(g.amount)}
                        </p>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(pct, g.amount > 0 ? 1 : 0)}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-baseline justify-between">
              <p className="text-sm text-slate-600">
                {L(`Por cada ${unitWordFor(unitInfo.unit, 1)}, además del precio de fábrica`, `Per ${unitWordFor(unitInfo.unit, 1)}, on top of the factory price`)}
                {costs.freightPending ? L(" (sin flete)", " (without freight)") : ""}
              </p>
              <p className="text-base font-bold text-[#0B3C5D]">
                +{Q(Math.max(costs.perUnit - price, 0), 2)}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="space-y-4">
          {breakdownRows.map((item, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-${item.color}-100 flex items-center justify-center flex-shrink-0`}
                >
                  <item.icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-${item.color}-600`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-[#0B3C5D] text-sm sm:text-base">
                    {item.label}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">
                    {item.details}
                  </div>
                </div>
              </div>
              <div className="text-right sm:text-right ml-13 sm:ml-0 flex-shrink-0">
                <div className="text-xl sm:text-2xl font-bold text-[#0B3C5D]">
                  {item.pending ? L("Por cotizar", "To be quoted") : Q(item.amount, 2)}
                </div>
                <div className="text-xs sm:text-sm text-slate-600">
                  {item.displayPercent}
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 px-1">{costs.fxNote}</p>
          {costs.freightPending && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ {L(
                "El total no incluye flete porque no indicaste volumen ni peso. Un ejecutivo de SEAL te cotiza el flete, o puedes volver al formulario y agregar el volumen (m³) o peso (kg).",
                "The total doesn't include freight because no volume or weight was given. A SEAL executive can quote it, or you can go back to the form and add the volume (m³) or weight (kg).",
              )}
            </div>
          )}
        </div>

        {/* Preliminary scenario + what can change it */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {L("Escenario estimado", "Estimated scenario")}
            </h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>
                  {L(
                    `En este escenario, el costo en Guatemala de cada ${unitWordFor(unitInfo.unit, 1)} sería de`,
                    `In this scenario, the landed cost in Guatemala of each ${unitWordFor(unitInfo.unit, 1)} would be`,
                  )}{" "}
                  <b>{Q(costs.perUnit, 2)}</b>
                  {piecesPerUnit > 1
                    ? L(
                        ` (unos ${Q(costs.perUnit / piecesPerUnit, 2)} por pieza, suponiendo ${piecesPerUnit} piezas por ${unitWordFor(unitInfo.unit, 1)})`,
                        ` (about ${Q(costs.perUnit / piecesPerUnit, 2)} per piece, assuming ${piecesPerUnit} pieces per ${unitWordFor(unitInfo.unit, 1)})`,
                      )
                    : ""}
                  {L(
                    ". Es una estimación preliminar, sujeta a revisión.",
                    ". It's a preliminary estimate, subject to review.",
                  )}
                  {costs.freightPending ? L(" No incluye flete.", " Freight not included.") : ""}
                </span>
              </li>
              {budget > 0 && (() => {
                // The budget is what the client plans to pay the supplier (FOB),
                // so it is compared with the product cost, not with the landed total.
                const diff = budget - costs.productCost;
                const extra = costs.totalCost - costs.productCost;
                return (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>
                      {L("Compra al proveedor:", "Purchase from the supplier:")} <b>{formatUSD(costs.productCost, 2)}</b>{" "}
                      {diff >= 0
                        ? L(
                            `queda dentro de tu presupuesto de compra de ${formatUSD(budget, 2)} (sobran ${formatUSD(diff, 2)}).`,
                            `fits within your purchase budget of ${formatUSD(budget, 2)} (${formatUSD(diff, 2)} left).`,
                          )
                        : L(
                            `supera tu presupuesto de compra de ${formatUSD(budget, 2)} por ${formatUSD(-diff, 2)}.`,
                            `exceeds your purchase budget of ${formatUSD(budget, 2)} by ${formatUSD(-diff, 2)}.`,
                          )}{" "}
                      {L(
                        costs.freightPending
                          ? `Aparte, traer la compra a Guatemala suma ${Q(extra)} en seguro, impuestos y gastos; el flete se cotiza aparte y no está incluido. Confírmalo con una cotización antes de decidir.`
                          : `Aparte, traer la compra a Guatemala suma ${Q(extra)} en flete, seguro, impuestos y gastos. Confírmalo con una cotización antes de decidir.`,
                        costs.freightPending
                          ? `On top of that, bringing it to Guatemala adds ${Q(extra)} in insurance, taxes and charges; freight is quoted separately and not included. Confirm it with a quote before deciding.`
                          : `On top of that, bringing it to Guatemala adds ${Q(extra)} in freight, insurance, taxes and charges. Confirm it with a quote before deciding.`,
                      )}
                    </span>
                  </li>
                );
              })()}
              {(() => {
                // Small orders: fixed charges weigh more than the product itself
                const ins = costs.lines.find((l) => l.key === "insurance")?.amount ?? 0;
                const insuranceMin = ins > costs.productCost * 0.0101;
                const fixed = costs.lines
                  .filter((l) => l.key === "insurance" || l.key === "customs" || l.key === "local")
                  .reduce((a, l) => a + l.amount, 0);
                return costs.totalCost > 0 && costs.productCost < fixed ? (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>
                      {L(
                        `En este pedido, los cargos que no dependen de la cantidad (seguro mínimo, honorarios de aduana y gastos en destino) suman ${Q(fixed)}, más que el producto (${Q(costs.productCost)}). Por eso el costo por ${unitWordFor(unitInfo.unit, 1)} sale alto; con una cantidad mayor se reparte entre más unidades.${insuranceMin ? " Además, el seguro mínimo forma parte del valor CIF, así que también sube la base del DAI y del IVA." : ""}`,
                        `In this order, the charges that don't depend on quantity (minimum insurance, customs fee and destination charges) add up to ${Q(fixed)}, more than the product (${Q(costs.productCost)}). That's why the cost per ${unitWordFor(unitInfo.unit, 1)} is high; with a larger quantity it is spread over more units.${insuranceMin ? " Also, the minimum insurance is part of the CIF value, so it also raises the DAI and IVA base." : ""}`,
                      )}
                    </span>
                  </li>
                ) : null;
              })()}
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>
                  {L("Con los supuestos usados, DAI e IVA suman", "With the assumptions used, DAI and IVA add up to")}{" "}
                  <b>{Q(costs.importDuties + costs.taxes)}</b>{" "}
                  ({(((costs.importDuties + costs.taxes) / costs.totalCost) * 100).toFixed(0)}%{" "}
                  {L("del total estimado", "of the estimated total")}).
                </span>
              </li>
              {(() => {
                const cbm = costs.chargeableCbm;
                if (costs.freightMode === "LCL" && cbm >= rates.lclMaxCbm * 0.75) {
                  return (
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>
                        {L(
                          `Con ${cbm.toFixed(1)} m³ está cerca de llenar un contenedor. A partir de ${rates.lclMaxCbm} m³ se cotiza contenedor completo.`,
                          `At ${cbm.toFixed(1)} m³ you are close to filling a container. From ${rates.lclMaxCbm} m³ a full container is quoted.`,
                        )}
                      </span>
                    </li>
                  );
                }
                if (costs.freightMode === "FCL") {
                  const n = Math.ceil(cbm / rates.container40Cbm);
                  const free = n * rates.container40Cbm - cbm;
                  if (free >= 10) {
                    return (
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span>
                          {L(
                            `Tu carga ocupa ${cbm.toFixed(0)} de ${n * rates.container40Cbm} m³. Te quedan ${free.toFixed(0)} m³ libres en el contenedor.`,
                            `Your cargo uses ${cbm.toFixed(0)} of ${n * rates.container40Cbm} m³. ${free.toFixed(0)} m³ remain free in the container.`,
                          )}
                        </span>
                      </li>
                    );
                  }
                }
                return null;
              })()}
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {L("Variables que pueden cambiar este escenario", "Variables that can change this scenario")}
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {scenarioVariables(costs, { priceIsMidpoint: priceInfo.isMid }).map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{v}</span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>
                  {L("Tránsito marítimo de referencia:", "Reference ocean transit:")}{" "}
                  <b>{rates.transitDays} {L("días", "days")}</b>.
                </span>
              </li>
            </ul>
            <a
              href={`https://wa.me/${SEAL_COMPANY.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                L(
                  `Hola SEAL, quiero una cotización confirmada para ${quantity.toLocaleString()} ${unitWordFor(unitInfo.unit, quantity)}${productDescription ? ` de: ${productDescription.slice(0, 200)}` : ""} (escenario estimado ${Q(costs.totalCost)}, ${formatUSD(costs.totalCost)}${costs.freightPending ? ", sin flete" : ""}).`,
                  `Hello SEAL, I'd like a confirmed quote for ${quantity.toLocaleString()} ${unitWordFor(unitInfo.unit, quantity)}${productDescription ? ` of: ${productDescription.slice(0, 200)}` : ""} (estimated scenario ${Q(costs.totalCost)}, ${formatUSD(costs.totalCost)}${costs.freightPending ? ", without freight" : ""}).`,
                ),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47] transition-colors"
            >
              <span>{L("Pedir una cotización confirmada", "Request a confirmed quote")}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Download Full Report Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() =>
              exportToPDF(costs, supplierName, quantity, price, productDescription, priceNote, reportNotes, reportDiffs)
            }
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-2xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-3 shadow-xl hover:shadow-2xl text-lg font-semibold"
          >
            <Download className="w-6 h-6" />
            {t("cost.downloadFullReport")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown instead of the scenario when the published price looks atypical. */
function PriceDecision({
  reason,
  published,
  onCustom,
  onUsePublished,
  onBack,
  unit = "",
}: {
  unit?: string;
  reason: string;
  published: string;
  onCustom: (v: number) => void;
  onUsePublished: () => void;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const value = parseFloat(text.replace(",", "."));
  const ok = value > 0 && value < 10_000_000;
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 sm:p-6 mb-8">
      <h2 className="text-lg font-semibold text-amber-900 mb-2">
        {Lx("Antes de calcular: este precio no parece utilizable", "Before calculating: this price doesn't look usable")}
      </h2>
      <p className="text-sm text-amber-900 mb-4">
        {reason}{" "}
        {Lx(
          `Calcular costos con ${published} daría un escenario engañoso. Escribe el precio unitario que te cotizaron, o vuelve y escoge otra opción.`,
          `Estimating costs with ${published} would give a misleading scenario. Enter the unit price you were quoted, or go back and choose another option.`,
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onCustom(value);
        }}
        className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4"
      >
        <label className="flex-1 text-sm text-slate-700">
          <span className="block mb-1 font-medium">{Lx(`Precio cotizado por ${unitWordFor(unit, 1)} (US$)`, `Quoted price per ${unitWordFor(unit, 1)} (US$)`)}</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder={Lx("Ej. 4500", "e.g. 4500")}
          />
        </label>
        <button
          type="submit"
          disabled={!ok}
          className="px-5 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold disabled:opacity-50"
        >
          {Lx("Calcular con este precio", "Calculate with this price")}
        </button>
      </form>
      <div className="flex flex-col sm:flex-row gap-3 text-sm">
        <button onClick={onBack} className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold bg-white">
          {Lx("Escoger otra opción", "Choose another option")}
        </button>
        <button onClick={onUsePublished} className="px-4 py-2 rounded-lg text-amber-900 underline">
          {Lx(`Usar ${published} de todos modos`, `Use ${published} anyway`)}
        </button>
      </div>
    </div>
  );
}

/** Lets the client recalculate with the price they were quoted. */
function OwnPrice({ current, onChange, unit = "" }: { current: number; onChange: (v: number) => void; unit?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current > 0 ? String(current) : "");
  const value = parseFloat(text.replace(",", "."));
  const ok = value > 0 && value < 10_000_000;
  if (!open) {
    return (
      <div className="mb-6 -mt-4 text-sm">
        <button onClick={() => setOpen(true)} className="text-blue-600 hover:underline">
          {current > 0
            ? Lx("Cambiar el precio que indicaste", "Change the price you entered")
            : Lx("¿Te cotizaron otro precio? Calcular con mi precio", "Were you quoted another price? Calculate with my price")}
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) {
          onChange(value);
          setOpen(false);
        }
      }}
      className="mb-6 -mt-4 flex flex-col sm:flex-row gap-3 sm:items-end bg-white border border-slate-200 rounded-xl p-4"
    >
      <label className="flex-1 text-sm text-slate-700">
        <span className="block mb-1 font-medium">{Lx(`Precio cotizado por ${unitWordFor(unit, 1)} (US$)`, `Quoted price per ${unitWordFor(unit, 1)} (US$)`)}</span>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {text.trim() !== "" && !ok && (
          <span role="alert" className="block mt-1 text-xs text-red-700">
            {Lx("Escribe un precio mayor a 0 (por ejemplo 12.50).", "Enter a price greater than 0 (for example 12.50).")}
          </span>
        )}
      </label>
      <button type="submit" disabled={!ok} className="px-5 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold disabled:opacity-50">
        {Lx("Recalcular", "Recalculate")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600">
        {Lx("Cancelar", "Cancel")}
      </button>
    </form>
  );
}

/** The published price is per set/box/pack: say it, and let the client say what their quantity means. */
function SaleUnitNotice({
  unit,
  packSize,
  packFromTitle,
  requested,
  mode,
  fromDescription,
  onMode,
  onPack,
  blocking = false,
  item = "",
  mixedWith = "",
  pieceCount,
  countedIn = "",
}: {
  pieceCount?: number; // the client's quantity in pieces (1,000 pares → 2,000)
  countedIn?: "pair" | "dozen" | "";
  item?: string;
  mixedWith?: string;
  unit: string;
  packSize: number;
  packFromTitle: boolean;
  requested: number;
  mode: "sets" | "pieces" | null;
  fromDescription: boolean;
  onMode: (m: "sets" | "pieces") => void;
  onPack: (n: number) => void;
  blocking?: boolean;
}) {
  const [packText, setPackText] = useState("");
  const one = unitWordFor(unit, 1);
  // the client's product word ("botellas"), so a mixed kit isn't counted by all its items
  const itemEs = item || "piezas";
  const itemEn = item || "pieces";
  const howMany = /as$/.test(itemEs) ? "Cuántas" : "Cuántos";
  const many = unitWordFor(unit, 2);
  // pairs or dozens are counted in pieces against a box of pieces
  const pieces = pieceCount && pieceCount > 0 ? pieceCount : requested;
  const countedLabel = countedIn === "pair" ? Lx("pares", "pairs") : countedIn === "dozen" ? Lx("docenas", "dozens") : "";
  const sets = packSize > 1 ? Math.ceil(pieces / packSize) : 0;
  const packValue = parseInt(packText, 10);
  const btn = (active: boolean) =>
    `px-3 py-2 rounded-lg border-2 text-left ${active ? "border-[#0B3C5D] bg-white font-semibold" : "border-amber-300 bg-amber-50/50"}`;
  return (
    <div className={`${blocking ? "mb-8" : "mb-6 -mt-2"} bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 text-sm text-amber-900`}>
      <p className="font-semibold mb-1 text-base">
        {blocking
          ? Lx("Antes de calcular: ¿tu cantidad es en piezas o en " + many + "?", "Before calculating: is your quantity in pieces or in " + many + "?")
          : Lx(`El precio publicado es por ${one}`, `The published price is per ${one}`)}
      </p>
      <p className="mb-3">
        {Lx(`Esta publicación vende por ${one}`, `This listing sells per ${one}`)}
        {unit === "pair"
          ? Lx(" (cada par son 2 piezas).", " (each pair is 2 pieces).")
          : packFromTitle
          ? Lx(
              ` y su título indica ${packSize} piezas por ${one}: usamos ese dato como supuesto, pendiente de confirmar con el proveedor.`,
              ` and its title says ${packSize} pieces per ${one}: we use it as an assumption, to be confirmed with the supplier.`,
            )
          : packSize > 1
            ? Lx(` y tú indicaste ${packSize} ${itemEs} por ${one}.`, ` and you entered ${packSize} ${itemEn} per ${one}.`)
            : mixedWith
              ? Lx(
                  `; es un set mixto (el título también menciona ${mixedWith}), así que no usamos el conteo de piezas del título: indica cuántas ${itemEs} trae cada ${one}.`,
                  `; it's a mixed set (the title also mentions ${mixedWith}), so we don't use the title's piece count: enter how many ${itemEn} each ${one} holds.`,
                )
              : Lx(`; el título no dice cuántas ${itemEs} trae cada ${one}.`, `; the title doesn't say how many ${itemEn} each ${one} holds.`)}
        {fromDescription && mode
          ? Lx(
              ` Por lo que escribiste, tomamos tu cantidad como ${mode === "pieces" ? "piezas" : many}; puedes cambiarlo.`,
              ` From what you wrote, we took your quantity as ${mode === "pieces" ? "pieces" : many}; you can change it.`,
            )
          : ""}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={() => onMode("sets")} className={btn(mode === "sets")}>
          {`${requested.toLocaleString()} ${unitWordFor(unit, requested)}`}
          {packSize > 1 && (
            <span className="block text-xs font-normal">
              {Lx(`= ${(requested * packSize).toLocaleString()} ${itemEs}`, `= ${(requested * packSize).toLocaleString()} ${itemEn}`)}
            </span>
          )}
        </button>
        <button onClick={() => onMode("pieces")} className={btn(mode === "pieces")}>
          {countedLabel
            ? `${requested.toLocaleString()} ${countedLabel} (${pieces.toLocaleString()} ${item || Lx("piezas", "pieces")})`
            : item
            ? `${requested.toLocaleString()} ${item}`
            : Lx(`${requested.toLocaleString()} ${requested === 1 ? "pieza" : "piezas"}`, `${requested.toLocaleString()} ${requested === 1 ? "piece" : "pieces"}`)}
          <span className="block text-xs font-normal">
            {packSize > 1
              ? Lx(
                  `= ${sets.toLocaleString()} ${unitWordFor(unit, sets)} (${(sets * packSize).toLocaleString()} ${itemEs})`,
                  `= ${sets.toLocaleString()} ${unitWordFor(unit, sets)} (${(sets * packSize).toLocaleString()} ${itemEn})`,
                )
              : Lx(`necesitamos saber cuántas ${itemEs} trae cada ${one}`, `we need to know how many ${itemEn} each ${one} holds`)}
          </span>
        </button>
      </div>
      {mode === "pieces" && !packFromTitle && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (packValue > 1 && packValue <= 100000) onPack(packValue);
          }}
          className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <label className="flex-1">
            <span className="block mb-1 font-medium">
              {item || mixedWith
                ? Lx(
                    `¿${howMany} ${itemEs} contiene cada ${one}? No incluyas ${mixedWith ? `${mixedWith} ni otros accesorios` : "accesorios ni otros artículos"}.`,
                    `How many ${itemEn} does each ${one} contain? Don't count ${mixedWith ? `${mixedWith} or other accessories` : "accessories or other items"}.`,
                  )
                : Lx(`Piezas por ${one} (según el proveedor)`, `Pieces per ${one} (per the supplier)`)}
            </span>
            <input
              type="number"
              min="2"
              inputMode="numeric"
              value={packText}
              onChange={(e) => setPackText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={Lx("Ej. 12", "e.g. 12")}
            />
          </label>
          <button type="submit" disabled={!(packValue > 1)} className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white font-semibold disabled:opacity-50">
            {Lx("Calcular", "Calculate")}
          </button>
        </form>
      )}
      <p className="text-xs mt-3">
        {Lx(
          "El contenido se lee del título o lo indicas tú: confírmalo con el proveedor antes de comprar, porque cambia el costo por pieza.",
          "The content comes from the title or from you: confirm it with the supplier before buying, as it changes the cost per piece.",
        )}
      </p>
    </div>
  );
}
