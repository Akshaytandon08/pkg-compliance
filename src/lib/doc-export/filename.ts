// Plain-language export filenames — never internal ids (brief: a filename a human
// reads, e.g. "Draft-EU-Declaration-of-Conformity-Corrugated-Carton-2026-09-08.docx").
// Slugs are ASCII, hyphen-separated, title-cased words preserved.

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "") // drop punctuation/diacritics
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface FilenameParts {
  kind: string; // e.g. "Draft-EU-Declaration-of-Conformity"
  subject: string; // e.g. pack name
  date: string; // ISO date
  language?: string; // "en" omitted; others appended (e.g. "DE")
  ext: "docx" | "pdf";
}

export function exportFilename(p: FilenameParts): string {
  const lang = p.language && p.language.toLowerCase() !== "en" ? `-${p.language.toUpperCase()}` : "";
  return `${p.kind}-${slug(p.subject)}${lang}-${p.date}.${p.ext}`;
}

export const DOC_KINDS = {
  doc: "Draft-EU-Declaration-of-Conformity",
  supplierRequest: "Supplier-Declaration-Request",
  labRequest: "Lab-Test-Request",
} as const;
