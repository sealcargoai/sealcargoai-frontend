// "Talk to SEAL": a visible way out to SEAL from the landing page, the chat and
// the results, for whoever wants to move forward (search is optional for those
// who already have a supplier, a proforma or cargo on its way). The request
// carries the whole case and the client gets a case number back.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { sendToSeal, receiptText, type CaseContext, type SealResult } from "../../utils/caseContext";
import { caseForSeal } from "../../utils/caseStore";
import { track } from "../../utils/funnel";

function storedUser(): { name: string; email: string } {
  try {
    const d = JSON.parse(localStorage.getItem("sealcargo_user_data") || "null");
    return { name: d?.name || "", email: d?.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}

interface Props {
  source: string; // landing, chat, resultados, costos…
  intent?: string;
  context?: CaseContext; // this screen's data (wins over the stored case)
  requestType?: string;
  variant?: "button" | "card" | "link" | "hero";
  label?: string;
  className?: string;
}

export function ContactSeal({ source, intent = "", context = {}, requestType, variant = "button", label, className = "" }: Props) {
  const { L } = useLanguage();
  const stored = storedUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SealResult | null>(null);

  // what SEAL will receive: the stored case, this screen's data and the product, quantity and
  // budget in force (an estimate made for other values is listed as no longer current): utils/caseStore
  const ctx: CaseContext = caseForSeal(context as Record<string, unknown>);
  const summary = [
    ctx.product || ctx.productDescription ? `${L("Producto", "Product")}: ${String(ctx.product || ctx.productDescription).slice(0, 600)}` : "",
    ctx.quantity ? `${L("Cantidad", "Quantity")}: ${Number(ctx.quantity) ? Number(ctx.quantity).toLocaleString("en-US") : ctx.quantity}` : "",
    ctx.budget ? `${L("Presupuesto de compra", "Purchase budget")}: ${ctx.budget}` : "",
    ctx.supplierName ? `${L("Proveedor", "Supplier")}: ${ctx.supplierName}` : "",
    ctx.price
      ? ctx.priceSource === "usuario"
        ? `${L("Precio indicado por el usuario", "Price entered by the user")}: ${ctx.price}${ctx.publishedPrice && ctx.publishedPrice !== ctx.price ? L(` (publicado: ${ctx.publishedPrice})`, ` (published: ${ctx.publishedPrice})`) : ""}`
        : ctx.publishedPrice && ctx.publishedPrice !== ctx.price
          ? `${L("Precio usado en la estimación", "Price used in the estimate")}: ${ctx.price} (${L("publicado", "published")}: ${ctx.publishedPrice})`
          : `${L("Precio publicado", "Published price")}: ${ctx.price}`
      : "",
    ctx.totalCostText ? `${L("Costo estimado", "Estimated cost")}: ${ctx.totalCostText}` : "",
    ctx.assumptions?.length ? L(`${ctx.assumptions.length} supuesto(s) de la estimación`, `${ctx.assumptions.length} estimate assumption(s)`) : "",
    ctx.warnings?.length ? L(`${ctx.warnings.length} advertencia(s) que viste`, `${ctx.warnings.length} warning(s) you saw`) : "",
    ctx.chat?.length ? L("Lo que escribiste en el chat", "What you wrote in the chat") : "",
    // a product changed in this case: the earlier data goes as history, marked as not current
    ...(ctx.earlier || []).map((x) => L(`Historial (ya no vigente): ${x}`, `History (no longer current): ${x}`)),
  ].filter(Boolean);

  const openForm = () => {
    // a new send can add to the case (the server groups it, without duplicating)
    setResult(null);
    setMessage("");
    setError("");
    setOpen(true);
    track("contacto_abierto", { seal_source: source, seal_intent: intent });
  };
  // a double click or Enter while sending never sends twice
  const inFlight = useRef(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    if (name.trim().length < 2) return setError(L("Escribe tu nombre.", "Enter your name."));
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email.trim())) return setError(L("Escribe un correo completo, por ejemplo nombre@empresa.com.", "Enter a complete email, for example name@company.com."));
    setError("");
    inFlight.current = true;
    setSending(true);
    const r = await sendToSeal({
      ...context,
      requestType: requestType || "Contacto directo con SEAL",
      source,
      intent,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
    });
    setSending(false);
    inFlight.current = false;
    // a confirmation only with a case number from the server; on failure what was written stays
    if (r.ok) return setResult(r);
    setError(
      r.status === 400
        ? L("Revisa tu nombre y correo (por ejemplo nombre@empresa.com).", "Check your name and email (for example name@company.com).")
        : r.status === 429
          ? L("Se alcanzó el límite de envíos por ahora. Escríbenos al WhatsApp +502 5996 4664.", "The sending limit was reached for now. Message us on WhatsApp +502 5996 4664.")
          : L("No se pudo enviar. Escríbenos al WhatsApp +502 5996 4664.", "Could not send. Message us on WhatsApp +502 5996 4664."),
    );
  };

  const text = label || L("Enviar mi caso a SEAL", "Send my case to SEAL");
  const trigger =
    variant === "link" ? (
      <button type="button" onClick={openForm} className={`underline font-semibold ${className}`}>
        {text}
      </button>
    ) : variant === "hero" ? (
      <button type="button" onClick={openForm} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#0B3C5D] font-semibold shadow-lg hover:bg-blue-50 ${className}`}>
        <MessageSquare className="w-4 h-4" /> {text}
      </button>
    ) : variant === "card" ? (
      <div className={`bg-emerald-50 border border-emerald-300 rounded-2xl p-5 max-w-2xl ${className}`}>
        <p className="text-sm text-emerald-950 mb-3">
          {L("SEAL recibe tu caso con lo que nos contaste y te da un número para el seguimiento.", "SEAL receives your case with what you told us and gives you a number for follow-up.")}
        </p>
        <button type="button" onClick={openForm} className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 inline-flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> {text}
        </button>
      </div>
    ) : (
      <button type="button" onClick={openForm} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 ${className}`}>
        <MessageSquare className="w-4 h-4" /> {text}
      </button>
    );

  const input = "w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800";
  // The dialog is mounted on <body>: inside a sticky or blurred header (backdrop-filter)
  // "fixed" is relative to that header and the form was pushed off screen.
  // Escape closes it, the page behind doesn't scroll, focus goes to the form.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    (panelRef.current?.querySelector<HTMLElement>("input") ?? panelRef.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const dialog = open ? (
        <div
          className="fixed inset-0 z-[200] bg-black/50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={text}
          data-testid="seal-dialog"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="min-h-full flex items-center justify-center p-4">
          <div ref={panelRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 text-left">
            <div className="sticky -top-5 sm:-top-6 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 pt-5 sm:pt-6 pb-2 bg-white z-10 flex items-start justify-between gap-3 mb-1">
              <h3 className="text-lg font-semibold text-[#0B3C5D]">{L("Hablar con SEAL", "Talk to SEAL")}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label={L("Cerrar", "Close")} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            {result ? (
              <div role="status" data-testid="seal-receipt" className="space-y-3">
                <p className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{receiptText(result, L)}</p>
                {result.caseUrl && (
                  <a href={result.caseUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-[#0B3C5D] underline">
                    {L("Ver lo que recibió SEAL y el estado de mi caso", "See what SEAL received and my case status")}
                  </a>
                )}
                <a
                  href={`https://wa.me/50259964664?text=${encodeURIComponent(L(`Hola, mi número de caso es ${result.id}.`, `Hello, my case number is ${result.id}.`))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-emerald-800 underline"
                >
                  {L("Escribir por WhatsApp con mi número de caso", "Message on WhatsApp with my case number")}
                </a>
                <button type="button" onClick={() => setOpen(false)} className="block w-full mt-2 px-4 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold">
                  {L("Listo", "Done")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3" noValidate>
                <p className="text-sm text-slate-600">
                  {L(
                    "Un ejecutivo de SEAL revisa tu caso y te contacta. No necesitas buscar proveedores si ya tienes uno.",
                    "A SEAL executive reviews your case and contacts you. You don't need to search for suppliers if you already have one.",
                  )}
                </p>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={L("Nombre", "Name")} aria-label={L("Nombre", "Name")} autoComplete="name" maxLength={120} />
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L("Correo", "Email")} aria-label={L("Correo", "Email")} autoComplete="email" maxLength={254} />
                <input className={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={L("Teléfono / WhatsApp (opcional)", "Phone / WhatsApp (optional)")} aria-label={L("Teléfono", "Phone")} autoComplete="tel" maxLength={40} />
                <textarea
                  className={input}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  aria-label={L("Mensaje", "Message")}
                  placeholder={L("¿Qué necesitas? (proveedor, proforma, fecha de llegada…)", "What do you need? (supplier, proforma, arrival date…)")}
                />
                {summary.length > 0 && (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="font-semibold mb-1">{L("SEAL recibirá también:", "SEAL will also receive:")}</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {summary.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={sending} className="w-full px-4 py-3 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-60">
                  {sending ? L("Enviando…", "Sending…") : L("Enviar a SEAL", "Send to SEAL")}
                </button>
                <p className="text-[11px] text-slate-500">
                  {L(
                    "Usamos tus datos solo para atender este caso. No los compartimos con proveedores.",
                    "We use your data only to handle this case. We don't share it with suppliers.",
                  )}
                </p>
              </form>
            )}
          </div>
          </div>
        </div>
  ) : null;
  return (
    <>
      {trigger}
      {dialog && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
