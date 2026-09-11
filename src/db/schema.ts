import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Checkpoints are versioned DATA, not code (brief §5). Every corpus change is a
// migration-versioned commit approved by the regulatory owner.

export const jurisdictionLevelEnum = pgEnum("jurisdiction_level", [
  "EU",
  "MS",
  "national",
  "state",
]);

export const stackEnum = pgEnum("stack", ["A", "B", "C", "D"]);

// What a verdict attaches to. Not every obligation is per-component: technical
// documentation and operator marking attach to the packaging unit; producer
// registration attaches to the organisation/market. Resolves SCHEMA_DELTAS #2.
export const checkpointSubjectEnum = pgEnum("checkpoint_subject", [
  "component",
  "packaging_unit",
  "organisation",
]);

// `draft` is the insert state. The ONLY path to `in_force` is an approval
// record by the regulatory owner (enforced by DB trigger, see migration 0001).
// The evaluator refuses to produce verdicts from anything not `in_force`.
// Analyst/validation confidence in a checkpoint's encoding — DISTINCT from
// `status` (which is the approval lifecycle). H|M|L. A row can be in_force yet
// carry M confidence, or draft yet H. Set from the validation report, not the
// approval gate.
export const checkpointConfidenceEnum = pgEnum("checkpoint_confidence", ["H", "M", "L"]);

export const checkpointStatusEnum = pgEnum("checkpoint_status", [
  "draft",
  "in_force",
  "upcoming",
  "contested",
  "superseded",
]);

// --- Extraction status vocab (Sprint 4 / A2) ------------------------------
export const extractionRunStatusEnum = pgEnum("extraction_run_status", [
  "pending", // created, not yet started
  "running",
  "succeeded",
  "failed", // provider/transport error
  "refused", // model declined / returned unusable output; NEVER a guessed value
]);

// A claim's lifecycle. It starts `pending` (extracted, not yet human-confirmed —
// it may NOT affect a verdict), moves to `confirmed` or `rejected` by a human, or
// is entered directly by a human as `manual`. A confirmed claim is immutable; a
// correction is a NEW claim linked back via supersedes_id.
export const extractedClaimStatusEnum = pgEnum("extracted_claim_status", [
  "pending",
  "confirmed",
  "rejected",
  "manual",
]);

// --- Evidence request status (Sprint 4 / B1) ------------------------------
export const evidenceRequestStatusEnum = pgEnum("evidence_request_status", [
  "open", // link live, awaiting an upload
  "fulfilled", // at least one document received
  "cancelled", // withdrawn by the assessor
  "expired", // past its expires_at
]);

// Array-valued fields use text[]; allowed values are validated at seed time so
// vocabulary growth (new materials, roles) never requires an enum migration.
// The vocabularies live in a client-safe module (no Drizzle) and are re-exported
// here so corpus code and UI code share one source of truth. EVIDENCE_TYPES
// includes `conformity_declaration` (the operator's own DoC — SCHEMA_DELTAS #6).
export { EVIDENCE_TYPES, FACTOR_TIERS, LEGAL_ROLES, MATERIALS, PACKAGING_LEVELS } from "../lib/vocab.ts";

export type Threshold = {
  parameter: string;
  operator: "<" | "<=" | "=" | ">=" | ">";
  value: number;
  unit: string;
  // Optional guard: the limit applies only under this condition (e.g. a test
  // method or material qualifier). Multiple thresholds on a checkpoint are ANDed.
  applies_when?: string;
};

// Evidence requirements in conjunctive normal form: an outer AND of inner ORs.
// Exactly one nesting level; every leaf is an EVIDENCE_TYPES value. If a real
// requirement cannot be expressed in one level of CNF, split the checkpoint.
// Resolves SCHEMA_DELTAS eval-format gap #1 (AND/OR evidence semantics).
export type EvidenceRequirement = {
  allOf: { anyOf: string[] }[];
};

// Recurring-obligation cadence for Stack B filings (registration renewals,
// annual declarations). NULL = a one-off obligation. Resolves SCHEMA_DELTAS #3
// (recurring next-due semantics). The obligation calendar computes the next
// occurrence from the assessment's as-of date.
export type Recurrence = {
  // ISO-8601 duration between occurrences: "P1Y" annual, "P6M" half-yearly, etc.
  every: string;
  // Optional recurring anchor the occurrence falls on, as ISO "--MM-DD" (annual).
  // Absent when the statutory deadline is not yet confirmed against primary —
  // the calendar then states the cadence without inventing a date.
  due?: string;
};

