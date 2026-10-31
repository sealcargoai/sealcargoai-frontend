import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./context/LanguageContext";
import { Lx } from "../utils/lang";
import { track } from "../utils/funnel";
import { SANDBOX } from "../utils/sandbox";

// Shown small in the corner so testers can tell which version they are seeing.
// Update it with each published change.
export const APP_VERSION = "2026.10.30-f";
// The commit this build was made from (Vercel sets it at build time; "local" otherwise), shown with
// the version so a test can always tell which code it ran against.
declare const __APP_COMMIT__: string;
export const APP_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "local";

// Name of the main script this tab is running (it changes with every deploy)
function currentBundle(): string {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src).pathname : "";
}

/**
 * A tab left open keeps running the version it loaded. Check now and then
 * whether a newer one was published and offer to load it (what the client
 * typed is kept: the form draft lives in sessionStorage).
 */
function useNewVersionAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return; // local development
    let stopped = false;
    const check = async () => {
      try {
        const html = await (await fetch("/", { cache: "no-store" })).text();
        const live = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
        if (!stopped && live && live !== mine) setAvailable(true);
      } catch {
        /* offline: try later */
      }
    };
    const timer = setInterval(check, 3 * 60 * 1000);
    const onFocus = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onFocus);
    const unsub = router.subscribe(() => check());
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      unsub();
    };
  }, []);
  return available;
}

function NewVersionBanner() {
  const available = useNewVersionAvailable();
  if (!available) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-400 text-amber-950 text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-3 shadow">
      <span className="font-medium">
        {Lx(
          "Hay una versión más reciente de la herramienta. Actualiza para ver los cambios; tus datos del formulario se conservan.",
          "A newer version of the tool is available. Refresh to see the changes; your form data is kept.",
        )}
      </span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1 rounded-md bg-[#0B3C5D] text-white font-semibold"
      >
        {Lx("Actualizar", "Refresh")}
      </button>
    </div>
  );
}

// Funnel: one visit per browser and day; WhatsApp clicks are counted apart
// (a click doesn't prove someone wrote, so it is never counted as a lead)
function useFunnel() {
  useEffect(() => {
    track("visita");
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href*='wa.me']");
      if (a) track("whatsapp_clic", { seal_path: window.location.pathname });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}

export default function App() {
  useFunnel();
  return (
    <LanguageProvider>
      <RouterProvider router={router} />
      <NewVersionBanner />
      {SANDBOX && (
        <div role="status" className="fixed bottom-2 left-2 z-[100] rounded-md bg-amber-300 text-amber-950 text-[11px] font-semibold px-2 py-1 shadow">
          {Lx("ENTORNO DE PRUEBA · no se envían solicitudes, correos ni eventos", "TEST ENVIRONMENT · no requests, emails or events are sent")}
        </div>
      )}
      {/* at the end of the page (not floating), so it never covers content */}
      <div aria-hidden="true" className="text-[10px] text-slate-400 text-right px-3 py-1 select-none bg-slate-50">
        v{APP_VERSION} · {APP_COMMIT}
      </div>
    </LanguageProvider>
  );
}
