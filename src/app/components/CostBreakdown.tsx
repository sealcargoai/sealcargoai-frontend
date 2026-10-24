import { useNavigate, useLocation } from "react-router";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import {
  SEAL_COMPANY,
  drawCompanyInfoBox,
  drawCompanyFooter,
  generateBeautifulExcel,
} from "../../utils/reportExports";
import {
  calculateCosts,
  useRates,
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
  destination: string,
  productType: string,
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Main header
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SEAL SmartTrade AI", 14, 16);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Análisis de Costos de Importación", 14, 26);
  doc.text(`Generado: ${now}`, 14, 34);

  // Company info bar (NEW)
  const yAfterCompany = drawCompanyInfoBox(doc, pageWidth, 40);

  // Order details box
  doc.setTextColor(11, 60, 93);
  doc.setFillColor(239, 246, 255);
  doc.rect(14, yAfterCompany + 6, pageWidth - 28, 28, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLES DEL PEDIDO", 18, yAfterCompany + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Proveedor: ${supplierName}`, 18, yAfterCompany + 24);
  doc.text(
    `Producto: ${productType}  |  Destino: ${destination}`,
    18,
    yAfterCompany + 30,
  );
  doc.text(
    `Cantidad: ${quantity.toLocaleString()} unidades`,
    100,
    yAfterCompany + 24,
  );
  doc.text(
    `Precio unitario: $${Number(price).toFixed(2)}`,
    100,
    yAfterCompany + 30,
  );

  // Section title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(11, 60, 93);
  doc.text("Desglose de Costos", 14, yAfterCompany + 48);

  // Cost table
  autoTable(doc, {
    startY: yAfterCompany + 53,
    head: [["Concepto", "Detalle", "Monto (USD)", "% del Total"]],
    body: costs.lines.map((l) => [
      l.label,
      l.detail,
      `$${l.amount.toLocaleString()}`,
      `${((l.amount / costs.totalCost) * 100).toFixed(1)}%`,
    ]),
    foot: [
      [
        "COSTO TOTAL LANDED",
        `${quantity.toLocaleString()} unidades`,
        `$${costs.totalCost.toLocaleString()}`,
        "100%",
      ],
    ],
    headStyles: { fillColor: [11, 60, 93], textColor: 255, fontStyle: "bold" },
    footStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    styles: { fontSize: 9 },
  });

  // Per unit summary bar
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(11, 60, 93);
  doc.rect(14, finalY, pageWidth - 28, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Costo por Unidad: $${costs.perUnit}  |  Total: $${costs.totalCost.toLocaleString()}`,
    pageWidth / 2,
    finalY + 11,
    { align: "center" },
  );

  // Footnotes
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(costs.noVatNote, 14, finalY + 26);
  if (costs.freightPending) {
    doc.text(
      "Flete por cotizar: el total no incluye flete. Un ejecutivo de SEAL le enviará la tarifa.",
      14,
      finalY + 31,
    );
  }

  // Company footer (NEW)
  drawCompanyFooter(doc);

  doc.save(
    `SEAL_CostBreakdown_${supplierName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
  );
}

// ─── Excel Export (NEW: Beautiful XLSX) ───────────────────────────────────────
async function exportToExcel(
  costs: Costs,
  supplierName: string,
  quantity: number,
  price: number,
  destination: string,
  productType: string,
) {
  await generateBeautifulExcel({
    reportTitle: "Análisis de Costos de Importación",
    supplierName,
    productType,
    destination,
    quantity,
    price,
    costs,
    vatRate: costs.vatRate,
    insuranceRate: costs.insuranceRate,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CostBreakdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // ── Read state ────────────────────────────────────────────────────────────
  const stateSupplier = location.state?.supplier ?? null;
  const stateQuantity = location.state?.quantity ?? "1000";
  const stateBudget = location.state?.budget ?? "";
  const stateDestination = location.state?.destination ?? "US";
  const stateProductType = location.state?.productType ?? "furniture";

  const quantity = parseInt(String(stateQuantity)) || 1000;
  // 0 = the client didn't give a budget (never invent one)
  const budget = parseFloat(String(stateBudget)) || 0;
  const destination = String(stateDestination);
  const productType = String(stateProductType);

  const price = stateSupplier?.price > 0 ? stateSupplier.price : 38.75;
  const supplierName = stateSupplier?.name || "Selected Supplier";
  const isLiveData = !!stateSupplier;

  const volumeCbm = parseFloat(String(location.state?.volumeCbm ?? "")) || 0;
  const weightKg = parseFloat(String(location.state?.weightKg ?? "")) || 0;
  const rates = useRates();
  const costs = calculateCosts({ price, quantity, volumeCbm, weightKg }, rates);

  // ── Chart data ────────────────────────────────────────────────────────────
  const costData = costs.lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ name: l.label.replace("*", ""), value: l.amount, color: l.color }));

  // "¿En qué se va su dinero?": the real calculator lines grouped in 4 blocks
  const sumKeys = (keys: string[]) =>
    costs.lines.filter((l) => keys.includes(l.key)).reduce((a, l) => a + l.amount, 0);
  const moneyGroups = [
    { key: "product", name: "Producto (FOB)", desc: "Lo que le paga al proveedor", amount: sumKeys(["product"]), color: "#0B3C5D" },
    { key: "logistics", name: "Traerlo a Guatemala", desc: "Flete, seguro y gastos en destino", amount: sumKeys(["freight", "insurance", "local"]), color: "#3B82F6" },
    { key: "taxes", name: "Impuestos SAT", desc: "DAI e IVA de importación", amount: sumKeys(["duties", "vat"]), color: "#60A5FA" },
    { key: "seal", name: "Servicio de aduana SEAL", desc: "Honorarios del agente aduanero", amount: sumKeys(["customs"]), color: "#8B5CF6" },
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
    displayPercent: `${((l.amount / costs.totalCost) * 100).toFixed(1)}%`,
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
          <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible lg:justify-end pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 w-full">
            <button
              onClick={() => navigate(-1)}
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              {t("cost.backToSuppliers")}
            </button>
            <button
              onClick={() =>
                exportToPDF(
                  costs,
                  supplierName,
                  quantity,
                  price,
                  destination,
                  productType,
                )
              }
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-red-300 text-red-700 rounded-xl hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm hover:shadow-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t("cost.exportPDF")}</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={() =>
                exportToExcel(
                  costs,
                  supplierName,
                  quantity,
                  price,
                  destination,
                  productType,
                )
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
                    quantity: stateQuantity,
                    budget: stateBudget,
                    destination: stateDestination,
                    productType: stateProductType,
                    volumeCbm: location.state?.volumeCbm,
                    weightKg: location.state?.weightKg,
                    productDescription: location.state?.productDescription,
                  },
                })
              }
              className="px-3 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              <span className="hidden sm:inline">
                {t("cost.riskAssessment")}
              </span>
              <span className="sm:hidden">Riesgos</span>
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
                {t("cost.units")} × ${Number(price).toFixed(2)} →{" "}
                {t("cost.destination")} {destination}
              </span>
            ) : (
              <span className="text-yellow-600">⚠️ {t("cost.demoCalc")}</span>
            )}
          </p>
        </div>

        {/* Total Cost Hero */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-[#0B3C5D] to-purple-700 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 md:p-10 mb-8 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-blue-100 mb-2 sm:mb-3 text-sm sm:text-lg">
                {t("cost.totalLandedCost")}
              </div>
              <div className="text-3xl sm:text-5xl md:text-6xl font-bold drop-shadow-lg mb-2 sm:mb-3 break-all">
                ${costs.totalCost.toLocaleString()}
              </div>
              <div className="text-blue-100 text-xs sm:text-base md:text-lg">
                {quantity.toLocaleString()} {t("cost.units")} •{" "}
                <span className="font-bold text-white">
                  ${costs.perUnit} {t("cost.perUnitLabel")}
                </span>
              </div>
            </div>
            <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl flex-shrink-0">
              <DollarSign className="w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
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
                      `$${Math.round(value).toLocaleString()}`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-lg font-bold text-[#0B3C5D]">
                  ${costs.totalCost.toLocaleString()}
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
                    <span className="text-slate-500 tabular-nums w-12 text-right">
                      {pct < 1 ? "<1" : Math.round(pct)}%
                    </span>
                    <span className="font-medium text-slate-800 tabular-nums w-20 text-right">
                      ${Math.round(d.value).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
            {costs.freightPending && (
              <p className="text-xs text-slate-500 mt-3">
                El flete marítimo no está incluido: se cotiza con el volumen o peso de su carga.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-[#0B3C5D] mb-1">
              ¿En qué se va su dinero?
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              De cada US$100 que invierte en esta importación
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
                          {pendingFreight ? " (flete por cotizar)" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-800">
                          US${share}
                        </p>
                        <p className="text-xs text-slate-500">
                          ${g.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
                Por cada unidad, además del precio de fábrica
                {costs.freightPending ? " (sin flete)" : ""}
              </p>
              <p className="text-base font-bold text-[#0B3C5D]">
                +${Math.max(costs.perUnit - price, 0).toFixed(2)}
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
                  {item.pending ? "Por cotizar" : `$${item.amount.toLocaleString()}`}
                </div>
                <div className="text-xs sm:text-sm text-slate-600">
                  {item.displayPercent}
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 px-1">{costs.noVatNote}</p>
          {costs.freightPending && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ El total no incluye flete porque no indicó volumen ni peso. Un
              ejecutivo de SEAL le cotiza el flete exacto, o puede volver a la
              calificación y agregar el volumen (m³) o peso (kg).
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Resumen de su importación
            </h3>
            <ul className="space-y-2 text-sm text-green-800">
              {budget > 0 ? (
                (() => {
                  const budgetPerUnit = budget / quantity;
                  const diff = Math.abs(budgetPerUnit - costs.perUnit);
                  const fits = costs.perUnit <= budgetPerUnit;
                  return (
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>
                        Cada unidad le sale en{" "}
                        <b>${costs.perUnit.toFixed(2)}</b> puesta en Guatemala,
                        con todo incluido. Su presupuesto es de{" "}
                        <b>${budgetPerUnit.toFixed(2)}</b> por unidad
                        {fits ? (
                          <>
                            : <b>le alcanza</b> y le sobran ${diff.toFixed(2)} por
                            unidad (${Math.round(diff * quantity).toLocaleString()} en
                            total).
                          </>
                        ) : (
                          <>
                            : <b>no le alcanza</b>, le faltan ${diff.toFixed(2)} por
                            unidad (${Math.round(diff * quantity).toLocaleString()} en
                            total).
                          </>
                        )}
                      </span>
                    </li>
                  );
                })()
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>
                    Cada unidad le sale en <b>${costs.perUnit.toFixed(2)}</b>{" "}
                    puesta en Guatemala, con todo incluido.
                  </span>
                </li>
              )}
              {/* Taxes share */}
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>
                  DAI e IVA suman{" "}
                  <b>${(costs.importDuties + costs.taxes).toLocaleString()}</b>, el{" "}
                  <b>
                    {(((costs.importDuties + costs.taxes) / costs.totalCost) * 100).toFixed(0)}%
                  </b>{" "}
                  del costo total.
                </span>
              </li>
              {/* Freight tip — only when it is useful */}
              {(() => {
                const cbm = costs.chargeableCbm;
                if (costs.freightMode === "LCL" && cbm >= rates.lclMaxCbm * 0.75) {
                  return (
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>
                        Con {cbm.toFixed(1)} m³ está cerca de llenar un contenedor. A
                        partir de {rates.lclMaxCbm} m³ le cotizamos contenedor
                        completo.
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
                          Su carga ocupa {cbm.toFixed(0)} de{" "}
                          {n * rates.container40Cbm} m³. Puede aprovechar los{" "}
                          {free.toFixed(0)} m³ que le quedan libres en el
                          contenedor.
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
              Próximos pasos con SEAL
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>
                  Tránsito marítimo estimado: <b>{rates.transitDays} días</b>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>
                  Este cálculo usa un DAI del {(rates.dutyRate * 100).toFixed(0)}% (el
                  más alto). Si nos confirma la partida arancelaria, el costo puede
                  bajar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>
                  Un ejecutivo de SEAL le confirma este costo de nacionalización antes
                  del embarque.
                </span>
              </li>
            </ul>
            <a
              href={`https://wa.me/${SEAL_COMPANY.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hola SEAL, quiero confirmar el costo de importación de ${quantity.toLocaleString()} unidades (total estimado US$${costs.totalCost.toLocaleString()}).`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47] transition-colors"
            >
              Hablar con un ejecutivo
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Download Full Report Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() =>
              exportToPDF(
                costs,
                supplierName,
                quantity,
                price,
                destination,
                productType,
              )
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
