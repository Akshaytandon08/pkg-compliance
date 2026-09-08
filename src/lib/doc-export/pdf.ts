import PDFDocument from "pdfkit";
import type { DocBlock, DraftDocument } from "./model.ts";

// PDF preview generated from the SAME structured model as the .docx (not from
// markdown). Fitsol brand colours + wordmark + green accent rule, and the DRAFT
// watermark stamped diagonally on every page and repeated in the footer. The PDF
// is the in-browser preview; the .docx is the document the manufacturer signs.
// (Preview uses a system sans; the .docx carries DM Sans.)

const CONTENT_WIDTH = 595.28 - 72 * 2; // A4 width minus margins

function hex(c: string): string {
  return c.startsWith("#") ? c : `#${c}`;
}

function drawTable(doc: PDFKit.PDFDocument, columns: string[], rows: string[][], brand: DraftDocument["brand"]) {
  const colW = CONTENT_WIDTH / columns.length;
  const x0 = doc.page.margins.left;
  const pad = 4;
  let y = doc.y;
  doc.fontSize(9);
  // Height of a row from the tallest wrapped cell (no fixed height → no overlap).
  const rowHeight = (cells: string[], font: string) => {
    doc.font(font);
    return Math.max(...cells.map((c) => doc.heightOfString(c || " ", { width: colW - pad * 2 }))) + pad * 2;
  };
  const ensure = (h: number) => {
    if (y + h > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      y = doc.y;
    }
  };
  // header
  const hH = rowHeight(columns, "Helvetica-Bold");
  ensure(hH);
  doc.rect(x0, y, CONTENT_WIDTH, hH).fill(hex("02402D"));
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  columns.forEach((c, i) => doc.text(c, x0 + i * colW + pad, y + pad, { width: colW - pad * 2 }));
  y += hH;
  // body
  for (const r of rows) {
    const rH = rowHeight(r, "Helvetica");
    ensure(rH);
    doc.font("Helvetica").fontSize(9).fillColor(hex(brand.n800));
    r.forEach((cell, i) => doc.text(cell, x0 + i * colW + pad, y + pad, { width: colW - pad * 2 }));
    doc.strokeColor("#CCCDD4").lineWidth(0.5).rect(x0, y, CONTENT_WIDTH, rH).stroke();
    y += rH;
  }
  doc.y = y + 8;
  doc.x = x0;
}

function renderBlock(doc: PDFKit.PDFDocument, block: DocBlock, brand: DraftDocument["brand"]) {
  const left = doc.page.margins.left;
  doc.x = left;
  switch (block.type) {
    case "wordmark":
      doc.font("Helvetica-Bold").fontSize(20).fillColor(hex(brand.green)).text(brand.wordmark, { continued: false });
      doc.moveTo(left, doc.y + 2).lineTo(left + CONTENT_WIDTH, doc.y + 2).lineWidth(2).strokeColor(hex(brand.green)).stroke();
      doc.moveDown(0.8);
      break;
    case "title":
      doc.font("Helvetica-Bold").fontSize(18).fillColor(hex(brand.n800)).text(block.text, { align: "center" });
      doc.moveDown(0.2);
      break;
    case "subtitle":
      doc.font("Helvetica").fontSize(11).fillColor(hex(brand.n600)).text(block.text, { align: "center" });
      doc.moveDown(0.6);
      break;
    case "metaRows":
      doc.fontSize(9);
      for (const [k, v] of block.rows) {
        doc.font("Helvetica-Bold").fillColor(hex(brand.n600)).text(`${k}: `, { continued: true });
        doc.font("Helvetica").fillColor(hex(brand.n800)).text(v);
      }
      doc.moveDown(0.4);
      break;
    case "heading":
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(hex(brand.n800)).text(block.text);
      doc.moveDown(0.2);
      break;
    case "paragraph":
      doc.font(block.muted ? "Helvetica-Oblique" : "Helvetica").fontSize(10).fillColor(hex(block.muted ? brand.n600 : brand.n800)).text(block.text);
      doc.moveDown(0.3);
      break;
    case "annexElement": {
      const numeric = /^\d+$/.test(block.ref);
      doc.font("Helvetica").fontSize(10).fillColor(hex(brand.n800));
      doc.text(numeric ? `${block.ref}.  ${block.fixedText}` : block.fixedText);
      if (block.fill) renderField(doc, block.fill, brand);
      doc.moveDown(0.2);
      break;
    }
    case "field":
      renderField(doc, block.value && block.value.length ? block.value : block.label, brand, !block.value);
      break;
    case "table":
      if (block.caption) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(hex(brand.n600)).text(block.caption);
        doc.moveDown(0.2);
      }
      drawTable(doc, block.columns, block.rows, brand);
      break;
    case "articleLines":
      doc.fontSize(10);
      for (const it of block.items) {
        doc.font("Helvetica-Bold").fillColor(hex(brand.green)).text(`Article ${it.article} — `, { continued: true });
        doc.font("Helvetica").fillColor(hex(brand.n800)).text(it.text);
      }
      doc.moveDown(0.2);
      break;
    case "bullets":
      doc.font("Helvetica").fontSize(10).fillColor(hex(brand.n800));
      for (const it of block.items) doc.text(`•  ${it}`, { indent: 8 });
      doc.moveDown(0.2);
      break;
    case "signatureBlock":
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(hex(brand.n800)).text("Signature");
      doc.moveDown(0.3);
      for (const l of block.lines) {
        doc.font("Helvetica").fontSize(9).fillColor(hex(brand.n600)).text(l);
        doc.moveDown(0.1);
        doc.moveTo(left, doc.y).lineTo(left + CONTENT_WIDTH * 0.6, doc.y).lineWidth(0.5).strokeColor("#999AA8").stroke();
        doc.moveDown(0.5);
      }
      break;
    case "notice":
      doc.moveDown(0.3);
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#713F12").text(block.text);
      doc.moveDown(0.3);
      break;
    case "spacer":
      doc.moveDown(0.6);
      break;
  }
}

function renderField(doc: PDFKit.PDFDocument, label: string, brand: DraftDocument["brand"], placeholder = true) {
  doc.moveDown(0.15);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(hex(brand.teal)).text("» To complete by the manufacturer: ", { continued: true });
  doc.font(placeholder ? "Helvetica-Oblique" : "Helvetica").fillColor(hex(brand.n600)).text(label);
  doc.moveDown(0.25);
}

function stampWatermark(doc: PDFKit.PDFDocument, model: DraftDocument) {
  const { width, height } = doc.page;
  if (model.diagonalWatermark) {
    doc.save();
    doc.rotate(-45, { origin: [width / 2, height / 2] });
    doc.fillColor(hex(model.brand.green)).fillOpacity(0.07).font("Helvetica-Bold").fontSize(46);
    doc.text(model.diagonalWatermark, 0, height / 2 - 30, { width, align: "center" });
    doc.restore();
  }
  // Footer line (always).
  doc.save();
  doc.fillOpacity(1).font("Helvetica-Bold").fontSize(7).fillColor(hex(model.brand.teal));
  doc.text(model.watermark, doc.page.margins.left, height - doc.page.margins.bottom + 12, { width: CONTENT_WIDTH, align: "center" });
  doc.restore();
}

export function renderPdf(model: DraftDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 90, bottom: 60, left: 72, right: 72 }, bufferPages: true, info: { Title: model.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const block of model.blocks) renderBlock(doc, block, model.brand);

    // Stamp the watermark on every buffered page.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      stampWatermark(doc, model);
    }
    doc.flushPages();
    doc.end();
  });
}
