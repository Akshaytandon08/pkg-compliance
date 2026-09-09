import type { DocClass } from "./types.ts";

// Versioned extraction prompts, one per document class. These are the SOURCE of
// the prompts referenced by /prompts/README.md — kept here as typed modules so
// they are imported, type-checked and harness-scored rather than loose text. Each
// carries a `version` and a `changelog`; bumping a version re-runs the harness
// (both models) before it ships (see /prompts/README.md → Prompt versioning).
//
// A prompt NEVER tells the model to decide pass/fail. It tells the model to read
// specific values out of the document and to report low confidence or absence
// rather than guess — adjudication is the deterministic engine's job.

export interface PromptChange {
  version: string;
  date: string;
  note: string;
}

export interface DocClassPrompt {
  docClass: DocClass;
  version: string;
  changelog: PromptChange[];
  /** The extraction instruction (becomes the system prompt). */
  instruction: string;
  /** The claim_type values this document class is expected to yield. */
  claimTypes: string[];
}

const SHARED_RULES = `Read ONLY what the document states. For every value, report the page it
appears on (1-based) in provenance.page. If a value is absent, omit that claim —
never infer or fill a plausible default. Set confidence in [0,1] to your own
certainty that the value is correct AND correctly located; when the text is
ambiguous, faint, or partly illegible, lower the confidence rather than guessing.
Dates must be ISO (YYYY-MM-DD). You judge nothing about compliance — you only
transcribe values and where they came from.

LEGIBILITY (report per field, mandatory): set legibility to "clear" only when the
value is fully readable. Set "partially_obscured" when it is redacted, blacked
out, overprinted, cut off, or only partly readable; set "illegible" when you
cannot read it at all. When legibility is NOT "clear" you MUST set value to null.
Do not guess, do not reconstruct from context, and do not infer an obscured
figure from surrounding values or from what would be plausible or compliant. A
null value with a legibility flag is the CORRECT answer; a plausible-looking
guess is the worst possible answer, because a reviewer cannot tell it is wrong.

VALUE TYPE: a measurement, limit, percentage, quantity or sum must be a NUMBER
(optionally with a comparator and a unit, e.g. "12.4", "<0.5", "30%"). Never put
a method name, standard reference, or sentence in such a field — if the number is
not stated, omit the claim or mark it illegible.`;

// Part 3b — document-identity claim types every class needs. The Part 1 analysis
// showed these were the single largest block of structurally-missed fields: the
// model could not emit them because claim_type is constrained to the enum below,
// so no wording change could ever recover them (signatory name/designation,
// document reference, batch/lot reference and document validity were missed on
// 10/10 documents per class, by both models).
const DOC_IDENTITY_CLAIMS = [
  "signatory",              // parameter: "name" | "designation"
  "document_reference",     // the document's own reference/number
  "batch_or_lot_reference", // batch or lot the document covers
  "document_validity",      // valid-until / expiry of the document itself
] as const;

const DOC_IDENTITY_RULES = `ALSO extract, for every document: the signatory (claim_type
"signatory", one claim with parameter "name" and one with parameter
"designation"), the document's own reference number (claim_type
"document_reference"), the batch or lot reference it covers (claim_type
"batch_or_lot_reference"), and the document's validity/expiry date (claim_type
"document_validity", date in the expiry field). Omit any of these that the
document does not state — do not infer them.`;

