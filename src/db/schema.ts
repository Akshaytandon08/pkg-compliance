import {
  boolean,
  date,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
export const checkpointStatusEnum = pgEnum("checkpoint_status", [
  "draft",
  "in_force",
  "upcoming",
  "contested",
  "superseded",
]);

// Array-valued fields use text[]; allowed values are validated at seed time so
// vocabulary growth (new materials, roles) never requires an enum migration.
export const MATERIALS = ["corrugated", "plastic", "wood", "metal", "all"] as const;
export const LEGAL_ROLES = [
  "manufacturer",
  "importer",
  "distributor",
  "epr_producer",
] as const;
export const PACKAGING_LEVELS = [
  "sales",
  "inner",
  "outer",
  "transport",
  "pallet",
  "ecomm",
] as const;
export const EVIDENCE_TYPES = [
  "supplier_declaration",
  "lab_test",
  "registration",
  "marking",
  "technical_file",
  "test_report",
  "pigment_spec",
] as const;

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
    testMethod: text("test_method"),
    // Primary legal source at article level — MANDATORY. A checkpoint without
    // a primary citation cannot ship.
    citation: text("citation").notNull(),
    citationVerifiedDate: date("citation_verified_date"),
    notes: text("notes"),
    foodContactOnly: boolean("food_contact_only").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
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
