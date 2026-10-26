import ExcelJS from "exceljs";
import { Lx, getLang } from "./lang";
import { unitWordFor } from "./saleUnit";
import { showNotice } from "./notice";
import { estimateNote, scenarioVariables, formatUSD, formatQ } from "./costCalculator";

// ─── SEAL Company Info ────────────────────────────────────────────────────────
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

// ─── Beautiful Excel Generator ───────────────────────────────────────────────
export interface ExcelExportData {
  reportTitle: string;
  supplierName: string;
  productType: string;
  destination: string;
  quantity: number;
  price: number;
  priceNote?: string; // e.g. "precio medio del rango US$10.00 – US$15.00"
  costs: {
    productCost: number;
    shipping: number;
    importDuties: number;
    taxes: number;
    insurance: number;
    totalCost: number;
    perUnit: number;
    dutyRate: number;
    // From utils/costCalculator — when present, rows are built from it
    lines?: { key: string; label: string; detail: string; amount: number }[];
    noVatNote?: string;
    freightPending?: boolean;
    exchangeRate?: number; // GTQ per USD — amounts are written in quetzales
    saleUnit?: string;
    fxNote?: string;
  };
  vatRate: number;
  insuranceRate: number;
  notes?: string[]; // assumptions (pieces per set, price basis, minimum order…)
}

const DEFAULT_FX = 7.9;
// Quetzal cell format: 2 decimals, 4 under Q1 (Q0.0023, never Q0.00)
const qFmt = (q: number) => (Math.abs(q) > 0 && Math.abs(q) < 1 ? '"Q"#,##0.0000' : '"Q"#,##0.00');

