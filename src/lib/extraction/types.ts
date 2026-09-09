import type { ClaimProvenance } from "@/db/schema";

// Provider-agnostic extraction contract (Sprint 4 / A3). The rest of the app
// depends only on this interface; the Anthropic adapter is one implementation and
// a second provider would be another. The LLM EXTRACTS — it never adjudicates:
// an ExtractionResult is a set of inspectable claims with provenance, which the
// deterministic engine judges and a human confirms before it affects a verdict.

export const DOC_CLASSES = [
  "supplier_declaration",
  "lab_test_report",
  "heat_treatment_certificate",
  "mill_declaration",
] as const;
export type DocClass = (typeof DOC_CLASSES)[number];

// The bytes to extract from, plus how to read them. A PDF with a text layer is
// sent as a document block; a scan/photo with no text layer is sent as an image
// (vision). The caller decides which — the adapter does not sniff silently.
export interface ExtractionInput {
  docClass: DocClass;
  bytes: Uint8Array;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  /** true when the PDF has no extractable text layer, so it must go via vision. */
  scanned?: boolean;
}

// How legible the source region was for THIS field. The model reports it per
// field; anything but `clear` must come with value === null (abstention), never a
// guess — that is the rule that keeps an obscured figure from being invented.
export const LEGIBILITY = ["clear", "partially_obscured", "illegible"] as const;
export type Legibility = (typeof LEGIBILITY)[number];

// Outcome of deterministic post-validation of a model-proposed claim.
// `type_mismatch`: the value is not of the type the parameter requires (e.g. a
// method string where a number is expected). The value is NOT stored — it is
// nulled and the offending text preserved in `rejectedValue` for the reviewer.
export type ClaimValidation = "ok" | "type_mismatch";

// One extracted value, shaped to map straight onto an extracted_claims row. Every
// draft carries a confidence self-score and provenance; a draft with neither is
// not a usable claim.
export interface ExtractedClaimDraft {
  claimType: string;
  parameter?: string | null;
  value?: string | null;
  unit?: string | null;
  testMethod?: string | null;
  issuer?: string | null;
  accreditationRef?: string | null;
  issueDate?: string | null; // ISO date
  expiry?: string | null; // ISO date
  scopeText?: string | null;
  confidence: number; // 0..1 model self-score
  provenance: ClaimProvenance;
  /** Per-field legibility self-report (Part 3a). Absent = treated as `clear`. */
  legibility?: Legibility | null;
  /** Deterministic post-validation verdict. Absent = not yet validated. */
  validation?: ClaimValidation | null;
  /** The value rejected by post-validation, kept for inspection, never as a value. */
  rejectedValue?: string | null;
}

export type ExtractionStatus = "succeeded" | "refused" | "failed";

// The outcome of one run of one model at one prompt version over one document.
// `refused` means the model returned no usable structured output — the adapter
// emits ZERO claims and says so, rather than inventing values.
export interface ExtractionResult {
  status: ExtractionStatus;
  provider: string;
  model: string;
  promptVersion: string;
  claims: ExtractedClaimDraft[];
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  /** Present on failed/refused — a short reason, never the API key or raw secret. */
  error?: string;
}

export interface ExtractionProvider {
  readonly name: string;
  readonly model: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
