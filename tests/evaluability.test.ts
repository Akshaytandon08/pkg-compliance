// The approval gate's application-layer half: an unapproved, contested or
// not-yet-triggered checkpoint must never produce a verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertEvaluable,
  evaluability,
  type EvaluabilityInput,
} from "../src/lib/corpus/evaluability.ts";

const base: EvaluabilityInput = {
  id: "EU-PPWR-heavy-metals",
  version: 1,
  status: "in_force",
  triggerDate: "2026-08-12",
  sunsetDate: null,
  citation: "Regulation (EU) 2025/40, Art. 5(4)",
};

test("in-force and in-window checkpoint is evaluable", () => {
  assert.deepEqual(evaluability(base, "2026-08-20"), { evaluable: true });
});

test("draft checkpoint is excluded — approval is the only path to a verdict", () => {
  const result = evaluability({ ...base, status: "draft" }, "2026-08-20");
  assert.equal(result.evaluable, false);
  assert.equal(result.evaluable === false && result.disposition, "excluded");
});

test("contested checkpoint is a caveat, never a verdict", () => {
  const result = evaluability({ ...base, status: "contested" }, "2026-08-20");
  assert.equal(result.evaluable, false);
  assert.equal(result.evaluable === false && result.disposition, "caveat");
});

test("checkpoint before its trigger date is a forward flag", () => {
  const result = evaluability(base, "2026-07-28");
  assert.equal(result.evaluable, false);
  assert.equal(result.evaluable === false && result.disposition, "caveat");
});

test("superseded and sunset checkpoints are excluded", () => {
  assert.equal(
    evaluability({ ...base, status: "superseded" }, "2026-08-20").evaluable,
    false,
  );
  assert.equal(
    evaluability({ ...base, sunsetDate: "2026-08-01" }, "2026-08-20").evaluable,
    false,
  );
});

test("missing citation blocks evaluation regardless of status", () => {
  const result = evaluability({ ...base, citation: "   " }, "2026-08-20");
  assert.equal(result.evaluable, false);
});

test("assertEvaluable throws rather than degrading silently", () => {
  assert.throws(
    () => assertEvaluable({ ...base, status: "draft" }, "2026-08-20"),
    /Refusing to evaluate EU-PPWR-heavy-metals@1/,
  );
  assert.doesNotThrow(() => assertEvaluable(base, "2026-08-20"));
});