// A scoped exemption/exclusion from a requirement, with its own pinpoint (kept
// separate from requirement_text so the report can flag "subject to exemptions"
// and the analyst can cite each carve-out). New delta from the Batch 2 EU
// validation report §5 — see docs/SCHEMA_DELTAS.md #10.
export type Exemption = {
  scope: string; // what is exempted / excluded
  basis_pinpoint: string; // the article/paragraph granting it
};

export const checkpoints = pgTable(
  "checkpoints",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    geography: text("geography").notNull(),
    jurisdictionLevel: jurisdictionLevelEnum("jurisdiction_level").notNull(),
    stack: stackEnum("stack").notNull(),
    subject: checkpointSubjectEnum("subject").notNull(),
    material: text("material").array().notNull(),
    legalRole: text("legal_role").array().notNull(),
    personaRelevance: text("persona_relevance").array().notNull(),
    packagingLevel: text("packaging_level").array().notNull(),
    triggerDate: date("trigger_date"),
    sunsetDate: date("sunset_date"),
    status: checkpointStatusEnum("status").notNull().default("draft"),
    requirementText: text("requirement_text").notNull(),
    // Multiple limits are ANDed (e.g. PFAS: single / sum / total organic
    // fluorine). Resolves SCHEMA_DELTAS #8 (threshold-as-list).
    thresholds: jsonb("thresholds").$type<Threshold[] | null>(),
    evidenceRequirements: jsonb("evidence_requirements")
      .$type<EvidenceRequirement>()
      .notNull(),
    // Applicability conditions keyed on assessment_context fields (e.g.
    // {"food_contact": true}, {"destination_member_states": "present"}). NULL
    // means the checkpoint always applies. If a condition cannot be evaluated
    // because the context is missing, the engine yields a `caveat`
    // (CONTEXT_REQUIRED) — never a silent pass, never a gap.
    appliesWhen: jsonb("applies_when").$type<Record<string, unknown> | null>(),
    // Recurring cadence for Stack B filings; NULL for one-off obligations.
    recurrence: jsonb("recurrence").$type<Recurrence | null>(),
    testMethod: text("test_method"),
    // Primary legal source at article level — MANDATORY. A checkpoint without
    // a primary citation cannot ship.
    citation: text("citation").notNull(),
    // Stamped post-approval by a human via corpus:verify — confirms the citation
    // was checked against primary. NOT frozen by the immutability trigger, so it
    // can be set on an in_force row without touching approved content.
    citationVerifiedDate: date("citation_verified_date"),
    citationVerifiedBy: text("citation_verified_by"),
    notes: text("notes"),
    // Shown when the checkpoint resolves not_applicable (e.g. the ISPM-15
    // processed-wood exemption under §2.1). NULL → the generic scope message.
    notApplicableReason: text("not_applicable_reason"),
    // food_contact_only was collapsed into `applies_when` ({"food_contact":
    // true}) — a single applicability mechanism instead of a special-case flag.

    // --- Batch 2 EU validation report §5 controls (SCHEMA_DELTAS #10) --------
    // "...or N months after act X, whichever is later" phase-in clause, kept as
    // its own field because it is not a fixed trigger_date.
    laterOfCondition: text("later_of_condition"),
    // Scoped carve-outs, each with its own pinpoint (Exemption[]).
    exemptions: jsonb("exemptions").$type<Exemption[] | null>(),
    // Proposed/pending legislation to monitor — NEVER treated as in force.
    futureLawWatch: text("future_law_watch"),
    // A secondary corroborating source URL (an official register/PRO/guidance
    // page). MUST NOT be used as the primary `citation`.
    sourceCorroborating: text("source_corroborating"),
    // Analyst confidence, distinct from the approval status.
    confidence: checkpointConfidenceEnum("confidence"),
    // --- Organisation-level Stack B registration fields ---------------------
    // The official statutory register (e.g. LUCID, SYDEREP), the body operating
    // it (e.g. ZSVR, ADEME), and — SEPARATELY — the producer responsibility
    // organisation / éco-organisme (e.g. CITEO, CONAI). A PRO is never a register:
    // the CHECK below refuses the same value in official_register and PRO.
    officialRegister: text("official_register"),
    registerOperator: text("register_operator"),
    producerResponsibilityOrganisation: text("producer_responsibility_organisation"),
    // Kept separate (the NL lesson): a threshold to REGISTER vs a threshold to
    // CONTRIBUTE/report can differ; conflating them mis-scopes obligations.
    registrationThreshold: text("registration_threshold"),
    contributionThreshold: text("contribution_threshold"),
    // Whether the official register offers a PUBLIC lookup/search (so a producer's
    // registration can be verified), and the URL of that lookup. NULL = not yet
    // confirmed against the official register page (a review TODO). Sprint 4b / C1.
    registerPublicLookup: boolean("register_public_lookup"),
    registerLookupUrl: text("register_lookup_url"),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.version] }),
    // A PRO value must never be stored as the official register.
    check(
      "checkpoints_register_not_pro",
      sql`${t.officialRegister} IS NULL OR ${t.producerResponsibilityOrganisation} IS NULL OR ${t.officialRegister} <> ${t.producerResponsibilityOrganisation}`,
    ),
  ],
);

