// One PDF generator for the costs screen and the final report.
// - Text is passed through pdfSafe(): jsPDF's built-in fonts only cover Latin-1,
//   and characters like "•", "–" or "→" switch it to a mode that spaces every
//   letter apart. Those are replaced with plain equivalents.
// - Keeps the client's own product description, presents the total as a
//   preliminary scenario and lists the variables that can change it.
import jsPDF from "jspdf";
import { differencesHeading, differencesFootnote } from "./differences";
import autoTable from "jspdf-autotable";
import { drawCompanyInfoBox, drawCompanyFooter } from "./reportExports";
import { formatQ, formatUSD, formatUnitUSD, formatUnitQ, estimateNote, scenarioVariables, type CostResult } from "./costCalculator";
import { Lx, getLang } from "./lang";
import { unitWordFor } from "./saleUnit";
import { showNotice } from "./notice";

const MAP: Record<string, string> = {
  "•": "-", "–": "-", "—": "-", "→": "->", "←": "<-", "≥": ">=", "≤": "<=",
  "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "✅": "", "⚠️": "", "⚠": "", "️": "",
};

export function pdfSafe(text: string): string {
  return String(text ?? "")
    .replace(/[•–—→←≥≤‘’“”…✅⚠️]/g, (c) => MAP[c] ?? "")
    // anything else outside Latin-1 (e.g. Chinese characters in a title) can't be drawn
    // by the PDF font: a run of them is marked instead of silently disappearing
    .replace(/[^\x00-\xFF]+/g, (run) => (/[\p{L}\p{N}]/u.test(run) ? "[...]" : ""))
    .replace(/\s+\n/g, "\n");
}

export interface CostPdfInput {
  title: string;
  supplierName: string;
  productDescription: string;
  quantity: number;
  price: number;
  priceNote?: string;
  costs: CostResult;
  topics?: { title: string }[];
  notes?: string[]; // assumptions (pieces per set, price basis, minimum order…)
  // the listing title and its differences with the request (same warnings as on screen)
  differences?: { title: string; items: string[] };
  disclaimer: string;
  reportId?: string;
  fileName: string;
  saveFile?: boolean;
}

