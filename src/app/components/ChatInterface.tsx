import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Send, MessageSquare, FileText, ArrowRight } from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { buildReply, productFromMessage, productMention, replyKinds, foodAdvice, quantityChange, type ReplySpec } from "../../utils/chatReply";

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
      content: query
        ? L(
            "Con tu consulta ya tengo el producto. En el formulario confirmamos la cantidad y, si lo tienes, el volumen o el peso; el destino es Guatemala. También puedes preguntarme aquí.",
            "With your request I already have the product. In the form we confirm the quantity and, if you have it, the volume or weight; the destination is Guatemala. You can also ask me here.",
          )
        : L(
            "Para preparar una orientación más útil, dime qué producto quieres importar y cuántas unidades; el destino es Guatemala.",
            "To prepare more useful guidance, tell me what product you want to import and how many units; the destination is Guatemala.",
          ),
    },
  ];
  // "ai" entries hold a reply spec (JSON); the text is built at render (ES / EN)
  // from the product the client actually named
  // The conversation survives a reload of this tab (same request)
  const CHAT_KEY = "seal_chat";
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "null");
      return saved && saved.query === (query || "") && Array.isArray(saved.messages) ? saved.messages : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify({ query: query || "", messages }));
    } catch {
      /* storage unavailable */
    }
  }, [messages, query]);
  const [input, setInput] = useState("");
  const specs = messages.filter((m) => m.role === "ai").map((m) => JSON.parse(m.content) as ReplySpec);
  const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
  const currentProduct = lastNamed?.newProduct || lastNamed?.mentioned || String(query || "").trim();
  // quantity: the last one the client gave here, else the one in their request
  const initialQty = (() => {
    const m = String(query || "").replace(/(\d),(\d{3})/g, "$1$2").match(/\b(\d+)\s+(?!kg|kgs|t\b|l\b|litros|agujas|needles)/i);
    return m ? Number(m[1]) : 0;
  })();
  const currentQuantity = [...specs].reverse().find((x) => x.newQuantity)?.newQuantity || initialQty;

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    const newProduct = productFromMessage(text) || undefined;
    // a product named inside a question ("¿el CE sirve para lápices?") becomes the context silently
    const mentioned = !newProduct ? productMention(text) || undefined : undefined;
    // only a certificate answer that asked "¿qué producto?" is answered again for the new product
    const lastAi = specs[specs.length - 1];
    const askedForProduct = !!lastAi && !lastAi.product && replyKinds(lastAi.reask || lastAi.text).includes("certificate");
    const qc = quantityChange(text);
    const spec: ReplySpec = {
      newQuantity: qc?.qty,
      oldQuantity: qc ? qc.before || currentQuantity || undefined : undefined,
      text,
      product: newProduct || mentioned || currentProduct,
      newProduct,
      mentioned,
      previous: currentProduct,
      reask: askedForProduct ? lastAi.reask || lastAi.text : undefined,
      earlierFood: specs.some((x) => (replyKinds(x.text).includes("certificate") || !!x.reask) && foodAdvice(x.product)),
    };
    setMessages([...messages, { role: "user", content: text }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "ai", content: JSON.stringify(spec) }]);
    }, 1000);
  };

  return (
    <div className="h-screen flex overflow-x-hidden bg-gradient-to-br from-slate-50 to-blue-50">
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
      <div className="flex-1 min-w-0 flex flex-col">
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
            ? { ...m, content: buildReply(JSON.parse(m.content) as ReplySpec) }
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
                navigate("/qualify", {
                  state: {
                    query: currentProduct || query,
                    name,
                    email,
                    descriptionCleaned,
                    ...([...specs].reverse().find((x) => x.newQuantity) ? { quantity: String(currentQuantity) } : {}),
                  },
                })
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
