import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { Send, MessageSquare, FileText, ArrowRight } from "lucide-react";
import logo from "../../imports/ChatGPT_Image_Apr_27,_2026,_10_59_16_AM.png";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { buildReply, contactIntent, urgentContact, requestStatusQuestion, quantityInForce, fmtBudget, validQuantity, type ReplySpec } from "../../utils/chatReply";
import { applyChatMessage } from "../../utils/chatCase";
import { lastSentCase, switchCaseProduct, switchedCase, caseContext } from "../../utils/caseContext";
import { ContactSeal } from "./ContactSeal";
import { savedProduct } from "../../utils/draft";
import { currentCase, repairCase } from "../../utils/caseStore";

/** A stored reply spec, or null when the record is damaged (never throws: a bad entry can't block the chat). */
function parseSpec(content: unknown): ReplySpec | null {
  if (typeof content !== "string") return null;
  try {
    const v = JSON.parse(content);
    return v && typeof v === "object" && !Array.isArray(v) && typeof v.text === "string" ? (v as ReplySpec) : null;
  } catch {
    return null;
  }
}
/** The saved conversation, keeping only well-formed messages (a damaged reply is dropped, not rendered). */
function cleanMessages(list: unknown): Message[] {
  if (!Array.isArray(list)) return [];
  const out: Message[] = [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const x = m as Record<string, unknown>;
    if (x.role === "user" && typeof x.content === "string") out.push({ role: "user", content: x.content.slice(0, 4000), ...(typeof x.id === "number" ? { id: x.id } : {}) });
    else if (x.role === "ai" && parseSpec(x.content)) out.push({ role: "ai", content: x.content as string, ...(typeof x.id === "number" ? { id: x.id } : {}) });
  }
  return out;
}

interface Message {
  role: "user" | "ai";
  content: string;
  id?: number; // ties a reply to the question it answers
  pending?: boolean; // the reply is shown as "typing" for a moment
}

