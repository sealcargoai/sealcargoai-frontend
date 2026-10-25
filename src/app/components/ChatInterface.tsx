import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Send, MessageSquare, FileText, ArrowRight } from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { query, name, email, descriptionCleaned } = location.state || {};
  const { t, L } = useLanguage();

  // Assistant texts are resolved at render time so they follow the ES / EN switch
  const intro: Message[] = [
    {
      role: "ai",
      content: L(
        `${name ? `Hola, ${name}.` : "Hola."} Soy el asistente de orientación de SEAL. Puedo ayudarte a organizar la información de tu importación, explorar posibles proveedores y revisar algunos aspectos que conviene considerar.${query ? ` Tu consulta: "${query}".` : ""}${descriptionCleaned ? " Dejé fuera una parte del texto que no describe el producto; la herramienta no garantiza proveedores." : ""}`,
        `${name ? `Hi, ${name}.` : "Hi."} I'm SEAL's guidance assistant. I can help you organize the information for your import, explore possible suppliers and review some aspects worth considering.${query ? ` Your request: "${query}".` : ""}${descriptionCleaned ? " I left out part of the text that doesn't describe the product; the tool does not guarantee suppliers." : ""}`,
      ),
    },
    {
      role: "ai",
      content: L(
        "Para preparar una orientación más útil, necesito algunos datos sobre el producto, la cantidad y el destino.",
        "To prepare more useful guidance, I need some details about the product, the quantity and the destination.",
      ),
    },
  ];
  // Short, honest answers: what the tool can't confirm, why, and the useful next step.
  const REPLIES: Record<string, string> = {
    supplier: L(
      "No puedo confirmar si un proveedor es real o confiable: la herramienta solo organiza lo que publica la plataforma (insignias, años, reseñas) y no lo verifica. Siguiente paso: continúa con el formulario para ver opciones ordenadas por índice referencial y, si vas a comprar, pide a SEAL la verificación del proveedor en China (servicio adicional).",
      "I can't confirm whether a supplier is real or reliable: the tool only organizes what the platform publishes (badges, years, reviews) and doesn't verify it. Next step: continue with the form to see options sorted by reference index and, if you're going to buy, ask SEAL for the supplier verification in China (additional service).",
    ),
    guarantee: L(
      "Tampoco puedo garantizar que la importación sea autorizada ni que pase la aduana sin observaciones: eso depende de la partida arancelaria, de los permisos que esa partida pida y de que la documentación del embarque coincida. Dato a confirmar: la ficha técnica del producto, para que SEAL revise la partida y los permisos antes de comprar.",
      "I also can't guarantee the import will be authorized or clear customs without remarks: that depends on the tariff heading, the permits it requires and the shipping documents matching. Data to confirm: the product's technical sheet, so SEAL can review the heading and permits before you buy.",
    ),
    dai: L(
      "No puedo dar el impuesto exacto sin la ficha técnica: el DAI depende de la partida arancelaria, y la partida se define con lo que dice esa ficha (qué es el producto, material, uso). En la estimación usamos 15% de DAI como referencia y el IVA de 12% sobre CIF + DAI. Siguiente paso: completa el formulario para ver el escenario y, para la partida exacta, comparte la ficha técnica con un agente aduanero de SEAL (WhatsApp +502 5996 4664).",
      "I can't give the exact tax without the technical sheet: the DAI depends on the tariff heading, and the heading is set from that sheet (what the product is, material, use). The estimate uses 15% DAI as reference and 12% IVA on CIF + DAI. Next step: complete the form to see the scenario and, for the exact heading, share the technical sheet with a SEAL customs broker (WhatsApp +502 5996 4664).",
    ),
    cost: L(
      "Puedo prepararte una estimación preliminar con los datos del formulario (producto, cantidad y, si lo tienes, volumen o peso). Un costo confirmado solo lo da una cotización de SEAL. Siguiente paso: continúa con el formulario.",
      "I can prepare a preliminary estimate with the form data (product, quantity and, if you have it, volume or weight). A confirmed cost only comes from a SEAL quote. Next step: continue with the form.",
    ),
    general: L(
      "Gracias. Por ahora no respondo preguntas abiertas en este chat. Para orientarte, continúa con el formulario: ahí ordenamos tus datos y preparamos las referencias y estimaciones. Si prefieres hablar con una persona, escribe al WhatsApp de SEAL +502 5996 4664.",
      "Thanks. For now I don't answer open questions in this chat. To guide you, continue with the form: there we organize your data and prepare the references and estimates. If you'd rather talk to a person, message SEAL on WhatsApp +502 5996 4664.",
    ),
  };
  // A question can touch several topics ("verified supplier, guaranteed import, exact tax"):
  // every one gets its answer, in this order.
  const replyKind = (text: string) => {
    const t = text.toLowerCase();
    const kinds: string[] = [];
    if (/proveedor|supplier|seller|vendedor|f[aá]brica|factory|confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verified|legit/.test(t)) kinds.push("supplier");
    if (/garantiz|garant[ií]a de que|asegur|autoriz|permiso|aprobad|aprobaci|liberaci|que pase|sin problema|guarantee|authoriz|permit|approv|clear customs/.test(t)) kinds.push("guarantee");
    if (/\bdai\b|arancel|partida|impuesto|\biva\b|tributo|tariff|duty|duties|\btax/.test(t)) kinds.push("dai");
    if (/precio|costo|cu[aá]nto|cotiz|price|cost|quote|how much/.test(t)) kinds.push("cost");
    return kinds.length ? kinds.join(",") : "general";
  };
  // "ai" entries in state hold the reply kind; the text is resolved at render (ES / EN)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const kind = replyKind(input);
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "ai", content: kind }]);
    }, 1000);
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-slate-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
  fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/95 backdrop-blur-lg border-r border-slate-200 flex flex-col shadow-xl
  transform transition-transform duration-300 ease-in-out
  ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
