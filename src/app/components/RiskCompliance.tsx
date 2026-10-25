import { useNavigate, useLocation } from "react-router";
import { ClipboardList, FileText, Info, ArrowRight, Building2, CheckCircle, Circle } from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { NoSupplierNotice, hasUsableSupplier, SupplierDisclaimer, badgeText } from "./SelectedSupplier";
import { Lx } from "../../utils/lang";

// ─── "Aspectos por revisar" ─────────────────────────────────────────────────
// Orientation only: topics worth reviewing for an import into Guatemala, with
// where to confirm them. No risk score or "safe to proceed" conclusion: the
// tool does not have the data to support one.

export interface ReviewTopic {
  title: string;
  why: string;
  action: string;
  source: string; // who confirms it
}

const CATEGORY_LABEL: Record<string, [string, string]> = {
  machinery: ["Maquinaria / equipo", "Machinery / equipment"],
  electronics: ["Electrónica", "Electronics"],
  textiles: ["Textiles / calzado", "Textiles / footwear"],
  furniture: ["Muebles", "Furniture"],
  food: ["Alimentos / bebidas", "Food / beverages"],
  other: ["Otro", "Other"],
};

export function categoryLabel(c: string): string {
  const l = CATEGORY_LABEL[c] || CATEGORY_LABEL.other;
  return Lx(l[0], l[1]);
}

// Machines whose description mentions food use get the food-contact topic
const FOOD_USE = /aliment|comida|\bfood|caf[eé](?![a-záéíóúñ])|coffee|panader|bakery|\bpan\b|bread|tortill|carne|\bmeat|l[aá]cte|leche|dairy|\bmilk|bebida|beverage|jugo|juice|snack|chocolate|cacao|az[uú]car|sugar|harina|flour|granos?\b|grain|ma[ií]z|\bcorn\b|frut|fruit|verdura|vegetable|cocina|kitchen|restaurante|restaurant/i;

