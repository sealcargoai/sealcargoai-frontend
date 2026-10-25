import { useState } from "react";
import { descriptionIsDetailed, descriptionDetailMessage, DESCRIPTION_MIN_CHARS } from "../../utils/descriptionCheck";
import { useNavigate } from "react-router";
import { Search, Shield, Globe, TrendingUp, CheckCircle } from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { getUserData, getSearchLimit } from "../../utils/searchLimit";

const QUERY_MIN = DESCRIPTION_MIN_CHARS;
const QUERY_MAX = 1500; // same limit as the product description in the next step
const NAME_MIN = 2;
const NAME_MAX = 120;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;


export function LandingPage() {
  const { t, L } = useLanguage();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();

  const queryTrim = query.trim();
  const queryOk = descriptionIsDetailed(queryTrim) && queryTrim.length <= QUERY_MAX;

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const m = email.trim();
    if (!queryOk) return setFormError(queryTrim.length > QUERY_MAX ? L(`Máximo ${QUERY_MAX.toLocaleString()} caracteres.`, `Maximum ${QUERY_MAX.toLocaleString()} characters.`) : descriptionDetailMessage());
    if (n.length < NAME_MIN) return setFormError(L("Escribe tu nombre completo.", "Enter your full name."));
    if (!EMAIL_RE.test(m)) return setFormError(L("Escribe un correo completo, por ejemplo nombre@empresa.com.", "Enter a complete email, for example name@company.com."));
    setFormError("");
    setSubmitting(true);

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/email/lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, email: m, query: queryTrim }),
        },
      );
    } catch {
      // Lead notification is not critical for the client's flow
    }
    // Initialize user in localStorage
    getUserData(m, n);
    setSubmitting(false);
    navigate("/chat", { state: { query: queryTrim, name: n, email: m } });
  };

  return (
    // Added 'scroll-smooth' here so that clicks glide smoothly instead of jumping instantly
    <div className="min-h-screen scroll-smooth">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        {/* Decreased padding from py-3 to py-1.5 to make the header thinner */}
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Reduced md:h-[85px] to md:h-[65px] so the logo doesn't stretch the navbar height */}
            <img src={logo} alt="SEAL" className="h-12 sm:h-14 md:h-[65px]" />
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <a
              href="#features"
              className="hidden sm:block text-slate-600 hover:text-[#0B3C5D] transition-colors"
            >
              {t("nav.features")}
            </a>
            <a
              href="#how-it-works"
              className="hidden sm:block text-slate-600 hover:text-[#0B3C5D] transition-colors"
            >
              {t("nav.howItWorks")}
            </a>
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://assets.cdn.filesafe.space/3n7o4ZY2ZXykwB7qRwZ3/media/69e52dc650b9a3263a1ff2ab.png"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B3C5D]/85 via-[#0B3C5D]/80 to-blue-900/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-xs sm:text-sm text-white shadow-lg">
              <Globe className="w-4 h-4" /> {t("hero.badge")}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-2xl">
              {t("hero.title")}{" "}
              <span className="block bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent mt-2 sm:mt-3">
                {t("hero.titleHighlight")}
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-50 max-w-2xl mx-auto drop-shadow-lg px-2">
              {t("hero.subtitle")}
            </p>

            {/* Input Section */}
            {!showForm ? (
              <div className="max-w-3xl mx-auto px-2 sm:px-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (queryOk) setShowForm(true);
                  }}
                  className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-3"
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Search className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 ml-2 sm:ml-3 flex-shrink-0" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        maxLength={QUERY_MAX}
                        placeholder={t("hero.placeholder")}
                        className="flex-1 min-w-0 px-1 sm:px-2 py-3 sm:py-5 text-sm sm:text-base md:text-lg outline-none bg-transparent placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!queryOk}
                      className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white text-sm sm:text-base font-semibold hover:from-blue-700 hover:to-[#0a2f47] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl whitespace-nowrap"
                    >
                      <span>{t("hero.cta")}</span>
                    </button>
                  </div>
                  {query.length > 0 && (
                    <div className="flex justify-between gap-3 px-3 pt-2 text-xs text-slate-500">
                      <span>
                        {!descriptionIsDetailed(queryTrim)
                          ? L("Di qué es y para qué se usa (al menos 2 palabras)", "Say what it is and what it's for (at least 2 words)")
                          : L("Puedes detallar más en el siguiente paso", "You can add more detail in the next step")}
                      </span>
                      <span className="shrink-0">
                        {query.length.toLocaleString()}/{QUERY_MAX.toLocaleString()}
                      </span>
                    </div>
                  )}
                </form>
                <p className="text-xs sm:text-sm text-blue-100 mt-3 sm:mt-4 drop-shadow px-2">
                  <span>
                    {t("hero.noCreditCard")} {L(`Incluye ${getSearchLimit()} consultas gratis por correo.`, `Includes ${getSearchLimit()} free searches per email.`)}
                  </span>
                </p>
              </div>
            ) : (
              <div className="max-w-md mx-auto px-2 sm:px-0">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-5 sm:p-8">
                  <h3 className="text-xl sm:text-2xl font-semibold text-[#0B3C5D] mb-4 sm:mb-6">
                    {t("hero.formTitle")}
                  </h3>
                  <form
                    onSubmit={handleStartAnalysis}
                    className="space-y-4 sm:space-y-5"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("hero.nameLabel")}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={NAME_MIN}
                        maxLength={NAME_MAX}
                        autoComplete="name"
                        className="w-full px-4 py-3 sm:py-3.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                        placeholder={t("hero.namePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("hero.emailLabel")}
                      </label>
                      <input
                        type="email"
                        pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
                        title={L("Correo completo, por ejemplo nombre@empresa.com", "Complete email, for example name@company.com")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={254}
                        autoComplete="email"
                        className="w-full px-4 py-3 sm:py-3.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                        placeholder={t("hero.emailPlaceholder")}
                      />
                    </div>
                    <p className="text-xs text-slate-600 text-left leading-relaxed">
                      <span>
                        {L(
                          `Usamos tu nombre y correo para enviarte el informe y para que un ejecutivo de SEAL le dé seguimiento a tu consulta. Tu correo también controla las ${getSearchLimit()} consultas gratis. No lo compartimos con los proveedores.`,
                          `We use your name and email to send you the report and so a SEAL executive can follow up on your request. Your email also tracks the ${getSearchLimit()} free searches. We don't share it with suppliers.`,
                        )}
                      </span>
                    </p>
                    {formError && (
                      <p className="text-sm text-red-600 text-left" role="alert">
                        <span>{formError}</span>
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-6 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white font-semibold hover:from-blue-700 hover:to-[#0a2f47] transition-all shadow-lg hover:shadow-xl disabled:opacity-60 text-sm sm:text-base"
                    >
                      <span>{submitting ? t("hero.processing") : t("hero.continue")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="w-full text-sm text-blue-100 hover:text-white"
                    >
                      {t("hero.back")}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-8 pt-12 flex-wrap">
              <div className="flex items-center gap-2 text-white bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 shadow-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />{" "}
                <span>{t("trust.verified")}</span>
              </div>
              <div className="flex items-center gap-2 text-white bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 shadow-lg">
                <Shield className="w-5 h-5 text-blue-400" />{" "}
                <span>{t("trust.compliance")}</span>
              </div>
              <div className="flex items-center gap-2 text-white bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 shadow-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />{" "}
                <span>{t("trust.pricing")}</span>
              </div>
              <div className="flex items-center gap-2 text-white bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 shadow-lg">
                <Globe className="w-5 h-5 text-cyan-400" />{" "}
                <span>{t("trust.network")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      {/* FIX: Added scroll-mt-28 to offset the fixed nav container height */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-6 py-24 -mt-16 relative z-20 scroll-mt-28"
      >
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#0B3C5D] mb-4">
            {t("features.title")}
          </h2>
          <p className="text-xl text-slate-600">{t("features.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Search,
              titleKey: "features.supplier.title",
              descKey: "features.supplier.desc",
              gradient: "from-blue-500 to-blue-600",
            },
            {
              icon: TrendingUp,
              titleKey: "features.cost.title",
              descKey: "features.cost.desc",
              gradient: "from-purple-500 to-purple-600",
            },
            {
              icon: Shield,
              titleKey: "features.risk.title",
              descKey: "features.risk.desc",
              gradient: "from-green-500 to-green-600",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl p-8 shadow-xl border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2 duration-300"
            >
              <div
                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
              >
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-[#0B3C5D] mb-3">
                {t(feature.titleKey)}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      {/* FIX: Added scroll-mt-24 to offset the fixed nav container height */}
      <section
        id="how-it-works"
        className="bg-gradient-to-br from-slate-50 to-blue-50 py-24 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-[#0B3C5D] mb-4">
              {t("howItWorks.title")}
            </h2>
            {t("howItWorks.subtitle") && (
              <p className="text-xl text-slate-600">{t("howItWorks.subtitle")}</p>
            )}
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                titleKey: "howItWorks.step1.title",
                descKey: "howItWorks.step1.desc",
                color: "from-blue-500 to-blue-600",
              },
              {
                step: "2",
                titleKey: "howItWorks.step2.title",
                descKey: "howItWorks.step2.desc",
                color: "from-purple-500 to-purple-600",
              },
              {
                step: "3",
                titleKey: "howItWorks.step3.title",
                descKey: "howItWorks.step3.desc",
                color: "from-green-500 to-green-600",
              },
              {
                step: "4",
                titleKey: "howItWorks.step4.title",
                descKey: "howItWorks.step4.desc",
                color: "from-orange-500 to-orange-600",
              },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300`}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-[#0B3C5D] mb-3">
                  {t(item.titleKey)}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {t(item.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-[#0B3C5D] to-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src={logo}
                alt="SEAL"
                className="h-[85px] brightness-0 invert drop-shadow-lg"
              />
              <span className="text-2xl font-bold">SmartTrade AI</span>
            </div>
            <p className="text-blue-200 text-lg">{t("footer.tagline")}</p>
          </div>
          <div className="border-t border-white/20 pt-8 text-center">
            <p className="text-blue-100">{t("footer.poweredby")} <a href="https://www.netreachgo.com" target="_blank" rel="noopener noreferrer" className="text-decoration-none text-blue-300 hover:text-blue-100 transition-colors cursor-pointer text-bold">
              NetReachGo
            </a> {t("footer.copyright")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
