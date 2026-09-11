// COMMIT 1 — temporal applicability. A requirement whose trigger date is after the
// assessment's as-of date does not yet apply: it cannot be satisfied, so treating
// it as a gap (or demanding evidence for it) would be wrong. It must report as
// `upcoming`, carry its date, stay out of the qualified/conditional/gap counts,
// and block nothing — and it must flip to a real verdict once the date passes.
//
// Corpus-independent by design (see eval/README.md): the checkpoint definition is
// embedded per case, so this holds regardless of which rows a given database has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCheckpoint, upcomingDetail } from "../src/lib/engine/evaluate.ts";
import { decideVerdict } from "../src/lib/engine/verdict.ts";
import type { AssessmentContext } from "../src/lib/engine/evaluate.ts";
import { evaluatePack, type ProductionCheckpoint } from "../src/lib/engine/pack.ts";

const context: AssessmentContext = {
  destination_member_states: ["DE"],
  food_contact: false,
  persona: "2a",
  declared_reusable: false,
  legal_role_facts: { packaging_branded: true, custom_vs_standardised: "custom", spec_defined_by: "user" },
} as unknown as AssessmentContext;

// The three forward requirements, with the trigger dates and later-of clauses the
// Batch 2 EU validation recorded (drizzle/0015_batch2-eu.sql, 0026 reconcile).
const FORWARD = [
  {
    id: "EU-green-claims-substantiation",
    triggerDate: "2026-09-27",
    laterOfCondition: null,
  },
  {
    id: "EU-PPWR-recyclability-grade",
    triggerDate: "2030-01-01",
    laterOfCondition: "Design-for-recycling grade from 1 Jan 2030 or 24 months after the Article 6(4) delegated acts enter into force, whichever is later",
  },
  {
    id: "EU-PPWR-recycled-content-plastic",
    triggerDate: "2030-01-01",
    laterOfCondition: "From 1 Jan 2030 or three years after the Article 7(8) implementing act enters into force, whichever is later",
  },
] as const;

const base = {
  appliesWhen: null,
  evidenceRequirements: { allOf: [{ anyOf: ["supplier_declaration"] }] },
  designAssessment: "no_inherent_risk" as const,
  documents: [],
  context,
  bomMaterials: ["paper"],
};

const TODAY = "2026-09-10";

test("the three forward requirements are `upcoming` as of today, with their dates", () => {
  for (const cp of FORWARD) {
    const out = evaluateCheckpoint({ ...base, asOf: TODAY, triggerDate: cp.triggerDate, laterOfCondition: cp.laterOfCondition });
    assert.equal(out.disposition, "upcoming", `${cp.id} must be upcoming as of ${TODAY}`);
    assert.equal(out.verdict, "upcoming");
    assert.equal(out.reasonCode, "UPCOMING_NOT_YET_APPLICABLE");
    assert.match(out.detail ?? "", new RegExp(`Applies from ${cp.triggerDate}`));
    // It must NOT masquerade as an evidence outcome.
    assert.equal(out.evidenceState, undefined, `${cp.id} must not derive evidence state before it applies`);
  }
});

test("a later-of clause is named in the reason; a plain trigger date is not padded", () => {
  const grade = FORWARD[1];
  assert.equal(
    upcomingDetail(grade.triggerDate, grade.laterOfCondition),
    `Applies from ${grade.triggerDate} or later, pending ${grade.laterOfCondition}`,
  );
  assert.equal(upcomingDetail("2026-09-27", null), "Applies from 2026-09-27");
});

test("each flips to a real evaluated verdict once its date has passed", () => {
  for (const cp of FORWARD) {
    // One day after the trigger, with no evidence on file → a normal conditional.
    const after = new Date(Date.parse(cp.triggerDate) + 86_400_000).toISOString().slice(0, 10);
    const out = evaluateCheckpoint({ ...base, asOf: after, triggerDate: cp.triggerDate, laterOfCondition: cp.laterOfCondition });
    assert.equal(out.disposition, "verdict", `${cp.id} must evaluate normally as of ${after}`);
    assert.notEqual(out.verdict, "upcoming");
    assert.equal(out.verdict, "conditional"); // no documents → evidence absent
    assert.equal(out.evidenceState, "absent");
  }
});

test("on the trigger date itself the requirement applies (boundary is inclusive)", () => {
  const cp = FORWARD[0];
  const out = evaluateCheckpoint({ ...base, asOf: cp.triggerDate, triggerDate: cp.triggerDate });
  assert.equal(out.disposition, "verdict", "as-of == trigger date means it applies");
});

test("a checkpoint with no trigger date is unaffected", () => {
  const out = evaluateCheckpoint({ ...base, asOf: TODAY, triggerDate: null });
  assert.equal(out.disposition, "verdict");
});

test("decideVerdict never returns `upcoming` — it is a temporal state, not a rule-table outcome", () => {
  for (const designAssessment of ["no_inherent_risk", "at_risk", "non_compliant"] as const) {
    for (const evidenceState of ["complete", "insufficient", "absent", "expired"] as const) {
      assert.notEqual(decideVerdict({ designAssessment, evidenceState }).verdict, "upcoming");
    }
  }
});

// --- pack level: routing, counts, and that nothing else is disturbed ---------

function cp(over: Partial<ProductionCheckpoint>): ProductionCheckpoint {
  return {
    id: "X", version: 1, status: "in_force", subject: "packaging_unit",
    requirementText: "r", citation: "c https://eur-lex.europa.eu/x", testMethod: null,
    evidenceRequirements: { allOf: [{ anyOf: ["supplier_declaration"] }] },
    appliesWhen: null, material: null, triggerDate: null, sunsetDate: null,
    confidence: "H", laterOfCondition: null, exemptions: null, notApplicableReason: null,
    ...over,
  } as ProductionCheckpoint;
}

test("evaluatePack routes upcoming to its own bucket and its own count", () => {
  const report = evaluatePack({
    checkpoints: [
      cp({ id: "EU-green-claims-substantiation", triggerDate: "2026-09-27" }),
      cp({ id: "EU-PPWR-recyclability-grade", triggerDate: "2030-01-01", laterOfCondition: "24 months after the Article 6(4) delegated acts" }),
      cp({ id: "EU-PPWR-heavy-metals", triggerDate: "2026-08-12" }), // already in force
    ],
    context,
    components: [{ line: "1", name: "Box", material: "paper", documents: [] } as never],
    asOf: TODAY,
    corpusVersion: "test",
  });

  assert.equal(report.upcoming.length, 2, "both future requirements land in the upcoming bucket");
  assert.equal(report.counts.upcoming, 2);
  // They are excluded from the outcome counts entirely.
  assert.equal(report.counts.gap, 0, "a future requirement is never a gap");
  assert.equal(report.counts.caveat, 0, "and is no longer a generic caveat");
  assert.equal(report.counts.conditional, 1, "only the in-force one is evaluated");
  // The overall verdict is driven only by evaluated rows.
  assert.equal(report.overall.evaluatedCount, 1);
  assert.equal(report.overall.verdict, "conditional");
  // Each carries its date, and the later-of clause is named where present.
  const grade = report.upcoming.find((c) => c.checkpointId === "EU-PPWR-recyclability-grade");
  assert.match(grade?.outcome?.detail ?? "", /Applies from 2030-01-01 or later, pending 24 months/);
});
