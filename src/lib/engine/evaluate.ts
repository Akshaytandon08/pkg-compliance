// The deterministic evaluator core. Pure: no DB, no I/O, no corpus coupling.
// Given a single checkpoint definition + assessment context + a component's
// claims/evidence, it returns one outcome. Both feed paths use THIS function:
//   - harness path (eval/engine-verdicts.test.ts): checkpoints hydrated from
//     fixture snapshots, treated as evaluable — measures agreement pre-approval.
//   - production path (src/lib/engine/pack.ts): checkpoints from the DB, gated
//     by evaluability() so drafts/contested render as caveats, never verdicts.
// Same core, no fork. The in_force gate lives only in the production wrapper.

import { decideVerdict } from "./verdict.ts";
import type { DesignAssessment, EvidenceState, Risk, Verdict } from "./verdict.ts";
import type { EvidenceRequirement } from "../../db/schema.ts";
import { expandMaterials, materialMatches } from "../vocab.ts";

export type EvidenceDocument = {
  docId: string;
  type: string;
  issuedDate?: string | null;
  expiryDate?: string | null;
  scope?: {
    components?: string[];
    materials?: string[];
    parameters?: string[];
  } | null;
  // Provenance for the gated report (C2) — the evaluator ignores these; they only
  // drive how the report labels and links an evidence item.
  source?: "manual" | "extracted";
  sourceDocumentId?: number | null; // the stored file this evidence came from, if any
  reference?: string | null;
};

export type AssessmentContext = {
  // Regime-level markets the pack ships into ("EU", "IN", ...); superset of
  // destination_member_states (the EU-internal detail). India rules key off this.
  destination_markets: string[];
  destination_member_states: string[];
  food_contact: boolean;
  persona: string;
  declared_reusable: boolean;
  legal_role_facts: Record<string, unknown>;
};

export type ReasonCode =
  | "EVIDENCE_COMPLETE"
  | "EVIDENCE_ABSENT"
  | "EVIDENCE_INCOMPLETE"
  | "EVIDENCE_EXPIRED"
  | "TEST_REQUIRED"
  | "DESIGN_NONCOMPLIANT"
  | "NOT_APPLICABLE_SCOPE"
  | "CONTEXT_REQUIRED"
  | "UPCOMING_NOT_YET_APPLICABLE";

export type Disposition = "verdict" | "caveat" | "not_applicable" | "upcoming";

export type CheckpointOutcome = {
  disposition: Disposition;
  reasonCode: ReasonCode;
  verdict?: Verdict; // present iff disposition === "verdict"
  risk?: Risk;
  evidenceState?: EvidenceState;
  detail?: string;
};

export type Applicability = "applicable" | "not_applicable" | "context_required";

const CONTEXT_KEYS = new Set([
  "destination_markets",
  "destination_member_states",
  "food_contact",
  "persona",
  "declared_reusable",
]);

/**
 * Resolves an `applies_when` object against assessment context and BOM facts.
 * A key that cannot be resolved (missing context, empty "present" array) yields
 * `context_required` — never a silent pass, never a gap.
 */
export function evaluateApplicability(
  appliesWhen: Record<string, unknown> | null | undefined,
  facts: { context: AssessmentContext; bomMaterials: string[] },
): Applicability {
  if (!appliesWhen || Object.keys(appliesWhen).length === 0) return "applicable";

  for (const [key, expected] of Object.entries(appliesWhen)) {
    // BOM-derived fact (see eval/README): presence of a material in the pack.
    // Honours the material hierarchy — a `wood` condition is satisfied by a
    // wood_solid or wood_processed component; a `wood_solid` condition is not.
    if (key === "bom_material_present") {
      if (typeof expected === "string" && !expandMaterials(facts.bomMaterials).includes(expected)) {
        return "not_applicable";
      }
      continue;
    }

    if (CONTEXT_KEYS.has(key)) {
      const actual = (facts.context as Record<string, unknown>)[key];
      if (expected === "present") {
        // Sentinel: the field must be a non-empty array. Empty/absent = unknown.
        if (Array.isArray(actual)) {
          if (actual.length === 0) return "context_required";
        } else if (actual == null) {
          return "context_required";
        }
        continue;
      }
      // { "contains": value } — the field is an array that must include `value`
      // (e.g. destination_markets contains "IN", destination_member_states
      // contains "FR"). An empty/absent array is unknown, not a silent "no".
      if (expected && typeof expected === "object" && "contains" in (expected as object)) {
        const needle = (expected as { contains: unknown }).contains;
        if (!Array.isArray(actual) || actual.length === 0) return "context_required";
        if (!actual.includes(needle)) return "not_applicable";
        continue;
      }
      if (actual === undefined || actual === null) return "context_required";
      if (actual !== expected) return "not_applicable";
      continue;
    }

    // Unknown key — cannot evaluate the condition; surface it, don't guess.
    return "context_required";
  }
  return "applicable";
}

/**
 * Derives evidence state by matching on-file documents against the checkpoint's
 * CNF requirement, honouring document scope (cert-covers-this-component) and
 * expiry. `complete` only if every allOf clause is satisfied by a covering,
 * unexpired document.
 */
