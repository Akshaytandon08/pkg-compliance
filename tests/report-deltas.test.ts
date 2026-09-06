// Output-level language guardrail for the report's delta actions (brief §1):
// user-facing text must never present the system as issuer/certifier/verifier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDeltaAction, describeRequirement } from "../src/lib/report/deltaActions.ts";
import { findLanguageViolations, PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "../src/lib/report/language.ts";
import type { CheckpointCard } from "../src/lib/engine/pack.ts";

const card = (overrides: Partial<CheckpointCard>): CheckpointCard => ({
  checkpointId: "EU-PPWR-declaration-of-conformity",
  version: 1,
  subject: "packaging_unit",
  requirementText: "…",
  citation: "…",
  testMethod: null,
  evidenceRequirements: { allOf: [{ anyOf: ["conformity_declaration"] }] },
  outcome: { disposition: "verdict", verdict: "conditional", risk: "low", reasonCode: "EVIDENCE_ABSENT", evidenceState: "absent" },
  ...overrides,
});

test("delta actions never contain issuing/certifying language", () => {
  const samples = [
    describeDeltaAction(card({})),
    describeDeltaAction(
      card({
        componentName: "Green polyester strap (PET)",
        evidenceRequirements: { allOf: [{ anyOf: ["pigment_spec", "lab_test"] }] },
        outcome: { disposition: "verdict", verdict: "conditional", risk: "medium", reasonCode: "TEST_REQUIRED", evidenceState: "absent" },
      }),
    ),
    describeDeltaAction(
      card({
        outcome: { disposition: "verdict", verdict: "conditional", risk: "low", reasonCode: "EVIDENCE_INCOMPLETE", evidenceState: "insufficient" },
      }),
    ),
    describeDeltaAction(
      card({ outcome: { disposition: "verdict", verdict: "gap", risk: "high", reasonCode: "DESIGN_NONCOMPLIANT", evidenceState: "absent" } }),
    ),
    describeRequirement({ allOf: [{ anyOf: ["supplier_declaration", "test_report", "lab_test"] }] }),
    SCREENING_DISCLAIMER,
  ];
  for (const text of samples) {
    assert.ok(text, "sample produced text");
    assert.deepEqual(findLanguageViolations(text!), [], `language violation in: ${text}`);
  }
});

test("the DoC delta names the operator's document, not a system output", () => {
  const text = describeDeltaAction(card({}));
  assert.match(text!, /drawn up by the obligated operator/);
});

test("new risk-annotation report strings carry no issuing language", () => {
  const strings = [
    "No risk annotation provided — defaulting to no inherent risk.",
    "Assessor risk annotation: no inherent risk (by Akshay Tandon).",
    "Assessor risk annotation: at risk (by Akshay Tandon) — pigment families may contain lead chromate.",
    "Assessor rationale (at risk): green pigment must be evidenced by a pigment specification or lab test.",
  ];
  for (const s of strings) assert.deepEqual(findLanguageViolations(s), [], `violation in: ${s}`);
});

test("new guidance/add-evidence report strings carry no issuing language", () => {
  const strings = [
    "How to obtain this evidence",
    "Guidance pending approval.",
    "Must contain:",
    "Watch for:",
    "Typical source:",
    "Cost & turnaround:",
    "Add evidence",
    "Save evidence",
    "Add evidence for Green polyester strap (PET)",
    "Request from the supplier of the component material a signed declaration naming the component it covers.",
  ];
  for (const s of strings) assert.deepEqual(findLanguageViolations(s), [], `violation in: ${s}`);
});

test("demonstration-data tag carries no issuing language", () => {
  assert.deepEqual(findLanguageViolations("Demonstration data"), []);
});

test("PCF disclaimer + card strings carry no issuing/forbidden language", () => {
  const strings = [
    PCF_DISCLAIMER,
    "Cradle-to-gate footprint (screening-grade)",
    "Source · tier",
    "Excluded from the total (no weight or no emission factor on file):",
  ];
  for (const s of strings) assert.deepEqual(findLanguageViolations(s), [], `violation in: ${s}`);
});

test("obligation-calendar report strings carry no issuing language", () => {
  const strings = [
    "Compliance calendar",
    "Recurring obligations that apply to this pack, with the next occurrence computed from the as-of date. Dates are indicative screening output; confirm the statutory deadline for each market against the primary source.",
    "Annual",
    "Every 6 months",
    "Next due 2027-03-31",
    "Next due date to be confirmed",
    "The regimes this pack ships into. India obligations apply only when IN is selected.",
  ];
  for (const s of strings) assert.deepEqual(findLanguageViolations(s), [], `violation in: ${s}`);
});

test("qualified cards have no delta action", () => {
  const text = describeDeltaAction(
    card({ outcome: { disposition: "verdict", verdict: "qualified", risk: "low", reasonCode: "EVIDENCE_COMPLETE", evidenceState: "complete" } }),
  );
  assert.equal(text, null);
});
