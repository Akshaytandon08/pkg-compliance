import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { DocBlock, DraftDocument } from "./model.ts";
import { docxBrandFonts } from "./fonts.ts";

// .docx generated directly from the structured model via controlled composition —
// NOT markdown conversion. Fitsol brand system applied: DM Sans default font, N800
// headings, a green accent rule under the wordmark, and the DRAFT watermark
// repeated in a header banner on every page and in the footer.

const GREEN_RULE = { color: undefined as string | undefined };

function heading(text: string, brand: DraftDocument["brand"]): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, color: brand.n800, size: 26 })],
  });
}

function fieldParagraph(label: string, value: string | undefined, brand: DraftDocument["brand"]): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: "D7F0E8" }, // p50 highlight — editable
    children: [
      new TextRun({ text: "» To complete by the manufacturer: ", bold: true, color: brand.teal, size: 18 }),
      new TextRun({ text: value && value.length > 0 ? value : label, italics: !value, color: brand.n600, size: 18 }),
    ],
  });
}

function blockToParagraphs(block: DocBlock, brand: DraftDocument["brand"]): (Paragraph | Table)[] {
  switch (block.type) {
    case "wordmark":
      return [
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: brand.wordmark, bold: true, color: brand.green, size: 32 })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: brand.green } },
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    case "title":
      return [
        new Paragraph({
          spacing: { before: 80, after: 60 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: block.text, bold: true, color: brand.n800, size: 32 })],
        }),
      ];
    case "subtitle":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [new TextRun({ text: block.text, color: brand.n600, size: 20 })],
        }),
      ];
    case "metaRows":
      return block.rows.map(
        ([k, v]) =>
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({ text: `${k}: `, bold: true, color: brand.n600, size: 18 }),
              new TextRun({ text: v, color: brand.n800, size: 18 }),
            ],
          }),
      );
    case "heading":
      return [heading(block.text, brand)];
    case "paragraph":
      return [
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: block.text, color: block.muted ? brand.n600 : brand.n800, italics: block.muted, size: 20 })],
        }),
      ];
    case "annexElement": {
      const numeric = /^\d+$/.test(block.ref);
      const out: (Paragraph | Table)[] = [
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            numeric ? new TextRun({ text: `${block.ref}.  `, bold: true, color: brand.n800, size: 20 }) : new TextRun({ text: "" }),
            new TextRun({ text: block.fixedText, color: brand.n800, size: 20 }),
          ],
        }),
      ];
      if (block.fill) out.push(fieldParagraph(block.fill, undefined, brand));
      return out;
    }
    case "field":
      return [fieldParagraph(block.label, block.value, brand)];
    case "table": {
      const header = new TableRow({
        tableHeader: true,
        children: block.columns.map(
          (c) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "02402D" }, // p800
              children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: "FFFFFF", size: 18 })] })],
            }),
        ),
      });
      const body = block.rows.map(
        (r) =>
          new TableRow({
            children: r.map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell, color: brand.n800, size: 18 })] })] })),
          }),
      );
      const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
      const out: (Paragraph | Table)[] = [];
      if (block.caption) out.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: block.caption, bold: true, color: brand.n600, size: 18 })] }));
      out.push(table);
      out.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      return out;
    }
    case "articleLines":
      return block.items.map(
        (it) =>
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `Article ${it.article} — `, bold: true, color: brand.green, size: 20 }),
              new TextRun({ text: it.text, color: brand.n800, size: 20 }),
            ],
          }),
      );
    case "bullets":
      return block.items.map(
        (it) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [new TextRun({ text: it, color: brand.n800, size: 20 })],
          }),
      );
    case "signatureBlock":
      return [
        new Paragraph({ spacing: { before: 200, after: 40 }, children: [new TextRun({ text: "Signature", bold: true, color: brand.n800, size: 22 })] }),
        ...block.lines.map(
          (l) =>
            new Paragraph({
              spacing: { before: 160 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999AA8" } },
              children: [new TextRun({ text: l, color: brand.n600, size: 18 })],
            }),
        ),
      ];
    case "notice":
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          shading: { type: ShadingType.CLEAR, fill: "FEFCE8" }, // warning-light
          children: [new TextRun({ text: block.text, italics: true, color: "713F12", size: 18 })],
        }),
      ];
    case "spacer":
      return [new Paragraph({ spacing: { after: 120 }, children: [] })];
  }
}

export async function renderDocx(doc: DraftDocument): Promise<Buffer> {
  void GREEN_RULE;
  const brand = doc.brand;
  const bodyChildren = doc.blocks.flatMap((b) => blockToParagraphs(b, brand));

  const watermarkHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.CLEAR, fill: "CDECE2" }, // p100
        children: [new TextRun({ text: doc.watermark, bold: true, color: brand.teal, size: 16 })],
      }),
    ],
  });
  const watermarkFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: doc.watermark, bold: true, color: brand.teal, size: 14 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: brand.n600, size: 14 })],
      }),
    ],
  });

  // Embed DM Sans so the .docx carries the brand font itself, not just its name
  // (docxBrandFonts returns [] if the TTF is unreadable — Word then substitutes by
  // family name, the prior behaviour).
  const embeddedFonts = docxBrandFonts();
  const document = new Document({
    creator: "Fitsol pkg-compliance",
    title: doc.title,
    ...(embeddedFonts.length ? { fonts: embeddedFonts } : {}),
    styles: { default: { document: { run: { font: brand.fontName } } } },
    sections: [
      {
        properties: {},
        headers: { default: watermarkHeader },
        footers: { default: watermarkFooter },
        children: bodyChildren,
      },
    ],
  });
  return Packer.toBuffer(document);
}