function drawCostPdf(d: CostPdfInput, tight: boolean): any {
  const doc = new jsPDF();
  const RH = tight ? 4.3 : 5; // line height of the details block
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const BOTTOM = H - 28; // keep clear of the footer
  const fx = d.costs.exchangeRate;
  const text = (t: string | string[], x: number, y: number, opt?: any) =>
    doc.text(Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t), x, y, opt);
  const wrap = (t: string, w: number) => doc.splitTextToSize(pdfSafe(t), w) as string[];
  let y = 0;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      // the footer changes font and color: keep the ones in use for the next page
      const size = doc.getFontSize();
      const color = doc.getTextColor();
      const font = doc.getFont();
      drawCompanyFooter(doc);
      doc.addPage();
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.setFont(font.fontName, font.fontStyle);
      y = 16;
    }
  };

  const now = new Date().toLocaleDateString(getLang() === "en" ? "en-US" : "es-GT", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Header
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, W, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  text("SEAL SmartTrade AI", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  text(d.title, 14, 26);
  text(`${Lx("Generado", "Generated")}: ${now}${d.reportId ? `  |  ID: ${d.reportId}` : ""}`, 14, 34);
  y = drawCompanyInfoBox(doc, W, 40) + 8;

  // Details
  doc.setTextColor(11, 60, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  text(Lx("DATOS DE LA CONSULTA", "REQUEST DETAILS"), 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(tight ? 8.5 : 9);
  doc.setTextColor(30, 41, 59);
  const rows: [string, string][] = [
    [Lx("Proveedor considerado", "Supplier considered"), d.supplierName],
    [Lx("Cantidad", "Quantity"), `${d.quantity.toLocaleString("en-US")} ${unitWordFor(d.costs.saleUnit, d.quantity)}`],
    [
      Lx(`Precio por ${unitWordFor(d.costs.saleUnit, 1)}`, `Price per ${unitWordFor(d.costs.saleUnit, 1)}`),
      `${formatUnitUSD(Number(d.price))} (${formatUnitQ(Number(d.price), fx)})${d.priceNote ? ` - ${d.priceNote}` : ""}`,
    ],
    [Lx("Destino", "Destination"), "Guatemala"],
  ];
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    text(`${k}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const lines = wrap(v, W - 70);
    text(lines, 58, y);
    y += RH * lines.length;
  }
  // Product description (client's own words, up to 8 lines)
  doc.setFont("helvetica", "bold");
  text(`${Lx("Producto", "Product")}:`, 14, y);
  doc.setFont("helvetica", "normal");
  let desc = wrap(d.productDescription || "-", W - 70);
  if (desc.length > 8) desc = [...desc.slice(0, 7), `${desc[7].slice(0, 80)}...`];
  text(desc, 58, y);
  y += RH * desc.length + (tight ? 2 : 4);

  // The listing as published, and what differs from the request or must be confirmed
  const diff = d.differences;
  if (diff?.title) {
    doc.setFont("helvetica", "bold");
    text(`${Lx("Publicación", "Listing")}:`, 14, y);
    doc.setFont("helvetica", "normal");
    let tl = wrap(diff.title, W - 70);
    if (tl.length > 4) tl = [...tl.slice(0, 3), `${tl[3].slice(0, 80)}...`];
    text(tl, 58, y);
    y += RH * tl.length + (tight ? 2 : 3);
  }
  if (diff?.title && !diff.items.length) {
    // same as the Excel: no differences found in the title is said, not left blank
    doc.setTextColor(100, 116, 139);
    const nl = wrap(Lx("No encontramos diferencias en el título; igual confirma los datos con el proveedor.", "We found no differences in the title; still confirm the data with the supplier."), W - 70);
    text(nl, 58, y);
    y += RH * nl.length + (tight ? 2 : 3);
    doc.setTextColor(30, 41, 59);
  }
  if (diff?.items.length) {
    ensure(RH * 3);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(153, 27, 27);
    text(`${differencesHeading()}:`, 14, y);
    y += RH;
    doc.setFont("helvetica", "normal");
    for (const n of diff.items) {
      const lines = wrap(`- ${n}`, W - 30);
      ensure(RH * lines.length + 2);
      text(lines, 18, y);
      y += RH * lines.length;
    }
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(tight ? 7.5 : 8);
    const fl = wrap(differencesFootnote(), W - 30);
    ensure(RH * fl.length);
    text(fl, 18, y);
    y += RH * fl.length + (tight ? 2 : 4);
    doc.setFontSize(tight ? 8.5 : 9);
    doc.setTextColor(30, 41, 59);
  }

  // Assumptions behind the quantity and price (same as on screen)
  if (d.notes?.length) {
    doc.setFont("helvetica", "bold");
    text(`${Lx("Supuestos", "Assumptions")}:`, 14, y);
    doc.setFont("helvetica", "normal");
    for (const n of d.notes) {
      const lines = wrap(`- ${n}`, W - 72);
      ensure(RH * lines.length + 2);
      text(lines, 58, y);
      y += RH * lines.length;
    }
    y += tight ? 2 : 4;
  }

  // Costs table: kept on one page (title, rows and total together)
  ensure(Math.min(12 + (d.costs.lines.length + 2) * (tight ? 6.5 : 8), BOTTOM - 20));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(11, 60, 93);
  text(Lx("Escenario estimado de costos", "Estimated cost scenario"), 14, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [[Lx("Concepto", "Item"), Lx("Detalle", "Detail"), Lx("Monto (Q)", "Amount (Q)"), "%"]],
    body: d.costs.lines.map((l) => {
      const pending = l.key === "freight" && d.costs.freightPending;
      return [
        l.label,
        pending ? Lx("Por cotizar", "To be quoted") : l.detail,
        pending ? Lx("Por cotizar", "To be quoted") : formatQ(l.amount, fx, 2),
        pending || !(d.costs.totalCost > 0) ? "-" : `${((l.amount / d.costs.totalCost) * 100).toFixed(1)}%`,
      ];
    }),
    foot: [[
      d.costs.freightPending
        ? Lx("TOTAL PARCIAL, SIN FLETE", "PARTIAL TOTAL, WITHOUT FREIGHT")
        : Lx("TOTAL ESTIMADO EN GUATEMALA", "ESTIMATED TOTAL IN GUATEMALA"),
      `${d.quantity.toLocaleString("en-US")} ${unitWordFor(d.costs.saleUnit, d.quantity)}`,
      formatQ(d.costs.totalCost, fx, 2),
      "100%",
    ]],
    headStyles: { fillColor: [11, 60, 93], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    styles: { fontSize: tight ? 7.8 : 8.5, cellPadding: tight ? 1.3 : 2, font: "helvetica" },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: 30 },
    didParseCell: (cell: any) => {
      cell.cell.text = (cell.cell.text || []).map((t: string) => pdfSafe(t));
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Everything after the table is measured first, so the notice never ends
  // up alone on an almost empty last page
  const vars = scenarioVariables(d.costs, { priceIsMidpoint: /medio del rango|midpoint/.test(d.priceNote || "") });
  doc.setFontSize(8.5);
  const varLines = vars.map((v) => wrap(`- ${v}`, W - 28));
  const topicLines = (d.topics || []).map((tp, i) => wrap(`${i + 1}. ${tp.title}`, W - 28));
  doc.setFontSize(8);
  const noteLines = [d.costs.fxNote, estimateNote()].filter(Boolean).map((n) => wrap(String(n), W - 28));
  const disc = wrap(`${Lx("Aviso", "Notice")}: ${d.disclaimer}`, W - 28);
  const sum = (ls: string[][], lh: number) => ls.reduce((a, l) => a + l.length * lh, 0);
  const need = (lh: number, sh: number, gap: number) =>
    sh + 5 + sum(varLines, lh) + gap + (topicLines.length ? 5 + sum(topicLines, lh) + gap : 0) + sum(noteLines, 3.8) + disc.length * 3.8 + 2;
  // a small overflow is absorbed by tighter spacing instead of a new page
  const over = need(4.2, 19, 3) - (BOTTOM - y);
  const compact = tight || (over > 0 && over <= 30);
  // A larger overflow moves the whole closing block (summary, lists, notice)
  // to the next page, so no page holds only a few loose lines
  if (over > 30 && need(3.6, 15, 1.5) <= BOTTOM - 16) ensure(BOTTOM);
  const LH = compact ? 3.6 : 4.2;
  const GAP = compact ? 1.5 : 3;
  const tailH = sum(noteLines, 3.8) + disc.length * 3.8 + 2;

  // Scenario summary
  ensure(16);
  doc.setFillColor(11, 60, 93);
  doc.rect(14, y, W - 28, compact ? 11 : 13, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  text(
    Lx(
      `${d.costs.freightPending ? "Estimación parcial, sin flete" : "Escenario preliminar"}: ${formatQ(d.costs.totalCost, fx)} (${formatUSD(d.costs.totalCost)}) - ${formatQ(d.costs.perUnit, fx, 2)} por ${unitWordFor(d.costs.saleUnit, 1)}`,
      `${d.costs.freightPending ? "Partial estimate, without freight" : "Preliminary scenario"}: ${formatQ(d.costs.totalCost, fx)} (${formatUSD(d.costs.totalCost)}) - ${formatQ(d.costs.perUnit, fx, 2)} per ${unitWordFor(d.costs.saleUnit, 1)}`,
    ),
    W / 2, y + (compact ? 7.5 : 8.5), { align: "center" },
  );
  y += compact ? 15 : 19;

  // Lists: the last two lines of the last list travel with the notice
  const list = (title: string, lines: string[][], isLast: boolean) => {
    ensure(5 + (lines[0]?.length || 1) * LH);
    doc.setTextColor(11, 60, 93);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    text(title, 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    lines.forEach((l, i) => {
      const rest = isLast && i >= lines.length - 2 ? lines.slice(i).reduce((a, x) => a + x.length * LH, 0) + tailH : l.length * LH;
      ensure(rest);
      text(l, 14, y);
      y += LH * l.length;
    });
    y += GAP;
  };
  list(Lx("Variables que pueden cambiar este escenario", "Variables that can change this scenario"), varLines, !topicLines.length);
  if (topicLines.length) list(Lx("Aspectos por revisar antes de importar", "Aspects to review before importing"), topicLines, true);

  // Notes and disclaimer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  for (const lines of noteLines) {
    ensure(lines.length * 3.8);
    text(lines, 14, y);
    y += 3.8 * lines.length;
  }
  ensure(disc.length * 3.8 + 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  text(disc, 14, y + 1);

  drawCompanyFooter(doc);
  return doc;
}

export function buildCostPdf(d: CostPdfInput): string {
  const pagesOf = (x: any) => x.internal.getNumberOfPages() as number;
  // Normal layout first; if it spills to a second page, a tighter layout is
  // tried and used when everything fits on one page
  let doc = drawCostPdf(d, false);
  if (pagesOf(doc) > 1) {
    const tightDoc = drawCostPdf(d, true);
    if (pagesOf(tightDoc) === 1) doc = tightDoc;
  }
  if (d.saveFile !== false) {
    // Plain letters only in the file name (accents or symbols get mangled by some systems)
    const base = d.fileName.replace(/\.pdf$/i, "");
    const fileName =
      base
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 90) + ".pdf";
    d = { ...d, fileName };
    doc.save(fileName);
    showNotice(
      Lx(
        `Informe descargado: ${d.fileName}. Búscalo en la carpeta de descargas de tu navegador.`,
        `Report downloaded: ${d.fileName}. Look for it in your browser's downloads folder.`,
      ),
    );
  }
  return doc.output("datauristring").split(",")[1];
}