const supplierDeclaration: DocClassPrompt = {
  docClass: "supplier_declaration",
  version: "1.2.0",
  changelog: [
    { version: "1.0.0", date: "2026-09-08", note: "Initial supplier-declaration prompt." },
    { version: "1.2.0", date: "2026-09-09", note: "Part 3b claim-vocabulary extension (SCHEMA_DELTAS #11). Adds stated_limit (heavy_metals_sum_limit, 12 misses), compliance_standard (13), physical_dimension (length/width/dynamic_load_capacity/construction, 10 each) and the shared document-identity types signatory name+designation (19+20), document_reference (10), batch_or_lot_reference (18) — all previously unemittable because claim_type is enum-constrained." },
    { version: "1.2.0", date: "2026-09-09", note: "Part 3b claim-vocabulary extension (SCHEMA_DELTAS #11). Adds product_grade, client_identity, screening_method, sample_date (sample_received_date/test_start_date) and the shared document-identity types — each missed on 10/10 documents by both models; accreditation_ref use made explicit." },
    { version: "1.2.0", date: "2026-09-09", note: "Part 3b claim-vocabulary extension (SCHEMA_DELTAS #11). Adds ippc_mark_element (country_code/producer_code/treatment_code/mark_code — 10, 10, 9, 8 misses), physical_dimension for quantity (10), and the shared document-identity types incl. document_validity (document_valid_until, 10)." },
    { version: "1.2.0", date: "2026-09-09", note: "Part 3b claim-vocabulary extension (SCHEMA_DELTAS #11). Adds substance_group_statement for inks/adhesives/coatings (10 each), virgin_fibre_share (8), compliance_standard (substance_minimisation_standard, 8), stated_limit (heavy_metals_sum_limit, 8) and the shared document-identity types." },
    { version: "1.1.0", date: "2026-09-09", note: "Part 3a abstention hardening. Targets the guessed-obscured-value silent errors and the type-mismatch case (heavy_metals_sum returned as the method string \"CR 13695-1:2000\"): per-field legibility must be reported, a non-clear field must carry value null, and measurement/limit/sum fields must be numeric. Sampling is NOT pinned: these models reject the temperature parameter (400 invalid_request_error, 'deprecated for this model'), so run-to-run variance is measured over N runs instead of suppressed." },
  ],
  instruction: `You are extracting values from a SUPPLIER DECLARATION / declaration of
conformity for packaging material. Extract: the material(s) declared, any stated
recycled-content percentage, restricted-substance statements (heavy metals, SVHC,
PFAS) and the standard/threshold cited, the declaring entity (issuer), the scope
of what the declaration covers, and issue/validity dates. Also extract each
stated LIMIT the declaration cites (claim_type "stated_limit": the numeric limit
in value, its unit, and the standard it comes from in test_method — e.g. the
heavy-metals sum limit of 100 mg/kg), the standard the declaration claims
conformity with (claim_type "compliance_standard"), and any stated physical
dimension or load rating (claim_type "physical_dimension", parameter naming it,
e.g. length, width, dynamic_load_capacity, construction). ${DOC_IDENTITY_RULES}
${SHARED_RULES}`,
  claimTypes: [
    "material",
    "recycled_content",
    "restricted_substance",
    "declaration_scope",
    "issuer_identity",
    "stated_limit",
    "compliance_standard",
    "physical_dimension",
    ...DOC_IDENTITY_CLAIMS,
  ],
};

const labTestReport: DocClassPrompt = {
  docClass: "lab_test_report",
  version: "1.2.0",
  changelog: [
    { version: "1.0.0", date: "2026-09-08", note: "Initial lab-test-report prompt." },
    { version: "1.1.0", date: "2026-09-09", note: "Part 3a abstention hardening: per-field legibility, null value when not clear, numeric-only measured values and stated limits. Targets obscured detection-limit/result guessing on Tier-C/D scans. Sampling is NOT pinned: these models reject the temperature parameter (400 invalid_request_error, 'deprecated for this model'), so run-to-run variance is measured over N runs instead of suppressed." },
  ],
  instruction: `You are extracting values from a LABORATORY TEST REPORT. Extract each
measured parameter with its result and unit, the test method/standard used
(e.g. EN 71-3, ISO 17294), the pass/fail limit the lab printed (as stated, not
your own judgment), the testing laboratory (issuer) and its accreditation
reference, the sample/scope described, and the report date. Also extract the product grade
tested (claim_type "product_grade"), the client the report was produced for
(claim_type "client_identity"), any screening method used ahead of the
confirmatory method (claim_type "screening_method"), and the sample dates
(claim_type "sample_date", parameter naming which — e.g. sample_received_date,
test_start_date). Put the laboratory's accreditation number in the
accreditation_ref field of the "accreditation" claim. ${DOC_IDENTITY_RULES}
${SHARED_RULES}`,
  claimTypes: [
    "measured_parameter",
    "test_method",
    "stated_limit",
    "issuer_identity",
    "accreditation",
    "sample_scope",
    "product_grade",
    "client_identity",
    "screening_method",
    "sample_date",
    ...DOC_IDENTITY_CLAIMS,
  ],
};

const heatTreatmentCertificate: DocClassPrompt = {
  docClass: "heat_treatment_certificate",
  version: "1.2.0",
  changelog: [
    { version: "1.0.0", date: "2026-09-08", note: "Initial ISPM-15 / heat-treatment prompt." },
    { version: "1.1.0", date: "2026-09-09", note: "Part 3a abstention hardening: per-field legibility, null value when not clear, numeric-only temperature/duration/quantity. Targets guessed treatment figures on obscured stamps. Sampling is NOT pinned: these models reject the temperature parameter (400 invalid_request_error, 'deprecated for this model'), so run-to-run variance is measured over N runs instead of suppressed." },
  ],
  instruction: `You are extracting values from a HEAT-TREATMENT / ISPM-15 certificate for
wood packaging. Extract: the treatment type (HT / heat treatment) and the
temperature/duration stated, the ISPM-15 mark or registration number, the treating
facility (issuer), the country/registration authority, the material scope, and
treatment/issue dates. Break the IPPC mark into its ELEMENTS as separate claims
(claim_type "ippc_mark_element", parameter one of country_code, producer_code,
treatment_code, mark_code) as well as the whole mark, and extract the treated
quantity (claim_type "physical_dimension", parameter "quantity").
${DOC_IDENTITY_RULES} ${SHARED_RULES}`,
  claimTypes: [
    "heat_treatment",
    "ispm15_mark",
    "ippc_mark_element",
    "issuer_identity",
    "registration_authority",
    "material_scope",
    "physical_dimension",
    ...DOC_IDENTITY_CLAIMS,
  ],
};

