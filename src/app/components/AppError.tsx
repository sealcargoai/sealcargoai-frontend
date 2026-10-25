import { useRouteError, useNavigate } from "react-router";
import { AlertTriangle, RotateCcw, ArrowLeft, Phone } from "lucide-react";
import { Lx } from "../../utils/lang";

// Shown when a screen fails to render (e.g. the browser's automatic
// translation rewrote the page). What the client typed is kept in
// sessionStorage by the qualification form, so nothing is lost.
export function AppError() {
  const error = useRouteError() as { message?: string } | undefined;
  const navigate = useNavigate();
  const message = String(error?.message || error || "");
  const looksLikeTranslation = /removeChild|insertBefore|not a child of this node/i.test(message);

  let hasDraft = false;
  try {
    hasDraft = !!sessionStorage.getItem("seal_qualify_draft");
  } catch {
    /* storage unavailable */
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 max-w-lg w-full text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B3C5D] mb-2">
          <span>{Lx("Algo falló al mostrar esta pantalla", "Something went wrong showing this screen")}</span>
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          <span>
            {hasDraft
              ? Lx("Lo que ingresaste quedó guardado. Puedes reintentar o volver al formulario sin escribirlo de nuevo.", "What you entered was saved. You can retry or go back to the form without typing it again.")
              : Lx("Puedes reintentar o volver a empezar.", "You can retry or start over.")}
          </span>
        </p>
        {looksLikeTranslation && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
            <span>
              {Lx(
                "Parece que el traductor automático del navegador modificó la página. Desactívalo para este sitio y usa el botón ES / EN de la herramienta.",
                "It looks like the browser's automatic translator changed the page. Turn it off for this site and use the tool's ES / EN button.",
              )}
            </span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0a2f47]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{Lx("Reintentar", "Retry")}</span>
          </button>
          <button
            onClick={() => navigate(hasDraft ? "/qualify" : "/")}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{hasDraft ? Lx("Volver al formulario", "Back to the form") : Lx("Ir al inicio", "Go to home")}</span>
          </button>
        </div>
        <a
          href="https://wa.me/50259964664"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <Phone className="w-4 h-4" />
          <span>{Lx("¿Sigue fallando? Escríbenos al +502 5996 4664", "Still failing? Message us at +502 5996 4664")}</span>
        </a>
        {message && (
          <p className="mt-4 text-[11px] text-slate-400 break-words">
            <span>{Lx("Detalle técnico:", "Technical detail:")} {message.slice(0, 200)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