export function getReviewTopics(productType: string, supplier: any, description = ""): ReviewTopic[] {
  const T = (es: string, en: string) => Lx(es, en);
  const topics: ReviewTopic[] = [
    {
      title: T("Clasificación arancelaria (partida SAC)", "Tariff classification (SAC heading)"),
      why: T(
        "La partida define el DAI real y si se necesitan permisos. La estimación usa un DAI de referencia del 15%, que puede ser menor o mayor.",
        "The heading sets the actual DAI duty and whether permits are needed. The estimate uses a reference DAI of 15%, which may be lower or higher.",
      ),
      action: T(
        "Confirmar la partida con la ficha técnica del producto antes de comprar.",
        "Confirm the heading with the product's technical sheet before buying.",
      ),
      source: T("Agente aduanero (SEAL) · Arancel SAC / SAT", "Customs broker (SEAL) · SAC tariff / SAT"),
    },
    {
      title: T("Registro como importador en la SAT", "Importer registration with SAT"),
      why: T(
        "Para nacionalizar la mercancía, el NIT del importador debe estar habilitado para importar.",
        "To clear the goods, the importer's NIT must be enabled for imports.",
      ),
      action: T(
        "Verificar en la Agencia Virtual de la SAT que tu NIT esté activo como importador.",
        "Check in SAT's Agencia Virtual that your NIT is active as an importer.",
      ),
      source: "SAT",
    },
    {
      title: T("Documentos del embarque", "Shipping documents"),
      why: T(
        "La DUCA se prepara con la factura comercial, la lista de empaque y el conocimiento de embarque o guía. Datos que no coinciden causan retrasos o ajustes de valor.",
        "The DUCA customs declaration is prepared from the commercial invoice, packing list and bill of lading or airway bill. Mismatched data causes delays or value adjustments.",
      ),
      action: T(
        "Pedir al proveedor borradores de factura y lista de empaque antes del embarque.",
        "Ask the supplier for draft invoice and packing list before shipment.",
      ),
      source: T("Agente aduanero (SEAL) · SAT", "Customs broker (SEAL) · SAT"),
    },
    {
      title: T("Origen y posible preferencia arancelaria", "Origin and possible tariff preference"),
      why: T(
        "Si el producto viene de un país con tratado comercial con Guatemala, un certificado de origen podría reducir el DAI. Para China continental normalmente no hay preferencia.",
        "If the product comes from a country with a trade agreement with Guatemala, a certificate of origin could reduce the DAI. For mainland China there is usually no preference.",
      ),
      action: T("Confirmar el país de fabricación real con el proveedor.", "Confirm the actual country of manufacture with the supplier."),
      source: T("Agente aduanero (SEAL) · MINECO", "Customs broker (SEAL) · MINECO"),
    },
    {
      title: T("Embalaje de madera (NIMF 15)", "Wood packaging (ISPM 15)"),
      why: T(
        "Tarimas o cajas de madera deben venir tratadas y selladas según la norma NIMF 15; si no, pueden retenerse en el puerto.",
        "Wood pallets or crates must be treated and stamped under ISPM 15; otherwise they can be held at the port.",
      ),
      action: T("Pedir al proveedor embalaje con sello NIMF 15 o sin madera.", "Ask the supplier for ISPM 15-stamped packaging or no wood."),
      source: "MAGA",
    },
  ];

  if (productType === "machinery") {
    topics.push(
      {
        title: T("Especificaciones eléctricas", "Electrical specifications"),
        why: T(
          "En Guatemala la red es de 60 Hz. Una máquina a 50 Hz o con otro voltaje puede no funcionar bien.",
          "Guatemala's grid is 60 Hz. A 50 Hz machine or one with another voltage may not work properly.",
        ),
        action: T(
          "Confirmar por escrito voltaje, fases y 60 Hz con el proveedor, según tu instalación.",
          "Confirm voltage, phases and 60 Hz in writing with the supplier, according to your installation.",
        ),
        source: T("Proveedor · tu técnico eléctrico", "Supplier · your electrician"),
      },
      {
        title: T("Manuales, repuestos, garantía e instalación", "Manuals, spare parts, warranty and installation"),
        why: T(
          "Son condiciones que conviene dejar pactadas antes de pagar, sobre todo en maquinaria.",
          "These are terms worth agreeing before paying, especially for machinery.",
        ),
        action: T(
          "Incluirlas en la proforma: manual en español, lista de repuestos, garantía y soporte de instalación.",
          "Include them in the proforma: manual in Spanish, spare parts list, warranty and installation support.",
        ),
        source: T("Proveedor", "Supplier"),
      },
    );
    if (FOOD_USE.test(`${description} ${supplier?.productName ?? ""}`)) {
      topics.push(
        {
          title: T("Partes en contacto con alimentos", "Parts in contact with food"),
          why: T(
            "Las partes en contacto con alimentos deben ser de material apto (por ejemplo acero inoxidable de grado alimenticio).",
            "Parts in contact with food must be food-grade material (for example food-grade stainless steel).",
          ),
          action: T(
            "Pedir al proveedor la especificación del material y los certificados que declare.",
            "Ask the supplier for the material specification and any certificates they declare.",
          ),
          source: T("Proveedor · MSPAS para la operación de tu planta", "Supplier · MSPAS for your plant's operation"),
        },
      );
    }
  } else if (productType === "food") {
    topics.push({
      title: T("Permisos sanitarios y fitosanitarios", "Sanitary and phytosanitary permits"),
      why: T(
        "Los alimentos y bebidas suelen requerir registro sanitario; los de origen vegetal o animal, permisos de importación.",
        "Food and beverages usually require sanitary registration; those of plant or animal origin, import permits.",
      ),
      action: T("Revisar los requisitos antes de comprar.", "Review the requirements before buying."),
      source: "MSPAS · MAGA",
    });
  } else if (productType === "electronics") {
    topics.push(
      {
        title: T("Voltaje, enchufe y garantía", "Voltage, plug and warranty"),
        why: T(
          "Conviene confirmar que el producto sea compatible con 120 V / 60 Hz y el tipo de enchufe usado en Guatemala.",
          "It's worth confirming the product works with 120 V / 60 Hz and the plug type used in Guatemala.",
        ),
        action: T("Confirmarlo por escrito con el proveedor.", "Confirm it in writing with the supplier."),
        source: T("Proveedor", "Supplier"),
      },
      {
        title: T("Baterías de litio", "Lithium batteries"),
        why: T(
          "Si el producto trae baterías de litio, el transporte tiene reglas de mercancía peligrosa.",
          "If the product includes lithium batteries, transport has dangerous-goods rules.",
        ),
        action: T("Avisar a SEAL para coordinar el embarque.", "Tell SEAL so the shipment can be coordinated."),
        source: T("Naviera / aerolínea · SEAL", "Carrier · SEAL"),
      },
    );
  } else if (productType === "textiles") {
    topics.push({
      title: T("Etiquetado de composición", "Composition labeling"),
      why: T(
        "La ropa y el calzado deben indicar su composición; además, la partida exacta cambia mucho el DAI.",
        "Clothing and footwear must show their composition; also, the exact heading changes the DAI a lot.",
      ),
      action: T("Pedir al proveedor la composición y el etiquetado.", "Ask the supplier for the composition and labeling."),
      source: T("Proveedor · agente aduanero (SEAL)", "Supplier · customs broker (SEAL)"),
    });
  } else if (productType === "furniture") {
    topics.push({
      title: T("Madera y acabados", "Wood and finishes"),
      why: T(
        "Muebles de madera sólida pueden tener requisitos fitosanitarios distintos a los de madera procesada.",
        "Solid wood furniture may have different phytosanitary requirements than processed wood.",
      ),
      action: T("Confirmar el tipo de madera y su tratamiento con el proveedor.", "Confirm the wood type and treatment with the supplier."),
      source: "MAGA",
    });
  }

  // Supplier: only what the platform data says
  topics.push({
    title: T("El proveedor no ha sido verificado por SEAL", "The supplier has not been verified by SEAL"),
    why: T(
      `Según la plataforma: ${badgeText(supplier)}. Las insignias y certificaciones las publica la plataforma o declara el proveedor.`,
      `According to the platform: ${badgeText(supplier)}. Badges and certifications are published by the platform or declared by the supplier.`,
    ),
    action: T(
      "Pedir muestras y, si va a comprar, solicitar la verificación del proveedor en China.",
      "Request samples and, if you'll buy, request the supplier verification in China.",
    ),
    source: T("SEAL (servicio adicional)", "SEAL (additional service)"),
  });

  return topics;
}