// Approved corpus releases. Reports record the corpus version used, so any
// report is reproducible months later.
export const corpusVersions = pgTable("corpus_versions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(),
  approvedBy: text("approved_by").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

// The citation gate, made structural. A checkpoint version cannot reach
// `in_force` without a row here (trigger-enforced), and an `in_force`
// checkpoint's substantive fields are immutable — any change to requirement
// text, threshold or citation requires a new version, hence a new approval.
//
// Approval history is an audit record: it must be undeletable. The FK is
// ON DELETE RESTRICT, so an approved checkpoint physically cannot be deleted.
// Checkpoints are NEVER deleted — a rule that stops applying transitions to
// status 'superseded' (optionally with a successor version). This keeps every
// report reproducible: the checkpoint and the approval it cited both survive.
export const checkpointApprovals = pgTable(
  "checkpoint_approvals",
  {
    checkpointId: text("checkpoint_id").notNull(),
    checkpointVersion: integer("checkpoint_version").notNull(),
    corpusVersionId: integer("corpus_version_id")
      .notNull()
      .references(() => corpusVersions.id),
    // Named regulatory owner who signed off (brief: hard gate, not a review).
    approvedBy: text("approved_by").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Confirms the approver opened the primary source, not a summary of it.
    primarySourceUrl: text("primary_source_url").notNull(),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.checkpointId, t.checkpointVersion] }),
    foreignKey({
      name: "checkpoint_approvals_checkpoint_version_fk",
      columns: [t.checkpointId, t.checkpointVersion],
      foreignColumns: [checkpoints.id, checkpoints.version],
    }).onDelete("restrict"),
  ],
);

// --- Evidence guidance (Sprint 2b) ---------------------------------------
// "How to obtain this evidence", keyed per (checkpoint version, evidence type).
// Advisory content derived from the checkpoint record — not a verdict rule — but
// held to the same approval discipline: seeds `draft`, promoted to `approved`
// only by a human via corpus:approve (guidance mode). The report renders
// approved guidance; draft guidance shows as pending, like a draft checkpoint.
export type GuidanceStatus = "draft" | "approved";

export const evidenceGuidance = pgTable(
  "evidence_guidance",
  {
    checkpointId: text("checkpoint_id").notNull(),
    checkpointVersion: integer("checkpoint_version").notNull(),
    evidenceType: text("evidence_type").notNull(),
    status: text("status").$type<GuidanceStatus>().notNull().default("draft"),
    issuerGuidance: text("issuer_guidance"),
    mustContain: jsonb("must_contain").$type<string[]>(),
    redFlags: jsonb("red_flags").$type<string[]>(),
    typicalSourceOrgRole: text("typical_source_org_role"),
    costTurnaroundNote: text("cost_turnaround_note"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    corpusVersion: text("corpus_version"),
    // Post-approval human verification (corpus:verify --guidance).
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.checkpointId, t.checkpointVersion, t.evidenceType] }),
    foreignKey({
      name: "evidence_guidance_checkpoint_fk",
      columns: [t.checkpointId, t.checkpointVersion],
      foreignColumns: [checkpoints.id, checkpoints.version],
    }).onDelete("restrict"),
  ],
);

