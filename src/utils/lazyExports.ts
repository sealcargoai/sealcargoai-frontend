// 02-11c: the PDF and Excel generators are loaded on demand (they are ~400 kB gzip of libraries the
// pages don't need until the client exports). A failed load (offline, a deploy in between) is said
// on screen instead of failing silently.
import { Lx } from "./lang";
import { showNotice } from "./notice";

export const loadCostPdf = () => import("./costPdf");
export const loadReportExports = () => import("./reportExports");

export function exportLoadFailed(): void {
  showNotice(
    Lx(
      "No pudimos preparar el archivo en este momento. Revisa tu conexión y vuelve a intentarlo; si continúa, recarga la página.",
      "We couldn't prepare the file right now. Check your connection and try again; if it continues, reload the page.",
    ),
  );
}
