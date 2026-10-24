import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Package,
  DollarSign,
  MapPin,
  Box,
  Weight,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import {
  canUserSearch,
  recordSearch,
  getRemainingSearches,
  getSearchLimit,
} from "../../utils/searchLimit";

// The product is now free text. Downstream screens (costs, risk) still use a
// category key, so we infer one from the description.
const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  electronics: /electr[oó]nic|electronic|celular|tel[eé]fono|phone|laptop|computador|tablet|cargador|charger|bater[ií]a|battery|led|cable|aud[ií]fono|headphone|bocina|speaker|c[aá]mara|camera|monitor|televisor|\btv\b|chip|circuit/i,
  textiles: /textil|tela|fabric|ropa|clothing|camis|shirt|pantal[oó]n|pants|vestido|dress|algod[oó]n|cotton|poli[eé]ster|polyester|uniforme|uniform|toalla|towel|zapato|shoe|calzado|bota|boot|gorra|cap/i,
  furniture: /mueble|furniture|silla|chair|mesa|table|escritorio|desk|sof[aá]|sill[oó]n|cama|\bbed\b|colch[oó]n|mattress|gabinete|cabinet|estanter|shelf|closet|ropero/i,
  machinery: /m[aá]quina|machine|maquinaria|machinery|equipo industrial|industrial equipment|motor|bomba|pump|compresor|compressor|generador|generator|torno|lathe|cnc|montacarga|forklift|excavadora|excavator|envasadora|empacadora|packing machine|horno industrial/i,
};

function inferCategory(description: string): string {
  for (const [category, regex] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regex.test(description)) return category;
  }
  return "other";
}

