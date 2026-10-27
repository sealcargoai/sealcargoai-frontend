import { inferCategory } from "../../utils/category";
import { quantityWord } from "../../utils/saleUnit";
import { useState, useEffect } from "react";
import { DRAFT_KEY } from "../../utils/draft";
import { descriptionIsDetailed, descriptionDetailMessage, DESCRIPTION_MIN_CHARS, cleanDescription } from "../../utils/descriptionCheck";
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
import { Lx, unitsWord } from "../../utils/lang";
import {
  recordSearch,
  getSearchLimit,
} from "../../utils/searchLimit";

// The product is now free text. Downstream screens (costs, risk) still use a
// category key, so we infer one from the description.
// Order matters: machinery first (machines mention electrical specs). Short
// words use \b so e.g. "aplicables" doesn't match "cable".

// Field limits (shown to the client next to each field)
export const LIMITS = {
  productMin: DESCRIPTION_MIN_CHARS,
  productMax: 1500,
  quantityMax: 10_000_000,
  budgetMax: 100_000_000,
  volumeMax: 5_000,
  weightMax: 5_000_000,
};

// DRAFT_KEY lives in utils/draft.ts
// The backend gives up at ~75 s; the browser waits a little longer, then offers a way out
const SEARCH_TIMEOUT_MS = 95_000;
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function loadDraft(): { formData?: Record<string, string>; step?: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns an error message for the field, or "" when valid. */
function fieldError(name: string, value: string): string {
  const v = value.trim();
  const n = Number(v);
  switch (name) {
    case "productType":
      // what gets searched is the cleaned text (sentences addressed to the tool are left out)
      if (!descriptionIsDetailed(v) || !descriptionIsDetailed(cleanDescription(v).text)) return descriptionDetailMessage();
      if (v.length > LIMITS.productMax) return Lx(`Máximo ${LIMITS.productMax.toLocaleString()} caracteres.`, `Maximum ${LIMITS.productMax.toLocaleString()} characters.`);
      return "";
    case "quantity":
      if (!v) return Lx("La cantidad es obligatoria.", "Quantity is required.");
      if (!Number.isInteger(n) || n < 1) return Lx("Escribe una cantidad entera mayor a 0.", "Enter a whole number greater than 0.");
      if (n > LIMITS.quantityMax) return Lx(`Máximo ${LIMITS.quantityMax.toLocaleString()} unidades.`, `Maximum ${LIMITS.quantityMax.toLocaleString()} units.`);
      return "";
    case "budget":
      if (!v) return "";
      if (!(n >= 1)) return Lx("El presupuesto de compra debe ser de al menos US$1.", "The purchase budget must be at least US$1.");
      if (n > LIMITS.budgetMax) return Lx(`Máximo US$${LIMITS.budgetMax.toLocaleString()}.`, `Maximum US$${LIMITS.budgetMax.toLocaleString()}.`);
      return "";
    case "volumeCbm":
      if (!v) return "";
      if (!(n > 0)) return Lx("El volumen debe ser mayor a 0.", "Volume must be greater than 0.");
      if (n > LIMITS.volumeMax) return Lx(`Máximo ${LIMITS.volumeMax.toLocaleString()} m³.`, `Maximum ${LIMITS.volumeMax.toLocaleString()} m³.`);
      return "";
    case "weightKg":
      if (!v) return "";
      if (!(n > 0)) return Lx("El peso debe ser mayor a 0.", "Weight must be greater than 0.");
      if (n > LIMITS.weightMax) return Lx(`Máximo ${LIMITS.weightMax.toLocaleString()} kg.`, `Maximum ${LIMITS.weightMax.toLocaleString()} kg.`);
      return "";
  }
  return "";
}


export function ProductQualification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, L } = useLanguage();

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
  // A saved draft (same session) is restored so nothing typed is lost after an
  // error or a reload. A new query coming from the start screen wins.
  const draft = loadDraft();
  const useDraft = !!draft?.formData && (!userQuery || draft.formData.productType === userQuery);
  const [step, setStep] = useState(useDraft && draft?.step ? draft.step : 1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    // Free-text product description (prefilled with the chat query)
    productType: userQuery,
    material: "",
    quantity: "",
    budget: "",
    destination: "GT", // SEAL SmartTrade AI calculates imports into Guatemala only
    volumeCbm: "", // optional — used to quote ocean freight
    weightKg: "",  // optional
    ...(useDraft ? draft!.formData : {}),
    // a quantity the client gave in the chat ("quiero 2000 en vez de 500")
    ...(location.state?.quantity && Number(location.state.quantity) >= 1 ? { quantity: String(Number(location.state.quantity)) } : {}),
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, step }));
    } catch {
      /* storage unavailable */
    }
  }, [formData, step]);

  const errors = {
    productType: fieldError("productType", formData.productType),
    quantity: fieldError("quantity", formData.quantity),
    budget: fieldError("budget", formData.budget),
    volumeCbm: fieldError("volumeCbm", formData.volumeCbm),
    weightKg: fieldError("weightKg", formData.weightKg),
  };
  const stepValid =
    step === 1
      ? !errors.productType
      : step === 2
        ? !errors.quantity && !errors.budget && !errors.volumeCbm && !errors.weightKg
        : true;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const showErr = (k: keyof typeof errors) =>
    touched[k] && errors[k] ? (
      <p className="text-xs text-red-600 mt-1">
        <span>{errors[k]}</span>
      </p>
    ) : null;
  const touch = (k: string) => setTouched((t0) => ({ ...t0, [k]: true }));
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [searchFailed, setSearchFailed] = useState(false);
  const [helpSent, setHelpSent] = useState<"" | "sending" | "sent" | "error">("");

  // Seconds counter while searching (shown to the client)
  useEffect(() => {
    if (!isLoading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s0) => s0 + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Ask SEAL to review the case when the search can't be completed
  const requestSealReview = async () => {
    setHelpSent("sending");
    try {
      const res = await fetch(`${API}/api/email/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Búsqueda asistida (la consulta no se completó)",
          name: userName,
          email: userEmail,
          productDescription: formData.productType.trim(),
          quantity: formData.quantity,
          budget: formData.budget,
          destination: "Guatemala",
          message: [
            formData.volumeCbm && `Volumen: ${formData.volumeCbm} m³`,
            formData.weightKg && `Peso: ${formData.weightKg} kg`,
          ].filter(Boolean).join(" · "),
        }),
      });
      setHelpSent(res.ok ? "sent" : "error");
    } catch {
      setHelpSent("error");
    }
  };
  // Free searches: the server's count is the only one shown. Until it answers
  // nothing is announced; if it can't be checked, the form says so (no number).
  const [remainingSearches, setRemainingSearches] = useState<number>(-1);
  const [quotaState, setQuotaState] = useState<"checking" | "ok" | "unknown">("checking");
  const [limitReason, setLimitReason] = useState<"email" | "ip" | "rate" | "">("");
  const [retryMinutes, setRetryMinutes] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(getSearchLimit());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch(`${API}/api/suppliers/quota?email=${encodeURIComponent(userEmail || "")}`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((q) => {
        if (cancelled || typeof q?.remaining !== "number") throw new Error("bad quota");
        setRemainingSearches(q.remaining);
        if (Number(q.limit) > 0) setQuotaLimit(Number(q.limit));
        setLimitReason(q.reason || "");
        setQuotaState("ok");
      })
      .catch(() => !cancelled && setQuotaState("unknown"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [userEmail]);

  // ── Submit: call backend then navigate ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The search only runs from step 3 (review), never by moving between steps or pressing Enter earlier
    if (step !== 3 || isLoading) return;

    // ── CHECK LIMIT FIRST (the server's count) ───────────
    if (quotaState === "ok" && remainingSearches === 0) {
      setShowLimitModal(true);
      return;
    }

    if (Object.values(errors).some(Boolean)) {
      setTouched({ productType: true, quantity: true, budget: true, volumeCbm: true, weightKg: true });
      setError(L("Revisa los datos marcados en rojo antes de buscar.", "Check the fields marked in red before searching."));
      return;
    }

    // Sentences addressed to the tool ("garantiza que el proveedor es real")
    // are left out of the search, the category and the reports.
    const { text: productDescription, removed: descriptionCleaned } = cleanDescription(formData.productType);
    if (!descriptionIsDetailed(productDescription)) {
      setTouched((t) => ({ ...t, productType: true }));
      setError(descriptionDetailMessage());
      // the field to fix is on step 1
      setStep(1);
      return;
    }
    const productCategory = inferCategory(productDescription);

    setIsLoading(true);
    setError("");
    setSearchFailed(false);
    setHelpSent("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${API}/api/suppliers/search`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            quantity: String(Number(formData.quantity)),
            productType: productCategory,
            material: "",
            userQuery: productDescription,
            userEmail,
          }),
        },
      );

      // Server-side limit reached → show the limit modal, no demo data
      if (response.status === 429) {
        const info = await response.json().catch(() => ({}));
        if (info?.rateLimited) {
          // too many requests in a short time: not the free-search limit
          setLimitReason("rate");
          setRetryMinutes(Math.max(1, Math.ceil((Number(info.retryAfterSeconds) || 600) / 60)));
        } else {
          setLimitReason(info?.reason === "ip" ? "ip" : "email");
          setRemainingSearches(0);
          setQuotaState("ok");
        }
        setShowLimitModal(true);
        return;
      }

      if (!response.ok) {
        const e = new Error(`HTTP ${response.status}`) as Error & { status?: number };
        e.status = response.status;
        throw e;
      }

      const suppliers = await response.json();

      // The server also checks the description; nothing is searched or counted
      if (suppliers?.needsMoreDetail) {
        setStep(1);
        setTouched((t) => ({ ...t, productType: true }));
        setError(descriptionDetailMessage());
        return;
      }

      // ── RECORD SEARCH ONLY WHEN IT SHOWED OPTIONS ────
      // A search that found nothing useful (no related products, blocked,
      // every option filtered out) or came from cache does not use a free search.
      const counted =
        !suppliers?.fromCache &&
        !suppliers?.blocked &&
        !suppliers?.noRelevantMatches &&
        (suppliers?.topSuppliers?.length ?? 0) > 0;
      if (userEmail && counted) recordSearch(userEmail, userName, productCategory, productDescription);
      // the server says how many are left after this search
      if (typeof suppliers?.remainingSearches === "number") {
        setRemainingSearches(suppliers.remainingSearches);
        setQuotaState("ok");
      }

      navigate("/suppliers", {
        state: {
          ...formData,
          // "1e7" and "1000" mean the same: send the plain number
          quantity: String(Number(formData.quantity)),
          productType: productCategory,
          productDescription,
          descriptionCleaned: descriptionCleaned || !!location.state?.descriptionCleaned,
          suppliers,
        },
      });

    } catch (err) {
      console.error("Supplier search failed:", err);
      // Stay here: the data stays in the form and the search is not counted
      setSearchFailed(true);
      // say what actually happened: timeout, no connection, a rejected request or a server error
      const e = err as Error & { status?: number };
      const kept = L(" Tus datos siguen aquí y la búsqueda no se descontó.", " Your data is still here and the search was not counted.");
      setError(
        e?.name === "AbortError"
          ? L(
              "La búsqueda tardó demasiado y se detuvo (a veces la plataforma de proveedores no responde a tiempo). Puedes intentarlo de nuevo, probar con una descripción un poco más corta, o pedir al equipo de SEAL que revise tu caso.",
              "The search took too long and was stopped (sometimes the supplier platform doesn't answer in time). You can try again, try a slightly shorter description, or ask the SEAL team to review your case.",
            ) + kept
          : e instanceof TypeError
            ? L(
                "No pudimos conectar con el servidor de SmartTrade (revisa tu conexión a internet). Intenta de nuevo en un momento o escribe al WhatsApp de SEAL +502 5996 4664.",
                "We couldn't reach the SmartTrade server (check your internet connection). Try again in a moment or message SEAL on WhatsApp +502 5996 4664.",
              ) + kept
            : e?.status && e.status >= 400 && e.status < 500
              ? L(
                  "El servidor no aceptó los datos de la búsqueda. Revisa la descripción y la cantidad; si el problema sigue, pide al equipo de SEAL que revise tu caso.",
                  "The server didn't accept the search data. Check the description and quantity; if it continues, ask the SEAL team to review your case.",
                ) + kept
              : L(
                  "El servidor tuvo un error al buscar proveedores en este intento. Puedes intentarlo de nuevo en unos minutos o pedir al equipo de SEAL que revise tu caso.",
                  "The server had an error searching suppliers on this attempt. You can try again in a few minutes or ask the SEAL team to review your case.",
                ) + kept,
      );
    } finally {
      clearTimeout(timer);
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
              onClick={() =>
                // back to this case's chat (same request, so its conversation is restored)
                navigate("/chat", { state: { query: userQuery, name: userName, email: userEmail, descriptionCleaned: !!location.state?.descriptionCleaned } })
              }
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
        {quotaState === "checking" ? (
          <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {L("Comprobando tus búsquedas disponibles…", "Checking your available searches…")}
          </div>
        ) : quotaState === "unknown" ? (
          <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {L(
              "No pudimos comprobar tus búsquedas disponibles en este momento. El límite se revisa al consultar; si ya lo alcanzaste, te lo indicaremos.",
              "We couldn't check your available searches right now. The limit is checked when you search; if you've reached it, we'll tell you.",
            )}
          </div>
        ) : (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${remainingSearches === 0
            ? "bg-red-100 text-red-700 border border-red-200"
            : remainingSearches === 1
              ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
              : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}>
            <span>
              {remainingSearches === 0
                ? limitReason === "ip"
                  ? L("🔒 Esta conexión ya usó sus búsquedas gratuitas de hoy", "🔒 This connection has used today's free searches")
                  : L(`🔒 Ya usaste tus ${quotaLimit} consultas. Para seguir, cotiza con SEAL el servicio a largo plazo: +502 5996 4664`, `🔒 You've used your ${quotaLimit} searches. To continue, ask SEAL for a long-term service quote: +502 5996 4664`)
                : L(
                    `🔍 ${remainingSearches} búsqueda${remainingSearches !== 1 ? "s" : ""} restante${remainingSearches !== 1 ? "s" : ""} de ${quotaLimit}`,
                    `🔍 ${remainingSearches} search${remainingSearches !== 1 ? "es" : ""} left of ${quotaLimit}`,
                  )
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
                  onBlur={() => touch("productType")}
                  required
                  rows={8}
                  maxLength={LIMITS.productMax}
                  placeholder={t("qualification.productPlaceholder")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[180px] leading-relaxed"
                />
                <div className="flex justify-between gap-3 text-xs text-slate-500">
                  <span>{t("qualification.productHelp")} {L("(qué es, para qué se usa y, si aplica, capacidad o material)", "(what it is, what it's for and, if relevant, capacity or material)")}</span>
                  <span className="shrink-0">
                    {formData.productType.length.toLocaleString()}/{LIMITS.productMax.toLocaleString()}
                  </span>
                </div>
                {showErr("productType")}
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
                    onBlur={() => touch("quantity")}
                    required
                    placeholder="1000"
                    min="1"
                    max={LIMITS.quantityMax}
                    step="1"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    <span>{L(`Obligatoria · número entero de 1 a ${LIMITS.quantityMax.toLocaleString()}`, `Required · whole number from 1 to ${LIMITS.quantityMax.toLocaleString()}`)}</span>
                  </p>
                  {showErr("quantity")}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <DollarSign className="w-4 h-4" />
                    {t("qualification.budget")}{" "}
                    <span className="text-slate-400 font-normal">{L("(opcional)", "(optional)")}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
                    }
                    onBlur={() => touch("budget")}
                    placeholder="50000"
                    min="1"
                    max={LIMITS.budgetMax}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    <span>{L(`Lo que piensas pagar al proveedor por toda la compra, sin flete ni impuestos (hasta US$${LIMITS.budgetMax.toLocaleString()})`, `What you plan to pay the supplier for the whole purchase, without freight or taxes (up to US$${LIMITS.budgetMax.toLocaleString()})`)}</span>
                  </p>
                  {showErr("budget")}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <Box className="w-4 h-4" />
                      <span>{L("Volumen aproximado (m³)", "Approximate volume (m³)")}</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.volumeCbm}
                      onChange={(e) =>
                        setFormData({ ...formData, volumeCbm: e.target.value })
                      }
                      onBlur={() => touch("volumeCbm")}
                      max={LIMITS.volumeMax}
                      placeholder={L("ej. 3.5", "e.g. 3.5")}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showErr("volumeCbm")}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <Weight className="w-4 h-4" />
                      <span>{L("Peso aproximado (kg)", "Approximate weight (kg)")}</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.weightKg}
                      onChange={(e) =>
                        setFormData({ ...formData, weightKg: e.target.value })
                      }
                      onBlur={() => touch("weightKg")}
                      max={LIMITS.weightMax}
                      placeholder={L("ej. 800", "e.g. 800")}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showErr("weightKg")}
                  </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                  <span>
                    {L(
                      "Opcional, pero con el volumen o el peso te estimamos el flete. Si no lo sabes, déjalo en blanco y un ejecutivo de SEAL te lo cotiza.",
                      "Optional, but with the volume or weight we estimate the freight. If you don't know it, leave it blank and a SEAL executive will quote it.",
                    )}
                  </span>
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
                    <option value="GT">Guatemala</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    <span>
                      {L(
                        "SmartTrade AI está enfocado en importaciones hacia Guatemala: la estimación usa los impuestos y gastos de Guatemala.",
                        "SmartTrade AI focuses on imports into Guatemala: the estimate uses Guatemala's taxes and charges.",
                      )}
                    </span>
                  </p>
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
                      {cleanDescription(formData.productType).text}
                    </p>
                    <p>
                      <span className="font-medium">
                        {t("qualification.quantity")}:
                      </span>{" "}
                      {Number(formData.quantity || 0).toLocaleString()} {quantityWord(cleanDescription(formData.productType).text, Number(formData.quantity || 0)) || unitsWord(Number(formData.quantity || 0))}
                    </p>
                    <p>
                      <span className="font-medium">
                        {t("qualification.budget")}:
                      </span>{" "}
                      {formData.budget ? `US$${Number(formData.budget).toLocaleString()}` : L("No indicado", "Not provided")}
                    </p>
                    <p>
                      <span className="font-medium">{L("Volumen / peso:", "Volume / weight:")}</span>{" "}
                      {formData.volumeCbm || formData.weightKg
                        ? [
                            formData.volumeCbm && `${formData.volumeCbm} m³`,
                            formData.weightKg && `${formData.weightKg} kg`,
                          ]
                            .filter(Boolean)
                            .join(" • ")
                        : L("Por cotizar", "To be quoted")}
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
                  key="next-step"
                  type="button"
                  onClick={() => {
                    if (!stepValid) {
                      setTouched((t0) => ({
                        ...t0,
                        ...(step === 1
                          ? { productType: true }
                          : { quantity: true, budget: true, volumeCbm: true, weightKg: true }),
                      }));
                      return;
                    }
                    setError("");
                    setStep(step + 1);
                  }}
                  aria-disabled={!stepValid}
                  className={`flex-1 px-6 py-3 rounded-lg bg-[#0B3C5D] text-white hover:bg-[#0a2f47] transition-colors flex items-center justify-center gap-2 ${stepValid ? "" : "opacity-60"}`}
                >
                  <span>{t("qualification.next")}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  key="search-submit"
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
                      <span key="loading">{L("Consultando referencias para tu producto…", "Looking up references for your product…")}</span>
                    </>
                  ) : (
                    <>
                      <span key="idle">{t("qualification.findSuppliers")}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Progress while searching */}
            {isLoading && (
              <p className="text-xs text-slate-500 text-center" aria-live="polite">
                <span>
                  {elapsed < 15
                    ? L("Revisando plataformas de proveedores…", "Checking supplier platforms…")
                    : L(
                        `Llevamos ${elapsed} s buscando; puede tardar hasta un minuto y medio. Tus datos ya quedaron guardados.`,
                        `${elapsed} s searching so far; it can take up to a minute and a half. Your data is already saved.`,
                      )}
                </span>
              </p>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800" role="alert">
                <span>⚠️ {error}</span>
                {searchFailed && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47]"
                    >
                      <span>{L("Intentar nuevamente", "Try again")}</span>
                    </button>
                    {helpSent === "sent" ? (
                      <span className="px-2 py-2 text-sm text-green-700">
                        ✅ {L("Recibimos tu caso. Un ejecutivo de SEAL te contactará.", "We received your case. A SEAL executive will contact you.")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={requestSealReview}
                        disabled={helpSent === "sending" || !userEmail}
                        className="px-4 py-2 rounded-lg border-2 border-[#0B3C5D] text-[#0B3C5D] text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
                      >
                        <span>
                          {helpSent === "sending" ? L("Enviando…", "Sending…") : L("Pedir a SEAL que revise mi caso", "Ask SEAL to review my case")}
                        </span>
                      </button>
                    )}
                    {helpSent === "error" && (
                      <span className="px-2 py-2 text-sm text-red-600">
                        {L("No se pudo enviar. Escríbenos al WhatsApp +502 5996 4664.", "Could not send. Message us on WhatsApp +502 5996 4664.")}
                      </span>
                    )}
                  </div>
                )}
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
              {limitReason === "rate"
                ? L("Demasiadas consultas seguidas", "Too many searches in a row")
                : L("Límite de búsquedas alcanzado", "Search limit reached")}
            </h2>

            {/* Description: the reason the server gave */}
            <p className="text-slate-600 mb-2">
              {limitReason === "rate"
                ? L(
                    `Recibimos muchas consultas desde esta conexión en poco tiempo. Intenta de nuevo en unos ${retryMinutes} minutos; esto no gasta tus búsquedas gratuitas.`,
                    `We received many searches from this connection in a short time. Try again in about ${retryMinutes} minutes; this doesn't use your free searches.`,
                  )
                : limitReason === "ip"
                  ? L(
                      `Desde esta conexión ya se usaron las búsquedas gratuitas de hoy (puede pasar si varias personas comparten la misma red).`,
                      `Today's free searches from this connection have been used (this can happen when several people share the same network).`,
                    )
                  : <>{L("Cada correo puede hacer un máximo de", "Each email can run a maximum of")} <strong>{quotaLimit} {L("consultas", "searches")}</strong>{L(", y ya las usaste.", ", and you have used them.")}</>}
            </p>
            {limitReason !== "rate" && (
              <p className="text-slate-600 mb-6">
                {L(
                  "Para seguir usando SmartTrade AI, contacta al equipo de SEAL y cotiza el servicio a largo plazo de esta herramienta.",
                  "To keep using SmartTrade AI, contact the SEAL team for a quote on the long-term service of this tool.",
                )}
              </p>
            )}

            {/* Buttons */}
            <div className="space-y-3">
              {limitReason !== "rate" && (
                <a
                  href={`https://wa.me/50259964664?text=${encodeURIComponent(L("Hola, quiero cotizar el servicio a largo plazo de SEAL SmartTrade AI.", "Hello, I'd like a quote for the long-term SEAL SmartTrade AI service."))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg"
                >
                  💬 {L("Cotizar por WhatsApp", "Get a quote on WhatsApp")}
                </a>
              )}
              <a
                href="tel:+50259964664"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-[#0a2f47] transition-all shadow-lg"
              >
                📞 {L("Contactar SEAL", "Contact SEAL")}: +502 5996 4664
              </a>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all"
              >
                {L("Volver al inicio", "Back to home")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