// --- Assessments (Sprint 2a intake) --------------------------------------
// A user's uploaded pack: assessment context + BOM components + per-component
// evidence metadata. The corpus version is stamped at creation so a report is
// reproducible against the corpus that was in force when it ran (brief §5/§6).

export type LegalRoleFacts = {
  packaging_branded?: boolean;
  custom_vs_standardised?: "custom" | "standardised";
  spec_defined_by?: "user" | "customer" | "supplier";
  // Whether the packaging manufacturer is established outside the EU. Under
  // Reg 2025/40 a non-EU party is still the manufacturer (Art 3(1)(13)) and draws
  // up the DoC (Art 15); establishment affects only importer verification (Art 18)
  // and any authorised-representative requirement — it is NOT an eligibility gate.
  manufacturer_is_non_eu?: boolean;
  // The assessing user declares they act for the manufacturer (e.g. draw up the DoC
  // on the manufacturer's behalf). Lets a derived manufacturer that is another named
  // party still be eligible, with a note recorded on the draft.
  acts_for_manufacturer?: boolean;
  [key: string]: unknown;
};

export type AssessmentContextRecord = {
  // Superset of destination_member_states: the markets the pack ships into, as
  // regime codes ("EU", "IN", ...). destination_member_states remains the
  // EU-internal detail (which Member States), so an EU pack has
  // destination_markets ["EU"] plus its Member-State list; a pack also shipping
  // to India adds "IN". India checkpoints key off destination_markets; the EU
  // Member-State layer keys off destination_member_states. One is not derivable
  // from the other, so both are stored.
  destination_markets: string[];
  destination_member_states: string[];
  food_contact: boolean;
  persona: string;
  declared_reusable: boolean;
  legal_role_facts: LegalRoleFacts;
  // Optional inbound (supplier → point of placing) transport leg for the
  // screening-grade PCF. Absent = the footprint reports material production only.
  inbound_transport?: { mode: string; km: number } | null;
};

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  packName: text("pack_name").notNull(),
  description: text("description"),
  assessmentContext: jsonb("assessment_context").$type<AssessmentContextRecord>().notNull(),
  // Stamped at creation — the corpus version in force then (or a pre-approval
  // sentinel while the corpus is still all draft). Never back-dated.
  corpusVersion: text("corpus_version").notNull(),
  asOf: date("as_of").notNull(),
  // Demonstration data flag. Seeded demo packs set this true so the report and
  // the public passport render a visible "Demonstration data" tag — a synthetic
  // pack must never be mistaken for a real screening.
  demo: boolean("demo").notNull().default(false),
  // The obligated economic operator this screening is prepared FOR. Nullable:
  // assessments created before organisations existed have none, and the intake
  // must not be blocked on capturing one.
  organisationId: integer("organisation_id").references(() => organisations.id, {
    onDelete: "set null",
  }),
  // Set the first time the footprint is computed. Null means "never evaluated",
  // which is what distinguishes it from "evaluated, and no factor was selected
  // for any material" — the two must not look alike.
  factorsPinnedAt: timestamp("factors_pinned_at", { withTimezone: true }),
});

export const assessmentComponents = pgTable("assessment_components", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  line: text("line").notNull(),
  name: text("name").notNull(),
  material: text("material").notNull(),
  composition: text("composition"),
  weightGrams: integer("weight_grams"),
  sourcedFrom: text("sourced_from"),
  // Optional assessor risk annotation — the human design/chemistry judgment the
  // evaluator consumes as designAssessment. NULL = unannotated (defaults to
  // no_inherent_risk, rendered explicitly, never silently). Attributed to the
  // entering user via riskAnnotatedBy.
  riskAnnotation: text("risk_annotation"),
  riskRationale: text("risk_rationale"),
  riskAnnotatedBy: text("risk_annotated_by"),
});

