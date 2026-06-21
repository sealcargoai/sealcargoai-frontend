import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Package,
  Ruler,
  DollarSign,
  MapPin,
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

export function ProductQualification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // Read original search query forwarded from chat/landing
  const userQuery = location.state?.query || "";
  const userName = location.state?.name || "";
  const userEmail = location.state?.email || "";
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    productType: "",
    material: "",
    quantity: "",
    budget: "",
    destination: "",
  });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [remainingSearches, setRemainingSearches] = useState<number>(3);

  useEffect(() => {
    if (userEmail) {
      const remaining = getRemainingSearches(userEmail, userName);
      setRemainingSearches(remaining);
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
            userQuery,
            userEmail,
          }),
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const suppliers = await response.json();

      // ── RECORD SEARCH AFTER SUCCESS ──────────────────
      if (userEmail) {
        recordSearch(
          userEmail,
          userName,
          formData.productType,
          userQuery || formData.productType
        );
        setRemainingSearches(getRemainingSearches(userEmail, userName));
      }

      navigate("/suppliers", {
        state: {
          ...formData,
          suppliers,
        },
      });
    } catch (err) {
      console.error("API failed:", err);
      setError(
        "No se pudo conectar al servidor. Mostrando datos de demostración.",
      );

      // Record even on fallback
      if (userEmail) {
        recordSearch(
          userEmail,
          userName,
          formData.productType,
          userQuery || formData.productType

        );
        setRemainingSearches(getRemainingSearches(userEmail, userName));
      }

      navigate("/suppliers", { state: formData });
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
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <Package className="w-4 h-4" />
                    {t("qualification.productType")}
                  </label>
                  <select
                    value={formData.productType}
                    onChange={(e) =>
                      setFormData({ ...formData, productType: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {t("qualification.selectCategory")}
                    </option>
                    <option value="furniture">
                      {t("qualification.furniture")}
                    </option>
                    <option value="electronics">
                      {t("qualification.electronics")}
                    </option>
                    <option value="textiles">
                      {t("qualification.textiles")}
                    </option>
                    <option value="machinery">
                      {t("qualification.machinery")}
                    </option>
                    <option value="other">{t("qualification.other")}</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <Ruler className="w-4 h-4" />
                    {t("qualification.material")}
                  </label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) =>
                      setFormData({ ...formData, material: e.target.value })
                    }
                    required
                    placeholder={t("qualification.materialPlaceholder")}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                    {t("qualification.budget")}
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
                    }
                    required
                    placeholder="50000"
                    min="1"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                    <p>
                      <span className="font-medium">
                        {t("qualification.product")}
                      </span>{" "}
                      {formData.productType}
                    </p>
                    <p>
                      <span className="font-medium">
                        {t("qualification.material")}:
                      </span>{" "}
                      {formData.material}
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
                      ${formData.budget}
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
                  className="flex-1 px-6 py-3 rounded-lg bg-[#0B3C5D] text-white hover:bg-[#0a2f47] transition-colors flex items-center justify-center gap-2"
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