`}
      >
        {/* ...keep existing sidebar content... */}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {/* Decreased vertical padding from py-5 to py-3 to shrink the header height */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#0B3C5D]">
                {" "}
                {t("chat.title")}{" "}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {" "}
                {t("chat.subtitle")}{" "}
              </p>
            </div>
            <LanguageToggle />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {[...intro, ...messages.map((m) => (m.role === "ai"
            ? { ...m, content: m.content
                  .split(",")
                  .map((k, i) => {
                    const r = REPLIES[k] ?? REPLIES.general;
                    // "Tampoco…" only reads well after another answer
                    return i === 0 ? r.replace(/^Tampoco puedo/, "No puedo").replace(/^I also can't/, "I can't") : r;
                  })
                  .join("\n\n") }
            : m))].map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-2xl ${msg.role === "user" ? "bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white shadow-lg" : "bg-white border border-slate-200 shadow-md"} rounded-2xl px-6 py-4`}
              >
                {msg.role === "ai" && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-[#0B3C5D]">
                        SEAL
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {L("Asistente de SEAL", "SEAL assistant")}
                    </span>
                  </div>
                )}
                <p
                  className={
                    `whitespace-pre-line ${msg.role === "user" ? "text-white" : "text-slate-700"}`
                  }
                >
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* CTA Card */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 max-w-2xl">
            <h3 className="font-semibold text-[#0B3C5D] mb-2">
              {t("chat.ctaTitle")}
            </h3>
            <p className="text-sm text-slate-600 mb-4">{t("chat.ctaDesc")}</p>
            <button
              onClick={() =>
                navigate("/qualify", { state: { query, name, email, descriptionCleaned } })
              }
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {t("chat.ctaButton")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="bg-white/80 backdrop-blur-lg border-t border-slate-200 p-6 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-3 bg-white rounded-xl px-5 py-4 border-2 border-slate-200 shadow-md focus-within:border-blue-500 focus-within:shadow-lg transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("chat.placeholder")}
              className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white hover:from-blue-700 hover:to-[#0a2f47] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
