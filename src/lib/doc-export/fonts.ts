import { readFileSync } from "node:fs";
import path from "node:path";

// DM Sans is bundled in the repo (/assets/fonts, OFL) and added to Next's
// outputFileTracingIncludes for the doc-generating routes (next.config.ts) so the
// TTFs ship INSIDE the serverless function. Paths resolve from the project root
// (process.cwd()), which is where file tracing places included assets
// (/var/task/assets/fonts on Vercel).
export const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

export const DM_SANS_FILES = {
  regular: path.join(FONT_DIR, "DMSans-Regular.ttf"),
  bold: path.join(FONT_DIR, "DMSans-Bold.ttf"),
  italic: path.join(FONT_DIR, "DMSans-Italic.ttf"),
  medium: path.join(FONT_DIR, "DMSans-Medium.ttf"),
} as const;

export interface BrandFontNames {
  regular: string;
  bold: string;
  italic: string;
}

// pdfkit: register the bundled TTFs under brand names and return them. Embedding a
// TTF removes pdfkit's runtime dependency on its built-in AFM metrics files (a
// common serverless "font not found" failure). If a TTF cannot be read, fall back
// to the built-in Helvetica family so a font problem degrades gracefully rather
// than failing the whole generation.
export function registerPdfBrandFonts(doc: PDFKit.PDFDocument): BrandFontNames {
  try {
    doc.registerFont("DMSans", DM_SANS_FILES.regular);
    doc.registerFont("DMSans-Bold", DM_SANS_FILES.bold);
    doc.registerFont("DMSans-Italic", DM_SANS_FILES.italic);
    return { regular: "DMSans", bold: "DMSans-Bold", italic: "DMSans-Italic" };
  } catch {
    return { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
  }
}

// docx: read the regular TTF to EMBED in the document so the .docx truly carries
// DM Sans (not merely names it). Returns [] if unreadable — Word then substitutes
// by family name, which is the prior behaviour.
export function docxBrandFonts(): { name: string; data: Buffer }[] {
  try {
    // turbopackIgnore: this path is not statically analysable (it is composed at
    // runtime from process.cwd()), and without the opt-out Next traces the WHOLE
    // project into every function that reaches this module. The fonts are shipped
    // deliberately via outputFileTracingIncludes in next.config.ts instead.
    return [{ name: "DM Sans", data: readFileSync(/*turbopackIgnore: true*/ DM_SANS_FILES.regular) }];
  } catch {
    return [];
  }
}
