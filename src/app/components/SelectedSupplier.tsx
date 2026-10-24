import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Award, Star, Package, ExternalLink, AlertCircle, ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { formatUSD } from "../../utils/costCalculator";

// Supplier as it arrives from the suppliers screen (real Alibaba data only)
export interface SelectedSupplierData {
  name?: string;
  productName?: string;
  price?: number;
  priceRange?: string;
  moq?: number;
  rating?: number | null;
  reviews?: number;
  verified?: boolean;
  goldSupplier?: boolean;
  yearsInBusiness?: number;
  location?: string;
  productUrl?: string;
  storeUrl?: string;
  verifiedSupplier?: boolean | null;
  tradeAssurance?: boolean | null;
  storeRating?: number | null;
  certifications?: string[];
  trustScore?: number;
  trustLevel?: string;
  trustBreakdown?: { key: string; label: string; weight: number; score: number | null; detail: string }[];
  trustCoverage?: { available: number; total: number };
  trustReasons?: string[];
  aiScore?: number;
}

// ─── Índice de Confianza SEAL (computed in the backend) ─────────────────────
export const TRUST_LEVELS: Record<string, { label: string; short: string; badge: string; text: string; bar: string }> = {
  A: { label: "Confianza alta", short: "A", badge: "bg-green-100 text-green-800 border-green-300", text: "text-green-700", bar: "bg-green-500" },
  B: { label: "Confianza buena", short: "B", badge: "bg-blue-100 text-blue-800 border-blue-300", text: "text-blue-700", bar: "bg-blue-500" },
  C: { label: "Confianza media · se recomienda verificación", short: "C", badge: "bg-amber-100 text-amber-800 border-amber-300", text: "text-amber-700", bar: "bg-amber-500" },
};

export function trustInfo(s?: SelectedSupplierData | null) {
  const score = s?.trustScore ?? s?.aiScore ?? 0;
  const level = s?.trustLevel && TRUST_LEVELS[s.trustLevel] ? s.trustLevel : score >= 80 ? "A" : score >= 65 ? "B" : "C";
  return {
    score,
    level,
    style: TRUST_LEVELS[level],
    breakdown: s?.trustBreakdown ?? [],
    coverage: s?.trustCoverage,
    reasons: s?.trustReasons ?? [],
  };
}

/** Badge text for the supplier's Alibaba status, without overstating it. */
export function badgeText(s?: SelectedSupplierData | null): string {
  const years = s?.yearsInBusiness || 0;
  const y = years ? ` · ${years} ${years === 1 ? "año" : "años"}` : "";
  if (s?.verifiedSupplier === true) return `Verified Supplier (auditado)${y}`;
  if (s?.goldSupplier || s?.verified) return `Gold Supplier${y}`;
  return "Sin insignia de verificación";
}

export function TrustBadge({ supplier, size = "md" }: { supplier: SelectedSupplierData; size?: "sm" | "md" }) {
  const ti = trustInfo(supplier);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-semibold ${ti.style.badge} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
      title="Índice de Confianza SEAL"
    >
      <ShieldCheck className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      Nivel {ti.level} · {ti.score}/100
    </span>
  );
}

/** Certifications the supplier declares on Alibaba (not verified by SEAL). */
export function CertificationsLine({ supplier }: { supplier: SelectedSupplierData }) {
  const certs = supplier.certifications ?? [];
  if (!certs.length) return null;
  return (
    <p className="text-xs text-slate-600 mt-2">
      <span className="font-medium">Certificaciones declaradas por el proveedor:</span>{" "}
      <span>{certs.join(", ")}</span>{" "}
      <span className="text-slate-400">(sin verificar)</span>
    </p>
  );
}

