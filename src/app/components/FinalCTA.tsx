import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Download,
  FileText,
  Mail,
  Phone,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  TrendingUp,
  Target,
  X,
} from "lucide-react";
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

// ─── PDF Generation (with company info) ──────────────────────────────────────
function generateReportPDF(data: {
  supplierName: string;
  quantity: number;
  price: number;
  destination: string;
  productType: string;
  riskScore: number;
  costs: ReturnType<typeof calculateCosts>;
  reportId: string;
  saveFile?: boolean;
}): string {
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
  doc.text("Informe Completo de Análisis de Importación", 14, 26);
  doc.text(`Generado: ${now}  |  ID: ${data.reportId}`, 14, 34);

  // Company info bar (NEW)
  const yAfterCompany = drawCompanyInfoBox(doc, pageWidth, 40);

  // Executive summary
  doc.setTextColor(11, 60, 93);
  doc.setFillColor(239, 246, 255);
  doc.rect(14, yAfterCompany + 6, pageWidth - 28, 32, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN EJECUTIVO", 18, yAfterCompany + 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Mejor Proveedor:  ${data.supplierName}`, 18, yAfterCompany + 24);
  doc.text(
    `Producto: ${data.productType}  |  Destino: ${data.destination}`,
    18,
    yAfterCompany + 30,
  );
  doc.text(
    `Cantidad: ${data.quantity.toLocaleString()} uds  |  Precio: $${Number(data.price).toFixed(2)}/u`,
    18,
    yAfterCompany + 36,
  );

  // Cost section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Desglose de Costos", 14, yAfterCompany + 50);

  autoTable(doc, {
    startY: yAfterCompany + 54,
    head: [["Concepto", "Detalle", "Monto (USD)"]],
    body: [
      [
        "Costo de Producto",
        `${data.quantity.toLocaleString()} × $${Number(data.price).toFixed(2)}`,
        `$${data.costs.productCost.toLocaleString()}`,
      ],
      [
        "Flete Marítimo",
        `Envío a ${data.destination}`,
        `$${data.costs.shipping.toLocaleString()}`,
      ],
      [
        "Aranceles de Importación",
        `${(data.costs.dutyRate * 100).toFixed(0)}% para ${data.productType}`,
        `$${data.costs.importDuties.toLocaleString()}`,
      ],
      [
        "IVA & Impuestos",
        `IVA ${(VAT_RATE * 100).toFixed(0)}%`,
        `$${data.costs.taxes.toLocaleString()}`,
      ],
      [
        "Seguro de Carga",
        `${(INSURANCE_RATE * 100).toFixed(0)}% del valor`,
        `$${data.costs.insurance.toLocaleString()}`,
      ],
    ],
    foot: [
      [
        "COSTO TOTAL LANDED",
        `${data.quantity.toLocaleString()} unidades`,
        `$${data.costs.totalCost.toLocaleString()}`,
      ],
    ],
    headStyles: { fillColor: [11, 60, 93], textColor: 255 },
    footStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    styles: { fontSize: 9 },
  });

  // Risk section
  const finalY1 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(11, 60, 93);
  doc.text("Evaluación de Riesgos", 14, finalY1);

  const riskLevel =
    data.riskScore < 40 ? "BAJO" : data.riskScore < 70 ? "MEDIO" : "ALTO";
  const riskColor: [number, number, number] =
    data.riskScore < 40
      ? [34, 197, 94]
      : data.riskScore < 70
        ? [234, 179, 8]
        : [239, 68, 68];

  doc.setFillColor(...riskColor);
  doc.rect(14, finalY1 + 4, pageWidth - 28, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Nivel de Riesgo: ${riskLevel}  (${data.riskScore}/100)`,
    pageWidth / 2,
    finalY1 + 17,
    { align: "center" },
  );

  // Per unit summary
  const finalY2 = finalY1 + 36;
  doc.setFillColor(11, 60, 93);
  doc.rect(14, finalY2, pageWidth - 28, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Costo por Unidad: $${data.costs.perUnit}  |  Total: $${data.costs.totalCost.toLocaleString()}`,
    pageWidth / 2,
    finalY2 + 11,
    { align: "center" },
  );

  // Company footer (NEW)
  drawCompanyFooter(doc);

  if (data.saveFile) {
    doc.save(
      `SEAL_FullReport_${data.supplierName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    );
  }

  return doc.output("datauristring").split(",")[1];
}

// ─── Excel Export (NEW: Beautiful XLSX) ───────────────────────────────────────
async function exportToExcel(data: {
  supplierName: string;
  quantity: number;
  price: number;
  destination: string;
  productType: string;
  costs: ReturnType<typeof calculateCosts>;
}) {
  await generateBeautifulExcel({
    reportTitle: "Informe Completo de Análisis",
    supplierName: data.supplierName,
    productType: data.productType,
    destination: data.destination,
    quantity: data.quantity,
    price: data.price,
    costs: data.costs,
    vatRate: VAT_RATE,
    insuranceRate: INSURANCE_RATE,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FinalCTA() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // ── Read state ────────────────────────────────────────────────────────────
  const stateSupplier = location.state?.supplier ?? null;
  const stateQuantity = location.state?.quantity ?? "1000";
  const stateBudget = location.state?.budget ?? "50000";
  const stateDestination = location.state?.destination ?? "US";
  const stateProductType = location.state?.productType ?? "furniture";
  const stateRiskScore = location.state?.riskScore ?? 32;
  const stateSuppliersData = location.state?.suppliersData ?? null;

  const quantity = parseInt(String(stateQuantity)) || 1000;
  const destination = String(stateDestination);
  const productType = String(stateProductType);

  const price = stateSupplier?.price > 0 ? stateSupplier.price : 38.75;
  const supplierName = stateSupplier?.name || "Proveedor Seleccionado";
  const isLiveData = !!stateSupplier;

  const costs = calculateCosts(price, quantity, destination, productType);

  // ── Dynamic stats ─────────────────────────────────────────────────────────
  const leadStats = {
    totalAnalyzed: stateSuppliersData?.totalCount ?? 15,
    filtered: stateSuppliersData?.filteredOutCount ?? 5,
    qualified: stateSuppliersData?.qualifiedCount ?? 9,
    topPicks: 3,
  };

  // ── Risk display ──────────────────────────────────────────────────────────
  const riskLevel =
    stateRiskScore < 40
      ? t("risk.low")
      : stateRiskScore < 70
        ? t("risk.medium")
        : t("risk.high");
  const riskColor =
    stateRiskScore < 40
      ? "text-green-600"
      : stateRiskScore < 70
        ? "text-yellow-600"
        : "text-red-600";

  // ── Modal state ───────────────────────────────────────────────────────────
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Quote form
  const [quoteName, setQuoteName] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteCompany, setQuoteCompany] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  // Email form
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailRecipientName, setEmailRecipientName] = useState("");

  const reportId = `SEAL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

  const reportSections = [
    { name: t("final.section1"), pages: 2 },
    {
      name: `${t("final.section2Prefix")} (${leadStats.qualified} ${t("final.section2Suffix")})`,
      pages: 8,
    },
    { name: t("final.section3"), pages: 4 },
    { name: t("final.section4"), pages: 6 },
    { name: t("final.section5"), pages: 3 },
    { name: t("final.section6"), pages: 2 },
  ];

  // ── Action: Download Full Report ──────────────────────────────────────────
  const handleDownloadReport = () => {
    generateReportPDF({
      supplierName,
      quantity,
      price,
      destination,
      productType,
      riskScore: stateRiskScore,
      costs,
      reportId,
      saveFile: true,
    });
  };

  // ── Action: Excel Export ──────────────────────────────────────────────────
  const handleExcelExport = async () => {
    await exportToExcel({
      supplierName,
      quantity,
      price,
      destination,
      productType,
      costs,
    });
  };

  // ── Action: Schedule Call ─────────────────────────────────────────────────
  const handleScheduleCall = () => {
    window.location.href = `tel:${SEAL_COMPANY.phone.replace(/\s+/g, "")}`;
  };

  // ── Action: Submit Quote Request ──────────────────────────────────────────
  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/email/quote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: quoteName,
            email: quoteEmail,
            phone: quotePhone,
            company: quoteCompany,
            message: quoteMessage,
            supplierName,
            totalCost: costs.totalCost,
            productType,
            quantity,
            destination,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      alert(t("final.quoteSuccess"));
      setShowQuoteModal(false);
      setQuoteName("");
      setQuoteEmail("");
      setQuotePhone("");
      setQuoteCompany("");
      setQuoteMessage("");
    } catch (err) {
      alert(t("final.quoteError"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Action: Email Report ──────────────────────────────────────────────────
  const handleEmailReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const pdfBase64 = generateReportPDF({
        supplierName,
        quantity,
        price,
        destination,
        productType,
        riskScore: stateRiskScore,
        costs,
        reportId,
        saveFile: false,
      });

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/email/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: emailRecipient,
            recipientName: emailRecipientName,
            pdfBase64,
            supplierName,
            totalCost: costs.totalCost,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      alert(t("final.emailSuccess"));
      setShowEmailModal(false);
      setEmailRecipient("");
      setEmailRecipientName("");
    } catch (err) {
      alert(t("final.emailError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        {/* Decreased py-3 to py-1.5 and sm:py-4 to sm:py-2 to shrink the header height */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Reduced desktop height from md:h-[85px] to md:h-[65px] and sm:h-16 to sm:h-14 so the logo doesn't stretch the navbar */}
            <img
              src={logo}
              alt="SEAL"
              className="h-12 sm:h-14 md:h-[65px] flex-shrink-0"
            />
            <span className="text-sm sm:text-xl font-bold text-[#0B3C5D] hidden xs:block truncate">
              {" "}
              SmartTrade AI{" "}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => navigate("/")}
              className="px-3 sm:px-5 py-2 sm:py-2.5 border-2 border-[#0B3C5D] text-[#0B3C5D] rounded-xl hover:bg-[#0B3C5D] hover:text-white transition-all font-medium shadow-sm hover:shadow-md text-xs sm:text-sm whitespace-nowrap"
            >
              {t("final.startNew")}
            </button>
            <LanguageToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        {/* Success */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <p className="text-xs mt-2">
            {t("final.analyzed")} {leadStats.totalAnalyzed}{" "}
            {t("final.suppliers")} {leadStats.qualified}{" "}
            {t("final.qualifiedLeads")}
          </p>
          <p className="text-xs mt-2">
            {isLiveData ? (
              <span className="text-green-600 font-medium">
                ✅ {t("final.basedOnReal")} {supplierName}
              </span>
            ) : (
              <span className="text-yellow-600 font-medium">
                ⚠️ {t("final.demoData")}
              </span>
            )}
          </p>
        </div>

        {/* Dynamic Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#0B3C5D] mb-1">
              {leadStats.totalAnalyzed}
            </div>
            <div className="text-sm text-slate-600">
              {t("final.suppliersAnalyzed")}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <Target className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-red-600 mb-1">
              {leadStats.filtered}
            </div>
            <div className="text-sm text-slate-600">
              {t("final.filteredOut")}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-600 mb-1">
              {leadStats.qualified}
            </div>
            <div className="text-sm text-slate-600">{t("final.qualified")}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {leadStats.topPicks}
            </div>
            <div className="text-sm text-slate-600">{t("final.topPicks")}</div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0B3C5D] mb-2">
                {t("final.reportTitle")}
              </h2>
              <p className="text-slate-600">{t("final.reportSubtitle")}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 mb-1">
                {t("final.reportID")}
              </div>
              <div className="font-mono text-[#0B3C5D] font-semibold">
                #{reportId}
              </div>
            </div>
          </div>

          {/* Dynamic Key Findings */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="text-sm text-blue-700 mb-2">
                {t("final.bestSupplier")}
              </div>
              <div className="font-bold text-xl text-[#0B3C5D] mb-1 truncate">
                {supplierName.split(" ").slice(0, 2).join(" ")}
              </div>
              <div className="flex items-center gap-1 text-sm text-blue-700">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {stateSupplier?.rating ?? 4.9} •{" "}
                {stateSupplier?.verified
                  ? t("final.verified")
                  : t("final.standard")}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="text-sm text-green-700 mb-2">
                {t("final.totalCost")}
              </div>
              <div className="font-bold text-xl text-[#0B3C5D] mb-1">
                ${costs.totalCost.toLocaleString()}
              </div>
              <div className="text-sm text-green-700">
                ${costs.perUnit} {t("final.perUnit")}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="text-sm text-purple-700 mb-2">
                {t("final.riskLevel")}
              </div>
              <div className={`font-bold text-xl ${riskColor} mb-1`}>
                {riskLevel}
              </div>
              <div className="text-sm text-purple-700">
                {stateRiskScore}/100 {t("final.riskScore")}
              </div>
            </div>
          </div>

          {/* Report Sections */}
          <div className="mb-8">
            <h3 className="font-semibold text-[#0B3C5D] mb-4">
              {t("final.reportContents")}
            </h3>
            <div className="space-y-2">
              {reportSections.map((section, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-slate-700">
                      {section.name}
                    </span>
                  </div>
                  <span className="text-sm text-slate-600">
                    {section.pages} {t("final.pages")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Single Download Button */}
          <button
            onClick={handleDownloadReport}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center justify-center gap-3 font-semibold shadow-lg hover:shadow-xl"
          >
            <Download className="w-5 h-5" />
            {t("final.downloadReport")}
          </button>
        </div>

        {/* SEAL Service CTA */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0B3C5D] via-blue-900 to-purple-900 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-10 text-white mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">
                {t("final.sealTitle")}
              </h2>
              <p className="text-sm sm:text-base md:text-xl text-blue-100 max-w-2xl mx-auto">
                {t("final.sealSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {[
                {
                  titleKey: "final.negotiation",
                  descKey: "final.negotiationDesc",
                  icon: "💰",
                },
                {
                  titleKey: "final.qualityControl",
                  descKey: "final.qualityControlDesc",
                  icon: "✓",
                },
                {
                  titleKey: "final.fullLogistics",
                  descKey: "final.fullLogisticsDesc",
                  icon: "🚢",
                },
              ].map((service, i) => (
                <div
                  key={i}
                  className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/30 hover:bg-white/20 transition-all shadow-xl"
                >
                  <div className="text-3xl mb-3">{service.icon}</div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t(service.titleKey)}
                  </h3>
                  <p className="text-sm text-blue-100">{t(service.descKey)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowQuoteModal(true)}
                className="flex-1 py-4 bg-white text-[#0B3C5D] rounded-xl hover:bg-blue-50 transition-all font-semibold flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:scale-105"
              >
                <Mail className="w-5 h-5" />
                {t("final.requestQuote")}
              </button>
              <button
                onClick={handleScheduleCall}
                className="flex-1 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-xl hover:bg-white/30 transition-all font-semibold flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:scale-105"
              >
                <Phone className="w-5 h-5" />
                {t("final.scheduleCall")}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-[#0B3C5D] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t("final.exportTitle")}
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleExcelExport}
                className="w-full py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t("final.downloadExcel")}
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="w-full py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {t("final.emailReport")}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-[#0B3C5D] mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              {t("final.nextSteps")}
            </h3>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{t("final.step1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{t("final.step2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{t("final.step3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{t("final.step4")}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Start Over */}
        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 border-2 border-[#0B3C5D] text-[#0B3C5D] rounded-lg hover:bg-[#0B3C5D] hover:text-white transition-all"
          >
            {t("final.startNew")}
          </button>
        </div>
      </div>

      {/* ── Quote Request Modal ─────────────────────────────────────────────── */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#0B3C5D]">
                {t("final.quoteModalTitle")}
              </h2>
              <button
                onClick={() => setShowQuoteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm">
              <p className="font-semibold text-[#0B3C5D]">{supplierName}</p>
              <p className="text-slate-600 mt-1">
                {quantity.toLocaleString()} {t("final.quoteUnits")} $
                {costs.totalCost.toLocaleString()}
              </p>
            </div>

            <form onSubmit={handleQuoteSubmit} className="space-y-4">
              <input
                type="text"
                required
                placeholder={t("final.quoteFullName")}
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                required
                placeholder={t("final.quoteEmail")}
                value={quoteEmail}
                onChange={(e) => setQuoteEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="tel"
                placeholder={t("final.quotePhone")}
                value={quotePhone}
                onChange={(e) => setQuotePhone(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder={t("final.quoteCompany")}
                value={quoteCompany}
                onChange={(e) => setQuoteCompany(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder={t("final.quoteMessage")}
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-lg hover:from-blue-700 hover:to-[#0a2f47] transition-all font-semibold disabled:opacity-60"
              >
                {submitting ? t("final.quoteSending") : t("final.quoteSubmit")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Email Report Modal ──────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#0B3C5D]">
                {t("final.emailModalTitle")}
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-5">
              {t("final.emailModalDesc")}
            </p>

            <form onSubmit={handleEmailReport} className="space-y-4">
              <input
                type="text"
                placeholder={t("final.emailYourName")}
                value={emailRecipientName}
                onChange={(e) => setEmailRecipientName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                required
                placeholder={t("final.emailYourEmail")}
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-lg hover:from-blue-700 hover:to-[#0a2f47] transition-all font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                {submitting ? t("final.emailSending") : t("final.emailSubmit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
