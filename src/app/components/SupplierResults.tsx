import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Star,
  MapPin,
  Package,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Filter,
  Mail,
  Phone,
  Heart,
  X,
  Zap,
  Award,
  Shield,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { SEAL_COMPANY } from "../../utils/reportExports";
import { calculateCosts, useRates, formatQ, formatUSD } from "../../utils/costCalculator";
import { Lx, plural } from "../../utils/lang";
import { requestedSpecs, matchSpecs, orderBySpecs, type Spec } from "../../utils/capacity";
import { flagPrices } from "../../utils/priceCheck";
import { descriptionIsDetailed } from "../../utils/descriptionCheck";
import {
  supplierPriceInfo,
  SupplierDisclaimer,
  TrustBadge,
  TrustBreakdown,
  CertificationsLine,
  trustDetail,
  trustInfo,
  badgeText,
  SpecTags,
} from "./SelectedSupplier";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getStoredUser(): { name: string; email: string } {
  try {
    const raw = localStorage.getItem("sealcargo_user_data");
    const d = raw ? JSON.parse(raw) : null;
    return { name: d?.name || "", email: d?.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}

// ─── More platforms: direct search links (no scraping) + hand-off to SEAL ────
const PLATFORMS = [
  {
    name: "Made-in-China",
    url: (kw: string) =>
      `https://www.made-in-china.com/products-search/hot-china-products/${kw
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("_")}.html`,
  },
  {
    name: "Global Sources",
    url: (kw: string) =>
      // Same keyword as the other platforms; hyphens split ("15-needle" → "15 needle")
      `https://www.globalsources.com/searchList/products?keyWord=${encodeURIComponent(
        kw.replace(/-/g, " ").replace(/\s+/g, " ").trim(),
      )}`,
  },
];

function MorePlatforms({
  keyword,
  productDescription,
  quantity,
  budget,
  destination,
}: {
  keyword: string;
  productDescription: string;
  quantity: string;
  budget: string;
  destination: string;
}) {
  const stored = getStoredUser();
  const [open, setOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const kw = (keyword || productDescription || "").trim();
  // No external searches for descriptions that don't name a product ("abc")
  if (!kw || !descriptionIsDetailed(productDescription || keyword)) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/email/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Proveedor de otra plataforma",
          name,
          email,
          message: notes,
          supplierName,
          supplierUrl,
          productDescription,
          quantity,
          budget,
          destination,
        }),
      });
      if (res.status === 400) {
        setError(Lx("Revisa tu correo: debe ser completo, por ejemplo nombre@empresa.com.", "Check your email: it must be complete, for example name@company.com."));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
    } catch {
      setError(Lx(`No se pudo enviar. Llámanos al ${SEAL_COMPANY.phone}.`, `Could not send. Call us at ${SEAL_COMPANY.phone}.`));
    } finally {
      setSending(false);
    }
  };

  const input =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 mt-6">
      <h3 className="font-semibold text-[#0B3C5D] mb-1">
        {Lx("Ver más proveedores en otras plataformas", "See more suppliers on other platforms")}
      </h3>
      <p className="text-sm text-slate-600 mb-4">
        {Lx("Abrimos la búsqueda de", "We open the search for")}{" "}
        <span className="font-medium text-slate-800">"{kw}"</span>{" "}
        {Lx("en cada plataforma para que compare.", "on each platform so you can compare.")}
      </p>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <a
            key={p.name}
            href={p.url(kw)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-slate-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {p.name}
          </a>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-slate-200">
        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            ✅ {Lx("Recibimos el proveedor. Un ejecutivo de SEAL te cotiza flete y nacionalización.", "We received the supplier. A SEAL executive will quote freight and customs clearance.")}
          </div>
        ) : !open ? (
          <button
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-[#0B3C5D] hover:underline"
          >
            {Lx("¿Encontraste un proveedor en otra plataforma? Pásalo a SEAL y te cotizamos flete y aduana →", "Found a supplier on another platform? Send it to SEAL and we'll quote freight and customs →")}
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                placeholder={Lx("Nombre del proveedor", "Supplier name")}
                className={input}
              />
              <input
                value={supplierUrl}
                onChange={(e) => setSupplierUrl(e.target.value)}
                placeholder={Lx("Enlace del producto (opcional)", "Product link (optional)")}
                className={input}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={Lx("Tu nombre", "Your name")}
                className={input}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
                title={Lx("Correo completo, por ejemplo nombre@empresa.com", "Complete email, for example name@company.com")}
                placeholder={Lx("Tu correo", "Your email")}
                className={input}
              />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={Lx("Precio que te dieron, cantidad, comentarios...", "Price you were given, quantity, comments...")}
              className={input}
            />
            {error && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47] disabled:opacity-60"
            >
              <span>{sending ? Lx("Enviando...", "Sending...") : Lx("Enviar a SEAL", "Send to SEAL")}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── No live results: honest message + assisted search request ──────────────
function NoResults({
  keyword,
  noRelevant = false,
  totalAnalyzed,
  filteredOut,
  productDescription,
  quantity,
  budget,
  destination,
}: {
  keyword: string;
  noRelevant?: boolean;
  totalAnalyzed: number;
  filteredOut: { name: string; reason: string }[];
  productDescription: string;
  quantity: string;
  budget: string;
  destination: string;
}) {
  const navigate = useNavigate();
  const stored = getStoredUser();
  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const allFiltered = totalAnalyzed > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/email/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Búsqueda asistida de proveedores",
          name,
          email,
          phone,
          company,
          message,
          productDescription,
          quantity,
          budget,
          destination,
        }),
      });
      if (res.status === 400) {
        setError(Lx("Revisa tu correo: debe ser completo, por ejemplo nombre@empresa.com.", "Check your email: it must be complete, for example name@company.com."));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
    } catch {
      setError(
        Lx(`No se pudo enviar la solicitud. Llámenos al ${SEAL_COMPANY.phone}.`, `Could not send the request. Call us at ${SEAL_COMPANY.phone}.`),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 sm:p-10">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-5">
            <Package className="w-7 h-7 text-[#0B3C5D]" />
          </div>
          <h1 className="text-3xl font-bold text-[#0B3C5D] mb-3">
            {noRelevant
              ? Lx("No encontramos opciones suficientemente relacionadas con tu producto", "We didn't find options closely related to your product")
              : allFiltered
                ? Lx("Ningún proveedor pasó nuestros filtros", "No supplier passed our filters")
                : Lx("No pudimos obtener resultados en este momento", "We couldn't get results right now")}
          </h1>
          <p className="text-slate-600 mb-6">
            {noRelevant
              ? Lx(
                  "Los resultados de la plataforma no coincidían con lo que describiste, así que preferimos no mostrarlos. Agrega más detalles (tipo exacto de producto, uso, capacidad, material) y busca de nuevo, o pide a SEAL que haga la búsqueda por ti.",
                  "The platform results didn't match what you described, so we prefer not to show them. Add more details (exact product type, use, capacity, material) and search again, or ask SEAL to do the search for you.",
                )
              : allFiltered
                ? Lx(
                    `Analizamos ${totalAnalyzed} ${totalAnalyzed === 1 ? "proveedor, pero no cumplió" : "proveedores, pero ninguno cumplió"} los criterios de verificación, reputación y pedido mínimo de SEAL. Preferimos no mostrarte opciones que no los cumplen.`,
                    `We analyzed ${totalAnalyzed} ${totalAnalyzed === 1 ? "supplier, but it did not meet" : "suppliers, but none met"} SEAL's verification, reputation and minimum-order criteria. We prefer not to show options that don't meet them.`,
                  )
                : Lx(
                    "La plataforma no devolvió datos en este intento. Puedes volver al formulario e intentarlo de nuevo (tus datos se conservan), o usar una descripción un poco más corta. No te vamos a mostrar datos de ejemplo: un ejecutivo de SEAL puede hacer la búsqueda por ti y enviarte opciones para revisar con su costo estimado.",
                    "The platform returned no data on this attempt. You can go back to the form and try again (your data is kept), or use a slightly shorter description. We won't show you sample data: a SEAL executive can do the search for you and send you options to review with their estimated cost.",
                  )}
          </p>

          {allFiltered && filteredOut.length > 0 && (
            <details className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <summary className="cursor-pointer font-medium text-red-900">
                {Lx("Ver por qué se filtraron", "See why they were filtered")} ({filteredOut.length})
              </summary>
              <ul className="mt-3 space-y-1 text-sm">
                {filteredOut.map((s, i) => (
                  <li key={i} className="text-slate-700">
                    <span className="font-medium">{s.name}</span>{" "}
                    <span className="text-red-600">— {rejectReason(s.reason)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-800">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> {Lx("Solicitud recibida", "Request received")}
              </div>
              {Lx("Un ejecutivo de SEAL te contactará para darle seguimiento a tu búsqueda.", "A SEAL executive will contact you to follow up on your search.")}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-lg font-semibold text-[#0B3C5D]">
                {Lx("Que SEAL busque los proveedores por ti", "Let SEAL search for suppliers for you")}
              </h2>
              {productDescription && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 whitespace-pre-line break-words">
                  <span className="font-medium text-slate-700">{Lx("Producto: ", "Product: ")}</span>
                  {productDescription}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={Lx("Nombre", "Name")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
                  title={Lx("Correo completo, por ejemplo nombre@empresa.com", "Complete email, for example name@company.com")}
                  placeholder={Lx("Correo", "Email")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={Lx("Teléfono / WhatsApp", "Phone / WhatsApp")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={Lx("Empresa", "Company")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={Lx("¿Algo más que debamos saber? (plazo, proveedor actual, etc.)", "Anything else we should know? (timeline, current supplier, etc.)")}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              {error && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ⚠️ {error}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{sending ? Lx("Enviando...", "Sending...") : Lx("Solicitar búsqueda asistida", "Request assisted search")}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={`tel:${SEAL_COMPANY.phone.replace(/\s+/g, "")}`}
                  className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" /> {SEAL_COMPANY.phone}
                </a>
              </div>
            </form>
          )}

          <SupplierDisclaimer productDescription={productDescription} quantity={quantity} />

          <MorePlatforms
            keyword={keyword}
            productDescription={productDescription}
            quantity={quantity}
            budget={budget}
            destination={destination}
          />

          <button
            onClick={() => navigate("/qualify")}
            className="mt-6 text-sm text-blue-600 hover:underline"
          >
            {Lx("← Modificar la descripción y buscar de nuevo", "← Edit the description and search again")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
// Order options for the results list. "seal" keeps the backend order
// (trust level first, then lowest price inside each level).
function decodeEntities(t: string): string {
  return String(t ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

// Filter reasons come from the backend in Spanish
function rejectReason(r: string): string {
  if (!r) return r;
  if (Lx("es", "en") === "es")
    return r
      .replace("(no es Verified ni Gold Supplier)", "(no es proveedor verificado ni miembro Gold)")
      .replace(/^Gold Supplier con/, "Miembro Gold con")
      .replace("mayor a su cantidad", "mayor a tu cantidad");
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^Sin verificación/, () => "No verification (not Verified or Gold Supplier)"],
    [/^(?:Gold Supplier|Miembro Gold) con menos de (\d+) años/, (m) => `Gold Supplier with less than ${m[1]} years`],
    [/^Calificación ([\d.]+) por debajo de ([\d.]+)/, (m) => `Rating ${m[1]} below ${m[2]}`],
    [/^Pedido mínimo de ([\d,]+) unidades/, (m) => `Minimum order of ${m[1]} units, above your quantity`],
    [/^Índice (?:referencial|de Confianza) (\d+)\/100, debajo del mínimo de (\d+)/, (m) => `Reference index ${m[1]}/100, below the minimum of ${m[2]}`],
  ];
  for (const [re, f] of rules) {
    const m = r.match(re);
    if (m) return f(m);
  }
  return r;
}

function SpecSummary({ reqs, list }: { reqs: Spec[]; list: { productName?: string }[] }) {
  if (!reqs.length || !list.length) return null;
  let meets = 0, differs = 0, unknown = 0;
  list.forEach((s) => {
    const m = matchSpecs(reqs, s.productName)!;
    if (m.items.every((x) => x.status === "meets")) meets++;
    else if (m.items.some((x) => x.status === "higher" || x.status === "lower")) differs++;
    else unknown++;
  });
  const asked = reqs.map((r) => r.text).join(", ");
  const parts = [
    meets && `${meets} ${plural(meets, "indica lo pedido", "indican lo pedido", "states what you asked", "state what you asked")}`,
    differs && `${differs} ${plural(differs, "con diferencias", "con diferencias", "with differences", "with differences")}`,
    unknown && `${unknown} ${plural(unknown, "no lo indica en la publicación", "no lo indican en la publicación", "does not state it", "do not state it")}`,
  ].filter(Boolean);
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
      <p>
        <span className="font-semibold text-[#0B3C5D]">{Lx(`Pediste: ${asked}.`, `You asked for: ${asked}.`)}</span>{" "}
        {parts.join(" · ")}.
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {meets
          ? Lx("Primero aparecen las que indican lo pedido; las demás son alternativas y se marcan sus diferencias. ", "Listings stating what you asked come first; the rest are alternatives with their differences marked. ")
          : Lx("Ninguna publicación indica exactamente lo pedido; las opciones son alternativas, con sus diferencias marcadas. ", "No listing states exactly what you asked; the options are alternatives, with their differences marked. ")}
        {Lx("Los datos se leen del título publicado: confírmalos con el proveedor.", "Data is read from the listing title: confirm it with the supplier.")}
      </p>
    </div>
  );
}

function sortSuppliers<T extends { price: number; rating: number | null; moq: number; trustScore?: number; aiScore: number }>(
  list: T[],
  by: string,
): T[] {
  if (by === "seal") return list;
  const copy = [...list];
  const price = (s: T) => (s.price > 0 ? s.price : Infinity);
  if (by === "price") copy.sort((a, b) => price(a) - price(b));
  if (by === "trust") copy.sort((a, b) => (b.trustScore ?? b.aiScore) - (a.trustScore ?? a.aiScore));
  if (by === "rating") copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (by === "moq") copy.sort((a, b) => (a.moq || 0) - (b.moq || 0));
  return copy;
}

interface Supplier {
  id: number;
  name: string;
  productName?: string;
  priceRange?: string;
  priceFlag?: string;
  rating: number | null;
  reviews: number;
  moq: number;
  price: number;
  verified: boolean;
  location: string;
  yearsInBusiness: number;
  responseRate: number | null;
  tags: string[];
  aiScore: number;
  trustScore?: number;
  trustLevel?: string;
  trustBreakdown?: { key: string; label: string; weight: number; score: number | null; detail: string }[];
  trustCoverage?: { available: number; total: number };
  trustReasons?: string[];
  verifiedSupplier?: boolean | null;
  qualityScore: number;
  reliabilityScore: number;
  priceScore: number;
  contactEmail?: string;
  contactPhone?: string;
  productImage?: string;
  images?: string[];
  productUrl?: string;
  storeUrl?: string;
  tradeAssurance?: boolean | null;
  goldSupplier?: boolean;
}

// (Demo suppliers removed — only real Alibaba results are shown)

// ─── Helper: get 3 product images ────────────────────────────────────────────
function getProductImages(supplier: Supplier): string[] {
  if (supplier.images && supplier.images.length >= 3) {
    return supplier.images.slice(0, 3);
  }
  if (supplier.productImage) {
    return [
      supplier.productImage,
      supplier.productImage,
      supplier.productImage,
    ];
  }
  return [
    "https://images.unsplash.com/photo-1503602642458-232111445657?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1519947486511-46149fa0a254?w=400&h=300&fit=crop",
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SupplierResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // ── Resolve suppliers ─────────────────────────────────────────────────────
  const apiData = location.state?.suppliers;

  // Only real results — no demo data
  const reqSpecs = requestedSpecs(String(location.state?.productDescription ?? ""));
  // Alibaba text can arrive HTML-escaped ("&amp;"); decode it once here
  const displaySuppliers: Supplier[] = flagPrices(orderBySpecs(
    (apiData?.topSuppliers ?? []).map((s: Supplier) => ({
      ...s,
      name: decodeEntities(s.name),
      productName: s.productName ? decodeEntities(s.productName) : s.productName,
    })),
    reqSpecs,
  ).slice(0, 9), String(location.state?.productType ?? ""));
  const filteredOutList: { name: string; reason: string }[] =
    apiData?.filteredOut ?? [];

  const isLiveData = !!(apiData?.topSuppliers?.length > 0);

  // ── Navigation state for cost breakdown ───────────────────────────────────
  const navQuantity = location.state?.quantity ?? "1000";
  const navBudget = location.state?.budget ?? "";
  const navDestination = location.state?.destination ?? "GT";
  const navProductType = location.state?.productType ?? "furniture";

  const rates = useRates();

  // ── State ─────────────────────────────────────────────────────────────────
  // Default: the first option whose price looks usable (atypical prices need confirmation)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier>(
    (displaySuppliers.find((s) => !s.priceFlag) ?? displaySuppliers[0]) as Supplier,
  );
  const [showFiltered, setShowFiltered] = useState(false);
  const [sortBy, setSortBy] = useState("seal");
  const [savedSuppliers, setSavedSuppliers] = useState<number[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [leadNotes, setLeadNotes] = useState("");

  // ── Lightbox state ────────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSupplier, setLightboxSupplier] = useState("");

  // ── Lightbox helpers ──────────────────────────────────────────────────────
  const openLightbox = (
    images: string[],
    startIndex: number,
    supplierName: string,
  ) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxSupplier(supplierName);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const lightboxPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((prev) =>
      prev === 0 ? lightboxImages.length - 1 : prev - 1,
    );
  };

  const lightboxNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((prev) =>
      prev === lightboxImages.length - 1 ? 0 : prev + 1,
    );
  };

  // ── Navigate to costs with selected supplier ──────────────────────────────
  const goToCosts = () => {
    navigate("/costs", {
      state: {
        supplier: selectedSupplier,
        quantity: navQuantity,
        budget: navBudget,
        destination: navDestination,
        productType: navProductType,
        volumeCbm: location.state?.volumeCbm,
        weightKg: location.state?.weightKg,
        productDescription: location.state?.productDescription,
        // Real counts from this search (shown in the final report)
        suppliersData: {
          totalAnalyzed: apiData?.totalAnalyzed,
          qualifiedCount: apiData?.qualifiedCount,
          filteredCount: apiData?.filteredCount ?? apiData?.filteredOut?.length,
          shownCount: displaySuppliers.length,
          duplicateCount: apiData?.duplicateCount,
        },
      },
    });
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleSave = (id: number) => {
    setSavedSuppliers((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  // Sends the supplier contact request to SEAL sales
  const handleContactSupplier = async () => {
    const user = getStoredUser();
    try {
      const res = await fetch(`${API_URL}/api/email/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Contactar proveedor",
          name: user.name || "Sin nombre",
          email: user.email,
          message: leadNotes,
          supplierName: selectedSupplier.name,
          supplierUrl: selectedSupplier.productUrl || selectedSupplier.storeUrl,
          productDescription: location.state?.productDescription,
          productType: navProductType,
          quantity: navQuantity,
          budget: navBudget,
          destination: navDestination,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowContactModal(false);
      alert(Lx("¡Solicitud enviada! Un ejecutivo de SEAL te dará seguimiento.", "Request sent! A SEAL executive will follow up."));
    } catch {
      alert(Lx(`No se pudo enviar. Llámanos al ${SEAL_COMPANY.phone}.`, `Could not send. Call us at ${SEAL_COMPANY.phone}.`));
    }
  };

  // ── No real suppliers → honest empty state with assisted search ──────────
  if (!displaySuppliers.length) {
    return (
      <NoResults
        keyword={apiData?.searchKeyword ?? ""}
        noRelevant={!!apiData?.noRelevantMatches}
        totalAnalyzed={apiData?.totalAnalyzed ?? 0}
        filteredOut={filteredOutList}
        productDescription={location.state?.productDescription ?? ""}
        quantity={navQuantity}
        budget={navBudget}
        destination={navDestination}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        {/* Decreased py-3 to py-1.5 and sm:py-4 to sm:py-2 to make the bar thinner */}
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
            {/* Reduced button padding from py-2 to py-1.5 and sm:py-3 to sm:py-2 to fit perfectly in the shorter header */}
            <button
              onClick={goToCosts}
              className="px-3 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">
                {" "}
                {t("suppliers.viewCostBreakdown")}{" "}
              </span>
              <span className="sm:hidden">Costos</span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <LanguageToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#0B3C5D] mb-2">
            {t("suppliers.title")}
          </h1>
          <p className="text-slate-600">
            {displaySuppliers.length} {plural(displaySuppliers.length, "proveedor mejor clasificado", "proveedores mejor clasificados", "top-ranked supplier", "top-ranked suppliers")} •{" "}
            {filteredOutList.length} {plural(filteredOutList.length, "filtrado", "filtrados", "filtered out", "filtered out")}
            <button
              onClick={() => setShowFiltered(!showFiltered)}
              className="ml-2 text-blue-600 hover:underline text-sm"
            >
              {showFiltered ? t("suppliers.hide") : t("suppliers.show")}{" "}
              {t("suppliers.filteredSuppliers")}
            </button>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isLiveData
              ? Lx("✅ Datos en vivo de Alibaba", "✅ Live data from Alibaba")
              : ""}
          </p>
        </div>

        {/* Filter Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">
                {t("suppliers.qualityFilter")}
              </span>
            </div>
            <p className="text-sm text-green-700">
              {t("suppliers.qualityDesc")}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">
                {t("suppliers.trustFilter")}
              </span>
            </div>
            <p className="text-sm text-blue-700">{t("suppliers.trustDesc")}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">
                {t("suppliers.experienceFilter")}
              </span>
            </div>
            <p className="text-sm text-purple-700">
              {t("suppliers.experienceDesc")}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-orange-900">
                {t("suppliers.aiScore")}
              </span>
            </div>
            <p className="text-sm text-orange-700">
              {t("suppliers.aiScoreDesc")}
            </p>
          </div>
        </div>

        <SupplierDisclaimer
          supplier={selectedSupplier}
          productDescription={location.state?.productDescription ?? ""}
          quantity={navQuantity}
        />

        {/* Filtered Out */}
        {showFiltered && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
              <X className="w-5 h-5" />
              {filteredOutList.length} {plural(filteredOutList.length, "proveedor que no pasó los filtros", "proveedores que no pasaron los filtros", "supplier that did not pass the filters", "suppliers that did not pass the filters")}
            </h3>
            <div className="space-y-2">
              {filteredOutList.map((s: any, i: number) => (
                <div
                  key={i}
                  className="bg-white rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="text-sm text-red-600 ml-3">
                      ⚠️ {rejectReason(s.reason)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {t("suppliers.notRecommended")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Supplier Cards ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            {location.state?.descriptionCleaned && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                {Lx(
                  "Dejamos fuera del análisis una parte del texto que no describe el producto (por ejemplo, pedirle a la herramienta que garantice algo). La herramienta no garantiza proveedores.",
                  "We left out of the analysis part of the text that doesn't describe the product (for example, asking the tool to guarantee something). The tool does not guarantee suppliers.",
                )}
              </div>
            )}
            <SpecSummary reqs={reqSpecs} list={displaySuppliers} />

            {/* Sort Bar */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 min-w-0 outline-none text-sm bg-transparent"
              >
                <option value="seal">{t("suppliers.aiRecommended")}</option>
                <option value="price">{t("suppliers.lowestPrice")}</option>
                <option value="trust">{t("suppliers.highestAI")}</option>
                <option value="rating">{t("suppliers.highestRating")}</option>
                <option value="moq">{t("suppliers.lowestMOQ")}</option>
              </select>
              <span className="text-sm text-slate-500">
                {displaySuppliers.length} {plural(displaySuppliers.length, "resultado", "resultados", "result", "results")}
              </span>
            </div>

            {/* Supplier Cards */}
            {sortSuppliers(displaySuppliers, sortBy).map((supplier, index) => {
              const images = getProductImages(supplier);
              return (
                <div
                  key={supplier.id}
                  className={`bg-white rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg relative ${
                    selectedSupplier.id === supplier.id
                      ? "border-blue-500 shadow-lg"
                      : "border-slate-200"
                  }`}
                >
                  {/* Ranking Badge */}
                  {sortBy === "seal" && index < 3 && (
                    <div
                      className={`absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg z-10 ${
                        index === 0
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                          : index === 1
                            ? "bg-gradient-to-br from-slate-300 to-slate-400"
                            : "bg-gradient-to-br from-amber-600 to-amber-700"
                      }`}
                    >
                      #{index + 1}
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedSupplier(supplier)}
                    className="p-4 sm:p-6"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-[#0B3C5D]">
                            {supplier.name}
                          </h3>
                          {supplier.verifiedSupplier === true && (
                            <CheckCircle className="w-5 h-5 text-green-500" aria-label="Verified Supplier" />
                          )}
                        </div>

                        {supplier.productName && (
                          <p className="text-sm text-slate-700 mb-2 line-clamp-2 first-letter:uppercase">
                            <span className="text-slate-500">{Lx("Producto publicado:", "Listed product:")}</span>{" "}
                            {supplier.productName}
                          </p>
                        )}
                        <SpecTags description={String(location.state?.productDescription ?? "")} productName={supplier.productName} />
                        {supplier.priceFlag && (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                            <span className="font-semibold">{Lx("Precio atípico:", "Atypical price:")}</span> {supplier.priceFlag}{" "}
                            {Lx("Para calcular costos con esta opción te pediremos confirmarlo o escribir el precio que te coticen.", "To estimate costs with this option we'll ask you to confirm it or enter the price you're quoted.")}
                          </p>
                        )}

                        {/* Índice de Confianza SEAL */}
                        <div className="mb-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <TrustBadge supplier={supplier} size="sm" />
                            <span className={`text-xs font-medium ${trustInfo(supplier).style.text}`}>
                              {trustInfo(supplier).style.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {[
                              badgeText(supplier),
                              ...trustInfo(supplier).breakdown
                                .filter((b) => b.key !== "verification" && b.key !== "track" && b.score !== null && b.score >= 50)
                                .map((b) => trustDetail(b.detail)),
                            ].join(" · ")}
                          </p>
                          <CertificationsLine supplier={supplier} />
                        </div>

                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {supplier.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {supplier.rating
                              ? `${supplier.rating} (${supplier.reviews})`
                              : Lx("Sin reseñas", "No reviews")}
                          </div>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right ml-3 shrink-0">
                        {(() => {
                          const pi = supplierPriceInfo(supplier);
                          return (
                            <>
                              <div className={`${pi.isRange ? "text-base sm:text-xl" : "text-xl sm:text-2xl"} font-bold text-[#0B3C5D] sm:whitespace-nowrap`}>
                                {pi.published}
                              </div>
                              <div className="text-sm text-slate-600">
                                {t("suppliers.perUnit")}
                              </div>
                              {pi.isRange && (
                                <div className="text-xs text-slate-500">
                                  {Lx("medio", "midpoint")} {formatUSD(pi.used, 2)}
                                </div>
                              )}
                              {supplier.priceFlag && (
                                <div className="mt-1 inline-block text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded px-2 py-0.5">
                                  {Lx("Precio atípico", "Atypical price")}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 mb-1">
                          {t("suppliers.moq")}
                        </div>
                        <div className="font-semibold text-[#0B3C5D] text-sm">
                          {supplier.moq}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 mb-1">
                          {t("suppliers.experience")}
                        </div>
                        <div className="font-semibold text-[#0B3C5D] text-sm">
                          {supplier.yearsInBusiness ? `${supplier.yearsInBusiness} ${plural(supplier.yearsInBusiness, "año", "años", "year", "years")}` : Lx("N/D", "N/A")}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 mb-1">
                          {t("suppliers.response")}
                        </div>
                        <div className="font-semibold text-[#0B3C5D] text-sm">
                          {supplier.responseRate != null ? `${supplier.responseRate}%` : Lx("N/D", "N/A")}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 mb-1">
                          {t("suppliers.quality")}
                        </div>
                        <div className="font-semibold text-[#0B3C5D] text-sm">
                          {supplier.tradeAssurance === true ? Lx("Sí", "Yes") : supplier.tradeAssurance === false ? "No" : Lx("N/D", "N/A")}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {supplier.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {supplier.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ── Product Images — click opens lightbox ─────────── */}
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((img, i) => (
                        <div
                          key={i}
                          className="rounded-lg overflow-hidden bg-slate-100 group cursor-pointer relative"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(images, i, supplier.name);
                          }}
                        >
                          <img
                            src={img}
                            alt={`Product view ${i + 1}`}
                            className="w-full h-24 object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                            onError={(e) => {
                              // No stock photo: an image that isn't the real product is hidden
                              (e.target as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                          {/* Hover overlay hint */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded-full transition-opacity duration-300">
                              {Lx("Ver", "View")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-xl flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave(supplier.id);
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        savedSuppliers.includes(supplier.id)
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-slate-300 text-slate-600 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          savedSuppliers.includes(supplier.id)
                            ? "fill-red-500"
                            : ""
                        }`}
                      />
                    </button>

                    {/* ✅ View on Alibaba — opens product page in new tab */}
                    <a
                      href={
                        supplier.productUrl ||
                        supplier.storeUrl ||
                        "https://www.alibaba.com"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-4 py-2.5 rounded-lg border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:border-orange-500 transition-all flex items-center justify-center gap-2 font-semibold text-sm shadow-sm hover:shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{t("suppliers.viewOnAlibaba")}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right: AI Panel ──────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6">
              <h2 className="font-semibold text-[#0B3C5D] mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {t("suppliers.aiRanking")}
              </h2>

              {/* Selected supplier: Índice de Confianza SEAL breakdown */}
              <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                <div className="font-semibold text-[#0B3C5D] mb-2 text-sm leading-tight">
                  {selectedSupplier.name}
                </div>
                <div className="mb-3">
                  <TrustBadge supplier={selectedSupplier} size="sm" />
                </div>
                <TrustBreakdown supplier={selectedSupplier} />
                <div className="pt-2 mt-3 border-t border-blue-300 flex items-center justify-between">
                  <span className="font-semibold text-[#0B3C5D]">
                    {t("suppliers.overallScore")}
                  </span>
                  <span className="text-2xl font-bold text-[#0B3C5D]">
                    {trustInfo(selectedSupplier).score}
                  </span>
                </div>
              </div>

              {/* How we order */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm text-slate-700">
                <div className="font-medium text-[#0B3C5D] mb-1">{Lx("Cómo ordenamos", "How we order")}</div>
                <p>
                  {Lx(
                    "Solo mostramos productos relacionados con tu descripción. Primero van los que indican lo que pediste (capacidad, agujas, cabezales), cuando lo escribiste; los demás se marcan con sus diferencias. Luego ordenamos por el nivel del índice referencial (A alto, B medio, C básico) y, dentro de cada nivel, por cercanía a tu producto y menor precio. El índice se calcula con información que publica la plataforma; no es una evaluación ni un aval de SEAL, y el precio no forma parte de él.",
                    "We only show products related to your description. Listings stating what you asked (capacity, needles, heads) come first, when you gave it; the rest are marked with their differences. Then we order by reference index level (A high, B medium, C basic) and, within each level, by closeness to your product and lowest price. The index is calculated from information the platform publishes; it is not an assessment or endorsement by SEAL, and price is not part of it.",
                  )}
                </p>
              </div>

              {/* Cost Estimate */}
              <div className="pt-4 border-t border-slate-200 mb-6">
                <h3 className="font-medium text-[#0B3C5D] mb-3">
                  {t("suppliers.selectedSupplier")}
                </h3>
                <div className="text-sm text-slate-600 space-y-2">
                  {selectedSupplier.priceFlag ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                      <p className="font-semibold mb-1">{Lx("Precio por confirmar", "Price to be confirmed")}</p>
                      <p>
                        {Lx(
                          "No calculamos la estimación con este precio publicado. En el desglose de costos podrás escribir el precio que te coticen o confirmarlo.",
                          "We don't estimate with this published price. In the cost breakdown you can enter the price you're quoted or confirm it.",
                        )}
                      </p>
                    </div>
                  ) : (() => {
                    const est = calculateCosts(
                      {
                        price: selectedSupplier.price || 0,
                        quantity: parseInt(navQuantity || "1000") || 1000,
                        volumeCbm: parseFloat(location.state?.volumeCbm) || 0,
                        weightKg: parseFloat(location.state?.weightKg) || 0,
                      },
                      rates,
                    );
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span>{t("suppliers.baseCost")}</span>
                          <span className="font-medium">{formatQ(est.productCost, est.exchangeRate)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("suppliers.estShipping")}</span>
                          <span className="font-medium">
                            {est.freightPending ? Lx("Por cotizar", "To be quoted") : formatQ(est.shipping, est.exchangeRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{Lx("Impuestos (DAI + IVA)", "Taxes (DAI + IVA)")}</span>
                          <span className="font-medium">
                            {formatQ(est.importDuties + est.taxes, est.exchangeRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{Lx("Seguro, aduana y destino", "Insurance, customs and destination")}</span>
                          <span className="font-medium">
                            {formatQ(est.insurance + est.customsFees + est.localCharges, est.exchangeRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-semibold text-[#0B3C5D]">
                          <span>{t("suppliers.totalEstimate")}</span>
                          <span>{formatQ(est.totalCost, est.exchangeRate)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <button
                onClick={goToCosts}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-lg hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center justify-center gap-2"
              >
                {t("suppliers.viewCostBreakdown")}
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Saved Leads */}
              {savedSuppliers.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="font-semibold text-[#0B3C5D] mb-3 flex items-center gap-2">
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                    {t("suppliers.savedLeads")} ({savedSuppliers.length})
                  </h3>
                  <div className="space-y-2">
                    {displaySuppliers
                      .filter((s) => savedSuppliers.includes(s.id))
                      .map((s) => (
                        <div
                          key={s.id}
                          className="text-sm p-2 bg-slate-50 rounded flex items-center justify-between"
                        >
                          <span className="text-slate-700 truncate">
                            {s.name.split(" ")[0]}
                          </span>
                          <span className="text-xs text-green-600 font-semibold">
                            {trustInfo(s).level} · {trustInfo(s).score}
                          </span>
                        </div>
                      ))}
                  </div>
                  <button className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold">
                    {t("suppliers.exportLeads")} {savedSuppliers.length}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <MorePlatforms
          keyword={apiData?.searchKeyword ?? ""}
          productDescription={location.state?.productDescription ?? ""}
          quantity={navQuantity}
          budget={navBudget}
          destination={navDestination}
        />
      </div>

      {/* ── Contact Modal ─────────────────────────────────────────────────────── */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#0B3C5D]">
                {t("suppliers.generateLead")}
              </h2>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="font-semibold text-[#0B3C5D] mb-2">
                  {selectedSupplier.name}
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {selectedSupplier.contactEmail ||
                      Lx("Contactar vía plataforma", "Contact via platform")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {selectedSupplier.contactPhone ||
                      Lx("Contactar vía plataforma", "Contact via platform")}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Award className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-600">
                      {Lx("Índice referencial", "Reference index")}: {trustInfo(selectedSupplier).score}/100 ({Lx("nivel", "level")} {trustInfo(selectedSupplier).level})
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("suppliers.leadNotes")}
                </label>
                <textarea
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder={t("suppliers.leadNotesPlaceholder")}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                />
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleContactSupplier}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-lg hover:from-blue-700 hover:to-[#0a2f47] transition-all font-semibold"
              >
                {t("suppliers.saveLead")}
              </button>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-full px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
              >
                {t("suppliers.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox Modal ────────────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all z-10 shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-4 py-1.5 rounded-full z-10">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>

          {/* Prev Button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={lightboxPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all z-10 shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={lightboxNext}
              className="absolute right-16 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all z-10 shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Main Image */}
          <div
            className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages[lightboxIndex]}
              alt={`${lightboxSupplier} - Image ${lightboxIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=600&fit=crop";
              }}
            />

            {/* Caption */}
            <div className="mt-4 text-center">
              <p className="text-white font-semibold text-lg">
                {lightboxSupplier}
              </p>
              <p className="text-white/60 text-sm mt-1">
                Imagen {lightboxIndex + 1} de {lightboxImages.length} • Click
                fuera para cerrar
              </p>
            </div>

            {/* Thumbnail strip */}
            {lightboxImages.length > 1 && (
              <div className="flex gap-3 mt-4">
                {lightboxImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(i);
                    }}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === lightboxIndex
                        ? "border-white scale-110 shadow-lg"
                        : "border-white/30 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
