// The obligation calendar: recurring obligations that apply to the pack, with
// next-due computed from the as-of date. Pure, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildObligationCalendar, nextAnnualDue } from "../src/lib/report/obligations.ts";
import type { ProductionCheckpoint } from "../src/lib/engine/pack.ts";
import type { AssessmentContext } from "../src/lib/engine/evaluate.ts";

const ctx: AssessmentContext = {
  destination_markets: ["EU", "IN"],
  destination_member_states: ["FR"],
  food_contact: false,
  persona: "2a",
  declared_reusable: false,
  legal_role_facts: {},
};

const base: Omit<ProductionCheckpoint, "id" | "appliesWhen" | "recurrence"> = {
  version: 1,
  status: "in_force",
  subject: "organisation",
  material: ["all"],
  legalRole: ["epr_producer"],
  requirementText: "Register and file.",
  evidenceRequirements: { allOf: [{ anyOf: ["registration"] }] },
  thresholds: null,
  citation: "cite",
  triggerDate: null,
  sunsetDate: null,
  testMethod: null,
  notes: null,
  confidence: null,
  laterOfCondition: null,
  exemptions: null,
  notApplicableReason: null,
};

const cp = (over: Partial<ProductionCheckpoint>): ProductionCheckpoint => ({ ...base, id: "x", appliesWhen: null, recurrence: null, ...over });

test("nextAnnualDue returns this year's anchor when it is still ahead", () => {
  assert.equal(nextAnnualDue("--03-31", "2026-01-01"), "2026-03-31");
});

test("nextAnnualDue rolls to next year when the anchor has passed", () => {
  assert.equal(nextAnnualDue("--03-31", "2026-09-05"), "2027-03-31");
});

test("nextAnnualDue returns null for a non-annual anchor", () => {
  assert.equal(nextAnnualDue("2026-03-31", "2026-01-01"), null);
});

test("only recurring, applicable checkpoints land on the calendar", () => {
  const checkpoints = [
    cp({ id: "one-off", recurrence: null }), // no recurrence → excluded
    cp({
      id: "FR-reg",
      recurrence: { every: "P1Y" },
      appliesWhen: { destination_member_states: { contains: "FR" } },
    }),
    cp({
      id: "DE-reg",
      recurrence: { every: "P1Y" },
      appliesWhen: { destination_member_states: { contains: "DE" } }, // not a destination → excluded
    }),
  ];
  const cal = buildObligationCalendar(checkpoints, ctx, ["plastic"], "2026-09-05");
  assert.deepEqual(cal.map((e) => e.checkpointId), ["FR-reg"]);
  assert.equal(cal[0].cadenceLabel, "Annual");
  assert.equal(cal[0].nextDue, null, "no due anchor → date to be confirmed");
});

test("a due anchor produces a computed next occurrence", () => {
  const cal = buildObligationCalendar(
    [cp({ id: "annual", recurrence: { every: "P1Y", due: "--03-31" } })],
    ctx,
    ["plastic"],
    "2026-09-05",
  );
  assert.equal(cal[0].nextDue, "2027-03-31");
});