function assumptions(productType: string, description: string): string[] {
  return [
    Lx("Destino: Guatemala.", "Destination: Guatemala."),
    Lx(
      `Tipo de producto inferido de tu descripción: ${categoryLabel(productType)}.`,
      `Product type inferred from your description: ${categoryLabel(productType)}.`,
    ),
    Lx(
      "Datos del proveedor tomados de la plataforma; no verificados por SEAL.",
      "Supplier data taken from the platform; not verified by SEAL.",
    ),
    Lx(
      "Los permisos exactos dependen de la partida arancelaria, que se confirma con la ficha técnica.",
      "Exact permits depend on the tariff heading, which is confirmed with the technical sheet.",
    ),
    ...(description ? [] : [Lx("No se recibió una descripción detallada del producto.", "No detailed product description was received.")]),
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RiskCompliance() {
  const navigate = useNavigate();
  const location = useLocation();
  const { L } = useLanguage();

  const supplier = location.state?.supplier ?? null;
  const destination = location.state?.destination ?? "GT";
  const productType = location.state?.productType ?? "other";
  const productDescription = String(location.state?.productDescription ?? "");
  const quantity = location.state?.quantity ?? "";
  const budget = location.state?.budget ?? "";
  const isLiveData = hasUsableSupplier(supplier);

  if (!isLiveData) return <NoSupplierNotice hasSupplierWithoutPrice={!!supplier?.name} />;

  const topics = getReviewTopics(productType, supplier, productDescription);

  const goToReport = () => {
    navigate("/report", {
      state: {
        supplier,
        destination,
        productType,
        quantity,
        budget,
        suppliersData: location.state?.suppliersData,
        volumeCbm: location.state?.volumeCbm,
        weightKg: location.state?.weightKg,
        productDescription,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-blue-50">
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={logo} alt="SEAL" className="h-12 sm:h-14 md:h-[65px] flex-shrink-0" />
              <span className="text-sm sm:text-xl font-bold text-[#0B3C5D] hidden xs:block truncate">
                SmartTrade AI
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              <button
                onClick={() => navigate(-1)}
                className="px-2 sm:px-4 py-2 sm:py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-xs sm:text-sm whitespace-nowrap"
              >
                <span>{L("← Costos", "← Costs")}</span>
              </button>
              <button
                onClick={goToReport}
                className="px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-1 sm:gap-2 shadow-lg hover:shadow-xl text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{L("Ver informe", "View report")}</span>
                <span className="sm:hidden">{L("Informe", "Report")}</span>
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <LanguageToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] mb-2">
            {L("Aspectos por revisar antes de importar", "Aspects to review before importing")}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            {L(
              "Orientación inicial para tu importación a Guatemala. No es un dictamen ni una evaluación de riesgo: son temas que conviene confirmar con las fuentes indicadas.",
              "Initial guidance for your import into Guatemala. It is not a ruling or a risk assessment: these are topics worth confirming with the sources indicated.",
            )}
          </p>
        </div>

        {/* Product */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4 sm:p-5 mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            {L("Tu producto", "Your product")}
          </p>
          <p className="text-sm text-slate-800 whitespace-pre-line break-words">
            {productDescription || categoryLabel(productType)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {L("Proveedor considerado:", "Supplier considered:")}{" "}
            <span className="font-medium text-slate-700">{supplier?.name}</span>
          </p>
        </div>

        {/* Topics */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 mb-6">
          <h2 className="font-semibold text-[#0B3C5D] mb-5 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {L(`Temas por revisar (${topics.length})`, `Topics to review (${topics.length})`)}
          </h2>
          <ol className="space-y-4">
            {topics.map((tp, i) => (
              <li key={i} className="border-l-4 border-blue-400 bg-blue-50/60 rounded-lg p-4">
                <h3 className="font-semibold text-[#0B3C5D] mb-1">
                  {i + 1}. {tp.title}
                </h3>
                <p className="text-sm text-slate-700 mb-2">{tp.why}</p>
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{L("Qué hacer:", "What to do:")}</span> {tp.action}
                </p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>
                    {L("Dónde confirmarlo:", "Where to confirm:")} {tp.source}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Documents */}
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4 sm:p-6">
            <h2 className="font-semibold text-[#0B3C5D] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {L("Documentos que normalmente se piden", "Documents usually requested")}
            </h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {[
                L("Factura comercial", "Commercial invoice"),
                L("Lista de empaque", "Packing list"),
                L("Conocimiento de embarque (marítimo) o guía aérea", "Bill of lading (ocean) or airway bill"),
                L("DUCA (la prepara el agente aduanero)", "DUCA customs declaration (prepared by the broker)"),
                L("Certificado de origen (solo si aplica una preferencia)", "Certificate of origin (only if a preference applies)"),
                L("Permisos según la partida, si aplican", "Permits depending on the heading, if applicable"),
              ].map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Circle className="w-3.5 h-3.5 text-slate-300 mt-1 flex-shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Assumptions */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-6">
            <h2 className="font-semibold text-[#0B3C5D] mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              {L("Supuestos de esta orientación", "Assumptions of this guidance")}
            </h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {assumptions(productType, productDescription).map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SupplierDisclaimer
          supplier={supplier}
          productDescription={productDescription}
          quantity={quantity}
        />
      </div>
    </div>
  );
}
