// Part 2 guard: the canonical comparison recovers surface-form differences of the
// SAME value and must NEVER let a genuinely different value count as right. Runs
// in `npm run check` — no model, pure comparison logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalMatch, strictMatch, canonDate } from "./canonical.ts";
import type { ExpectedClaim } from "./manifest.ts";
import type { ExtractedClaimDraft } from "../../src/lib/extraction/types.ts";

function exp(value: string, extra: Partial<ExpectedClaim> = {}): ExpectedClaim {
  return { parameter: extra.parameter ?? "p", value, unit: null, test_method: null, issuer: null, issuer_type: null, accreditation_ref: null, issue_date: null, valid_until: null, scope: null, ...extra };
}
function claim(value: string, extra: Partial<ExtractedClaimDraft> = {}): ExtractedClaimDraft {
  return { claimType: "x", value, confidence: 0.9, provenance: { page: 1 }, ...extra };
}

test("canonical recovers unit / % / date / case equivalences of the SAME value", () => {
  // mg/kg ≡ ppm
  assert.equal(canonicalMatch(exp("50", { unit: "mg/kg" }), [claim("50 ppm")]), "number");
  assert.equal(canonicalMatch(exp("50", { unit: "ppm" }), [claim("50 mg/kg")]), "number");
  // percent forms
  assert.equal(canonicalMatch(exp("30", { unit: "%" }), [claim("30 %")]), "number");
  assert.equal(canonicalMatch(exp("30%"), [claim("30 percent")]), "number");
  // ISO date vs written forms
  assert.equal(canonicalMatch(exp("2026-03-01"), [claim("1 March 2026")]), "date");
  assert.equal(canonicalMatch(exp("2026-03-01"), [claim("01/03/2026")]), "date");
  // case / whitespace / punctuation (normText unifies separators/case)
  assert.equal(canonicalMatch(exp("EN 71-3"), [claim("en 71 3")]), "text");
  // issuer alias
  assert.equal(canonicalMatch(exp("SGS", { issuer: "SGS" }), [claim("SGS SA", { issuer: "SGS SA" })]), "alias");
});

test("canonical NEVER matches a different value (the Part 2 bug bar)", () => {
  assert.equal(canonicalMatch(exp("Grade A"), [claim("Grade B")]), null);
  assert.equal(canonicalMatch(exp("50", { unit: "mg/kg" }), [claim("60 ppm")]), null);
  assert.equal(canonicalMatch(exp("50", { unit: "mg/kg" }), [claim("50 %")]), null); // no %↔ppm cross-convert
  assert.equal(canonicalMatch(exp("2026-03-01"), [claim("2026-03-02")]), null);
  assert.equal(canonicalMatch(exp("EN 71-3"), [claim("EN 71-1")]), null);
  assert.equal(canonicalMatch(exp("SGS", { issuer: "SGS" }), [claim("Intertek", { issuer: "Intertek" })]), null);
  // no substring/subset shortcut
  assert.equal(canonicalMatch(exp("Recyclable"), [claim("Non-recyclable")]), null);
});

test("strictMatch is exact-only (no unit/date/alias)", () => {
  assert.equal(strictMatch(exp("50", { unit: "mg/kg" }), [claim("50 ppm")]), false);
  assert.equal(strictMatch(exp("50"), [claim("50")]), true);
  assert.equal(strictMatch(exp("EN 71-3"), [claim("EN 71-3")]), true);
  assert.equal(strictMatch(exp("Grade A"), [claim("Grade B")]), false);
});

test("canonDate parses the forms in the set and rejects junk", () => {
  assert.equal(canonDate("2026-3-1"), "2026-03-01");
  assert.equal(canonDate("1 March 2026"), "2026-03-01");
  assert.equal(canonDate("March 1, 2026"), "2026-03-01");
  assert.equal(canonDate("01/03/2026"), "2026-03-01");
  assert.equal(canonDate("not a date"), null);
});
