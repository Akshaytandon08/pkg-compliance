// The `contains` applies_when operator + destination_markets context key.
// Pure engine, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateApplicability, type AssessmentContext } from "../src/lib/engine/evaluate.ts";

const ctx = (over: Partial<AssessmentContext> = {}): AssessmentContext => ({
  destination_markets: ["EU"],
  destination_member_states: ["DE"],
  food_contact: false,
  persona: "2a",
  declared_reusable: false,
  legal_role_facts: {},
  ...over,
});

const facts = (context: AssessmentContext) => ({ context, bomMaterials: ["plastic"] });

test("destination_markets contains IN — not applicable when only EU is a market", () => {
  const r = evaluateApplicability({ destination_markets: { contains: "IN" } }, facts(ctx()));
  assert.equal(r, "not_applicable");
});

test("destination_markets contains IN — applicable when IN is a market", () => {
  const r = evaluateApplicability(
    { destination_markets: { contains: "IN" } },
    facts(ctx({ destination_markets: ["EU", "IN"] })),
  );
  assert.equal(r, "applicable");
});

test("destination_markets contains IN — context_required when no markets are set", () => {
  const r = evaluateApplicability(
    { destination_markets: { contains: "IN" } },
    facts(ctx({ destination_markets: [] })),
  );
  assert.equal(r, "context_required");
});

test("destination_member_states contains FR — applicable only when FR is a destination", () => {
  assert.equal(
    evaluateApplicability(
      { destination_member_states: { contains: "FR" } },
      facts(ctx({ destination_member_states: ["FR", "DE"] })),
    ),
    "applicable",
  );
  assert.equal(
    evaluateApplicability(
      { destination_member_states: { contains: "FR" } },
      facts(ctx({ destination_member_states: ["DE"] })),
    ),
    "not_applicable",
  );
  assert.equal(
    evaluateApplicability(
      { destination_member_states: { contains: "FR" } },
      facts(ctx({ destination_member_states: [] })),
    ),
    "context_required",
  );
});