export const assessmentEvidence = pgTable("assessment_evidence", {
  id: serial("id").primaryKey(),
  componentId: integer("component_id")
    .notNull()
    .references(() => assessmentComponents.id, { onDelete: "cascade" }),
  // Metadata entry only — no file parsing in this slice.
  evidenceType: text("evidence_type").notNull(),
  reference: text("reference"),
  issuedDate: date("issued_date"),
  expiryDate: date("expiry_date"),
  scopeComponents: text("scope_components").array(),
  scopeMaterials: text("scope_materials").array(),
  scopeParameters: text("scope_parameters").array(),
  // Provenance (Sprint 4 / C2). 'manual' = a human typed it; 'extracted' = it was
  // materialised from a confirmed extracted claim. When extracted, document_id and
  // extracted_claim_id point back to the source file + claim so the report can link
  // to the provenance. This is GATED-report only — the passport is unchanged.
  source: text("source").notNull().default("manual"),
  documentId: integer("document_id").references(() => evidenceDocuments.id, { onDelete: "set null" }),
  extractedClaimId: integer("extracted_claim_id"),
});

// --- Evidence documents (Sprint 4 / A1, stored files) ---------------------
// The stored file behind a piece of evidence — distinct from assessment_evidence
// (which is metadata only). Files are AUDIT ARTEFACTS: never deleted, and a
// replacement is a NEW row that points back at the one it supersedes (supersedes_id)
// rather than an overwrite, so the chain of what was submitted stays intact.
// Bytes live in object storage (StorageAdapter); this row holds only the pointer
// (storage_backend + storage_key), integrity hash and provenance. Files are
// private — served ONLY through the gated, signed, short-lived download route,
// never from a public URL.
export const evidenceDocuments = pgTable("evidence_documents", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  // Optional component scope; NULL = assessment-level document.
  componentId: integer("component_id").references(() => assessmentComponents.id, {
    onDelete: "set null",
  }),
  filename: text("filename").notNull(), // original client filename (display only)
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  // SHA-256 of the bytes — integrity + dedupe; NOT a security token.
  sha256: text("sha256").notNull(),
  // Where the bytes live and the adapter-relative key. 'local' for dev/tests;
  // 'blob'/'s3' when configured by env. The key is generated by us, never the
  // client filename, so it cannot carry a path-traversal payload.
  storageBackend: text("storage_backend").notNull(),
  storageKey: text("storage_key").notNull(),
  version: integer("version").notNull().default(1),
  // Self-reference: the document this one replaces. The superseded row is KEPT.
  supersedesId: integer("supersedes_id"),
  // Provenance of the upload: 'manual' | 'magic-link' | ... Never guessed.
  source: text("source").notNull(),
  uploadedBy: text("uploaded_by"),
  // The magic-link request this file was uploaded against (NULL for a manual,
  // gated-side upload). Set when a supplier uploads via /evidence/[token].
  evidenceRequestId: integer("evidence_request_id"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Evidence requests (Sprint 4 / B1, magic-link intake) -----------------
// One token-scoped request for evidence against a specific gap (checkpoint, and
// optionally a component). The token is an unguessable public segment for
// /evidence/[token] — a supplier uploads without an account. v1 does NOT send
// mail: the assessor gets a generated subject+body to send themselves; a per-message
// send happens only if RESEND/SMTP is configured and the assessor approves it.
export const evidenceRequests = pgTable("evidence_requests", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  checkpointId: text("checkpoint_id").notNull(), // the gap this request is for
  componentId: integer("component_id").references(() => assessmentComponents.id, {
    onDelete: "set null",
  }),
  token: text("token").notNull().unique(), // unguessable; public URL segment
  status: evidenceRequestStatusEnum("status").notNull().default("open"),
  note: text("note"), // optional free text shown to the supplier
  expiresAt: timestamp("expires_at", { withTimezone: true }), // NULL = no expiry
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Where in a source document an extracted value was read. `page` is 1-based;
// `span` is a [start,end] char offset into the page text layer; `bbox` is a
// [x0,y0,x1,y1] box (0..1 of page dimensions) for a scanned/vision extraction.
export type ClaimProvenance = {
  page: number;
  span?: [number, number];
  bbox?: [number, number, number, number];
};

// --- Extraction runs + extracted claims (Sprint 4 / A2) -------------------
// One extraction_run = one call of one model at one prompt version over one
// document. `model` and `prompt_version` are PINNED here so a run is reproducible
// and the harness can attribute accuracy to a (model, prompt) pair. Tokens/cost/
// latency are recorded per run. A run that the model refuses (unusable output)
// is `refused`, never fabricated into claims.
export const extractionRuns = pgTable("extraction_runs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => evidenceDocuments.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'anthropic' (interface allows others)
  model: text("model").notNull(), // e.g. 'claude-sonnet-5' — pinned, not implied
  promptVersion: text("prompt_version").notNull(),
  docClass: text("doc_class"), // supplier_declaration | lab_test_report | ...
  status: extractionRunStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: doublePrecision("cost_usd"),
  error: text("error"), // populated on failed/refused; never logged with secrets
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One extracted claim = one structured value the model read out of a document,
// with provenance. A claim is EVIDENCE, not a verdict: the deterministic engine
// judges it and a human confirms it before it can affect a verdict. `confidence`
// is the model's 0..1 self-score; a below-threshold claim is surfaced for
// escalation, never silently trusted. Once `confirmed`, a claim is immutable
// (DB trigger); a correction inserts a NEW claim pointing back via supersedes_id.
export const extractedClaims = pgTable("extracted_claims", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => extractionRuns.id, { onDelete: "cascade" }),
  claimType: text("claim_type").notNull(), // e.g. 'recycled_content' | 'heat_treatment'
  parameter: text("parameter"),
  value: text("value"),
  unit: text("unit"),
  testMethod: text("test_method"),
  issuer: text("issuer"),
  accreditationRef: text("accreditation_ref"),
  issueDate: date("issue_date"),
  expiry: date("expiry"),
  scopeText: text("scope_text"),
  confidence: doublePrecision("confidence"), // 0..1 model self-score; NULL for manual
  // { page, span?: [start,end], bbox?: [x0,y0,x1,y1] } — where in the document
  // this value was read. NULL only for a manual entry (labelled as such).
  provenance: jsonb("provenance").$type<ClaimProvenance>(),
  status: extractedClaimStatusEnum("status").notNull().default("pending"),
  supersedesId: integer("supersedes_id"), // the claim this one corrects (kept)
  confirmedBy: text("confirmed_by"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Assessment activity feed (Sprint 4 / B4) -----------------------------
// An append-only audit trail per assessment: evidence requests sent, documents
// received, claims confirmed/rejected/edited, and verdict changes. Every row is
// timestamped and attributed. Rows are facts about what happened — never edited
// or deleted; a correction is a new row.
export const assessmentActivity = pgTable("assessment_activity", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(), // who/what caused it: 'Assessor', 'supplier (magic-link)', ...
  // request_created | document_received | claim_confirmed | claim_rejected |
  // claim_edited | verdict_changed
  kind: text("kind").notNull(),
  summary: text("summary").notNull(), // one-line human-readable description
  meta: jsonb("meta").$type<Record<string, unknown>>(), // structured detail (ids, from/to counts)
});

// --- Emission factors (Stack D, screening-grade PCF) ----------------------
// Reference data for the cradle-to-gate footprint: one factor per
// (material, process), CHOSEN BY A HUMAN and stored with the provenance that
// makes the choice auditable. Nothing here is seeded automatically: a factor is
// a claim about the physical world, and a number with no traceable origin is
// worse than no number at all.
//
// Sprint 9 removed the `SEED-ESTIMATE` tier and every row that carried it. A
// material with no selected factor now renders "No factor selected" and is
// excluded from the total with a visible note — the honest outcome, rather than
// an order-of-magnitude guess presented as an estimate.
//
// Rows are VERSIONED per (material, process): selecting a new factor appends a
// version rather than overwriting, so an assessment that pinned version 1 keeps
// rendering version 1 (see assessmentFactorPins).
export const emissionFactors = pgTable(
  "emission_factors",
  {
    id: serial("id").primaryKey(),
    // Material vocab (corrugated|plastic|wood_solid|wood_processed|metal) for
    // production rows, or 'transport' for a transport-mode row.
    material: text("material").notNull(),
    // 'production' for a material row; the mode (road|sea|air) for transport.
    process: text("process").notNull(),
    // Monotonic per (material, process). The highest version is the current one.
    version: integer("version").notNull().default(1),
    // Numeric factor; unit given by `unit` (never mix units in one column).
    factor: doublePrecision("factor").notNull(),
    unit: text("unit").notNull(), // 'kgCO2e/kg' | 'kgCO2e/kg.km'
    // Provenance tier. See FACTOR_TIERS in src/lib/vocab.ts:
    //   'primary'            — Fitsol's own measured/supplier data
    //   'secondary_database' — a published LCA database (e.g. via Climatiq)
    //   'none'               — the owner looked and chose nothing; the material
    //                          renders "No factor selected" and is excluded.
    tier: text("tier").notNull(),
    // Publisher name as a reader would recognise it ("ecoinvent", "Fitsol").
    source: text("source").notNull(),
    // The specific dataset within that publisher ("ecoinvent 3.10 cut-off").
    sourceDataset: text("source_dataset"),
    // The provider's stable identifier for the activity, when it has one
    // (Climatiq activity_id). Null for a Fitsol primary factor.
    activityId: text("activity_id"),
    region: text("region").notNull(), // ISO-3166 code or a provider region key
    year: integer("year").notNull(),
    // GWP set and system boundary, e.g. "AR6 GWP100, cradle-to-gate".
    methodology: text("methodology"),
    // When the value was pulled from the provider — a factor is a snapshot, and
    // databases are revised.
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    // What the dataset's terms say about republishing the NUMBER. Recorded by
    // the owner after reading them; prose, for a human to re-read later.
    licenceNote: text("licence_note"),
    // Whether those terms permit showing the factor VALUE on the PUBLIC
    // passport. Separate from licenceNote on purpose: a licensing decision must
    // not be inferred by parsing English. Default false — the passport shows the
    // computed result and the source name, never the licensed value, until the
    // owner has read the terms and said otherwise.
    valueDisplayPermitted: boolean("value_display_permitted").notNull().default(false),
    // Who chose this factor, and when. Selection is a human act (scripts/
    // factors-select.ts), the same discipline as corpus approval.
    selectedBy: text("selected_by").notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (t) => [unique("emission_factors_material_process_version").on(t.material, t.process, t.version)],
);

// Which factor rows an assessment was evaluated against. Pinned the first time
// the footprint is computed, so a report re-rendered after the owner selects a
// better factor still shows the number it showed — a screening is a dated
// artefact, and a figure that silently moves is not reproducible.
//
// `assessments.factors_pinned_at` distinguishes "not yet pinned" from "pinned,
// and there were no factors" — without it an empty pin set is ambiguous.
export const assessmentFactorPins = pgTable(
  "assessment_factor_pins",
  {
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    factorId: integer("factor_id")
      .notNull()
      .references(() => emissionFactors.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.factorId] })],
);

export type EmissionFactorRow = typeof emissionFactors.$inferSelect;

// --- Passports (Sprint 3 / Stack C, public tier) --------------------------
// A shareable public snapshot of an assessment's PUBLIC tier (pack name, material
// summary, verdict counts, corpus version, PCF summary — never per-checkpoint
// detail or evidence). Addressed by an unguessable `token` (NOT the assessment
// id), stable across versions so a printed QR keeps working. Each regeneration
// after a data change appends a new version, chained by prev_hash → a simple
// tamper-evident hash-chain (no blockchain). `content_hash` is over the DATA
// payload only (not the timestamp), so regenerating unchanged data is a no-op.
export const passports = pgTable(
  "passports",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    token: text("token").notNull(), // stable across versions; public URL segment
    version: integer("version").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    prevHash: text("prev_hash"), // chains to the prior version's content_hash
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("passports_token_version_uq").on(t.token, t.version)],
);

// --- Document templates (Sprint 4b / DoC drafting) ------------------------
// Corpus-governed encodings of a legal document structure (e.g. PPWR Annex VIII,
// the EU declaration of conformity). Each element carries the VERBATIM fixed
// legal text and a flag for whether the manufacturer completes a field there, so
// a generated draft can render the fixed text exactly and highlight what the
// signer must fill. Held to the same discipline as the corpus: seeded `draft`,
// promoted to `approved` ONLY by a human via corpus:approve (doc-template mode)
// after confirming the encoding matches the primary Annex text. The draft
// generator refuses any template that is not `approved`.
export type DocTemplateElement = {
  // "header" | "1".."8" | "signature" | "footnote" — position in the Annex.
  ref: string;
  // Verbatim fixed legal text for this element (never paraphrased).
  fixedText: string;
  // True when the manufacturer completes a field within/after this element.
  fillable: boolean;
  // Short label for the editable-field highlight in the generated draft.
  fillLabel?: string;
};

export type DocTemplateStatus = "draft" | "approved";

export const docTemplates = pgTable(
  "doc_templates",
  {
    templateId: text("template_id").notNull(), // e.g. "EU-DoC-AnnexVIII"
    version: integer("version").notNull(),
    title: text("title").notNull(),
    sourceCitation: text("source_citation").notNull(), // e.g. "Regulation (EU) 2025/40, Annex VIII"
    sourceUrl: text("source_url").notNull(), // the EUR-Lex URL it was encoded from
    elements: jsonb("elements").$type<DocTemplateElement[]>().notNull(),
    status: text("status").$type<DocTemplateStatus>().notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    corpusVersion: text("corpus_version"),
    // Post-approval human verification (corpus:verify --doc-template), optional.
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.version] })],
);

