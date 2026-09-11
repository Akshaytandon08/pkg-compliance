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

// --- rule names -------------------------------------------------------------

// A table needs a SHORT name per rule. The corpus has only `requirement_text`
// (a full legal sentence) and no title column, and the corpus is not ours to
// change — so display names are curated here, keyed by checkpoint id. The id's
// slug is already human-meaningful by convention (SCHEMA_DELTAS #9), which makes
// the fallback safe, but a curated name reads better than a de-slugged one
// ("PFAS in food-contact packaging", not "Pfas food contact").
const RULE_NAME: Record<string, string> = {
  "EU-EPR-producer-registration": "EPR producer registration",
  "EU-MS-DE-epr-registration": "EPR registration — Germany",
  "EU-MS-ES-epr-registration": "EPR registration — Spain",
  "EU-MS-FR-epr-registration": "EPR registration — France",
  "EU-MS-IT-epr-registration": "EPR registration — Italy",
  "EU-MS-NL-epr-registration": "EPR registration — Netherlands",
  "EU-MS-PL-epr-registration": "EPR registration — Poland",
  "EU-MS-FR-labelling-triman-infotri": "Triman / Info-tri labelling — France",
  "EU-PPWR-composite-plastic-relevant": "Composite packaging: plastic-relevant",
  "EU-PPWR-declaration-of-conformity": "Declaration of conformity",
  "EU-PPWR-heavy-metals": "Heavy metals limit",
  "EU-PPWR-no-chemical-preservative": "No chemical preservative",
  "EU-PPWR-no-transitional-stock": "No transitional stock",
  "EU-PPWR-operator-id-importer": "Importer identification",
  "EU-PPWR-operator-id-manufacturer": "Manufacturer identification",
  "EU-PPWR-pfas-food-contact": "PFAS in food-contact packaging",
  "EU-PPWR-recyclability-grade": "Recyclability grade",
  "EU-PPWR-recycled-content-plastic": "Recycled content in plastic",
  "EU-PPWR-soc-minimisation": "Substances of concern",
  "EU-PPWR-technical-documentation": "Technical documentation",
  "EU-green-claims-substantiation": "Green-claims substantiation",
  "IN-PWM-category-classification": "Plastic category classification",
  "IN-PWM-epr-recycled-content": "EPR recycled content",
  "IN-PWM-epr-registration": "EPR registration — India",
  "IN-PWM-epr-targets": "EPR targets",
  "IN-PWM-marking": "Packaging marking",
  "IN-PWM-sup-ban": "Single-use plastic ban",
  "IN-PWM-thickness": "Minimum thickness",
  "INTL-ISPM15-heat-treatment": "ISPM-15 heat treatment",
};

/** Acronyms that must not be sentence-cased by the slug fallback. */
const ACRONYMS: Record<string, string> = {
  pfas: "PFAS", epr: "EPR", soc: "SoC", ispm15: "ISPM-15", doc: "DoC",
  eu: "EU", ms: "MS", id: "identification", sup: "single-use plastic", pwm: "PWM", ppwr: "PPWR",
};

/**
 * The rule's short display name. Curated where we have one; otherwise derived
 * from the id's slug (dropping the geography/instrument prefix), with acronyms
 * preserved. Never returns the raw id — that is what `ruleReference` is for.
 */
export function ruleName(checkpointId: string): string {
  const curated = RULE_NAME[checkpointId];
  if (curated) return curated;
  // Drop a leading GEOGRAPHY-INSTRUMENT (and an optional MS-XX) prefix.
  const slug = checkpointId.replace(/^[A-Z]+-(?:MS-[A-Z]{2}-)?[A-Za-z0-9]+-/, "");
  const words = slug.split("-").map((w) => ACRONYMS[w.toLowerCase()] ?? w);
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

// --- thresholds -------------------------------------------------------------

const OPERATOR_SYMBOL: Record<string, string> = {
  lte: "≤", lt: "<", gte: "≥", gt: ">", eq: "=", ne: "≠",
  "<=": "≤", "<": "<", ">=": "≥", ">": ">", "=": "=",
};

/** "Sum of Pb, Cd, Hg, Cr(VI) ≤ 100 mg/kg" — a threshold a reader can check. */
export function describeThreshold(t: {
  parameter?: string | null;
  operator?: string | null;
  value?: unknown;
  unit?: string | null;
}): string {
  const symbol = OPERATOR_SYMBOL[String(t.operator ?? "").toLowerCase()] ?? String(t.operator ?? "");
  const parts = [t.parameter, symbol, t.value, t.unit].filter((p) => p !== null && p !== undefined && p !== "");
  return parts.join(" ").trim();
}

// --- the organisation a screening is prepared for ---------------------------

const LEGAL_ROLE_LABEL: Record<string, string> = {
  manufacturer: "Manufacturer",
  importer: "Importer",
  distributor: "Distributor",
  epr_producer: "EPR producer",
};

/** "epr_producer" → "EPR producer". Unknown roles fall back to humanise(). */
export function legalRoleLabel(role: string): string {
  return LEGAL_ROLE_LABEL[role] ?? humanise(role);
}

/** "DE" → "Germany". Falls back to the code itself, which is still meaningful —
 *  never to an empty string or a guess. */
export function countryLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (c.length !== 2) return code;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(c);
    // ZZ is the reserved "unknown region" code and resolves to the words
    // "Unknown Region" — which reads like data rather than like a bad code. Show
    // the code itself instead; a reader can at least see what was entered.
    return !name || /^unknown/i.test(name) ? c : name;
  } catch {
    return c;
  }
}

/**
 * "Prepared for" identity line: legal name · country · role. Parts the record
 * does not hold are OMITTED rather than filled with a placeholder — a compliance
 * document that invents an operator's role is worse than one that is silent.
 */
export function preparedForLine(org: {
  legalName: string;
  country: string;
  roleDefault?: string | null;
}): string {
  return [org.legalName, countryLabel(org.country), org.roleDefault ? legalRoleLabel(org.roleDefault) : null]
    .filter(Boolean)
    .join(" · ");
}

// --- emission factors -------------------------------------------------------

/** What a material with no selected factor reads as. Sprint 9 removed the seeded
 *  order-of-magnitude tier, so this is now a real and common state: the honest
 *  answer is that nobody has chosen a factor, not a number nobody can trace. */
export const NO_FACTOR_LABEL = "No factor selected";

const TIER_LABEL: Record<string, string> = {
  primary: "Primary (Fitsol)",
  secondary_database: "Secondary database",
  none: NO_FACTOR_LABEL,
};

/** "secondary_database" → "Secondary database". */
export function factorTierLabel(tier: string): string {
  return TIER_LABEL[tier] ?? humanise(tier);
}

/**
 * How a factor's provenance reads on the report: the publisher, and the dataset
 * within it when they differ. A factor is only checkable if a reader can find
 * the row it came from, which is what the dataset name is for.
 */
export function factorSourceLabel(factor: { source: string; sourceDataset?: string | null }): string {
  if (!factor.sourceDataset || factor.sourceDataset === factor.source) return factor.source;
  return `${factor.source} / ${factor.sourceDataset}`;
}