/** Criteria breakdown of the Índice de Confianza SEAL. */
export function TrustBreakdown({ supplier }: { supplier: SelectedSupplierData }) {
  const ti = trustInfo(supplier);
  if (!ti.breakdown.length) return null;
  return (
    <div className="space-y-3">
      {ti.breakdown.map((b) => (
        <div key={b.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-slate-700">
              {b.label} <span className="text-xs text-slate-400">({b.weight}%)</span>
            </span>
            <span className={`font-semibold ${b.score === null ? "text-slate-400" : "text-[#0B3C5D]"}`}>
              {b.score === null ? "N/D" : `${b.score}/100`}
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
            {b.score !== null && <div className={`h-full ${ti.style.bar}`} style={{ width: `${b.score}%` }} />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{b.detail}</p>
        </div>
      ))}
      {ti.coverage && (
        <p className="text-xs text-slate-500">
          Datos disponibles: {ti.coverage.available} de {ti.coverage.total}. Lo que no se publica no se inventa: su peso se reparte entre los criterios disponibles.
        </p>
      )}
    </div>
  );
}

const COUNTRY: Record<string, string> = {
  CN: "China",
  HK: "Hong Kong",
  TW: "Taiwán",
  VN: "Vietnam",
  IN: "India",
  TH: "Tailandia",
  MY: "Malasia",
  ID: "Indonesia",
  KR: "Corea del Sur",
  JP: "Japón",
  TR: "Turquía",
  PK: "Pakistán",
  BD: "Bangladés",
  US: "Estados Unidos",
  MX: "México",
};

export function countryName(code?: string): string {
  if (!code) return "N/D";
  return COUNTRY[code.toUpperCase()] || code;
}

/** Price as Alibaba publishes it, plus the value the calculator uses. */
export function supplierPriceInfo(s?: SelectedSupplierData | null) {
  const used = s?.price && s.price > 0 ? s.price : 0;
  const nums = String(s?.priceRange || "")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((n) => n > 0) ?? [];
  const isRange = nums.length >= 2 && nums[0] !== nums[1];
  const published = isRange
    ? `${formatUSD(nums[0], 2)} – ${formatUSD(nums[1], 2)}`
    : used > 0
      ? formatUSD(used, 2)
      : "N/D";
  return { used, isRange, published };
}

export function hasUsableSupplier(s?: SelectedSupplierData | null): boolean {
  return !!s && !!s.name && (s.price ?? 0) > 0;
}

export function SelectedSupplierCard({ supplier }: { supplier: SelectedSupplierData }) {
  const { used, isRange, published } = supplierPriceInfo(supplier);
  const link = supplier.productUrl || supplier.storeUrl;
  const gold = supplier.verifiedSupplier === true || supplier.goldSupplier || supplier.verified;
  const hasTrust = supplier.trustScore !== undefined || supplier.aiScore !== undefined;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Proveedor considerado
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-[#0B3C5D] break-words">
            {supplier.name}
          </h2>
          {hasTrust && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TrustBadge supplier={supplier} size="sm" />
              <span className={`text-xs font-medium ${trustInfo(supplier).style.text}`}>
                {trustInfo(supplier).style.label}
              </span>
            </div>
          )}
          {supplier.productName && (
            <p className="text-sm text-slate-600 mt-1 break-words">{supplier.productName}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              {countryName(supplier.location)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Award className={`w-4 h-4 ${gold ? "text-amber-500" : "text-slate-400"}`} />
              {badgeText(supplier)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="w-4 h-4 text-slate-400" />
              {supplier.rating
                ? `${supplier.rating.toFixed(1)}${supplier.reviews ? ` (${supplier.reviews} reseñas)` : ""}`
                : "Sin reseñas"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Package className="w-4 h-4 text-slate-400" />
              Pedido mínimo: {supplier.moq ? `${supplier.moq.toLocaleString()} uds.` : "N/D"}
            </span>
            {supplier.storeRating ? (
              <span className="inline-flex items-center gap-1.5">
                <Star className="w-4 h-4 text-slate-400" />
                Servicio del proveedor: {supplier.storeRating.toFixed(1)}/5
              </span>
            ) : null}
          </div>
          <CertificationsLine supplier={supplier} />
        </div>

        <div className="sm:text-right shrink-0">
          <p className="text-xs text-slate-500">Precio publicado en Alibaba</p>
          <p className="text-lg font-bold text-[#0B3C5D]">{published}</p>
          {isRange && (
            <p className="text-xs text-slate-500 mt-0.5">
              Se calculó con {formatUSD(used, 2)} (precio medio)
            </p>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              Ver en Alibaba <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown instead of a calculation when there is no real supplier/price to use. */
export function NoSupplierNotice({ hasSupplierWithoutPrice }: { hasSupplierWithoutPrice?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 max-w-lg w-full text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B3C5D] mb-2">
          {hasSupplierWithoutPrice
            ? "Este proveedor no publica precio"
            : "Primero escoja un proveedor"}
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          {hasSupplierWithoutPrice
            ? "Sin el precio real no podemos calcular el costo en Guatemala. Escoja otro proveedor de la lista."
            : "El costo en Guatemala se calcula con el precio real del proveedor que usted escoja en la lista de resultados."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/qualify"))}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47]"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a proveedores
          </button>
          <button
            onClick={() => navigate("/qualify")}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <Search className="w-4 h-4" />
            Nueva búsqueda
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Disclaimer + SEAL supplier verification in China (paid add-on) ─────────
export const SEAL_DISCLAIMER =
  "SEAL no garantiza a los proveedores ni los resultados de esta búsqueda. SmartTrade AI es una herramienta para organizar y comparar proveedores. Para comprar con más seguridad se requiere el servicio específico de verificación de proveedor en China.";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function storedUser(): { name: string; email: string } {
  try {
    const raw = localStorage.getItem("sealcargo_user_data");
    const d = raw ? JSON.parse(raw) : null;
    return { name: d?.name || "", email: d?.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}

export function SupplierDisclaimer({
  supplier,
  productDescription = "",
  quantity = "",
  compact = false,
}: {
  supplier?: SelectedSupplierData | null;
  productDescription?: string;
  quantity?: string | number;
  compact?: boolean;
}) {
  const stored = storedUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/email/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Verificación de proveedor en China",
          name,
          email,
          message: notes,
          supplierName: supplier?.name || "",
          supplierUrl: supplier?.productUrl || supplier?.storeUrl || "",
          productDescription,
          quantity: String(quantity || ""),
          destination: "Guatemala",
        }),
      });
      if (res.status === 400) {
        setError("Revise su nombre y correo (por ejemplo nombre@empresa.com).");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
    } catch {
      setError("No se pudo enviar. Escríbanos al WhatsApp +502 5996 4664.");
    } finally {
      setSending(false);
    }
  };

  const input =
    "w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl ${compact ? "p-4" : "p-4 sm:p-5"} mb-6`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Aviso: </span>
            {SEAL_DISCLAIMER}
          </p>
          {sent ? (
            <p className="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
              ✅ Recibimos su solicitud. Un ejecutivo de SEAL le contacta para la verificación en China.
            </p>
          ) : !open ? (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47]"
            >
              <ShieldCheck className="w-4 h-4" />
              {supplier?.name ? "Solicitar verificación de este proveedor en China" : "Solicitar verificación de proveedor en China"}
            </button>
          ) : (
            <form onSubmit={submit} className="mt-3 space-y-2">
              {supplier?.name && (
                <p className="text-xs text-slate-600">
                  Proveedor: <span className="font-medium text-slate-800">{supplier.name}</span>
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={input} placeholder="Su nombre" value={name} onChange={(e) => setName(e.target.value)} required />
                <input className={input} type="email" placeholder="Su correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <textarea
                className={`${input} min-h-[70px]`}
                placeholder="¿Qué le gustaría verificar? (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47] disabled:opacity-60"
                >
                  {sending ? "Enviando…" : "Enviar solicitud"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
