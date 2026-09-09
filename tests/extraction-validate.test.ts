// Part 3a — deterministic post-validation. The LLM proposes; this layer refuses
// values that cannot be right for their field, so a wrong value is always flagged
// rather than stored. Pure functions, no model, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateClaim, expectsNumericValue, isNumericValue } from "../src/lib/extraction/validate.ts";
import type { ExtractedClaimDraft } from "../src/lib/extraction/types.ts";

function claim(over: Partial<ExtractedClaimDraft> = {}): ExtractedClaimDraft {
  return { claimType: "measured_parameter", parameter: "Pb", value: "12.4", confidence: 0.9, provenance: { page: 1 }, ...over };
}

test("a method string where a number belongs is rejected as type_mismatch", () => {
  // The exact observed silent error: heavy_metals_sum = "CR 13695-1:2000".
  const out = validateClaim(claim({ parameter: "heavy_metals_sum", value: "CR 13695-1:2000" }));
  assert.equal(out.value, null, "the wrong-type value must NOT be stored");
  assert.equal(out.rejectedValue, "CR 13695-1:2000", "offending text kept for the reviewer");
  assert.equal(out.validation, "type_mismatch");
});

test("genuine numeric forms survive validation", () => {
  for (const v of ["12.4", "0.05", "<0.5", "≤ 0.1", "30%", "50 mg/kg", "1,200"]) {
    const out = validateClaim(claim({ parameter: "heavy_metals_sum", value: v }));
    assert.equal(out.value, v, `${v} must be kept`);
    assert.equal(out.validation, "ok");
  }
});

test("a value on a not-fully-legible field is dropped, never guessed", () => {
  for (const leg of ["partially_obscured", "illegible"] as const) {
    const out = validateClaim(claim({ parameter: "MUF_resin_solids_content", value: "25", legibility: leg }));
    assert.equal(out.value, null, `${leg} must null the value`);
    assert.equal(out.rejectedValue, "25");
    assert.equal(out.validation, "type_mismatch");
  }
  // clear + a real value is untouched
  const ok = validateClaim(claim({ legibility: "clear", value: "12.4" }));
  assert.equal(ok.value, "12.4");
});

test("non-numeric fields keep their text", () => {
  const out = validateClaim(claim({ claimType: "issuer_identity", parameter: "issuer", value: "SGS SA" }));
  assert.equal(out.value, "SGS SA");
  assert.equal(out.validation, "ok");
});

test("expectsNumericValue / isNumericValue pin the rule", () => {
  assert.equal(expectsNumericValue(claim({ claimType: "measured_parameter", parameter: "Pb" })), true);
  assert.equal(expectsNumericValue(claim({ claimType: "stated_limit", parameter: "x" })), true);
  assert.equal(expectsNumericValue(claim({ claimType: "x", parameter: "heavy_metals_sum" })), true);
  assert.equal(expectsNumericValue(claim({ claimType: "issuer_identity", parameter: "issuer" })), false);
  assert.equal(isNumericValue("CR 13695-1:2000"), false);
  assert.equal(isNumericValue("not detected"), false);
  assert.equal(isNumericValue("12.4"), true);
});