export async function generateBeautifulExcel(
  data: ExcelExportData,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = SEAL_COMPANY.name;
  wb.lastModifiedBy = SEAL_COMPANY.name;
  wb.created = new Date();

  const ws = wb.addWorksheet(Lx("Escenario de costos", "Cost scenario"), {
    properties: { defaultColWidth: 18 },
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });

  // ─── Column widths (now 5 columns: Concepto | Detalle | Tasa | Monto | %) ───
  ws.columns = [
    { width: 28 }, // A: Concepto
    { width: 38 }, // B: Detalle
    { width: 14 }, // C: Tasa Aplicada (NEW)
    { width: 16 }, // D: Monto (Q)
    { width: 12 }, // E: % del Total
  ];

  // ═══ COMPANY HEADER (rows 1-3) ═══════════════════════════════════════════
  ws.mergeCells("A1:E1");
  const titleCell = ws.getCell("A1");
  titleCell.value = SEAL_COMPANY.name;
  titleCell.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3C5D" },
  };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:E2");
  const addrCell = ws.getCell("A2");
  addrCell.value = SEAL_COMPANY.address;
  addrCell.font = { name: "Arial", size: 10, color: { argb: "FFBFDBFE" } };
  addrCell.alignment = { vertical: "middle", horizontal: "center" };
  addrCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3C5D" },
  };
  ws.getRow(2).height = 18;

  ws.mergeCells("A3:E3");
  const phoneCell = ws.getCell("A3");
  phoneCell.value = `Tel: ${SEAL_COMPANY.phone}  |  ${SEAL_COMPANY.website}`;
  phoneCell.font = { name: "Arial", size: 10, color: { argb: "FFBFDBFE" } };
  phoneCell.alignment = { vertical: "middle", horizontal: "center" };
  phoneCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3C5D" },
  };
  ws.getRow(3).height = 16;

  // ═══ REPORT TITLE (rows 5-6) ═══════════════════════════════════════════════
  ws.mergeCells("A5:E5");
  const reportTitleCell = ws.getCell("A5");
  reportTitleCell.value = data.reportTitle.toUpperCase();
  reportTitleCell.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF0B3C5D" },
  };
  reportTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  reportTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };
  ws.getRow(5).height = 26;

  ws.mergeCells("A6:E6");
  const dateCell = ws.getCell("A6");
  dateCell.value = `${Lx("Generado", "Generated")}: ${new Date().toLocaleDateString(getLang() === "en" ? "en-US" : "es-GT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
  dateCell.font = {
    name: "Arial",
    size: 9,
    italic: true,
    color: { argb: "FF64748B" },
  };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(6).height = 16;

  // Empty row
  ws.getRow(7).height = 8;

  // ═══ ORDER DETAILS (rows 8-13) ═══════════════════════════════════════════
  ws.mergeCells("A8:E8");
  const detailsHeader = ws.getCell("A8");
  detailsHeader.value = Lx("DATOS DE LA CONSULTA", "REQUEST DETAILS");
  detailsHeader.font = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  detailsHeader.alignment = {
    vertical: "middle",
    horizontal: "left",
    indent: 1,
  };
  detailsHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" },
  };
  ws.getRow(8).height = 22;

  const orderRows = [
    [Lx("Proveedor considerado:", "Supplier considered:"), data.supplierName],
    [Lx("Producto:", "Product:"), data.productType],
    [Lx("País de destino:", "Destination country:"), "Guatemala"],
    [Lx("Cantidad:", "Quantity:"), `${data.quantity.toLocaleString()} ${unitWordFor(data.costs.saleUnit, data.quantity)}`],
    [Lx(`Precio por ${unitWordFor(data.costs.saleUnit, 1)}:`, `Price per ${unitWordFor(data.costs.saleUnit, 1)}:`), `${formatUSD(Number(data.price), 2)} (${formatQ(Number(data.price), data.costs.exchangeRate || DEFAULT_FX, 2)})${data.priceNote ? ` — ${data.priceNote}` : ""}`],
  ];

  orderRows.forEach((row, i) => {
    const rowNum = 9 + i;
    ws.mergeCells(`A${rowNum}:B${rowNum}`);
    ws.mergeCells(`C${rowNum}:E${rowNum}`);
    const labelCell = ws.getCell(`A${rowNum}`);
    const valueCell = ws.getCell(`C${rowNum}`);

    labelCell.value = row[0];
    labelCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF0B3C5D" },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };

    valueCell.value = row[1];
    valueCell.font = { name: "Arial", size: 10, color: { argb: "FF1E293B" } };
    valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    ws.getRow(rowNum).height = 20;

    // Border
    [labelCell, valueCell].forEach((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });
  });

  // Empty row
  ws.getRow(14).height = 12;

  // ═══ COST BREAKDOWN TABLE ═══════════════════════════════════════════════
  // Header row 15 — NOW 5 COLUMNS
  const headers = [
    Lx("CONCEPTO", "ITEM"),
    Lx("DETALLE", "DETAIL"),
    Lx("TASA APLICADA", "RATE APPLIED"),
    Lx("MONTO (Q)", "AMOUNT (Q)"),
    Lx("% DEL TOTAL", "% OF TOTAL"),
  ];
  headers.forEach((header, i) => {
    const cell = ws.getRow(15).getCell(i + 1);
    cell.value = header;
    cell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B3C5D" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });
  ws.getRow(15).height = 26;

  // Data rows from row 16 — one per cost line (utils/costCalculator)
  const RATE_BY_KEY: Record<string, number | undefined> = {
    duties: data.costs.dutyRate,
    vat: data.vatRate,
    insurance: data.insuranceRate,
  };
  const dataRows = (data.costs.lines || []).map((l) => ({
    concept: l.label,
    detail:
      l.key === "freight" && data.costs.freightPending ? Lx("Por cotizar", "To be quoted") : l.detail,
    appliedRate:
      RATE_BY_KEY[l.key] !== undefined
        ? `${((RATE_BY_KEY[l.key] as number) * 100).toFixed(0)}%`
        : "—",
    amount: l.amount * (data.costs.exchangeRate || DEFAULT_FX),
    pending: l.key === "freight" && !!data.costs.freightPending,
    isRate: RATE_BY_KEY[l.key] !== undefined,
    rateKey: l.key,
  }));

  dataRows.forEach((row, i) => {
    const rowNum = 16 + i;
    const isAlt = i % 2 === 1;
    const fillColor = isAlt ? "FFEFF6FF" : "FFFFFFFF";

    const conceptCell = ws.getRow(rowNum).getCell(1);
    const detailCell = ws.getRow(rowNum).getCell(2);
    const appliedRateCell = ws.getRow(rowNum).getCell(3); // NEW
    const amountCell = ws.getRow(rowNum).getCell(4);
    const percentCell = ws.getRow(rowNum).getCell(5);

    conceptCell.value = row.concept;
    conceptCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF0B3C5D" },
    };
    conceptCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };

    detailCell.value = row.detail;
    detailCell.font = { name: "Arial", size: 9, color: { argb: "FF475569" } };
    detailCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };

    // ✅ APPLIED RATE column — shows 12%, 1%, 6%, etc. (highlighted yellow)
    appliedRateCell.value = row.appliedRate;
    appliedRateCell.font = {
      name: "Arial",
      size: 11,
      bold: row.isRate,
      color: { argb: row.isRate ? "FF0B3C5D" : "FF94A3B8" },
    };
    appliedRateCell.alignment = { vertical: "middle", horizontal: "center" };

    // unrounded amounts; small ones keep 4 decimals (same as the screen and PDF)
    amountCell.value = row.pending ? Lx("Por cotizar", "To be quoted") : row.amount;
    amountCell.numFmt = qFmt(row.amount);
    amountCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF0B3C5D" },
    };
    amountCell.alignment = {
      vertical: "middle",
      horizontal: "right",
      indent: 1,
    };

    // Share of the total (the applied rate has its own column)
    const totalQ = data.costs.totalCost * (data.costs.exchangeRate || DEFAULT_FX);
    const share = !row.pending && totalQ > 0 ? (row.amount / totalQ) * 100 : NaN;
    const percentDisplay = Number.isFinite(share) ? (share > 0 && share < 0.1 ? "<0.1%" : `${share.toFixed(1)}%`) : "—";
    percentCell.value = percentDisplay;
    percentCell.font = { name: "Arial", size: 10, color: { argb: "FF64748B" } };
    percentCell.alignment = { vertical: "middle", horizontal: "center" };

    // Apply fill — special yellow highlight on Tasa Aplicada column for rate rows
    [conceptCell, detailCell, amountCell, percentCell].forEach((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    // ✅ HIGHLIGHTED YELLOW for the Tasa Aplicada column (matches client's screenshot)
    appliedRateCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: row.isRate ? "FFFEF3C7" : fillColor }, // yellow-100 only for rate rows
    };
    appliedRateCell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };

    ws.getRow(rowNum).height = 22;
  });

  // ═══ TOTAL ROW (row 21) ═══════════════════════════════════════════════════
  const totalRowNum = 16 + dataRows.length;
  const totalConceptCell = ws.getRow(totalRowNum).getCell(1);
  const totalDetailCell = ws.getRow(totalRowNum).getCell(2);
  const totalRateCell = ws.getRow(totalRowNum).getCell(3);
  const totalAmountCell = ws.getRow(totalRowNum).getCell(4);
  const totalPctCell = ws.getRow(totalRowNum).getCell(5);

  totalConceptCell.value = data.costs.freightPending
    ? Lx("TOTAL PARCIAL, SIN FLETE", "PARTIAL TOTAL, WITHOUT FREIGHT")
    : Lx("TOTAL ESTIMADO EN GUATEMALA", "ESTIMATED TOTAL IN GUATEMALA");
  totalDetailCell.value = `${data.quantity.toLocaleString()} ${unitWordFor(data.costs.saleUnit, data.quantity)}`;
  totalRateCell.value = "—";
  totalAmountCell.value = data.costs.totalCost * (data.costs.exchangeRate || DEFAULT_FX);
  totalAmountCell.numFmt = qFmt(totalAmountCell.value as number);
  totalPctCell.value = "100%";

  [
    totalConceptCell,
    totalDetailCell,
    totalRateCell,
    totalAmountCell,
    totalPctCell,
  ].forEach((cell, i) => {
    cell.font = {
      name: "Arial",
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 3 ? "right" : i === 2 || i === 4 ? "center" : "left",
      indent: i === 3 ? 1 : i === 2 || i === 4 ? 0 : 1,
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });
  ws.getRow(totalRowNum).height = 28;

  // ═══ PER UNIT ROW (row 22) ════════════════════════════════════════════════
  const perUnitRowNum = totalRowNum + 1;
  ws.mergeCells(`A${perUnitRowNum}:C${perUnitRowNum}`);
  const perUnitLabel = ws.getCell(`A${perUnitRowNum}`);
  const perUnitValue = ws.getCell(`D${perUnitRowNum}`);
  const perUnitEmpty = ws.getCell(`E${perUnitRowNum}`);

  perUnitLabel.value = Lx(`COSTO ESTIMADO POR ${unitWordFor(data.costs.saleUnit, 1).toUpperCase()}`, `ESTIMATED COST PER ${unitWordFor(data.costs.saleUnit, 1).toUpperCase()}`);
  perUnitValue.value = data.costs.perUnit * (data.costs.exchangeRate || DEFAULT_FX);
  perUnitValue.numFmt = qFmt(perUnitValue.value as number);

  [perUnitLabel, perUnitValue, perUnitEmpty].forEach((cell, i) => {
    cell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FF0B3C5D" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDBEAFE" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 1 ? "right" : "left",
      indent: 1,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0B3C5D" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  ws.getRow(perUnitRowNum).height = 24;

  // ═══ ASSUMPTIONS (same as on screen) ══════════════════════════════════════
  let notesEnd = perUnitRowNum;
  (data.notes || []).forEach((n, i) => {
    const r = perUnitRowNum + 2 + i;
    ws.mergeCells(`A${r}:E${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = `${i === 0 ? Lx("Supuestos: ", "Assumptions: ") : ""}${n}`;
    c.font = { name: "Arial", size: 10, color: { argb: "FF7C2D12" }, bold: i === 0 };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    ws.getRow(r).height = Math.max(18, Math.ceil(n.length / 95) * 15);
    notesEnd = r;
  });

  // ═══ FOOTER (after per-unit row) ══════════════════════════════════════════════════
  const f1 = notesEnd + 2;
  const f2 = notesEnd + 3;
  ws.mergeCells(`A${f1}:E${f1}`);
  const footerCell = ws.getCell(`A${f1}`);
  footerCell.value =
    `${estimateNote()}${data.costs.fxNote ? "  " + data.costs.fxNote : ""}  ${Lx("Variables que pueden cambiar este escenario", "Variables that can change this scenario")}: ${scenarioVariables(data.costs as any, { priceIsMidpoint: /medio del rango|midpoint/.test(data.priceNote || "") }).join(" ")}  ${Lx("Aviso: SEAL no garantiza a los proveedores ni los resultados de esta búsqueda; SmartTrade AI es una herramienta para organizar y comparar proveedores. Para comprar con más seguridad se requiere el servicio específico de verificación de proveedor en China.", "Notice: SEAL does not guarantee the suppliers or the results of this search; SmartTrade AI is a tool to organize and compare suppliers. To buy more safely, the specific supplier verification service in China is required.")}`;
  footerCell.font = {
    name: "Arial",
    size: 9,
    italic: true,
    color: { argb: "FF64748B" },
  };
  footerCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(f1).height = 120;

  ws.mergeCells(`A${f2}:E${f2}`);
  const footerCell2 = ws.getCell(`A${f2}`);
  footerCell2.value = `${SEAL_COMPANY.name}  •  ${SEAL_COMPANY.phone}`;
  footerCell2.font = {
    name: "Arial",
    size: 9,
    bold: true,
    color: { argb: "FF0B3C5D" },
  };
  footerCell2.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(f2).height = 18;

  // ─── Save file ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // Plain letters only: some systems and messaging apps mangle accents or symbols in file names
  const safe = (t: string) =>
    String(t || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
  link.download = `SEAL_${safe(data.reportTitle)}_${safe(data.supplierName)}_${Date.now()}.xlsx`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  showNotice(
    Lx(
      `Excel descargado: ${link.download}. Búscalo en la carpeta de descargas de tu navegador.`,
      `Excel downloaded: ${link.download}. Look for it in your browser's downloads folder.`,
    ),
  );
  // Removing the link right away makes some browsers lose the file name
  setTimeout(() => link.remove(), 1500);
  // Revoking immediately cancels the download on iPhone/Safari — wait a bit
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