// --- Generated DoC drafts (Sprint 4b / DoC drafting) ----------------------
// A generated DRAFT declaration-of-conformity artefact, linked to the assessment
// and the corpus version it was built from. The status is DELIBERATELY constrained
// to 'draft' | 'superseded' — never 'issued': this system's output is never an
// issued declaration (HARD RULE). Regenerating after evidence changes appends a new
// version with a changelog; the prior version is marked 'superseded' (kept). The
// docx (the document the manufacturer signs) and a pdf preview are stored via the
// object-storage adapter; the plain-language filenames are stored for download.
export const docDraftStatusEnum = pgEnum("doc_draft_status", ["draft", "superseded"]);

export const documentDrafts = pgTable(
  "document_drafts",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    templateVersion: integer("template_version").notNull(),
    corpusVersion: text("corpus_version").notNull(),
    version: integer("version").notNull(), // draft version, increments on regenerate
    language: text("language").notNull(), // "en", "de", …
    status: docDraftStatusEnum("status").notNull().default("draft"),
    changelog: text("changelog"),
    docxStorageKey: text("docx_storage_key").notNull(),
    pdfStorageKey: text("pdf_storage_key").notNull(),
    docxFilename: text("docx_filename").notNull(),
    pdfFilename: text("pdf_filename").notNull(),
    storageBackend: text("storage_backend").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // status is a pgEnum limited to 'draft' | 'superseded' — 'issued' is not a
  // representable value, so the HARD RULE ("no state records a DoC as issued") is
  // enforced structurally by the type itself (a CHECK against 'issued' is not even
  // expressible, since the literal is not a valid enum member).
);