export function ProductQualification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // Read original search query forwarded from chat/landing
  const userQuery = location.state?.query || "";

  // Read from location.state first, fallback to localStorage
  const storedData = (() => {
    try {
      const raw = localStorage.getItem("sealcargo_user_data");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const userName = location.state?.name || storedData?.name || "";
  const userEmail = location.state?.email || storedData?.email || "";
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    // Free-text product description (prefilled with the chat query)
    productType: userQuery,
    material: "",
    quantity: "",
    budget: "",
    destination: "",
    volumeCbm: "", // optional — used to quote ocean freight
    weightKg: "",  // optional
  });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [remainingSearches, setRemainingSearches] = useState<number>(3);

  useEffect(() => {
    if (userEmail) {
      const remaining = getRemainingSearches(userEmail, userName);
      setRemainingSearches(remaining);
    } else {
      console.warn("⚠️ useEffect — no userEmail found");
    }
  }, [userEmail, userName]);

  // ── Submit: call backend then navigate ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── CHECK LIMIT FIRST ────────────────────────────────
    if (userEmail && !canUserSearch(userEmail, userName)) {
      setShowLimitModal(true);
      return;
    }

    const productDescription = formData.productType.trim();
    const productCategory = inferCategory(productDescription);

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/suppliers/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            productType: productCategory,
            material: "",
            userQuery: productDescription,
            userEmail,
          }),
        },
      );

      // Server-side limit reached → show the limit modal, no demo data
      if (response.status === 429) {
        setRemainingSearches(0);
        setShowLimitModal(true);
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const suppliers = await response.json();

      // ── RECORD SEARCH AFTER SUCCESS ──────────────────
      if (userEmail) {
        recordSearch(
          userEmail,
          userName,
          productCategory,
          productDescription
        );
        const localRemaining = getRemainingSearches(userEmail, userName);
        const serverRemaining =
          typeof suppliers?.remainingSearches === "number"
            ? suppliers.remainingSearches
            : localRemaining;
        setRemainingSearches(Math.min(localRemaining, serverRemaining));
      }

      navigate("/suppliers", {
        state: {
          ...formData,
          productType: productCategory,
          productDescription,
          suppliers,
        },
      });

    } catch (err) {
      console.error("API failed:", err);
      setError(
        "No se pudo conectar al servidor. Mostrando datos de demostración.",
      );

      // Failed searches (server down) are not counted against the user

      navigate("/suppliers", {
        state: { ...formData, productType: productCategory, productDescription },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        {/* Decreased padding from py-3 to py-1.5 to shrink the header height */}
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Reduced the logo height from h-[85px] to h-[60px] to make the header thinner */}
            <img src={logo} alt="SEAL" className="h-[60px]" />
            <span className="text-xl font-bold text-[#0B3C5D]">
              {" "}
              SmartTrade AI{" "}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/chat")}
              className="text-slate-600 hover:text-[#0B3C5D] flex items-center gap-2 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">
                {" "}
                {t("qualification.back")}{" "}
              </span>
            </button>
            <LanguageToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              {t("qualification.step")} {step} {t("qualification.of")} 3
            </span>
            <span className="text-sm font-medium text-[#0B3C5D]">
              {Math.round(progress)}% {t("qualification.complete")}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-[#0B3C5D] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* Remaining searches indicator */}
        {userEmail && remainingSearches <= getSearchLimit() && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${remainingSearches === 0
            ? "bg-red-100 text-red-700 border border-red-200"
            : remainingSearches === 1
              ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
              : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}>
            <span>
              {remainingSearches === 0
                ? "🔒 Sin búsquedas disponibles"
                : `🔍 ${remainingSearches} búsqueda${remainingSearches !== 1 ? "s" : ""} restante${remainingSearches !== 1 ? "s" : ""} de ${getSearchLimit()}`
              }
            </span>
          </div>
        )}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-10">
          <h1 className="text-4xl font-bold text-[#0B3C5D] mb-3">
            {t("qualification.title")}
          </h1>
          <p className="text-lg text-slate-600 mb-10">
            {t("qualification.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1 — free-text product description */}
            {step === 1 && (
              <div className="space-y-3 animate-fade-in">
                <label
                  htmlFor="productType"
                  className="flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <Package className="w-4 h-4" />
                  {t("qualification.productType")}
                </label>
                <textarea
                  id="productType"
                  value={formData.productType}
                  onChange={(e) =>
                    setFormData({ ...formData, productType: e.target.value })
                  }
                  required
                  rows={8}
                  maxLength={1500}
                  placeholder={t("qualification.productPlaceholder")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[180px] leading-relaxed"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t("qualification.productHelp")}</span>
                  <span>{formData.productType.length}/1500</span>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <Package className="w-4 h-4" />
                    {t("qualification.quantity")}
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    required
                    placeholder="1000"
                    min="1"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <DollarSign className="w-4 h-4" />
                    {t("qualification.budget")}{" "}
                    <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
                    }
                    placeholder="50000"
                    min="1"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <Box className="w-4 h-4" />
                      Volumen aproximado (m³)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.volumeCbm}
                      onChange={(e) =>
                        setFormData({ ...formData, volumeCbm: e.target.value })
                      }
                      placeholder="ej. 3.5"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <Weight className="w-4 h-4" />
                      Peso aproximado (kg)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.weightKg}
                      onChange={(e) =>
                        setFormData({ ...formData, weightKg: e.target.value })
                      }
                      placeholder="ej. 800"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                  Opcional, pero con el volumen o el peso le calculamos el flete.
                  Si no lo sabe, déjelo en blanco y un ejecutivo de SEAL se lo cotiza.
                </p>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <MapPin className="w-4 h-4" />
                    {t("qualification.destination")}
                  </label>
                  <select
                    value={formData.destination}
                    onChange={(e) =>
                      setFormData({ ...formData, destination: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {t("qualification.selectDestination")}
                    </option>
                    <option value="US">Estados Unidos</option>
                    <option value="GT">Guatemala</option>
                    <option value="MX">México</option>
                    <option value="CA">Canadá</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                {/* Review Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-[#0B3C5D] mb-2">
                    {t("qualification.review")}
                  </h3>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="whitespace-pre-line break-words">
                      <span className="font-medium">
                        {t("qualification.product")}
                      </span>{" "}
                      {formData.productType}
                    </p>
                    <p>
                      <span className="font-medium">
                        {t("qualification.quantity")}:
                      </span>{" "}
                      {formData.quantity} unidades
                    </p>
                    <p>
                      <span className="font-medium">
                        {t("qualification.budget")}:
                      </span>{" "}
                      {formData.budget ? `$${formData.budget}` : "No indicado"}
                    </p>
                    <p>
                      <span className="font-medium">Volumen / peso:</span>{" "}
                      {formData.volumeCbm || formData.weightKg
                        ? [
                            formData.volumeCbm && `${formData.volumeCbm} m³`,
                            formData.weightKg && `${formData.weightKg} kg`,
                          ]
                            .filter(Boolean)
                            .join(" • ")
                        : "Por cotizar"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={isLoading}
                  className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("qualification.previous")}
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && formData.productType.trim().length < 3) ||
                    (step === 2 && !(parseInt(formData.quantity) > 0))
                  }
                  className="flex-1 px-6 py-3 rounded-lg bg-[#0B3C5D] text-white hover:bg-[#0a2f47] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("qualification.next")}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Buscando Proveedores...
                    </>
                  ) : (
                    <>
                      {t("qualification.findSuppliers")}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ {error}
              </div>
            )}
          </form>
        </div>
      </div>
      {/* ── Search Limit Modal ─────────────────────────────────── */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">

            {/* Icon */}
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🔒</span>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-[#0B3C5D] mb-3">
              Límite de Búsquedas Alcanzado
            </h2>

            {/* Description */}
            <p className="text-slate-600 mb-2">
              Has utilizado tus <strong>{getSearchLimit()} búsquedas gratuitas</strong>.
            </p>
            <p className="text-slate-600 mb-6">
              Para continuar buscando proveedores, contacta al equipo de SEAL y obtén acceso completo.
            </p>

            {/* Highlight box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-[#0B3C5D] mb-2">
                Con acceso completo obtienes:
              </p>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>✅ Búsquedas ilimitadas de proveedores</li>
                <li>✅ Análisis de costos detallado</li>
                <li>✅ Informes PDF y Excel</li>
                <li>✅ Soporte del equipo SEAL</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <a
                href="tel:+50259964664"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-[#0a2f47] transition-all shadow-lg"
              >
                📞 Contactar SEAL: +502 5996 4664
              </a>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
