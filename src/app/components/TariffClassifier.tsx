// 20-11: «Clasificador arancelario SEAL» — lead magnet at /clasificador.
// Screen 1: what the tool does (SEAL brand). Screen 2: name, phone and email (confirmed with a code).
// Screen 3: the goods (description, technical sheet, photos, origin). Screen 4: the preliminary inciso with
// its technical justification, the general and preferential DAI, the probable permits and the entity.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FileText, ShieldCheck, Scale, Landmark, Upload, X, CheckCircle2, AlertTriangle, ChevronDown, Loader2, Calculator, MessageCircle, RotateCcw } from "lucide-react";
import logo from "../../imports/seal-logo.webp";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { emailProblem } from "../../utils/emailFormat";
import { startVerification, confirmVerification, verifiedSessionFor } from "../../utils/verifiedEmail";
import { classify, classifyQuota, prepareFile, saveDutyForCase, MAX_FILES, type ClassificationResult, type UploadFile, type ClassifyError } from "../../utils/classification";
import { currentCase, writeCaseTx } from "../../utils/caseStore";
import { track } from "../../utils/funnel";

const SEAL_WHATSAPP = "50259964664";
const ORIGINS: [string, string][] = [
  ["CN", "China"], ["US", "Estados Unidos"], ["MX", "México"], ["TW", "Taiwán"], ["CO", "Colombia"], ["CL", "Chile"], ["PA", "Panamá"],
  ["DO", "República Dominicana"], ["SV", "El Salvador"], ["HN", "Honduras"], ["NI", "Nicaragua"], ["CR", "Costa Rica"], ["BZ", "Belice"],
  ["EC", "Ecuador"], ["CU", "Cuba"], ["IL", "Israel"], ["GB", "Reino Unido"], ["ES", "España"], ["DE", "Alemania"], ["IT", "Italia"],
  ["FR", "Francia"], ["NL", "Países Bajos"], ["PT", "Portugal"], ["BE", "Bélgica"], ["PL", "Polonia"], ["AT", "Austria"], ["SE", "Suecia"],
  ["DK", "Dinamarca"], ["IE", "Irlanda"], ["CZ", "Chequia"], ["JP", "Japón"], ["KR", "Corea del Sur"], ["IN", "India"], ["VN", "Vietnam"],
  ["TH", "Tailandia"], ["MY", "Malasia"], ["ID", "Indonesia"], ["TR", "Turquía"], ["BR", "Brasil"], ["AR", "Argentina"], ["PE", "Perú"],
  ["CA", "Canadá"], ["BD", "Bangladés"], ["PK", "Pakistán"], ["AE", "Emiratos Árabes Unidos"],
];
const FUNDAMENTO: [string, string, string][] = [
  ["naturaleza", "Naturaleza de la mercancía", "Nature of the goods"],
  ["ubicacion", "Sección y capítulo", "Section and chapter"],
  ["notas_legales", "Notas legales de sección y capítulo", "Section and chapter legal notes"],
  ["reglas_aplicadas", "Reglas Generales de Interpretación aplicadas", "General Interpretative Rules applied"],
  ["notas_explicativas", "Notas Explicativas del Sistema Armonizado", "Harmonized System Explanatory Notes"],
  ["subpartida_e_inciso", "Subpartida e inciso", "Subheading and tariff line"],
  ["descartes", "Alternativas descartadas", "Alternatives ruled out"],
  ["texto", "Fundamento", "Justification"],
];

type Step = "intro" | "contact" | "goods" | "working" | "result";

