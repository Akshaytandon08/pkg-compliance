// A renderer-agnostic document model (Sprint 4b / DoC drafting). The DoC assembly
// produces this structured model; the .docx and .pdf renderers both walk it, so
// Word and the PDF preview are generated from the SAME controlled template — never
// from markdown. Markdown exists only as an internal preview/diff representation.

export interface BrandTokens {
  green: string; // primary green accent (#05A070)
  n800: string; // heading ink (#1A1C3C)
  n600: string; // muted label
  teal: string; // dark teal
  fontName: string; // "DM Sans"
  wordmark: string; // "Fitsol"
}

export const FITSOL_BRAND: BrandTokens = {
  green: "05A070",
  n800: "1A1C3C",
  n600: "4D4F67",
  teal: "04524E",
  fontName: "DM Sans",
  wordmark: "Fitsol",
};

// Prefixes for a highlighted fill-in field. One pair, used by both renderers, so
// the .docx and the .pdf of the same draft can never say different things about
// whether a value still needs checking.
export const FIELD_PREFIX_BLANK = "» To complete by the manufacturer: ";
export const FIELD_PREFIX_FILLED = "» Pre-filled from the organisation record — CONFIRM BEFORE SIGNING: ";

export type DocBlock =
  | { type: "wordmark" } // Fitsol brand mark + green accent rule (header)
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "metaRows"; rows: [string, string][] } // header metadata grid
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; muted?: boolean }
  // A verbatim Annex element. `fixedText` is rendered exactly; when `fill` is set,
  // a highlighted "to complete" field follows so the signer sees what to enter.
  | { type: "annexElement"; ref: string; fixedText: string; fill?: string }
  // A highlighted editable field the manufacturer completes (left blank).
  | { type: "field"; label: string; value?: string }
  | { type: "table"; columns: string[]; rows: string[][]; caption?: string }
  // Article-by-article conformity lines built from passed in_force checkpoints.
  | { type: "articleLines"; items: { article: string; text: string }[] }
  | { type: "bullets"; items: string[] }
  | { type: "signatureBlock"; lines: string[] } // rendered blank for signing
  | { type: "notice"; text: string } // e.g. translation-to-be-verified
  | { type: "spacer" };

export interface DraftDocument {
  // Footer/header banner line, repeated on every page (the DRAFT statement for a
  // DoC; the request disclaimer for a request template).
  watermark: string;
  // Optional large diagonal page watermark (DoC drafts only, e.g. "DRAFT — NOT
  // SIGNED"). Absent for request templates, which are letters the user sends out.
  diagonalWatermark?: string;
  brand: BrandTokens;
  blocks: DocBlock[];
  // Metadata used by the .docx core properties + PDF info (never the filename ids).
  title: string;
  language: string; // "en", "de", …
}
