// Production path: the in_force gate lives in evaluatePack, wrapping the same
// evaluateCheckpoint core the harness uses. Proves the report flips from
// "pending regulatory approval" caveats to real verdicts on approval with NO
// code change — the only difference is checkpoint.status.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePack, type ProductionCheckpoint, type ComponentInput } from "../src/lib/engine/pack.ts";
import type { AssessmentContext } from "../src/lib/engine/evaluate.ts";

const context: AssessmentContext = {
  destination_member_states: ["DE"],
  food_contact: false,
  persona: "2a",
  declared_reusable: false,
  legal_role_facts: {},
};

const components: ComponentInput[] = [
  { line: "1", name: "Pine pallet", material: "wood", documents: [] },
];

const checkpoint = (status: ProductionCheckpoint["status"]): ProductionCheckpoint => ({
  id: "EU-PPWR-heavy-metals",
  version: 1,
  status,
  subject: "component",
  material: ["all"],
  legalRole: ["manufacturer"],
  requirementText: "Sum of Pb+Cd+Hg+Cr(VI) <= 100 mg/kg.",
  evidenceRequirements: { allOf: [{ anyOf: ["supplier_declaration"] }] },
  appliesWhen: null,
  thresholds: null,
  citation: "Regulation (EU) 2025/40, Article 5. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng",
  triggerDate: "2026-08-12",
  sunsetDate: null,
  testMethod: null,
  notes: null,
});

const run = (status: ProductionCheckpoint["status"]) =>
  evaluatePack({
    checkpoints: [checkpoint(status)],
    context,
    components,
    asOf: "2026-08-20",
    corpusVersion: "test",
  });

test("draft checkpoint renders as a caveat, never a verdict", () => {
  const report = run("draft");
  assert.equal(report.componentSections[0].cards.length, 0, "no verdict cards while draft");
  assert.equal(report.caveats.length, 1);
  assert.equal(report.caveats[0].caveat?.label, "Pending regulatory approval");
  assert.equal(report.overall.verdict, "pending");
});

test("contested checkpoint renders as a caveat, never a verdict", () => {
  const report = run("contested");
  assert.equal(report.caveats.length, 1);
  assert.equal(report.caveats[0].caveat?.label, "Under legal challenge");
});

test("same code, same data — only status changes — flips caveat to verdict", () => {
  const draft = run("draft");
  const inForce = run("in_force");
  // Draft: caveat, no verdict.
  assert.equal(draft.componentSections[0].cards.length, 0);
  // in_force: a real verdict card (no evidence on file -> conditional/EVIDENCE_ABSENT).
  assert.equal(inForce.caveats.length, 0);
  assert.equal(inForce.componentSections[0].cards.length, 1);
  const card = inForce.componentSections[0].cards[0];
  assert.equal(card.outcome?.disposition, "verdict");
  assert.equal(card.outcome?.verdict, "conditional");
  assert.equal(card.outcome?.reasonCode, "EVIDENCE_ABSENT");
  assert.equal(inForce.overall.verdict, "conditional");
});
