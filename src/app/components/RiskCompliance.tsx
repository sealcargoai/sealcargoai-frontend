import { useNavigate, useLocation } from "react-router";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  FileText,
  Globe,
  TrendingDown,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Warning {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
}

interface Document {
  name: string;
  status: "required" | "recommended" | "optional";
  completed: boolean;
}

interface ComplianceCheck {
  item: string;
  passed: boolean;
}

// ─── Dynamic content generators ──────────────────────────────────────────────

function getDocuments(destination: string): Document[] {
  const base: Document[] = [
    { name: "Factura Comercial", status: "required", completed: false },
    { name: "Lista de Empaque", status: "required", completed: false },
    { name: "Conocimiento de Embarque", status: "required", completed: false },
    { name: "Certificado de Origen", status: "required", completed: false },
  ];

  if (destination === "US") {
    base.push(
      {
        name: "Declaración de Aduana CBP 7501",
        status: "required",
        completed: false,
      },
      {
        name: "Certificado CARB (si aplica)",
        status: "recommended",
        completed: false,
      },
      { name: "Licencia de Importación", status: "optional", completed: false },
    );
  } else if (destination === "GT") {
    base.push(
      {
        name: "Declaración Aduanera SAT",
        status: "required",
        completed: false,
      },
      {
        name: "Certificado Fitosanitario",
        status: "recommended",
        completed: false,
      },
      {
        name: "Registro de Importador SAT",
        status: "required",
        completed: false,
      },
    );
  } else if (destination === "MX") {
    base.push(
      {
        name: "Pedimento de Importación",
        status: "required",
        completed: false,
      },
      {
        name: "Certificado de Origen TMEC",
        status: "recommended",
        completed: false,
      },
      { name: "NOM Certificación", status: "optional", completed: false },
    );
  } else if (destination === "CA") {
    base.push(
      {
        name: "Formulario B3 Aduanas Canadá",
        status: "required",
        completed: false,
      },
      {
        name: "Certificado de Origen CUSMA",
        status: "recommended",
        completed: false,
      },
      {
        name: "Licencia de Importación CFIA",
        status: "optional",
        completed: false,
      },
    );
  } else {
    base.push(
      {
        name: "Documentos Aduaneros Locales",
        status: "required",
        completed: false,
      },
      {
        name: "Certificado Fitosanitario",
        status: "recommended",
        completed: false,
      },
    );
  }

  return base;
}

function getWarnings(
  productType: string,
  destination: string,
  supplier: any,
): Warning[] {
  const warnings: Warning[] = [];

  if (supplier?.priceScore && supplier.priceScore > 80) {
    warnings.push({
      type: "pricing",
      severity: "medium",
      title: "Variación de Precio Detectada",
      description: `El precio del proveedor ($${supplier.price}/unidad) es competitivo. Verificar calidad antes de pedido masivo.`,
      recommendation:
        "Ordenar unidades de muestra y realizar inspección de calidad",
    });
  } else {
    warnings.push({
      type: "pricing",
      severity: "low",
      title: "Precio en Rango de Mercado",
      description:
        "El precio del proveedor está dentro del rango normal de mercado para este tipo de producto.",
      recommendation: "Solicitar muestras antes de confirmar pedido grande",
    });
  }

  if (productType === "furniture") {
    if (destination === "US") {
      warnings.push({
        type: "compliance",
        severity: "medium",
        title: "Prueba de Formaldehído Requerida",
        description:
          "Los muebles de madera deben cumplir con los estándares CARB de emisión de formaldehído para importación a EE.UU.",
        recommendation:
          "Solicitar certificación CARB Phase 2 o informe de prueba de terceros",
      });
    }
    warnings.push({
      type: "customs",
      severity: "medium",
      title: "Clasificación de Código HS",
      description:
        "Verificar el código HS correcto para muebles (9401.xx para sillas, 9403.xx para otros muebles) para evitar retrasos aduaneros.",
      recommendation: "Confirmar código HS con agente aduanero antes del envío",
    });
  } else if (productType === "electronics") {
    warnings.push({
      type: "compliance",
      severity: "high",
      title: "Certificación FCC Requerida",
      description:
        "Los dispositivos electrónicos importados a EE.UU. requieren certificación FCC obligatoria.",
      recommendation: "Obtener certificación FCC antes de importar",
    });
    warnings.push({
      type: "customs",
      severity: "medium",
      title: "Revisión de Sanciones",
      description:
        "Verificar que los componentes no provengan de entidades en lista de sanciones.",
      recommendation:
        "Solicitar declaración de origen de componentes al proveedor",
    });
  } else if (productType === "textiles") {
    warnings.push({
      type: "compliance",
      severity: "medium",
      title: "Etiquetado de Contenido de Fibra",
      description:
        "Los textiles importados deben cumplir con requisitos de etiquetado de contenido de fibra.",
      recommendation:
        "Verificar que el proveedor incluya etiquetas con composición correcta",
    });
    warnings.push({
      type: "customs",
      severity: "low",
      title: "Cuotas de Importación de Textiles",
      description:
        "Verificar que el volumen de importación no exceda cuotas aplicables para la categoría de textil.",
      recommendation: "Consultar con agente aduanero sobre cuotas vigentes",
    });
  } else {
    warnings.push({
      type: "customs",
      severity: "low",
      title: "Documentación Estándar Requerida",
      description:
        "Asegurar que toda la documentación estándar de importación esté completa y correcta.",
      recommendation:
        "Trabajar con un agente aduanero certificado para el despacho",
    });
  }

  if (destination === "GT") {
    warnings.push({
      type: "customs",
      severity: "low",
      title: "Registro SAT de Guatemala",
      description:
        "Asegúrate de estar registrado como importador en el SAT de Guatemala antes de recibir el envío.",
      recommendation: "Verificar registro de importador con el SAT",
    });
  }

  return warnings;
}

