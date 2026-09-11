// COMMIT 2 — the two silent-error mechanisms. A silent error is a wrong value
// that reaches a verdict with nothing to warn a reviewer, so both mechanisms are
// judged on one question: does a value that cannot be substantiated get
// WITHHELD and FLAGGED rather than stored? Pure functions, no model, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groundClaims, reconcilePasses, isVerdictDriving } from "../src/lib/extraction/safeguards.ts";
import { snippetIsGrounded, normalizeForGrounding } from "../src/lib/extraction/text-layer.ts";
import type { ExtractedClaimDraft } from "../src/lib/extraction/types.ts";

const DOC_TEXT = `Orvantis Materials Laboratory
Report SYN/2026/0006
Lead (Pb): 12.4 mg/kg   Detection limit 0.5 mg/kg
Sum of heavy metals: 38.2 mg/kg (limit 100 mg/kg)
Method: CR 13695-1:2000`;

function claim(over: Partial<ExtractedClaimDraft> = {}): ExtractedClaimDraft {
  return {
    claimType: "measured_parameter", parameter: "Pb", value: "12.4",
    sourceSnippet: "Lead (Pb): 12.4 mg/kg", confidence: 0.95, provenance: { page: 1 }, ...over,
  };
}

// --- verbatim grounding -----------------------------------------------------

test("a value whose snippet IS in the document survives grounding", () => {
  const { claims, ungrounded } = groundClaims([claim()], DOC_TEXT);
  assert.equal(ungrounded, 0);
  assert.equal(claims[0].value, "12.4");
});

test("a value whose snippet is NOT in the document is rejected", () => {
  // The invented case: a plausible sum the document never states.
  const c = claim({ parameter: "heavy_metals_sum", value: "42.8", sourceSnippet: "Sum of heavy metals: 42.8 mg/kg" });
  const { claims, ungrounded } = groundClaims([c], DOC_TEXT);
  assert.equal(ungrounded, 1);
  assert.equal(claims[0].value, null, "an ungrounded value must NOT be stored");
  assert.equal(claims[0].rejectedValue, "42.8");
  assert.equal(claims[0].validation, "ungrounded");
});

test("a value with NO snippet at all is rejected — unshowable is not good enough", () => {
  const { claims, ungrounded } = groundClaims([claim({ sourceSnippet: null })], DOC_TEXT);
  assert.equal(ungrounded, 1);
  assert.equal(claims[0].value, null);
  assert.equal(claims[0].validation, "ungrounded");
});

test("grounding tolerates whitespace/case/dash differences but not different text", () => {
  assert.equal(snippetIsGrounded("lead (pb):   12.4  MG/KG", DOC_TEXT), true);
  assert.equal(snippetIsGrounded("CR 13695‑1:2000", DOC_TEXT), true); // unicode dash
  assert.equal(snippetIsGrounded("Lead (Pb): 99.9 mg/kg", DOC_TEXT), false);
  assert.equal(normalizeForGrounding("  A  B "), "a b");
});

test("document metadata is not grounded — it never closes a checkpoint", () => {
  const meta = claim({ claimType: "signatory", parameter: "name", value: "A. Neral", sourceSnippet: "not in the doc" });
  assert.equal(isVerdictDriving(meta), false);
  const { claims, ungrounded } = groundClaims([meta], DOC_TEXT);
  assert.equal(ungrounded, 0, "metadata is exempt, so it costs nothing to check");
  assert.equal(claims[0].value, "A. Neral");
});

// --- two-pass agreement (image-only) ----------------------------------------

test("values both passes agree on proceed", () => {
  const { claims, disagreements } = reconcilePasses([claim()], [claim()]);
  assert.equal(disagreements, 0);
  assert.equal(claims[0].value, "12.4");
});

test("values the two passes read differently are nulled with pass_disagreement", () => {
  const { claims, disagreements } = reconcilePasses([claim({ value: "25" })], [claim({ value: "55" })]);
  assert.equal(disagreements, 1);
  assert.equal(claims[0].value, null, "a disputed value must NOT be stored");
  assert.equal(claims[0].rejectedValue, "25");
  assert.equal(claims[0].validation, "pass_disagreement");
});

test("a field the second pass did not see at all counts as disagreement", () => {
  const { claims, disagreements } = reconcilePasses([claim()], []);
  assert.equal(disagreements, 1);
  assert.equal(claims[0].value, null);
});

test("agreement is on the field, not on ordering", () => {
  const a = [claim({ parameter: "Pb", value: "12.4" }), claim({ parameter: "Cd", value: "0.8" })];
  const b = [claim({ parameter: "Cd", value: "0.8" }), claim({ parameter: "Pb", value: "12.4" })];
  const { disagreements } = reconcilePasses(a, b);
  assert.equal(disagreements, 0);
});

test("metadata is not cross-checked across passes", () => {
  const m1 = claim({ claimType: "document_reference", parameter: "ref", value: "SYN/1" });
  const m2 = claim({ claimType: "document_reference", parameter: "ref", value: "SYN/2" });
  const { claims, disagreements } = reconcilePasses([m1], [m2]);
  assert.equal(disagreements, 0);
  assert.equal(claims[0].value, "SYN/1");
});
