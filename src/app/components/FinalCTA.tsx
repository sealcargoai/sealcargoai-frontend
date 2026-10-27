import { useEffect, useState } from "react";
import { cleanSupplier } from "../../utils/text";
import { qtyFrom, resolveScenario, priceNoteFor, reportNotesFor } from "../../utils/scenario";
import { clearDraft } from "../../utils/draft";
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
import { NoSupplierNotice, hasUsableSupplier, SupplierDisclaimer, sealDisclaimer, badgeText, TrustBadge, supplierPriceInfo } from "./SelectedSupplier";
import { getReviewTopics } from "./RiskCompliance";
import { buildCostPdf } from "../../utils/costPdf";
import { listingDifferences } from "../../utils/differences";
import { budgetNote, smallOrderNote } from "../../utils/costNotes";
import { Lx, plural } from "../../utils/lang";
import { saleUnitInfo, unitWordFor } from "../../utils/saleUnit";
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
  formatUSD,
  estimateNote,
  type CostResult,
} from "../../utils/costCalculator";

// Cost logic lives in utils/costCalculator (shared with costs page and Excel)
type Costs = CostResult;

// ─── PDF (shared generator: utils/costPdf) ──────────────────────────────────
function generateReportPDF(data: {
  supplierName: string;
  quantity: number;
  price: number;
  priceNote?: string;
  productDescription: string;
  productType: string;
  supplier: any;
  costs: Costs;
  reportId: string;
  saveFile?: boolean;
  notes?: string[];
  differences?: { title: string; items: string[] };
}): string {
  return buildCostPdf({
    title: Lx("Informe de orientación para tu importación · costos estimados", "Guidance report for your import · estimated costs"),
    supplierName: data.supplierName,
    productDescription: data.productDescription,
    quantity: data.quantity,
    price: data.price,
    priceNote: data.priceNote,
    costs: data.costs,
    notes: data.notes,
    differences: data.differences,
    topics: getReviewTopics(data.productType, data.supplier, data.productDescription),
    disclaimer: sealDisclaimer(),
    reportId: data.reportId,
    fileName: `SEAL_${Lx("Informe", "Report")}_${data.supplierName.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    saveFile: data.saveFile,
  });
}

// ─── Excel Export (NEW: Beautiful XLSX) ───────────────────────────────────────
async function exportToExcel(data: {
  supplierName: string;
  quantity: number;
  price: number;
  priceNote?: string;
  destination: string;
  productType: string;
  costs: Costs;
  notes?: string[];
  differences?: { title: string; items: string[] };
}) {
  await generateBeautifulExcel({
    notes: data.notes,
    differences: data.differences,
    reportTitle: Lx("Informe de orientación · costos estimados", "Guidance report · estimated costs"),
    priceNote: data.priceNote,
    supplierName: data.supplierName,
    productType: data.productType,
    destination: data.destination,
    quantity: data.quantity,
    price: data.price,
    costs: data.costs,
    vatRate: data.costs.vatRate,
    insuranceRate: data.costs.insuranceRate,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FinalCTA() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, L } = useLanguage();

  // ── Read state ────────────────────────────────────────────────────────────
  // The costs page hands over its inputs: the report rebuilds the very same
  // scenario (price, unit, quantity, assumptions) in the language in use
  const input = location.state?.scenarioInput;
  const rebuilt = input?.supplier
    ? resolveScenario(cleanSupplier(input.supplier), input.choices || {}, {
        requestedQty: qtyFrom(input.requestedQty),
        productType: String(location.state?.productType ?? ""),
        description: String(location.state?.productDescription ?? ""),
      })
    : null;
  const stateSupplier = rebuilt ? rebuilt.supplier : cleanSupplier(location.state?.supplier ?? null);
  const stateQuantity = rebuilt ? rebuilt.quantity : location.state?.quantity ?? "1000";
  const stateBudget = location.state?.budget ?? "";
  const stateDestination = location.state?.destination ?? "GT";
  const stateProductType = location.state?.productType ?? "";
  const stateSuppliersData = location.state?.suppliersData ?? null;

  // the scenario's own quantity (already in sale units; qtyFrom would cap it again)
  const quantity = rebuilt ? rebuilt.quantity : qtyFrom(String(stateQuantity));
  const destination = String(stateDestination);
  const productType = String(stateProductType);
  const productDescription = String(location.state?.productDescription ?? "");
  const reviewTopics = getReviewTopics(productType, stateSupplier, productDescription);

  // Real supplier only: no demo name or price (see NoSupplierNotice below)
  const price = stateSupplier?.price > 0 ? stateSupplier.price : 0;
  const supplierName = stateSupplier?.name || "";
  const isLiveData = hasUsableSupplier(stateSupplier);
  const priceInfo = supplierPriceInfo(stateSupplier);
  const priceNote = priceNoteFor(stateSupplier);


  const volumeCbm = parseFloat(String(location.state?.volumeCbm ?? "")) || 0;
  const weightKg = parseFloat(String(location.state?.weightKg ?? "")) || 0;
  const rates = useRates();
  const saleUnit = saleUnitInfo(stateSupplier, productType).unit;
  const costs = calculateCosts({ price, quantity, volumeCbm, weightKg, saleUnit }, rates);
  // Assumptions from the costs page (pieces per set, price basis, minimum order…)
  const reportNotes: string[] = rebuilt
    ? [
        ...reportNotesFor(rebuilt, costs.perUnit, (usd, d = 0) => formatQ(usd, costs.exchangeRate, d)),
        // the purchase budget and the small-order note, as on the costs page
        budgetNote(costs, parseFloat(String(stateBudget)) || 0, (usd) => formatQ(usd, costs.exchangeRate)),
        smallOrderNote(costs, unitWordFor(saleUnit, 1), (usd) => formatQ(usd, costs.exchangeRate)),
      ].filter(Boolean)
    : Array.isArray(location.state?.reportNotes)
      ? location.state.reportNotes.map(String)
      : [];
  // the listing title and what differs from the request: the same warnings as on screen
  const reportDiffs = listingDifferences(productDescription, stateSupplier);
  const piecesPerUnitShown = rebuilt ? rebuilt.piecesPerUnit : Number(location.state?.piecesPerUnit) || 0;
  const Q = (usd: number, decimals = 0) => formatQ(usd, costs.exchangeRate, decimals);
  const totalCostText = `${Q(costs.totalCost)} (${formatUSD(costs.totalCost)})${costs.freightPending ? Lx(" — estimación parcial, sin flete", " — partial estimate, without freight") : ""}`;

  // ── Dynamic stats ─────────────────────────────────────────────────────────
  // Real counts from the supplier search; null = not available (block is hidden)
  const num = (v: unknown) => (typeof v === "number" && v >= 0 ? v : null);
  const leadStats =
    num(stateSuppliersData?.totalAnalyzed) !== null && num(stateSuppliersData?.qualifiedCount) !== null
      ? {
          totalAnalyzed: stateSuppliersData.totalAnalyzed as number,
          filtered: num(stateSuppliersData?.filteredCount),
          qualified: stateSuppliersData.qualifiedCount as number,
          shown: num(stateSuppliersData?.shownCount),
          // Listings from a supplier already counted (same company twice)
          duplicates:
            num(stateSuppliersData?.duplicateCount) ??
            Math.max(
              0,
              (stateSuppliersData.totalAnalyzed as number) -
                (stateSuppliersData.qualifiedCount as number) -
                (num(stateSuppliersData?.filteredCount) ?? 0),
            ),
        }
      : null;


  // ── Modal state ───────────────────────────────────────────────────────────
  // One ID per report: the screen, the PDF and the email show the same one
  const [reportId] = useState<string>(
    () => location.state?.reportId || `SEAL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
  );
  // Esc closes the quote and email forms
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowQuoteModal(false);
        setShowEmailModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // kept in this page's history entry: a reload shows the same ID
  useEffect(() => {
    if (location.state && location.state.reportId !== reportId)
      navigate(location.pathname, { replace: true, state: { ...location.state, reportId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Quote form
  // pre-filled with the name and email given at the start of the analysis
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("sealcargo_user_data") || "{}") || {};
    } catch {
      return {};
    }
  })();
  const [quoteName, setQuoteName] = useState(String(storedUser.name || ""));
  const [quoteEmail, setQuoteEmail] = useState(String(storedUser.email || ""));
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteCompany, setQuoteCompany] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  // Email form
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailRecipientName, setEmailRecipientName] = useState("");

  if (!isLiveData) return <NoSupplierNotice hasSupplierWithoutPrice={!!stateSupplier?.name} />;


  // Exactly what the PDF contains
  const reportSections = [
    { name: L("Datos de la consulta y descripción del producto", "Request details and product description") },
    { name: L("Proveedor considerado", "Supplier considered") },
    { name: L("Escenario estimado de costos en Guatemala", "Estimated cost scenario in Guatemala") },
    ...(reportNotes.length ? [{ name: L("Supuestos de cantidad, precio y pedido mínimo", "Quantity, price and minimum-order assumptions") }] : []),
    { name: L("Variables que pueden cambiar el escenario", "Variables that can change the scenario") },
    { name: L(`Aspectos por revisar (${reviewTopics.length})`, `Aspects to review (${reviewTopics.length})`) },
    { name: L("Aviso y alcance de la herramienta", "Notice and scope of the tool") },
  ];

  // ── Action: Download Full Report ──────────────────────────────────────────
  const handleDownloadReport = () => {
    generateReportPDF({
        notes: reportNotes,
        differences: reportDiffs,
      supplierName,
      quantity,
      price,
      priceNote,
      productDescription,
      productType,
      supplier: stateSupplier,
      costs,
      reportId,
      saveFile: true,
    });
  };

  // ── Action: Excel Export ──────────────────────────────────────────────────
  const handleExcelExport = async () => {
    await exportToExcel({
      notes: reportNotes,
        differences: reportDiffs,
      supplierName,
      quantity,
      price,
      priceNote,
      destination,
      productType: productDescription || productType,
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
            totalCostText,
            // the client's own description and the quantity with its unit, not just the category
            productType,
            productDescription,
            quantity: `${quantity.toLocaleString("en-US")} ${unitWordFor(saleUnit, quantity)}`,
            destination,
            budget: stateBudget ? `US$${stateBudget}` : "",
            supplierUrl: stateSupplier?.productUrl || stateSupplier?.storeUrl || "",
          }),
        },
      );
      if (res.status === 429) {
        // the email endpoint allows a few requests per hour: retrying now won't work
        alert(L(`Se alcanzó el límite de envíos por ahora. Escríbenos al WhatsApp de SEAL ${SEAL_COMPANY.phone} y te atendemos de inmediato.`, `The sending limit was reached for now. Message SEAL on WhatsApp ${SEAL_COMPANY.phone} and we'll help you right away.`));
        return;
      }
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

  const downloadReportNow = () => {
    try {
      generateReportPDF({
        notes: reportNotes,
        differences: reportDiffs,
        supplierName,
        quantity,
        price,
        priceNote,
        productDescription,
        productType,
        supplier: stateSupplier,
        costs,
        reportId,
        saveFile: true,
      });
    } catch {
      /* ignore */
    }
  };

  // ── Action: Email Report ──────────────────────────────────────────────────
  const handleEmailReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const pdfBase64 = generateReportPDF({
        notes: reportNotes,
        differences: reportDiffs,
        supplierName,
        quantity,
        price,
        priceNote,
        productDescription,
        productType,
        supplier: stateSupplier,
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
            // who ran the search (the server only sends reports for them)
            requesterEmail: (() => {
              try {
                return JSON.parse(localStorage.getItem("sealcargo_user_data") || "{}").email || "";
              } catch {
                return "";
              }
            })(),
            recipientName: emailRecipientName,
            pdfBase64,
            supplierName,
            totalCost: costs.totalCost,
            totalCostText,
          }),
        },
      );
      if (res.status === 400) {
        alert(Lx("Revisa el correo: debe ser completo, por ejemplo nombre@empresa.com.", "Check the email: it must be complete, for example name@company.com."));
        return;
      }
      if (res.status === 403 || res.status === 429) {
        // not sent from here (limit or session): the client still gets the PDF
        downloadReportNow();
        alert(
          Lx(
            "No pudimos enviarlo por correo desde aquí, así que el informe se descargó en este dispositivo. Puedes reenviarlo tú o pedírselo a SEAL por WhatsApp +502 5996 4664.",
            "We couldn't email it from here, so the report was downloaded to this device. You can forward it yourself or ask SEAL on WhatsApp +502 5996 4664.",
          ),
        );
        setShowEmailModal(false);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const result = await res.json().catch(() => ({}));
      if (result.delivered === false) {
        // Could not email the client directly — SEAL got the report and will forward it.
        downloadReportNow();
        alert(
          Lx(
            `Tu informe se descargó en este dispositivo. Además, un ejecutivo de SEAL te lo enviará a ${emailRecipient}.`,
            `Your report was downloaded to this device. A SEAL executive will also send it to ${emailRecipient}.`,
          ),
        );
      } else {
        alert(t("final.emailSuccess"));
      }
      setShowEmailModal(false);
      setEmailRecipient("");
      setEmailRecipientName("");
    } catch (err) {
      // Never leave the user empty-handed: give them the PDF right away
      downloadReportNow();
      alert(
        Lx(
          `No pudimos enviarlo por correo, pero tu informe se descargó en este dispositivo. Si lo necesitas, llámanos al ${SEAL_COMPANY.phone}.`,
          `We couldn't email it, but your report was downloaded to this device. If you need help, call us at ${SEAL_COMPANY.phone}.`,
        ),
      );
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
              onClick={() => navigate(-1)}
              aria-label={L("Volver a aspectos por revisar", "Back to points to review")}
              title={L("Aspectos por revisar", "Points to review")}
              className="px-2 sm:px-3 py-2 text-[#0B3C5D] hover:underline text-xs sm:text-sm whitespace-nowrap"
            >
              ←<span className="hidden md:inline"> {L("Aspectos por revisar", "Points to review")}</span>
            </button>
            <button
              onClick={() => {
              clearDraft();
              navigate("/");
            }}
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
          {leadStats && (
            <p className="text-xs mt-2">
              {(() => {
                const parts = [
                  `${leadStats.qualified} ${plural(leadStats.qualified, "pasó los filtros", "pasaron los filtros", "passed the filters", "passed the filters")}`,
                  leadStats.filtered !== null ? `${leadStats.filtered} ${plural(leadStats.filtered, "no pasó", "no pasaron", "did not pass", "did not pass")}` : "",
                  leadStats.duplicates > 0 ? `${leadStats.duplicates} ${plural(leadStats.duplicates, "era una publicación repetida de un proveedor ya contado", "eran publicaciones repetidas de proveedores ya contados", "was a repeat listing from a supplier already counted", "were repeat listings from suppliers already counted")}` : "",
                ].filter(Boolean);
                const and = Lx(" y ", " and ");
                const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}${and}${parts[parts.length - 1]}` : parts[0];
                return `${Lx("La herramienta revisó", "The tool reviewed")} ${leadStats.totalAnalyzed} ${plural(leadStats.totalAnalyzed, "publicación", "publicaciones", "listing", "listings")}: ${list}.`;
              })()}
            </p>
          )}
          <p className="text-xs mt-2">
            {isLiveData ? (
              <span className="text-green-600 font-medium">
                ✅ {t("final.basedOnReal")} {supplierName}
              </span>
            ) : null}
          </p>
        </div>

        {/* Dynamic Stats — only real counts from the search */}
        {leadStats && (
        <>
        <div className={`grid grid-cols-2 ${leadStats.duplicates > 0 ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4 mb-2`}>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#0B3C5D] mb-1">
              {leadStats.totalAnalyzed}
            </div>
            <div className="text-sm text-slate-600">
              {plural(leadStats.totalAnalyzed, "Publicación revisada", "Publicaciones revisadas", "Listing reviewed", "Listings reviewed")}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <Target className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-red-600 mb-1">
              {leadStats.filtered ?? Lx("N/D", "N/A")}
            </div>
            <div className="text-sm text-slate-600">
              {plural(leadStats.filtered ?? 0, "No pasó los filtros", "No pasaron los filtros", "Filtered out", "Filtered out")}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-600 mb-1">
              {leadStats.qualified}
            </div>
            <div className="text-sm text-slate-600">{plural(leadStats.qualified, "Pasó los filtros", "Pasaron los filtros", "Passed the filters", "Passed the filters")}</div>
          </div>
          {leadStats.duplicates > 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
              <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-600 mb-1">{leadStats.duplicates}</div>
              <div className="text-sm text-slate-600">
                {plural(leadStats.duplicates, "Repetida (mismo proveedor)", "Repetidas (mismo proveedor)", "Repeat (same supplier)", "Repeats (same supplier)")}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {leadStats.shown ?? Lx("N/D", "N/A")}
            </div>
            <div className="text-sm text-slate-600">{plural(leadStats.shown ?? 0, "Mostrado en resultados", "Mostrados en resultados", "Shown in results", "Shown in results")}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-8">
          {Lx(
            `Las publicaciones repetidas de un mismo proveedor se cuentan una sola vez.${leadStats.shown !== null && leadStats.shown < leadStats.qualified ? ` De los ${leadStats.qualified} que pasaron los filtros se muestran los ${leadStats.shown} mejor ubicados.` : ""}`,
            `Repeat listings from the same supplier are counted once.${leadStats.shown !== null && leadStats.shown < leadStats.qualified ? ` Of the ${leadStats.qualified} that passed the filters, the top ${leadStats.shown} are shown.` : ""}`,
          )}
        </p>
        </>
        )}

        <SupplierDisclaimer
          supplier={stateSupplier}
          productDescription={location.state?.productDescription ?? ""}
          quantity={`${quantity.toLocaleString("en-US")} ${unitWordFor(saleUnit, quantity)}`}
        />

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
              <div className="font-bold text-lg text-[#0B3C5D] mb-1 break-words" title={supplierName}>
                {supplierName}
              </div>
              <div className="flex items-center gap-1 text-sm text-blue-700">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {stateSupplier?.rating ?? L("Sin reseñas", "No reviews")} • {badgeText(stateSupplier)}
              </div>
              {(stateSupplier?.trustScore !== undefined || stateSupplier?.aiScore !== undefined) && (
                <div className="mt-2">
                  <TrustBadge supplier={stateSupplier} size="sm" />
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="text-sm text-green-700 mb-2">
                {costs.freightPending ? L("Costo parcial estimado (sin flete)", "Estimated partial cost (without freight)") : t("final.totalCost")}
              </div>
              <div className="font-bold text-xl text-[#0B3C5D] mb-1">
                {Q(costs.totalCost)}
              </div>
              {costs.freightPending && (
                <div className="text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded px-2 py-0.5 inline-block mb-1">
                  {Lx("Estimación parcial, sin flete", "Partial estimate, without freight")}
                </div>
              )}
              <div className="text-sm text-green-700">
                {Q(costs.perUnit, 2)} {Lx("por", "per")} {unitWordFor(saleUnit, 1)}
                {piecesPerUnitShown > 1 && (
                  <span className="block text-xs text-green-800">
                    {Lx(
                      `≈ ${Q(costs.perUnit / piecesPerUnitShown, 2)} por pieza (supuesto: ${piecesPerUnitShown} piezas por ${unitWordFor(saleUnit, 1)}, por confirmar)`,
                      `≈ ${Q(costs.perUnit / piecesPerUnitShown, 2)} per piece (assumption: ${piecesPerUnitShown} pieces per ${unitWordFor(saleUnit, 1)}, to be confirmed)`,
                    )}
                  </span>
                )}
              </div>
              <div className="text-xs text-green-800 mt-1">
                <span>{L("Escenario estimado, no cotización", "Estimated scenario, not a quote")}</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="text-sm text-purple-700 mb-2">
                {L("Aspectos por revisar", "Aspects to review")}
              </div>
              <div className="font-bold text-xl text-[#0B3C5D] mb-1">
                {reviewTopics.length} {plural(reviewTopics.length, "tema", "temas", "topic", "topics")}
              </div>
              <div className="text-sm text-purple-700">
                {L("Antes de comprar e importar", "Before buying and importing")}
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
            onClick={() => {
              clearDraft();
              navigate("/");
            }}
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
                {quantity.toLocaleString()} {unitWordFor(saleUnit, quantity)} • {costs.freightPending ? Lx("Total parcial:", "Partial total:") : Lx("Total estimado:", "Estimated total:")}{" "}
                {Q(costs.totalCost)}
                {costs.freightPending ? Lx(" (sin flete)", " (without freight)") : ""}
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
                pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
                title={L("Correo completo, por ejemplo nombre@empresa.com", "Complete email, for example name@company.com")}
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
                pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
                title={L("Correo completo, por ejemplo nombre@empresa.com", "Complete email, for example name@company.com")}
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