// --- Organisations (Sprint 8) ---------------------------------------------
// The obligated economic operator a screening is prepared FOR. Until now a report
// named the pack but never the party carrying the obligation — the first thing a
// reader of a compliance document looks for, and the party a Declaration of
// Conformity is drawn up BY.
//
// Vocabularies (role_default, country, scheme) are TEXT, not enums, for the same
// reason as the rest of this schema: a new role must not require a migration.
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  legalName: text("legal_name").notNull(),
  // The name it trades under, when that differs from the registered name.
  tradingName: text("trading_name"),
  country: text("country").notNull(), // ISO 3166-1 alpha-2
  registeredAddress: text("registered_address"),
  // Free text: a name, or a role mailbox. Deliberately NOT split into
  // name/email/phone columns — a screening does not need a CRM, and every extra
  // personal-data column is one more thing to justify holding.
  primaryContact: text("primary_contact"),
  // Default legal role (src/lib/vocab.ts LEGAL_ROLES). A given assessment's
  // context can still derive a different role; this is the starting point.
  roleDefault: text("role_default"),
  // Fictional organisation seeded for the demo suite. Drives the same
  // "Demonstration data" labelling as assessments.demo.
  demo: boolean("demo").notNull().default(false),
});

// A producer/EPR registration held by an organisation, per jurisdiction. One row
// per (scheme, jurisdiction): an operator placing packaging in five Member States
// holds five registrations, and the passport discloses them per Member State.
export const orgRegistrations = pgTable("org_registrations", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  scheme: text("scheme").notNull(), // e.g. "EPR", "packaging register"
  registerName: text("register_name"), // e.g. "LUCID", "SYDEREP"
  registrationNumber: text("registration_number").notNull(),
  jurisdiction: text("jurisdiction").notNull(), // ISO 3166-1 alpha-2 (Member State)
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
});

export type OrganisationRow = typeof organisations.$inferSelect;
export type OrgRegistrationRow = typeof orgRegistrations.$inferSelect;