export function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { query, name: stateName, email, descriptionCleaned } = location.state || {};
  const { t, L } = useLanguage();
  // The conversation of this case is kept while the client goes to the form and back
  // (a new case from the start screen clears it). Its intro keeps the request it began with.
  const CHAT_KEY = "seal_chat";
  const savedChat = (() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "null");
      return v && typeof v === "object" && Array.isArray(v.messages) ? { query: typeof v.query === "string" ? v.query : undefined, name: typeof v.name === "string" ? v.name : undefined, messages: cleanMessages(v.messages) } : null;
    } catch {
      return null;
    }
  })();
  // a reload keeps the greeting with the client's name
  const name = stateName || (savedChat?.messages.length && typeof savedChat.name === "string" ? savedChat.name : "");
  const startQuery = savedChat?.messages.length && typeof savedChat.query === "string" ? savedChat.query : String(query || "");

  // Assistant texts are resolved at render time so they follow the ES / EN switch
  const intro: Message[] = [
    {
      role: "ai",
      content: L(
        `${name ? `Hola, ${name}.` : "Hola."} Soy el asistente de orientación de SEAL. Puedo ayudarte a organizar la información de tu importación, explorar posibles proveedores y revisar algunos aspectos que conviene considerar.${startQuery ? ` Tu consulta: "${startQuery}".` : ""}${descriptionCleaned ? " Dejé fuera una parte del texto que no describe el producto; la herramienta no garantiza proveedores." : ""}`,
        `${name ? `Hi, ${name}.` : "Hi."} I'm SEAL's guidance assistant. I can help you organize the information for your import, explore possible suppliers and review some aspects worth considering.${startQuery ? ` Your request: "${startQuery}".` : ""}${descriptionCleaned ? " I left out part of the text that doesn't describe the product; the tool does not guarantee suppliers." : ""}`,
      ),
    },
    {
      role: "ai",
      content: startQuery
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
  const specsOf = (list: Message[]) => list.filter((m) => m.role === "ai").map((m) => parseSpec(m.content)).filter((x): x is ReplySpec => !!x);
  // quantity: the last one the client gave here, else the one in their request
  const initialQty = (() => {
    // "500 ml", "20 kg", "12 V" are sizes, not the quantity
    // (the tail of "3.5" or of "-1" is not a quantity, and an out-of-range number is not used)
    const m = String(startQuery || "").replace(/(\d),(\d{3})/g, "$1$2").match(/(?<![\d.,\-−])(\d+)\s*(?!\s*(?:ml|l|lt|lts|litros?|kg|kgs|g|gr|grs|gramos?|oz|lb|lbs|libras?|t|ton|toneladas?|cm|mm|m|mts?|metros?|pulgadas?|in|ft|pies|w|v|kw|kva|hp|hz|mah|gb|tb|agujas|needles|%|"|x\s*\d)\b)(?=\s|$)/i);
    return m && validQuantity(Number(m[1])) ? Number(m[1]) : 0;
  })();
  const contextOf = (list: ReplySpec[]) => {
    const lastNamed = [...list].reverse().find((x) => x.newProduct || x.mentioned);
    return {
      currentProduct: lastNamed?.newProduct || lastNamed?.mentioned || String(startQuery || "").trim(),
      // a quantity given for an earlier product doesn't carry over to the new one
      currentQuantity: quantityInForce(list) || (list.some((x) => x.newProduct && x.previous) ? 0 : initialQty),
    };
  };
  const [messages, setMessages] = useState<Message[]>(() => {
    // a reply that was still "typing" when the page reloaded is shown in full
    const list: Message[] = (savedChat?.messages || []).map((m: Message) => ({ ...m, pending: false }));
    // the client changed the product in the form: the chat continues with it, and says so
    const inForm = savedProduct();
    // compared with the product the client stated (a product only mentioned in a question doesn't count)
    const here = [...specsOf(list)].reverse().find((x) => x.newProduct)?.newProduct || String(startQuery || "").trim();
    const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
    if (inForm && norm(inForm) !== norm(here)) {
      const spec: ReplySpec = { text: "", product: inForm, newProduct: inForm, previous: here, formUpdate: true };
      // what the product change leaves as history (computed without writing: this initializer may
      // run twice under React StrictMode; the write happens once, in the effect below)
      const old = switchedCase(caseContext(), inForm, { product: here }).facts;
      if (old) spec.stale = { product: old.product, quantity: old.quantity, budget: old.budget };
      list.push({ role: "ai", content: JSON.stringify(spec), id: Date.now() });
    }
    return list;
  });
  // the case follows the product in force; the previous product's data becomes history (idempotent)
  useEffect(() => {
    repairCase();
    const last = [...specsOf(messages)].reverse().find((x) => x.newProduct);
    if (last?.formUpdate && last.newProduct) switchCaseProduct(last.newProduct, { product: last.previous || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the conversation as last applied (read synchronously by handleSend)
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify({ query: startQuery, name, messages }));
    } catch {
      /* storage unavailable */
    }
  }, [messages, startQuery]);
  const [input, setInputState] = useState("");
  // the text to send, read and cleared synchronously: a double click (or Enter + click) before React
  // re-renders finds it empty and sends nothing — one message is applied once
  const inputRef = useRef("");
  const setInput = (v: string) => {
    inputRef.current = v;
    setInputState(v);
  };
  // the newest answer (and the way to SEAL under it) comes into view
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);
  const specs = specsOf(messages);
  // (the reply context, with mentions, is built per message in handleSend)
  // whoever wants to move forward gets the way to SEAL right under that answer
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
  // the form is offered under a request to talk to SEAL, and under "¿ya llegó mi solicitud?" when nothing was sent yet
  const sentSpecs = new Map(messages.filter((m) => m.role === "ai" && m.id).map((m) => [m.id, parseSpec(m.content)]));
  const lastContact = [...messages].reverse().find(
    (m) => m.role === "user" && (contactIntent(m.content) || (requestStatusQuestion(m.content) && !sentSpecs.get(m.id)?.sentCase)),
  );
  // the latest message asks for SEAL: one clear next step (the form stays as a small link)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const wantsSeal = !!lastContact && lastUser === lastContact;
  const INTENT_LABEL: Record<string, string> = { contratar: "quiere contratar", hablar_persona: "pide que un ejecutivo revise su caso", proforma: "tiene proforma", documentos: "ya tiene documentos", carga_en_camino: "su carga ya viene", ya_tiene_proveedor: "ya tiene proveedor" };
  // the case's product is the one the client stated (here or in the form); a product only
  // mentioned inside a question ("¿qué DAI pagan los molinos?") guides that answer, not the case
  const caseProduct = [...specs].reverse().find((x) => x.newProduct)?.newProduct || savedProduct() || String(startQuery || "").trim();
  // the product, quantity and budget in force, as every screen shows them (utils/caseStore)
  const inForce = currentCase();
  const caseQtyNow = inForce.quantity || 0;
  const chatCase = {
    product: inForce.product || caseProduct || undefined,
    quantity: caseQtyNow ? String(caseQtyNow) : undefined,
    budget: inForce.budget ? fmtBudget(inForce.budget) : undefined,
    chat: userTexts.slice(-8),
  };

  const handleSend = () => {
    const text = inputRef.current.trim();
    if (!text) return;
    inputRef.current = "";
    const id = Date.now() + Math.random();
    // The question and its reply are added together, right after the earlier ones:
    // a second question sent while a reply is still "typing" is answered after it,
    // with that reply already counted (a follow-up builds on it), never mixed up.
    // The message is applied ONCE, outside the React state updater (React may run an updater
    // twice, and this one writes the case), against the conversation as it is right now: a second
    // message sent while a reply is still "typing" builds on this one, never on a stale copy.
    const prev = messagesRef.current;
    const earlier = specsOf(prev);
    const ctx = contextOf(earlier);
    // what the message is and what it changes in the case: utils/chatCase applyChatMessage
    const spec = applyChatMessage(text, earlier, { ...ctx, startQuery: String(startQuery || "") });
    // "¿ya llegó mi solicitud?": answered with the case actually sent from this tab, if any
    if (requestStatusQuestion(text)) spec.sentCase = lastSentCase() || undefined;
    const added: Message[] = [{ role: "user", content: text, id }, { role: "ai", content: JSON.stringify(spec), id, pending: true }];
    messagesRef.current = [...prev, ...added];
    // pure updater: it only appends this exchange
    setMessages((list) => [...list, ...added]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id && m.pending ? { ...m, pending: false } : m)));
    }, 700);
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
            <div className="flex items-center gap-2">
              <ContactSeal
                source="chat"
                variant="button"
                label={L("Hablar con SEAL", "Talk to SEAL")}
                context={chatCase}
                // what the client asked for in the chat (proforma, cargo on its way…) travels with the case
                {...(lastContact ? { intent: contactIntent(lastContact.content), requestType: `${urgentContact(lastContact.content) ? "URGENTE · " : ""}Chat: ${INTENT_LABEL[contactIntent(lastContact.content)] || "contacto"}` } : {})}
              />
              <LanguageToggle />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {[...intro, ...messages.map((m) => (m.role === "ai"
            ? { ...m, content: m.pending ? L("Escribiendo…", "Typing…") : (() => { const sp = parseSpec(m.content); return sp ? buildReply(sp) : ""; })() }
            : m))].map((msg, i) => (
            <div key={i}>
            <div
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
            {msg.role === "ai" && lastContact && "id" in msg && msg.id === lastContact.id && !msg.pending && (
              <ContactSeal
                source="chat"
                variant="card"
                className="mt-3"
                intent={contactIntent(lastContact.content)}
                requestType={`${urgentContact(lastContact.content) ? "URGENTE · " : ""}Chat: ${INTENT_LABEL[contactIntent(lastContact.content)] || "contacto"}`}
                context={chatCase}
              />
            )}
            </div>
          ))}

          <div ref={endRef} />
          {/* CTA Card */}
          {wantsSeal ? (
            <p className="text-xs text-slate-500 max-w-2xl">
              {L("Si más adelante quieres comparar proveedores, ", "If later you want to compare suppliers, ")}
              <button
                type="button"
                className="underline"
                onClick={() => navigate("/qualify", { state: { query: caseProduct || query, name, email, descriptionCleaned, ...(caseQtyNow ? { quantity: String(caseQtyNow) } : {}) } })}
              >
                {L("puedes usar el formulario", "you can use the form")}
              </button>
              .
            </p>
          ) : (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 max-w-2xl">
            <h3 className="font-semibold text-[#0B3C5D] mb-2">
              {t("chat.ctaTitle")}
            </h3>
            <p className="text-sm text-slate-600 mb-4">{t("chat.ctaDesc")}</p>
            <button
              onClick={() =>
                navigate("/qualify", {
                  state: {
                    query: caseProduct || query,
                    name,
                    email,
                    descriptionCleaned,
                    ...(caseQtyNow ? { quantity: String(caseQtyNow) } : {}),
                  },
                })
              }
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-[#0B3C5D] text-white rounded-xl hover:from-blue-700 hover:to-[#0a2f47] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {t("chat.ctaButton")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white/80 backdrop-blur-lg border-t border-slate-200 p-6 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-3 bg-white rounded-xl px-5 py-4 border-2 border-slate-200 shadow-md focus-within:border-blue-500 focus-within:shadow-lg transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // a held-down Enter (key repeat) or an IME composition never sends the same message twice
              onKeyDown={(e) => e.key === "Enter" && !e.repeat && !e.nativeEvent.isComposing && handleSend()}
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
