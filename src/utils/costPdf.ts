// One PDF generator for the costs screen and the final report.
// - Text is passed through pdfSafe(): jsPDF's built-in fonts only cover Latin-1,
//   and characters like "•", "–" or "→" switch it to a mode that spaces every
//   letter apart. Those are replaced with plain equivalents.
// - Keeps the client's own product description, presents the total as a
//   preliminary scenario and lists the variables that can change it.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawCompanyInfoBox, drawCompanyFooter } from "./reportExports";
import { formatQ, formatUSD, estimateNote, scenarioVariables, type CostResult } from "./costCalculator";
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
    .replace(/[^\x00-\xFF]/g, "") // anything else outside Latin-1
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
  disclaimer: string;
  reportId?: string;
  fileName: string;
  saveFile?: boolean;
}

export function buildCostPdf(d: CostPdfInput): string {
  const doc = new jsPDF();
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
      drawCompanyFooter(doc);
      doc.addPage();
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
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const rows: [string, string][] = [
    [Lx("Proveedor considerado", "Supplier considered"), d.supplierName],
    [Lx("Cantidad", "Quantity"), `${d.quantity.toLocaleString("en-US")} ${unitWordFor(d.costs.saleUnit, d.quantity)}`],
    [
      Lx("Precio unitario", "Unit price"),
      `${formatUSD(Number(d.price), 2)} (${formatQ(Number(d.price), fx, 2)})${d.priceNote ? ` - ${d.priceNote}` : ""}`,
    ],
    [Lx("Destino", "Destination"), "Guatemala"],
  ];
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    text(`${k}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const lines = wrap(v, W - 70);
    text(lines, 58, y);
    y += 5 * lines.length;
  }
  // Product description (client's own words, up to 8 lines)
  doc.setFont("helvetica", "bold");
  text(`${Lx("Producto", "Product")}:`, 14, y);
  doc.setFont("helvetica", "normal");
  let desc = wrap(d.productDescription || "-", W - 70);
  if (desc.length > 8) desc = [...desc.slice(0, 7), `${desc[7].slice(0, 80)}...`];
  text(desc, 58, y);
  y += 5 * desc.length + 4;

  // Costs table
  ensure(30);
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
        pending ? Lx("Por cotizar", "To be quoted") : formatQ(l.amount, fx),
        `${((l.amount / d.costs.totalCost) * 100).toFixed(1)}%`,
      ];
    }),
    foot: [[
      d.costs.freightPending
        ? Lx("TOTAL PARCIAL, SIN FLETE", "PARTIAL TOTAL, WITHOUT FREIGHT")
        : Lx("TOTAL ESTIMADO EN GUATEMALA", "ESTIMATED TOTAL IN GUATEMALA"),
      `${d.quantity.toLocaleString("en-US")} ${unitWordFor(d.costs.saleUnit, d.quantity)}`,
      formatQ(d.costs.totalCost, fx),
      "100%",
    ]],
    headStyles: { fillColor: [11, 60, 93], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    styles: { fontSize: 8.5, cellPadding: 2, font: "helvetica" },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: 30 },
    didParseCell: (cell: any) => {
      cell.cell.text = (cell.cell.text || []).map((t: string) => pdfSafe(t));
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Scenario summary
  ensure(16);
  doc.setFillColor(11, 60, 93);
  doc.rect(14, y, W - 28, 13, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  text(
    Lx(
      `${d.costs.freightPending ? "Estimación parcial, sin flete" : "Escenario preliminar"}: ${formatQ(d.costs.totalCost, fx)} (${formatUSD(d.costs.totalCost)}) - ${formatQ(d.costs.perUnit, fx, 2)} por ${unitWordFor(d.costs.saleUnit, 1)}`,
      `${d.costs.freightPending ? "Partial estimate, without freight" : "Preliminary scenario"}: ${formatQ(d.costs.totalCost, fx)} (${formatUSD(d.costs.totalCost)}) - ${formatQ(d.costs.perUnit, fx, 2)} per ${unitWordFor(d.costs.saleUnit, 1)}`,
    ),
    W / 2, y + 8.5, { align: "center" },
  );
  y += 19;

  // Variables
  const vars = scenarioVariables(d.costs, { priceIsMidpoint: !!d.priceNote });
  ensure(10 + vars.length * 5);
  doc.setTextColor(11, 60, 93);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  text(Lx("Variables que pueden cambiar este escenario", "Variables that can change this scenario"), 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  for (const v of vars) {
    const lines = wrap(`- ${v}`, W - 28);
    ensure(lines.length * 4.2);
    text(lines, 14, y);
    y += 4.2 * lines.length;
  }
  y += 3;

  // Aspects to review (final report)
  if (d.topics?.length) {
    ensure(12);
    doc.setTextColor(11, 60, 93);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    text(Lx("Aspectos por revisar antes de importar", "Aspects to review before importing"), 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    d.topics.forEach((tp, i) => {
      const lines = wrap(`${i + 1}. ${tp.title}`, W - 28);
      ensure(lines.length * 4.2);
      text(lines, 14, y);
      y += 4.2 * lines.length;
    });
    y += 3;
  }

  // Notes and disclaimer
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  for (const n of [d.costs.fxNote, estimateNote()]) {
    const lines = wrap(n, W - 28);
    ensure(lines.length * 3.8);
    text(lines, 14, y);
    y += 3.8 * lines.length;
  }
  const disc = wrap(`${Lx("Aviso", "Notice")}: ${d.disclaimer}`, W - 28);
  ensure(disc.length * 3.8 + 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  text(disc, 14, y + 1);

  drawCompanyFooter(doc);
  if (d.saveFile !== false) {
    doc.save(d.fileName);
    showNotice(
      Lx(
        `Informe descargado: ${d.fileName}. Búscalo en la carpeta de descargas de tu navegador.`,
        `Report downloaded: ${d.fileName}. Look for it in your browser's downloads folder.`,
      ),
    );
  }
  return doc.output("datauristring").split(",")[1];
}