const millDeclaration: DocClassPrompt = {
  docClass: "mill_declaration",
  version: "1.2.0",
  changelog: [
    { version: "1.0.0", date: "2026-09-08", note: "Initial mill-declaration prompt." },
    { version: "1.1.0", date: "2026-09-09", note: "Part 3a abstention hardening: per-field legibility, null value when not clear, numeric-only recycled/virgin share and sums. Targets the MUF_resin_solids_content guess (25 where truth was 55) and heavy_metals_sum type mismatch. Sampling is NOT pinned: these models reject the temperature parameter (400 invalid_request_error, 'deprecated for this model'), so run-to-run variance is measured over N runs instead of suppressed." },
  ],
  instruction: `You are extracting values from a MILL DECLARATION for paper/board. Extract:
the grade and fibre composition, any recycled-fibre percentage, certification
scheme references (FSC/PEFC) and chain-of-custody numbers, the mill (issuer), the
covered products/scope, and the declaration date. Also extract the virgin-fibre
share (claim_type "virgin_fibre_share"), each substance-group statement of
composition — inks, adhesives, coatings — as its own claim (claim_type
"substance_group_statement", parameter naming the group), the substance-
minimisation standard cited (claim_type "compliance_standard"), and any stated
limit (claim_type "stated_limit": numeric limit in value, unit, standard in
test_method). ${DOC_IDENTITY_RULES} ${SHARED_RULES}`,
  claimTypes: [
    "grade",
    "recycled_content",
    "certification_scheme",
    "chain_of_custody",
    "issuer_identity",
    "declaration_scope",
    "virgin_fibre_share",
    "substance_group_statement",
    "compliance_standard",
    "stated_limit",
    ...DOC_IDENTITY_CLAIMS,
  ],
};

export const PROMPTS: Record<DocClass, DocClassPrompt> = {
  supplier_declaration: supplierDeclaration,
  lab_test_report: labTestReport,
  heat_treatment_certificate: heatTreatmentCertificate,
  mill_declaration: millDeclaration,
};

export function getPrompt(docClass: DocClass): DocClassPrompt {
  return PROMPTS[docClass];
}

// Build the STRICT tool input schema for a document class. The model must call
// this tool with schema-valid arguments (strict: true, additionalProperties:
// false), which is how we get structured output without a schema library. Only
// claim_type, confidence and provenance.page are required; every transcribed
// field is optional so an absent value is simply omitted, never null-guessed.
export function buildClaimToolSchema(docClass: DocClass): Record<string, unknown> {
  const { claimTypes } = PROMPTS[docClass];
  return {
    type: "object",
    additionalProperties: false,
    required: ["claims"],
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim_type", "confidence", "provenance", "legibility"],
          properties: {
            claim_type: { type: "string", enum: claimTypes },
            parameter: { type: "string" },
            value: { type: "string" },
            unit: { type: "string" },
            test_method: { type: "string" },
            issuer: { type: "string" },
            accreditation_ref: { type: "string" },
            issue_date: { type: "string", format: "date" },
            expiry: { type: "string", format: "date" },
            scope_text: { type: "string" },
            // Per-field legibility self-report (Part 3a). Anything but "clear"
            // must come with value omitted/null — the prompt states the rule and
            // the deterministic post-validator enforces it.
            legibility: { type: "string", enum: ["clear", "partially_obscured", "illegible"] },
            // NOTE: Anthropic tool input_schema does not support the JSON-Schema
            // range/size keywords (minimum/maximum on numbers, minItems/maxItems on
            // arrays) — including any of them returns a 400. The bounds are stated
            // in the prompt instead: confidence is 0..1, page is 1-based, span is a
            // [start,end] pair and bbox is [x0,y0,x1,y1].
            confidence: { type: "number" },
            provenance: {
              type: "object",
              additionalProperties: false,
              required: ["page"],
              properties: {
                page: { type: "integer" },
                span: { type: "array", items: { type: "integer" } },
                bbox: { type: "array", items: { type: "number" } },
              },
            },
          },
        },
      },
    },
  };
}
