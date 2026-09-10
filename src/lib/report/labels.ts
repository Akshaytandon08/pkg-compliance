// Display vocabulary — ONE source of truth for every user-visible enum.
//
// The report is read by a packaging manager, not by the person who chose the
// enum names. Before this module, `EVIDENCE_ABSENT` and `supplier declaration`
// (underscore-stripped) reached the screen verbatim. Every mapping lives here so
// a label is fixed in one place and cannot drift between the report, the
// passport and the panels.
//
// Register note: `deltaActions.ts` keeps its own PROSE phrasings ("a supplier
// declaration", "an on-pack marking") because instructions read as sentences,
// not as table cells. Those are a different register, not a second source of
// truth — `tests/report-labels.test.ts` asserts every evidence type is covered
// by BOTH, so neither can silently fall behind the vocabulary.
//
// Every string here is user-facing output and is checked by the language
// guardrail (findLanguageViolations): these are noun labels, never a claim by
// this system to certify, declare or verify anything.

import type { Verdict, Risk, EvidenceState } from "../engine/verdict.ts";
import type { ReasonCode } from "../engine/evaluate.ts";

// --- verdicts ---------------------------------------------------------------

export const VERDICT_LABEL: Record<Verdict, string> = {
  qualified: "Qualified",
  conditional: "Conditional",
  gap: "Gap",
  not_applicable: "Not applicable",
  upcoming: "Upcoming",
};

/** What a verdict chip says. `upcoming` carries its date, because "Upcoming"
 *  alone leaves the reader asking the only question that matters: from when? */
export function verdictLabel(verdict: Verdict, detail?: string | null): string {
  if (verdict === "upcoming") {
    const date = detail?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return date ? `Upcoming — applies from ${date}` : "Upcoming";
  }
  return VERDICT_LABEL[verdict];
}

/** Screen-reader label: the chip's colour carries meaning sighted users get for
 *  free, so the accessible name states the subject as well as the value. */
export function verdictAriaLabel(verdict: Verdict, ruleName: string, detail?: string | null): string {
  return `${ruleName}: ${verdictLabel(verdict, detail)}`;
}

// --- reason codes -----------------------------------------------------------

const REASON_LABEL: Record<ReasonCode, string> = {
  EVIDENCE_COMPLETE: "Evidence complete",
  EVIDENCE_ABSENT: "Evidence pending",
  EVIDENCE_INCOMPLETE: "Evidence incomplete",
  EVIDENCE_EXPIRED: "Evidence expired",
  TEST_REQUIRED: "Test required",
  DESIGN_NONCOMPLIANT: "Design does not meet the requirement",
  NOT_APPLICABLE_SCOPE: "Not applicable to this pack",
  CONTEXT_REQUIRED: "More information needed",
  UPCOMING_NOT_YET_APPLICABLE: "Not yet applicable",
};

/**
 * The "Why" cell. Two codes prefer the engine's own sentence over a generic
 * label, because it says something the label cannot:
 *   NOT_APPLICABLE_SCOPE → the recorded scoping reason (inspectors read the
 *     reasoning, not just the result — SCHEMA_DELTAS #5);
 *   UPCOMING_NOT_YET_APPLICABLE → "Applies from <date>", possibly with a
 *     later-of clause.
 */
export function reasonLabel(reasonCode: ReasonCode, detail?: string | null): string {
  if ((reasonCode === "NOT_APPLICABLE_SCOPE" || reasonCode === "UPCOMING_NOT_YET_APPLICABLE") && detail?.trim()) {
    return detail.trim();
  }
  return REASON_LABEL[reasonCode] ?? "Reviewed";
}

// --- evidence state, risk, confidence ---------------------------------------

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, string> = {
  complete: "Complete",
  insufficient: "Partial",
  absent: "None on file",
  expired: "Expired",
};

/** Assessor annotation. Rendered ONLY when an annotation exists — an
 *  un-annotated component must not display a reassuring default. */
