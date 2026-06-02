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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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

// ─── Constants ────────────────────────────────────────────────────────────────
const DUTY_RATES: Record<string, number> = {
  furniture: 0.15,
  electronics: 0.15,
  textiles: 0.15,
  machinery: 0.15,
  other: 0.15,
};
const SHIPPING_COSTS: Record<string, number> = {
  US: 4200,
  GT: 3800,
  MX: 3500,
  CA: 4800,
  other: 5000,
};
const VAT_RATE = 0.12;
const INSURANCE_RATE = 0.01;

// ─── Calculate all costs ──────────────────────────────────────────────────────
function calculateCosts(
  price: number,
  quantity: number,
  destination: string,
  productType: string,
) {
  const productCost = Math.round(price * quantity);
  const shipping = SHIPPING_COSTS[destination] || 4200;
  const dutyRate = DUTY_RATES[productType] || 0.15;
  const importDuties = Math.round(productCost * dutyRate);
  const taxes = Math.round((productCost + importDuties) * VAT_RATE);
  const insurance = Math.round(productCost * INSURANCE_RATE);
  const totalCost = productCost + shipping + importDuties + taxes + insurance;
  return {
    productCost,
    shipping,
    importDuties,
    taxes,
    insurance,
    totalCost,
    perUnit: parseFloat((totalCost / quantity).toFixed(2)),
    dutyRate,
  };
}