export function deriveEvidenceState(
  requirement: EvidenceRequirement,
  documents: EvidenceDocument[],
  facts: { componentName?: string; material?: string; asOf: string },
): EvidenceState {
  const clauses = requirement.allOf ?? [];
  if (clauses.length === 0) return "complete"; // nothing required to close

  const covers = (doc: EvidenceDocument): boolean => {
    if (!facts.componentName) return true; // pack/organisation subject: no per-component scope
    const s = doc.scope;
    if (!s || (!s.components && !s.materials)) return true; // an unscoped document covers
    if (s.components && s.components.includes(facts.componentName)) return true;
    // Hierarchy-aware: evidence scoped to a parent material ("wood") covers a
    // subtype component ("wood_solid"), and an exact match covers as before.
    if (s.materials && facts.material && materialMatches(s.materials, facts.material)) return true;
    return false;
  };
  const notExpired = (doc: EvidenceDocument): boolean =>
    !doc.expiryDate || doc.expiryDate >= facts.asOf;

  const relevantTypes = new Set(clauses.flatMap((c) => c.anyOf));
  const relevant = documents.filter((d) => relevantTypes.has(d.type));
  if (relevant.length === 0) return "absent";

  let expiredBlocked = false;
  const allSatisfied = clauses.every((clause) => {
    const covering = documents.filter(
      (d) => clause.anyOf.includes(d.type) && covers(d),
    );
    if (covering.length === 0) return false;
    if (covering.some(notExpired)) return true;
    expiredBlocked = true; // covered but every candidate is expired
    return false;
  });
  if (allSatisfied) return "complete";
  return expiredBlocked ? "expired" : "insufficient";
}

export type CheckpointEvalInput = {
  appliesWhen: Record<string, unknown> | null | undefined;
  evidenceRequirements: EvidenceRequirement;
  // The extraction's chemistry/design judgment for this (component, checkpoint).
  // An input, not something the deterministic evaluator derives. Production
  // defaults to `no_inherent_risk` until the extraction pipeline lands.
  designAssessment: DesignAssessment;
  documents: EvidenceDocument[];
  context: AssessmentContext;
  bomMaterials: string[];
  componentName?: string;
  material?: string;
  asOf: string;
  // Optional checkpoint-specific explanation shown when the checkpoint is
  // not_applicable (e.g. the ISPM-15 processed-wood exemption). Falls back to the
  // generic scope message when absent.
  notApplicableReason?: string | null;
  // TEMPORAL applicability. `triggerDate` is the date the requirement starts to
  // apply; `laterOfCondition` is the "…or N months after act X, whichever is
  // later" clause, which means the real date may be LATER than triggerDate and is
  // not yet fixed. Before the trigger the checkpoint is `upcoming`: reported, but
  // never evaluated for evidence and never counted as a gap.
  triggerDate?: string | null;
  laterOfCondition?: string | null;
};

/** The informational reason shown on an `upcoming` row. */
export function upcomingDetail(triggerDate: string, laterOfCondition?: string | null): string {
  return laterOfCondition
    ? `Applies from ${triggerDate} or later, pending ${laterOfCondition}`
    : `Applies from ${triggerDate}`;
}

/** The single place a per-checkpoint outcome is decided. */
export function evaluateCheckpoint(input: CheckpointEvalInput): CheckpointOutcome {
  const applic = evaluateApplicability(input.appliesWhen, {
    context: input.context,
    bomMaterials: input.bomMaterials,
  });
  if (applic === "context_required") {
    return {
      disposition: "caveat",
      reasonCode: "CONTEXT_REQUIRED",
      detail: "Applicability depends on context this assessment does not capture.",
    };
  }
  if (applic === "not_applicable") {
    return {
      disposition: "not_applicable",
      reasonCode: "NOT_APPLICABLE_SCOPE",
      detail: input.notApplicableReason ?? "Out of scope for this assessment's context.",
    };
  }

  // TEMPORAL GATE — before evidence is considered. A requirement whose trigger
  // date is after the assessment's as-of date does not yet apply: it cannot be
  // satisfied, so calling it a gap (or demanding evidence for it) would be wrong.
  // It reports as `upcoming` with its own count and blocks nothing.
  if (input.triggerDate && input.asOf < input.triggerDate) {
    return {
      disposition: "upcoming",
      verdict: "upcoming",
      reasonCode: "UPCOMING_NOT_YET_APPLICABLE",
      detail: upcomingDetail(input.triggerDate, input.laterOfCondition),
    };
  }

  const evidenceState = deriveEvidenceState(
    input.evidenceRequirements,
    input.documents,
    { componentName: input.componentName, material: input.material, asOf: input.asOf },
  );

  // A design/chemistry failure is a gap regardless of paperwork.
  if (input.designAssessment === "non_compliant") {
    return {
      disposition: "verdict",
      verdict: "gap",
      risk: "high",
      evidenceState,
      reasonCode: "DESIGN_NONCOMPLIANT",
    };
  }

  const { verdict, risk } = decideVerdict({
    designAssessment: input.designAssessment,
    evidenceState,
  });
  const reasonCode: ReasonCode =
    evidenceState === "complete"
      ? "EVIDENCE_COMPLETE"
      : evidenceState === "insufficient"
        ? "EVIDENCE_INCOMPLETE"
        : evidenceState === "expired"
          ? "EVIDENCE_EXPIRED"
          : input.designAssessment === "at_risk"
            ? "TEST_REQUIRED"
            : "EVIDENCE_ABSENT";

  return { disposition: "verdict", verdict, risk, evidenceState, reasonCode };
}