export function TariffClassifier() {
  const { L, language } = useLanguage();
  const lang = language === "en" ? "en" : "es";
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [step]);
  useEffect(() => {
    track("clasificador_visita");
  }, []);

  // ── contact ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  // ── goods ──
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [use, setUse] = useState("");
  const [presentation, setPresentation] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [origin, setOrigin] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [workMsg, setWorkMsg] = useState(0);
  const [dutySaved, setDutySaved] = useState(false);

  const contactProblem = (): string => {
    if (name.trim().length < 2) return L("Escriba su nombre completo.", "Enter your full name.");
    if (phone.replace(/\D/g, "").length < 8) return L("Escriba un teléfono o WhatsApp válido (8 dígitos o más, con código de país si es fuera de Guatemala).", "Enter a valid phone or WhatsApp number.");
    const p = emailProblem(email.trim());
    if (p === "unsupported") return L("Escriba el correo sin tildes, eñes ni caracteres especiales.", "Write the email without accents or special characters.");
    if (p) return L("Escriba un correo completo, por ejemplo nombre@empresa.com.", "Enter a complete email, for example name@company.com.");
    if (!consent) return L("Para continuar, acepte que SEAL le contacte con el resultado.", "To continue, agree that SEAL may contact you with the result.");
    return "";
  };

  async function afterVerified() {
    const session = verifiedSessionFor(email);
    const left = await classifyQuota(email, session);
    setRemaining(left);
    track("clasificador_contacto");
    setStep("goods");
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const p = contactProblem();
    if (p) return setError(p);
    setError("");
    if (verifiedSessionFor(email)) return afterVerified();
    setBusy(true);
    const r = await startVerification(email.trim(), lang);
    setBusy(false);
    if (r === "sent") return setCodeSent(true);
    setError(
      r === "limit"
        ? L("Se pidieron muchos códigos para este correo. Espere unos minutos e intente de nuevo.", "Too many codes were requested. Wait a few minutes and try again.")
        : r === "not_supported" || r === "invalid"
          ? L("Revise el correo: no se pudo enviar el código a esa dirección.", "Check the email: the code could not be sent.")
          : L("No se pudo enviar el código en este momento. Intente de nuevo.", "The code could not be sent right now. Try again."),
    );
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await confirmVerification(email.trim(), code);
    setBusy(false);
    if (r.ok) {
      setError("");
      return afterVerified();
    }
    setError(r.reason === "format" ? L("El código tiene 10 letras y números, como lo recibió en su correo.", "The code has 10 letters and digits, as in your email.") : r.reason === "wrong" ? L("El código no es correcto o ya venció. Revise el correo o pida uno nuevo.", "The code is wrong or expired.") : L("No se pudo confirmar el código. Intente de nuevo.", "The code could not be confirmed. Try again."));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setError(L(`Puede adjuntar hasta ${MAX_FILES} archivos.`, `You can attach up to ${MAX_FILES} files.`));
        break;
      }
      const r = await prepareFile(f);
      if ("error" in r) {
        setError(
          r.error === "file_type"
            ? L("Adjunte la ficha técnica en PDF y fotos en JPG, PNG o WEBP.", "Attach the technical sheet as PDF and photos as JPG, PNG or WEBP.")
            : r.error === "file_too_large"
              ? L("La ficha técnica en PDF puede pesar hasta 4 MB.", "The PDF technical sheet can be up to 4 MB.")
              : L("No se pudo leer una de las fotos. Pruebe con JPG o PNG.", "One photo could not be read. Try JPG or PNG."),
        );
        continue;
      }
      next.push(r);
    }
    setFiles(next);
  }

  const goodsProblem = (): string => {
    if (productName.trim().length < 3) return L("Escriba el nombre comercial de la mercancía.", "Enter the commercial name of the goods.");
    if (description.trim().length < 15 && !files.length) return L("Describa la mercancía (qué es, de qué está hecha y para qué sirve) o adjunte la ficha técnica.", "Describe the goods or attach the technical sheet.");
    return "";
  };

  const WORK_MSGS = [
    L("Analizando la naturaleza de la mercancía…", "Analyzing the nature of the goods…"),
    L("Ubicando sección y capítulo del Sistema Arancelario Centroamericano…", "Locating section and chapter…"),
    L("Revisando notas legales y Notas Explicativas…", "Reviewing legal and Explanatory Notes…"),
    L("Aplicando las Reglas Generales de Interpretación…", "Applying the General Interpretative Rules…"),
    L("Calculando el DAI general y preferencial…", "Computing general and preferential duty…"),
  ];

  async function runClassification(e: React.FormEvent) {
    e.preventDefault();
    const p = goodsProblem();
    if (p) return setError(p);
    setError("");
    setStep("working");
    setWorkMsg(0);
    const timer = setInterval(() => setWorkMsg((m) => Math.min(m + 1, WORK_MSGS.length - 1)), 9000);
    const r = await classify(
      { name: name.trim(), phone: phone.trim(), email: email.trim(), company: company.trim() },
      { productName: productName.trim(), description: description.trim(), material: material.trim(), use: use.trim(), presentation: presentation.trim(), brandModel: brandModel.trim(), origin },
      files,
      verifiedSessionFor(email),
      lang,
    );
    clearInterval(timer);
    if (r.ok) {
      setResult(r.result);
      setRemaining(r.result.restantes);
      setDutySaved(false);
      track("clasificador_resultado");
      setStep("result");
      return;
    }
    setStep(r.error === "session_invalid" ? "contact" : "goods");
    if (r.error === "session_invalid") setCodeSent(false);
    setError(errorText(r.error));
  }

  function errorText(e: ClassifyError): string {
    switch (e) {
      case "session_invalid":
        return L("Su confirmación de correo venció. Confírmelo de nuevo con un código.", "Your email confirmation expired. Confirm it again.");
      case "email_limit":
        return L("Ya usó las consultas gratuitas de este correo. Un ejecutivo de SEAL puede clasificar más mercancías: escríbanos por WhatsApp.", "You have used the free queries for this email. Contact SEAL on WhatsApp for more.");
      case "daily_limit":
        return L("El clasificador alcanzó el límite de consultas de hoy. Intente mañana o escríbanos por WhatsApp.", "The classifier reached today's limit. Try tomorrow or contact SEAL.");
      case "not_goods":
        return L("No pudimos identificar una mercancía en lo que escribió. Describa el producto: qué es, de qué está hecho y para qué sirve.", "We could not identify goods in your text. Describe the product.");
      case "no_match":
      case "bad_answer":
        return L("No logramos una clasificación confiable con esta información. Agregue más detalle (materia, función, uso) o adjunte la ficha técnica; no se descontó la consulta.", "We could not reach a reliable classification. Add more detail or the technical sheet; the query was not counted.");
      case "file_too_large":
      case "too_many_files":
      case "file_type":
        return L("Revise los archivos: hasta 4, PDF de hasta 4 MB y fotos JPG, PNG o WEBP.", "Check the files: up to 4, PDF up to 4 MB, photos JPG/PNG/WEBP.");
      case "not_configured":
        return L("El clasificador no está disponible en este momento. Escríbanos por WhatsApp y un agente de SEAL le ayuda.", "The classifier is not available right now. Contact SEAL on WhatsApp.");
      default:
        return L("No se pudo completar la clasificación en este momento; no se descontó la consulta. Intente de nuevo en unos minutos.", "The classification could not be completed; the query was not counted. Try again shortly.");
    }
  }

  function applyDuty() {
    if (!result) return;
    // the DAI goes with THIS product: the current case becomes this product when it was another one
    const caseProduct = currentCase().product;
    const product = caseProduct && productName && caseProduct.toLowerCase().includes(productName.toLowerCase().split(" ")[0]) ? caseProduct : productName.trim();
    if (product !== caseProduct) writeCaseTx({ product });
    const saved = saveDutyForCase(product, result);
    setDutySaved(!!saved);
    track("clasificador_usar_dai");
  }

  function newQuery() {
    setResult(null);
    setProductName("");
    setDescription("");
    setMaterial("");
    setUse("");
    setPresentation("");
    setBrandModel("");
    setFiles([]);
    setError("");
    setStep("goods");
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/40";
  const label = "block text-sm font-medium text-slate-700 mb-1";
  const card = "bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8";
  const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B3C5D] px-6 py-3 font-semibold text-white hover:bg-[#0a3350] disabled:opacity-60";
  const waLink = (text: string) => `https://wa.me/${SEAL_WHATSAPP}?text=${encodeURIComponent(text)}`;

  return (
    <div className="min-h-screen" ref={top}>
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-between">
          <a href="https://seal.com.gt" target="_blank" rel="noopener noreferrer">
            <img src={logo} alt="SEAL – Agencia de aduanas y carga" className="h-12 sm:h-14" />
          </a>
          <div className="flex items-center gap-3">
            <a href={waLink(L("Hola, quiero ayuda con la clasificación arancelaria de una mercancía.", "Hello, I need help with a tariff classification."))} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-2 text-sm text-[#0B3C5D] font-medium">
              <MessageCircle className="w-4 h-4" /> {L("Hablar con un agente", "Talk to an agent")}
            </a>
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {step === "intro" && (
        <>
          <section className="bg-gradient-to-br from-[#0B3C5D] via-[#0B3C5D] to-blue-900 text-white">
            <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-4 py-1.5 text-sm">
                <Scale className="w-4 h-4" /> {L("Clasificador arancelario SEAL · Guatemala", "SEAL tariff classifier · Guatemala")}
              </span>
              <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
                {L("¿En qué fracción arancelaria se clasifica su mercancía", "Which tariff line does your product fall under")}
                <span className="block text-cyan-200 mt-2">{L("y cuánto paga de impuestos al importarla?", "and how much duty will you pay?")}</span>
              </h1>
              <p className="text-lg text-blue-50 max-w-3xl mx-auto">
                {L(
                  "Describa su producto o suba la ficha técnica y fotos. Le indicamos la fracción arancelaria del Arancel Centroamericano 2026 con su fundamento técnico, el DAI general y el preferencial si viene de un país con tratado de libre comercio, y los permisos de importación con la entidad de Guatemala que los emite.",
                  "Describe your product or upload its technical sheet and photos. We give you the tariff line of the 2026 Central American Tariff with its technical justification, the general and preferential duty, and the import permits with the Guatemalan agency that issues them.",
                )}
              </p>
              <button className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-[#0B3C5D] hover:bg-blue-50" onClick={() => setStep("contact")}>
                {L("Consultar mi mercancía — sin costo", "Check my product — free")}
              </button>
              <p className="text-sm text-blue-100">{L("Resultado en menos de dos minutos · Un agente de SEAL revisa su caso", "Result in under two minutes · A SEAL agent reviews your case")}</p>
            </div>
          </section>
          <section className="max-w-6xl mx-auto px-6 py-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [FileText, L("Fracción arancelaria", "Tariff line"), L("Inciso SAC de 10 dígitos con la explicación técnica: notas legales, Reglas Generales de Interpretación y Notas Explicativas.", "10-digit SAC line with the technical explanation.")],
              [Scale, L("Impuestos de importación", "Import duties"), L("DAI general y DAI preferencial según el país de origen (México, CAFTA, Unión Europea, Taiwán, Colombia, Chile y más), más el IVA del 12%.", "General and preferential duty by origin, plus 12% VAT.")],
              [Landmark, L("Permisos y entidad", "Permits and agency"), L("Si su mercancía requiere permiso o registro antes de importarse y qué entidad lo emite: MAGA, MSPAS, MEM, MARN, DIGECAM y otras.", "Whether permits are needed and which agency issues them.")],
              [ShieldCheck, L("Respaldo de expertos", "Expert backing"), L("SEAL es agencia de aduanas y carga con un equipo de más de 25 años de experiencia. Un ejecutivo revisa su resultado.", "SEAL is a customs and freight agency with a team of 25+ years of experience.")],
            ].map(([Icon, title, text], i) => {
              const I = Icon as typeof FileText;
              return (
                <div key={i} className={card}>
                  <I className="w-8 h-8 text-[#0B3C5D] mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-2">{title as string}</h3>
                  <p className="text-sm text-slate-600">{text as string}</p>
                </div>
              );
            })}
          </section>
          <section className="bg-white border-y border-slate-200">
            <div className="max-w-5xl mx-auto px-6 py-12">
              <h2 className="text-2xl font-bold text-[#0B3C5D] text-center mb-8">{L("Cómo funciona", "How it works")}</h2>
              <ol className="grid gap-6 sm:grid-cols-3">
                {[
                  [L("Sus datos", "Your details"), L("Nombre, teléfono y correo. Confirmamos su correo con un código.", "Name, phone and email, confirmed with a code.")],
                  [L("Su mercancía", "Your goods"), L("Descripción, ficha técnica y fotos, y el país de origen.", "Description, technical sheet, photos and origin.")],
                  [L("Su resultado", "Your result"), L("Fracción arancelaria, impuestos, permisos y la explicación técnica.", "Tariff line, duties, permits and the technical explanation.")],
                ].map(([t, d], i) => (
                  <li key={i} className="text-center">
                    <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3C5D] text-white font-bold">{i + 1}</span>
                    <p className="font-semibold text-slate-900">{t}</p>
                    <p className="text-sm text-slate-600">{d}</p>
                  </li>
                ))}
              </ol>
              <div className="text-center mt-10">
                <button className={primary} onClick={() => setStep("contact")}>
                  {L("Comenzar", "Start")}
                </button>
              </div>
            </div>
          </section>
          <p className="max-w-4xl mx-auto px-6 py-8 text-xs text-slate-500 text-center">
            {L(
              "Resultado preliminar y orientativo, elaborado con inteligencia artificial sobre el Arancel Centroamericano de Importación 2026 y las Notas Explicativas del Sistema Armonizado. No es una clasificación vinculante; la clasificación vinculante se obtiene con una resolución anticipada de la SAT.",
              "Preliminary, indicative result produced with AI on the 2026 Central American Import Tariff and the HS Explanatory Notes. It is not a binding classification.",
            )}
          </p>
        </>
      )}

      {step === "contact" && (
        <section className="max-w-xl mx-auto px-6 py-12">
          <Progress n={1} L={L} />
          <div className={card}>
            <h2 className="text-2xl font-bold text-[#0B3C5D] mb-1">{L("Sus datos de contacto", "Your contact details")}</h2>
            <p className="text-sm text-slate-600 mb-6">{L("Le enviaremos el resultado y un ejecutivo de SEAL podrá darle seguimiento.", "We'll send you the result and a SEAL executive can follow up.")}</p>
            {!codeSent ? (
              <form onSubmit={sendCode} className="space-y-4">
                <div>
                  <label className={label}>{L("Nombre completo", "Full name")} *</label>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
                </div>
                <div>
                  <label className={label}>{L("Teléfono / WhatsApp", "Phone / WhatsApp")} *</label>
                  <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" placeholder="+502 5555 5555" />
                </div>
                <div>
                  <label className={label}>{L("Correo electrónico", "Email")} *</label>
                  <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} type="email" autoComplete="email" />
                </div>
                <div>
                  <label className={label}>{L("Empresa (opcional)", "Company (optional)")}</label>
                  <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} autoComplete="organization" />
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>{L("Acepto que SEAL me contacte por teléfono, WhatsApp o correo para dar seguimiento a esta consulta.", "I agree that SEAL may contact me to follow up on this query.")}</span>
                </label>
                {error && <ErrorBox text={error} />}
                <button className={`${primary} w-full`} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {L("Continuar", "Continue")}
                </button>
              </form>
            ) : (
              <form onSubmit={checkCode} className="space-y-4">
                <p className="text-sm text-slate-700">
                  {L("Le enviamos un código de 10 caracteres a", "We sent a 10-character code to")} <b>{email}</b>. {L("Revise también la carpeta de spam.", "Check your spam folder too.")}
                </p>
                <input className={`${input} tracking-widest text-center text-lg`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={24} placeholder="XXXXX-XXXXX" autoComplete="one-time-code" />
                {error && <ErrorBox text={error} />}
                <button className={`${primary} w-full`} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {L("Confirmar correo", "Confirm email")}
                </button>
                <button type="button" className="w-full text-sm text-slate-500 underline" onClick={() => { setCodeSent(false); setCode(""); setError(""); }}>
                  {L("Cambiar el correo o pedir otro código", "Change the email or request another code")}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {step === "goods" && (
        <section className="max-w-2xl mx-auto px-6 py-12">
          <Progress n={2} L={L} />
          <form className={card} onSubmit={runClassification}>
            <h2 className="text-2xl font-bold text-[#0B3C5D] mb-1">{L("Información de la mercancía", "About the goods")}</h2>
            <p className="text-sm text-slate-600 mb-6">
              {L("Entre más detalle técnico, más precisa la clasificación: qué es, de qué está hecha, cómo funciona y para qué se usa.", "The more technical detail, the more accurate the classification.")}
              {remaining !== null && <span className="block mt-1 text-slate-500">{L(`Consultas disponibles con este correo: ${remaining}.`, `Queries left for this email: ${remaining}.`)}</span>}
            </p>
            <div className="space-y-4">
              <div>
                <label className={label}>{L("Nombre comercial de la mercancía", "Commercial name")} *</label>
                <input className={input} value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={200} placeholder={L("Ej.: Bomba de agua sumergible de 1 HP", "E.g. 1 HP submersible water pump")} />
              </div>
              <div>
                <label className={label}>{L("Descripción", "Description")} *</label>
                <textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} placeholder={L("Qué es, cómo funciona, características técnicas, medidas, potencia, capacidad…", "What it is, how it works, technical specs…")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>{L("Materia o composición", "Material / composition")}</label>
                  <input className={input} value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={400} placeholder={L("Ej.: acero inoxidable 80%, plástico 20%", "E.g. 80% stainless steel")} />
                </div>
                <div>
                  <label className={label}>{L("Función o uso", "Function / use")}</label>
                  <input className={input} value={use} onChange={(e) => setUse(e.target.value)} maxLength={400} placeholder={L("Ej.: uso doméstico, industrial, agrícola…", "E.g. household, industrial…")} />
                </div>
                <div>
                  <label className={label}>{L("Presentación", "Presentation")}</label>
                  <input className={input} value={presentation} onChange={(e) => setPresentation(e.target.value)} maxLength={300} placeholder={L("Ej.: a granel, en caja para venta al por menor, en juego…", "E.g. bulk, retail box, set…")} />
                </div>
                <div>
                  <label className={label}>{L("Marca y modelo", "Brand and model")}</label>
                  <input className={input} value={brandModel} onChange={(e) => setBrandModel(e.target.value)} maxLength={200} />
                </div>
              </div>
              <div>
                <label className={label}>{L("País de origen de la mercancía", "Country of origin")}</label>
                <select className={input} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                  <option value="">{L("Seleccione (para calcular el DAI preferencial)", "Select (to compute the preferential duty)")}</option>
                  {ORIGINS.map(([iso, n]) => (
                    <option key={iso} value={iso}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>{L("Ficha técnica y fotos (opcional, hasta 4 archivos)", "Technical sheet and photos (optional, up to 4)")}</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-slate-600 hover:border-[#0B3C5D]">
                  <Upload className="w-5 h-5" /> {L("Subir PDF o fotos (JPG, PNG)", "Upload PDF or photos")}
                  <input type="file" className="hidden" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded bg-slate-100 px-3 py-1.5 text-sm">
                        <span className="truncate">{f.name}</span>
                        <button type="button" aria-label={L("Quitar", "Remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {error && <ErrorBox text={error} wa={waLink(L(`Hola, quiero clasificar: ${productName}`, `Hello, I want to classify: ${productName}`))} L={L} />}
              <button className={`${primary} w-full`}>{L("Clasificar mi mercancía", "Classify my product")}</button>
            </div>
          </form>
        </section>
      )}

      {step === "working" && (
        <section className="max-w-xl mx-auto px-6 py-24 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#0B3C5D] mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-[#0B3C5D] mb-2">{L("Clasificando su mercancía", "Classifying your goods")}</h2>
          <p className="text-slate-600">{WORK_MSGS[workMsg]}</p>
          <p className="text-sm text-slate-400 mt-4">{L("Puede tardar hasta un minuto.", "This can take up to a minute.")}</p>
        </section>
      )}

      {step === "result" && result && (
        <section className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <Progress n={3} L={L} />
          {result.simulado && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900 font-semibold">
              {L("MODO DE PRUEBA: resultado simulado, sin inteligencia artificial y sin costo. No es una clasificación real.", "TEST MODE: simulated result, no AI and no cost. Not a real classification.")}
            </div>
          )}
          <div className={card}>
            <p className="text-sm uppercase tracking-wide text-slate-500">{L("Fracción arancelaria preliminar (inciso SAC)", "Preliminary tariff line (SAC)")}</p>
            <p className="text-4xl font-bold text-[#0B3C5D] my-2 tabular-nums">{result.inciso}</p>
            <p className="text-slate-700">{result.descripcion}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ConfidenceBadge c={result.confianza} L={L} />
              {result.caso && <span className="text-xs text-slate-500">{L("Caso", "Case")} {result.caso}</span>}
            </div>
            {result.resumen && <p className="mt-4 text-slate-800">{result.resumen}</p>}
          </div>

          <div className={card}>
            <h3 className="text-lg font-semibold text-[#0B3C5D] mb-4">{L("Impuestos de importación", "Import duties")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{L("DAI general (NMF)", "General duty (MFN)")}</p>
                <p className="text-2xl font-bold text-slate-900">{result.dai.general.text}</p>
                <p className="text-xs text-slate-500">{L("Sobre el valor CIF", "On the CIF value")}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-slate-500">{result.origen ? `${L("DAI preferencial", "Preferential duty")} · ${result.origen.nombre}` : L("DAI preferencial", "Preferential duty")}</p>
                {result.dai.preferencial ? (
                  <>
                    <p className="text-2xl font-bold text-emerald-800">{result.dai.preferencial.pct !== null ? `${result.dai.preferencial.pct}%` : "—"}</p>
                    <p className="text-xs text-slate-600">{result.dai.preferencial.agreement}</p>
                    <p className="text-xs text-slate-500 mt-1">{result.dai.preferencial.pct === null ? result.dai.preferencial.text : result.dai.preferencial.note}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 mt-1">
                    {result.origen
                      ? L(`Guatemala no tiene tratado de libre comercio vigente con ${result.origen.nombre} en el arancel: aplica el DAI general.`, `No trade agreement with ${result.origen.nombre} in the tariff: the general duty applies.`)
                      : L("Indique el país de origen para ver si aplica un tratado.", "Enter the origin to see if an agreement applies.")}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-4">{L(`Además se paga IVA del ${result.iva}% sobre el valor CIF más el DAI.`, `Plus ${result.iva}% VAT on CIF plus duty.`)}</p>
            {result.dai.nota.map((n, i) => (
              <p key={i} className="text-sm text-amber-700 mt-2">{n}</p>
            ))}
          </div>

          <div className={card}>
            <h3 className="text-lg font-semibold text-[#0B3C5D] mb-4">{L("Permisos de importación", "Import permits")}</h3>
            {result.permisos.length ? (
              <ul className="space-y-3">
                {result.permisos.map((p) => (
                  <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-slate-900">{p.entidad}</p>
                    <p className="text-sm text-slate-700">{p.tramite}</p>
                    {p.condicion && <p className="text-xs text-slate-600 mt-1">{p.condicion}</p>}
                    {!p.validado && <p className="text-xs text-amber-800 mt-1">{L("Requisito probable: un agente de SEAL lo confirma para su caso.", "Probable requirement: a SEAL agent confirms it.")}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-700 flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                {L("No identificamos permisos de importación específicos para esta fracción. Un agente de SEAL lo confirma según el uso y el origen de su mercancía.", "No specific import permits identified for this line. A SEAL agent confirms it.")}
              </p>
            )}
          </div>

          <div className={card}>
            <h3 className="text-lg font-semibold text-[#0B3C5D] mb-2">{L("Explicación técnica de la clasificación", "Technical explanation")}</h3>
            {result.descripcionTecnica && <p className="text-sm text-slate-700 mb-3">{result.descripcionTecnica}</p>}
            {FUNDAMENTO.filter(([k]) => result.fundamento?.[k]).map(([k, es, en]) => (
              <details key={k} className="group border-t border-slate-200 py-3" open={k === "reglas_aplicadas"}>
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-900">
                  {L(es, en)} <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{result.fundamento[k]}</p>
              </details>
            ))}
            {result.alternativas.length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <p className="font-medium text-slate-900 mb-1">{L("Otras fracciones posibles", "Other possible lines")}</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {result.alternativas.map((a) => (
                    <li key={a.inciso}>
                      <b className="tabular-nums">{a.inciso}</b> — {a.cuando}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.datosFaltantes.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">{L("Datos que pueden cambiar la clasificación", "Data that could change the classification")}</p>
                <ul className="list-disc pl-5 text-sm text-slate-700">
                  {result.datosFaltantes.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={`${card} space-y-3`}>
            <h3 className="text-lg font-semibold text-[#0B3C5D]">{L("Siguiente paso", "Next step")}</h3>
            {result.dai.aplicable !== null && (
              dutySaved ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {L(`Listo: el cálculo de importación usará un DAI de ${result.dai.aplicable}% para este producto.`, `Done: the import estimate will use ${result.dai.aplicable}% duty.`)}
                  </p>
                  <button className={primary} onClick={() => navigate("/")}>
                    <Calculator className="w-4 h-4" /> {L("Ir a la calculadora", "Go to the calculator")}
                  </button>
                </div>
              ) : (
                <button className={primary} onClick={applyDuty}>
                  <Calculator className="w-4 h-4" /> {L(`Usar este DAI (${result.dai.aplicable}%) en mi cálculo de importación`, `Use this duty (${result.dai.aplicable}%) in my import estimate`)}
                </button>
              )
            )}
            <a className="inline-flex items-center gap-2 rounded-lg border border-[#0B3C5D] px-6 py-3 font-semibold text-[#0B3C5D] hover:bg-blue-50 mr-3" href={waLink(L(`Hola, consulté el clasificador de SEAL (caso ${result.caso}): ${productName} → ${result.inciso}. Quiero que un agente confirme la clasificación.`, `Hello, I used the SEAL classifier (case ${result.caso}): ${productName} → ${result.inciso}.`))} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4" /> {L("Confirmar con un agente de SEAL", "Confirm with a SEAL agent")}
            </a>
            {remaining !== null && remaining > 0 && (
              <button className="inline-flex items-center gap-2 text-sm text-slate-600 underline" onClick={newQuery}>
                <RotateCcw className="w-4 h-4" /> {L(`Clasificar otra mercancía (${remaining} disponible${remaining === 1 ? "" : "s"})`, `Classify another product (${remaining} left)`)}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">{result.aviso} {L("Fuente:", "Source:")} {result.fuente}.</p>
        </section>
      )}
    </div>
  );
}

function Progress({ n, L }: { n: number; L: (es: string, en: string) => string }) {
  const steps = [L("Sus datos", "Your details"), L("Mercancía", "Goods"), L("Resultado", "Result")];
  return (
    <ol className="mb-6 flex items-center justify-center gap-3 text-sm">
      {steps.map((s, i) => (
        <li key={s} className={`flex items-center gap-2 ${i + 1 <= n ? "text-[#0B3C5D] font-semibold" : "text-slate-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i + 1 <= n ? "bg-[#0B3C5D] text-white" : "bg-slate-200"}`}>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function ErrorBox({ text, wa, L }: { text: string; wa?: string; L?: (es: string, en: string) => string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        {text}
        {wa && L && (
          <>
            {" "}
            <a className="underline" href={wa} target="_blank" rel="noopener noreferrer">
              {L("Escribir por WhatsApp", "WhatsApp us")}
            </a>
          </>
        )}
      </span>
    </div>
  );
}

function ConfidenceBadge({ c, L }: { c: "alta" | "media" | "baja"; L: (es: string, en: string) => string }) {
  const map = {
    alta: ["bg-emerald-100 text-emerald-800", L("Confianza alta", "High confidence")],
    media: ["bg-amber-100 text-amber-800", L("Confianza media: conviene confirmarla", "Medium confidence")],
    baja: ["bg-red-100 text-red-800", L("Confianza baja: faltan datos de la mercancía", "Low confidence")],
  } as const;
  const [cls, text] = map[c] || map.media;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{text}</span>;
}
