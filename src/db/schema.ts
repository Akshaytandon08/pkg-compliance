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

// Array-valued fields use text[]; allowed values are validated at seed time so
// vocabulary growth (new materials, roles) never requires an enum migration.
// The vocabularies live in a client-safe module (no Drizzle) and are re-exported
// here so corpus code and UI code share one source of truth. EVIDENCE_TYPES
// includes `conformity_declaration` (the operator's own DoC — SCHEMA_DELTAS #6).
export { EVIDENCE_TYPES, LEGAL_ROLES, MATERIALS, PACKAGING_LEVELS } from "../lib/vocab.ts";

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
});

// --- Emission factors (Sprint 3 / Stack D, screening-grade PCF) -----------
// Reference data for the cradle-to-gate footprint: one factor per
// (material, process). Material-production rows carry a per-kg factor; transport
// rows a per-kg·km factor (unit column disambiguates). Every row records its
// source, year, geography and data-quality tier so each figure on the report can
// show its provenance. Seed rows are marked data_quality 'SEED-ESTIMATE' — a
// clearly-labelled placeholder, never dressed up as an authoritative source.
export const emissionFactors = pgTable("emission_factors", {
  id: serial("id").primaryKey(),
  // Material vocab (corrugated|plastic|wood|metal) for production rows, or
  // 'transport' for a transport-mode row.
  material: text("material").notNull(),
  // 'production' for a material row; the mode (road|sea|air) for transport.
  process: text("process").notNull(),
  // Numeric factor; unit given by `unit` (never mix units in one column).
  factor: doublePrecision("factor").notNull(),
  unit: text("unit").notNull(), // 'kgCO2e/kg' | 'kgCO2e/kg.km'
  source: text("source").notNull(),
  year: integer("year").notNull(),
  geography: text("geography").notNull(),
  // Provenance tier: 'SEED-ESTIMATE' (placeholder) | 'secondary' | 'primary'.
  dataQuality: text("data_quality").notNull(),
  notes: text("notes"),
});

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