function getComplianceChecks(supplier: any): ComplianceCheck[] {
  return [
    { item: "Verificación de proveedor completada", passed: !!supplier },
    {
      item: "Capacidad de exportación confirmada",
      passed:
        supplier?.tags?.includes("Gold Supplier") ||
        supplier?.tags?.includes("Trade Assurance") ||
        false,
    },
    {
      item: "Garantía comercial disponible",
      passed:
        supplier?.tradeAssurance ||
        supplier?.tags?.includes("Trade Assurance") ||
        false,
    },
    {
      item: "Proveedor verificado/evaluado",
      passed:
        supplier?.verified || supplier?.tags?.includes("Assessed") || false,
    },
    { item: "Certificación de producto revisada", passed: false },
    {
      item: "Auditoría de fábrica realizada",
      passed: supplier?.tags?.includes("Audited") || false,
    },
  ];
}

function calculateRiskScore(
  supplier: any,
  productType: string,
  destination: string,
): number {
  let score = 50;
  if (supplier?.verified) score -= 8;
  if (supplier?.tradeAssurance) score -= 5;
  if (supplier?.goldSupplier) score -= 5;
  if (supplier?.yearsInBusiness >= 5) score -= 5;
  if (supplier?.yearsInBusiness >= 10) score -= 5;
  if (supplier?.responseRate >= 90) score -= 3;
  if (supplier?.aiScore >= 80) score -= 5;
  if (productType === "electronics") score += 10;
  if (productType === "textiles") score += 5;
  if (destination === "US") score -= 5;
  if (destination === "GT") score -= 3;
  return Math.max(10, Math.min(80, score));
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RiskCompliance() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // ── Read navigation state ─────────────────────────────────────────────────
  const supplier = location.state?.supplier ?? null;
  const destination = location.state?.destination ?? "US";
  const productType = location.state?.productType ?? "furniture";
  const quantity = location.state?.quantity ?? "1000";
  const budget = location.state?.budget ?? "50000";
  const supplierName = supplier?.name ?? "Proveedor Seleccionado";
  const isLiveData = !!supplier;

  // ── Calculate dynamic risk ────────────────────────────────────────────────
  const riskScore = calculateRiskScore(supplier, productType, destination);
  const riskLevel =
    riskScore < 40
      ? t("risk.low")
      : riskScore < 70
        ? t("risk.medium")
        : t("risk.high");

  const riskColorClass =
    riskScore < 40
      ? "bg-gradient-to-r from-green-500 to-green-600"
      : riskScore < 70
        ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
        : "bg-gradient-to-r from-red-500 to-red-600";

  const riskTextClass =
    riskScore < 40
      ? "text-green-100"
      : riskScore < 70
        ? "text-yellow-100"
        : "text-red-100";

  // ── Dynamic content ───────────────────────────────────────────────────────
  const documents = getDocuments(destination);
  const warnings = getWarnings(productType, destination, supplier);
  const complianceChecks = getComplianceChecks(supplier);
  const passedCount = complianceChecks.filter((c) => c.passed).length;

  const goToReport = () => {
    navigate("/report", {
      state: {
        supplier,
        destination,
        productType,
        quantity,
        budget,
        riskScore,
        suppliersData: location.state?.suppliersData,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-blue-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        {/* Decreased py-3 to py-1.5 and sm:py-4 to sm:py-2 to make the layout height thinner */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Reduced desktop height from md:h-[85px] to md:h-[65px] and sm:h-16 to sm:h-14 to stop the image from stretching the navbar */}
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
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              <button
                onClick={() => navigate(-1)}
                className="px-2 sm:px-4 py-2 sm:py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-xs sm:text-sm whitespace-nowrap"
              >
                {t("risk.backToCosts")}
              </button>
              {/* Reduced button vertical padding from py-2/sm:py-3 to py-1.5/sm:py-2 to fit cleanly inside the compact bar */}
              <button
                onClick={goToReport}
                className="px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-1 sm:gap-2 shadow-lg hover:shadow-xl text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">
                  {" "}
                  {t("risk.generateReport")}{" "}
                </span>
                <span className="sm:hidden">{t("risk.report")}</span>
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <LanguageToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-2">
            {t("risk.title")}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            {t("risk.subtitle")}
          </p>
          <p className="text-xs mt-1">
            {isLiveData ? (
              <span className="text-green-600 font-medium">
                ✅ {t("risk.dynamicAnalysis")} {supplierName} → {destination} (
                {productType})
              </span>
            ) : (
              <span className="text-yellow-600 font-medium">
                ⚠️ {t("risk.genericAnalysis")}
              </span>
            )}
          </p>
        </div>

        {/* ── Risk Score Card ───────────────────────────────────────────────── */}
        <div
          className={`${riskColorClass} rounded-2xl shadow-xl p-5 sm:p-8 mb-6 sm:mb-8 text-white`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className={`${riskTextClass} mb-2 text-sm sm:text-base`}>
                {t("risk.overallRiskScore")}
              </div>
              <div className="text-4xl sm:text-5xl font-bold">
                {riskScore}/100
              </div>
              <div
                className={`${riskTextClass} mt-2 flex items-center gap-2 text-sm sm:text-base`}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                {riskLevel} {t("risk.riskWord")}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className={`${riskTextClass} mb-2 text-sm sm:text-base`}>
                {t("risk.riskLevel")}
              </div>
              <div className="text-2xl sm:text-3xl font-bold">{riskLevel}</div>
              <div className={`text-xs sm:text-sm ${riskTextClass} mt-2`}>
                {riskScore < 40
                  ? t("risk.lowMessage")
                  : t("risk.reviewWarnings")}
              </div>
            </div>
          </div>

          {/* Risk breakdown bar */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/80">{t("risk.riskLevel")}</span>
              <span className="text-white font-medium">{riskScore}/100</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all"
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>{t("risk.lowRiskLabel")}</span>
              <span>{t("risk.highRiskLabel")}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* ── Left: Warnings + Documents ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Warnings */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="font-semibold text-[#0B3C5D] mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t("risk.warnings")}
                <span className="ml-auto text-xs text-slate-400 font-normal">
                  {t("risk.warningsFor")} {productType} → {destination}
                </span>
              </h2>

              <div className="space-y-4">
                {warnings.map((warning, i) => (
                  <div
                    key={i}
                    className={`border-l-4 rounded-lg p-4 ${
                      warning.severity === "high"
                        ? "border-red-500 bg-red-50"
                        : warning.severity === "medium"
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-blue-500 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          warning.severity === "high"
                            ? "text-red-600"
                            : warning.severity === "medium"
                              ? "text-yellow-600"
                              : "text-blue-600"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3
                            className={`font-semibold ${
                              warning.severity === "high"
                                ? "text-red-900"
                                : warning.severity === "medium"
                                  ? "text-yellow-900"
                                  : "text-blue-900"
                            }`}
                          >
                            {warning.title}
                          </h3>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              warning.severity === "high"
                                ? "bg-red-200 text-red-800"
                                : warning.severity === "medium"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : "bg-blue-200 text-blue-800"
                            }`}
                          >
                            {warning.severity.toUpperCase()}
                          </span>
                        </div>
                        <p
                          className={`text-sm mb-2 ${
                            warning.severity === "high"
                              ? "text-red-800"
                              : warning.severity === "medium"
                                ? "text-yellow-800"
                                : "text-blue-800"
                          }`}
                        >
                          {warning.description}
                        </p>
                        <div
                          className={`text-xs font-medium ${
                            warning.severity === "high"
                              ? "text-red-700"
                              : warning.severity === "medium"
                                ? "text-yellow-700"
                                : "text-blue-700"
                          }`}
                        >
                          ✓ {t("risk.recommendation")} {warning.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Documents */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="font-semibold text-[#0B3C5D] mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("risk.requiredDocs")}
                <span className="ml-auto text-xs text-slate-400 font-normal">
                  {t("risk.destinationLabel")} {destination}
                </span>
              </h2>

              <div className="space-y-3">
                {documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          doc.completed
                            ? "bg-green-500 border-green-500"
                            : "border-slate-300"
                        }`}
                      >
                        {doc.completed && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-slate-700">
                        {doc.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        doc.status === "required"
                          ? "bg-red-100 text-red-700"
                          : doc.status === "recommended"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t(`risk.${doc.status}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Compliance + Insights ────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Compliance Checks */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="font-semibold text-[#0B3C5D] mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("risk.complianceChecks")}
              </h2>

              <div className="space-y-3">
                {complianceChecks.map((check, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {check.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-sm ${check.passed ? "text-slate-700" : "text-slate-400"}`}
                    >
                      {check.item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="text-center">
                  <div
                    className={`text-3xl font-bold mb-1 ${
                      passedCount >= 4
                        ? "text-green-600"
                        : passedCount >= 2
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {passedCount}/{complianceChecks.length}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t("risk.checksPassed")}
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier Info Card */}
            {isLiveData && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-semibold text-[#0B3C5D] mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {t("risk.supplierAnalyzed")}
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-slate-800">{supplierName}</p>
                  <div className="flex justify-between text-slate-600">
                    <span>{t("risk.aiScoreLabel")}</span>
                    <span className="font-semibold text-blue-600">
                      {supplier?.aiScore}/100
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t("risk.yearsInBusiness")}</span>
                    <span className="font-semibold">
                      {supplier?.yearsInBusiness ? `${supplier.yearsInBusiness}a` : "N/D"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t("risk.responseRate")}</span>
                    <span className="font-semibold">
                      {supplier?.responseRate != null ? `${supplier.responseRate}%` : "N/D"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {supplier?.tags?.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Regional Insights */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t("risk.regionalInsights")}
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t("risk.insight1")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t("risk.insight2")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t("risk.insight3")}</span>
                </li>
              </ul>
            </div>

            {/* Overall Assessment */}
            <div
              className={`border rounded-xl p-6 ${
                riskScore < 40
                  ? "bg-green-50 border-green-200"
                  : riskScore < 70
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-red-50 border-red-200"
              }`}
            >
              <h3
                className={`font-semibold mb-2 ${
                  riskScore < 40
                    ? "text-green-900"
                    : riskScore < 70
                      ? "text-yellow-900"
                      : "text-red-900"
                }`}
              >
                {t("risk.overallAssessment")}
              </h3>
              <p
                className={`text-sm ${
                  riskScore < 40
                    ? "text-green-800"
                    : riskScore < 70
                      ? "text-yellow-800"
                      : "text-red-800"
                }`}
              >
                {riskScore < 40
                  ? `${t("risk.assessmentLow1")} ${riskLevel.toLowerCase()}. ${passedCount >= 4 ? t("risk.assessmentLow2") : t("risk.assessmentLow3")}`
                  : riskScore < 70
                    ? t("risk.assessmentMedium")
                    : t("risk.assessmentHigh")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
