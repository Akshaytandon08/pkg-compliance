import {
  boolean,
  date,
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

export const checkpointStatusEnum = pgEnum("checkpoint_status", [
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
] as const;

export type Threshold = {
  parameter: string;
  operator: "<" | "<=" | "=" | ">=" | ">";
  value: number;
  unit: string;
};

export const checkpoints = pgTable(
  "checkpoints",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    geography: text("geography").notNull(),
    jurisdictionLevel: jurisdictionLevelEnum("jurisdiction_level").notNull(),
    stack: stackEnum("stack").notNull(),
    material: text("material").array().notNull(),
    legalRole: text("legal_role").array().notNull(),
    personaRelevance: text("persona_relevance").array().notNull(),
    packagingLevel: text("packaging_level").array().notNull(),
    triggerDate: date("trigger_date"),
    sunsetDate: date("sunset_date"),
    status: checkpointStatusEnum("status").notNull(),
    requirementText: text("requirement_text").notNull(),
    threshold: jsonb("threshold").$type<Threshold | null>(),
    evidenceType: text("evidence_type").array().notNull(),
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