// ─── PDF Export (with company info) ───────────────────────────────────────────
function exportToPDF(
  costs: ReturnType<typeof calculateCosts>,
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
    body: [
      [
        "Costo de Producto",
        `${quantity.toLocaleString()} unidades × $${Number(price).toFixed(2)}`,
        `$${costs.productCost.toLocaleString()}`,
        `${((costs.productCost / costs.totalCost) * 100).toFixed(1)}%`,
      ],
      [
        "Flete Marítimo",
        `Envío a ${destination} (~25 días)`,
        `$${costs.shipping.toLocaleString()}`,
        `${((costs.shipping / costs.totalCost) * 100).toFixed(1)}%`,
      ],
      [
        "Aranceles de Importación",
        `Tasa ${(costs.dutyRate * 100).toFixed(0)}% para ${productType}`,
        `$${costs.importDuties.toLocaleString()}`,
        `${((costs.importDuties / costs.totalCost) * 100).toFixed(1)}%`,
      ],
      [
        "IVA & Impuestos",
        `IVA ${(VAT_RATE * 100).toFixed(0)}% sobre producto + aranceles`,
        `$${costs.taxes.toLocaleString()}`,
        `${((costs.taxes / costs.totalCost) * 100).toFixed(1)}%`,
      ],
      [
        "Seguro de Carga",
        `Cobertura completa (${(INSURANCE_RATE * 100).toFixed(0)}% del valor)`,
        `$${costs.insurance.toLocaleString()}`,
        `${((costs.insurance / costs.totalCost) * 100).toFixed(1)}%`,
      ],
    ],
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

  // Company footer (NEW)
  drawCompanyFooter(doc);

  doc.save(
    `SEAL_CostBreakdown_${supplierName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
  );
}

// ─── Excel Export (NEW: Beautiful XLSX) ───────────────────────────────────────
async function exportToExcel(
  costs: ReturnType<typeof calculateCosts>,
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
    vatRate: VAT_RATE,
    insuranceRate: INSURANCE_RATE,
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
  const stateBudget = location.state?.budget ?? "50000";
  const stateDestination = location.state?.destination ?? "US";
  const stateProductType = location.state?.productType ?? "furniture";

  const quantity = parseInt(String(stateQuantity)) || 1000;
  const budget = parseFloat(String(stateBudget)) || 50000;
  const destination = String(stateDestination);
  const productType = String(stateProductType);

  const price = stateSupplier?.price > 0 ? stateSupplier.price : 38.75;
  const supplierName = stateSupplier?.name || "Selected Supplier";
  const isLiveData = !!stateSupplier;

  const costs = calculateCosts(price, quantity, destination, productType);

  // ── Chart data ────────────────────────────────────────────────────────────
  const costData = [
    { name: "Product Cost", value: costs.productCost, color: "#0B3C5D" },
    { name: "Shipping", value: costs.shipping, color: "#3B82F6" },
    { name: "Import Duties", value: costs.importDuties, color: "#60A5FA" },
    { name: "Taxes", value: costs.taxes, color: "#93C5FD" },
    { name: "Insurance", value: costs.insurance, color: "#BFDBFE" },
  ];

  const comparisonData = [
    { supplier: supplierName.split(" ")[0], total: costs.totalCost },
    { supplier: "Avg Market", total: Math.round(costs.totalCost * 1.14) },
    { supplier: "Budget Alt", total: Math.round(costs.totalCost * 0.92) },
    { supplier: "Premium Alt", total: Math.round(costs.totalCost * 1.2) },
  ];

  const breakdownRows = [
    {
      icon: DollarSign,
      labelKey: "cost.productCost",
      amount: costs.productCost,
      details: `${quantity.toLocaleString()} ${t("cost.units")} × $${Number(price).toFixed(2)} ${t("cost.perUnitLabel")}`,
      color: "blue",
      displayPercent: `${((costs.productCost / costs.totalCost) * 100).toFixed(1)}%`,
    },
    {
      icon: Ship,
      labelKey: "cost.oceanFreight",
      amount: costs.shipping,
      details: `Envío estimado a ${destination} • ~25 días de tránsito`,
      color: "cyan",
      displayPercent: `${((costs.shipping / costs.totalCost) * 100).toFixed(1)}%`,
    },
    {
      icon: FileText,
      labelKey: "cost.importDuties",
      amount: costs.importDuties,
      details: `Tasa arancelaria ${(costs.dutyRate * 100).toFixed(0)}% para ${productType}`,
      color: "purple",
      displayPercent: `${(costs.dutyRate * 100).toFixed(0)}%`, // ✅ shows duty rate (e.g., 15%)
    },
    {
      icon: TrendingUp,
      labelKey: "cost.vatTaxes",
      amount: costs.taxes,
      details: `IVA ${(VAT_RATE * 100).toFixed(0)}% sobre producto + aranceles`,
      color: "green",
      displayPercent: "12%", // ✅ FIXED at 12% — what the CEO wants
    },
    {
      icon: AlertCircle,
      labelKey: "cost.insurance",
      amount: costs.insurance,
      details: `Seguro de carga • Cobertura completa • ${(INSURANCE_RATE * 100).toFixed(0)}% del valor`,
      color: "orange",
      displayPercent: "1%", // ✅ FIXED at 1% — what the CEO wants
    },
  ];

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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  dataKey="value"
                >
                  {costData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-[#0B3C5D] mb-6">
              {t("cost.supplierComparison")}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <XAxis dataKey="supplier" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Bar
                  dataKey="total"
                  fill="#0B3C5D"
                  name="Total Landed Cost"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
                    {t(item.labelKey)}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">
                    {item.details}
                  </div>
                </div>
              </div>
              <div className="text-right sm:text-right ml-13 sm:ml-0 flex-shrink-0">
                <div className="text-xl sm:text-2xl font-bold text-[#0B3C5D]">
                  ${item.amount.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-slate-600">
                  {item.displayPercent}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t("cost.savingsTitle")}
            </h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>{t("cost.saving1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>
                  {t("cost.unitPrice")} ${costs.perUnit} {t("cost.is")}{" "}
                  {costs.perUnit < budget / quantity
                    ? t("cost.lower")
                    : t("cost.higher")}{" "}
                  {t("cost.than")} ${(budget / quantity).toFixed(2)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>{t("cost.saving3")}</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t("cost.considerationsTitle")}
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>{t("cost.consideration1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>{t("cost.consideration2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>{t("cost.consideration3")}</span>
              </li>
            </ul>
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