export const RISK_LABEL: Record<Risk, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const DESIGN_ASSESSMENT_LABEL: Record<string, string> = {
  no_inherent_risk: "No inherent risk",
  at_risk: "At risk",
  non_compliant: "Does not meet the requirement",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  H: "High confidence",
  M: "Medium confidence",
  L: "Low confidence",
};

// --- evidence types ---------------------------------------------------------

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  supplier_declaration: "Supplier declaration",
  lab_test: "Lab test",
  registration: "Producer registration",
  marking: "On-pack marking",
  technical_file: "Technical file",
  test_report: "Test report",
  pigment_spec: "Pigment specification",
  // The obligated operator's OWN declaration — never a system output.
  conformity_declaration: "Declaration of conformity",
};

export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_LABEL[type] ?? humanise(type);
}

// --- extracted-claim vocabulary ---------------------------------------------

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  material: "Material",
  recycled_content: "Recycled content",
  restricted_substance: "Restricted substance",
  declaration_scope: "Declaration scope",
  issuer_identity: "Issued by",
  measured_parameter: "Measured value",
  test_method: "Test method",
  stated_limit: "Stated limit",
  accreditation: "Accreditation",
  sample_scope: "Sample scope",
  heat_treatment: "Heat treatment",
  ispm15_mark: "ISPM-15 mark",
  ippc_mark_element: "IPPC mark element",
  registration_authority: "Registration authority",
  material_scope: "Material scope",
  grade: "Grade",
  product_grade: "Product grade",
  certification_scheme: "Certification scheme",
  chain_of_custody: "Chain of custody",
  virgin_fibre_share: "Virgin fibre share",
  substance_group_statement: "Substance group",
  compliance_standard: "Standard cited",
  physical_dimension: "Dimension",
  client_identity: "Client",
  screening_method: "Screening method",
  sample_date: "Sample date",
  signatory: "Signatory",
  document_reference: "Document reference",
  batch_or_lot_reference: "Batch / lot reference",
  document_validity: "Valid until",
};

export function claimTypeLabel(type: string): string {
  return CLAIM_TYPE_LABEL[type] ?? humanise(type);
}

export const LEGIBILITY_LABEL: Record<string, string> = {
  clear: "Clear",
  partially_obscured: "Partly obscured",
  illegible: "Not readable",
};

/** Why a proposed value was withheld. Each says what a reviewer must do next. */
export const VALIDATION_LABEL: Record<string, string> = {
  ok: "Read from the document",
  type_mismatch: "Withheld — not a valid value for this field",
  ungrounded: "Withheld — could not be located in the document",
  pass_disagreement: "Withheld — two readings of the document disagreed",
};

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  pending: "Pending confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected",
  manual: "Entered manually",
};

// --- storage / generation error categories ----------------------------------

export const ERROR_CATEGORY_LABEL: Record<string, string> = {
  storage_unavailable: "Document storage unavailable",
  template_not_approved: "Template not approved yet",
  eligibility_changed: "No longer eligible",
  render_failed: "Could not produce the document",
  not_found: "Assessment not found",
};

// --- rule reference ---------------------------------------------------------

/** Tooltip on the muted checkpoint id. The id is an internal handle, kept
 *  visible for support and audit but never presented as the rule's name. */
export const RULE_REFERENCE_TOOLTIP =
  "Rule reference — the internal identifier for this requirement, for support and audit";

/** The muted secondary line. The version suffix is hidden by default: a reader
 *  needs the rule, not its revision, unless they are comparing corpus versions. */
export function ruleReference(checkpointId: string, version: number, showVersion = false): string {
  return showVersion ? `${checkpointId}@${version}` : checkpointId;
}

// --- fallback ---------------------------------------------------------------

/** Last resort for a value with no mapping: sentence-case it rather than leak
 *  snake_case. A miss here is a bug — the label tests enumerate the vocabularies. */
export function humanise(token: string): string {
  const spaced = token.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
