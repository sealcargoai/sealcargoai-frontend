import { useNavigate } from "react-router";
import { MapPin, Award, Star, Package, ExternalLink, AlertCircle, ArrowLeft, Search } from "lucide-react";
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
  const gold = supplier.goldSupplier || supplier.verified;
  const years = supplier.yearsInBusiness || 0;

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
              {gold
                ? `Gold Supplier verificado${years ? ` · ${years} ${years === 1 ? "año" : "años"}` : ""}`
                : "No verificado"}
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
          </div>
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
