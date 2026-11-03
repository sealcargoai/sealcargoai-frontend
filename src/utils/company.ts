import { Lx } from "./lang";

// SEAL's contact data, used by the pages (phone, WhatsApp) and the PDF / Excel exports.
// 02-11c: its own module, so the pages don't load the heavy export libraries (jsPDF, ExcelJS) just
// to read the phone number; those load only when the client exports or emails a report.
export const SEAL_COMPANY = {
  name: "SEAL - AGENCIA DE CARGA Y LOGISTICA",
  address: "Calzada Roosevelt 33-86, Cdad. de Guatemala 01007, Guatemala",
  phone: "+502 5996 4664",
  website: "SEAL SmartTrade AI",
};

// ─── PDF helper: draw company header (call after main header) ────────────────
export function drawCompanyInfoBox(
  doc: any,
  pageWidth: number,
  yStart: number = 40,
): number {
  // Light grey company info bar below main header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(0, yStart, pageWidth, 14, "F");

  doc.setTextColor(11, 60, 93);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(SEAL_COMPANY.name, 14, yStart + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(SEAL_COMPANY.address, 14, yStart + 9);
  doc.text(`Tel: ${SEAL_COMPANY.phone}`, 14, yStart + 12.5);

  return yStart + 14; // return next Y position
}

// ─── PDF footer with company info ────────────────────────────────────────────
export function drawCompanyFooter(doc: any) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Footer background
  doc.setFillColor(11, 60, 93);
  doc.rect(0, pageHeight - 22, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(SEAL_COMPANY.name, pageWidth / 2, pageHeight - 16, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(191, 219, 254); // blue-200
  doc.text(SEAL_COMPANY.address, pageWidth / 2, pageHeight - 11, {
    align: "center",
  });
  doc.text(
    `Tel: ${SEAL_COMPANY.phone}  |  ${SEAL_COMPANY.website}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: "center" },
  );

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
  doc.text(
    Lx("Este análisis es una estimación. Los costos reales pueden variar.", "This analysis is an estimate. Actual costs may vary."),
    pageWidth / 2,
    pageHeight - 1.5,
    { align: "center" },
  );
}
