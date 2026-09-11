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

// --- Commit 6: retry-on-empty (offline, fake provider) ----------------------

import { extractWithSafeguards, DROPOUT_CLAIM_FLOOR } from "../src/lib/extraction/safeguards.ts";
import type { ExtractionProvider, ExtractionResult } from "../src/lib/extraction/types.ts";

function result(claims: number, tokens = 100): ExtractionResult {
  return {
    status: "succeeded", provider: "fake", model: "fake", promptVersion: "t",
    claims: Array.from({ length: claims }, (_, i) => claim({ parameter: `p${i}`, value: `${i}`, sourceSnippet: `p${i}` })),
    usage: { inputTokens: tokens, outputTokens: tokens }, latencyMs: 1,
  };
}
/** A provider that returns a scripted sequence of results, one per call. */
function scripted(...results: ExtractionResult[]): ExtractionProvider & { calls: number } {
  let i = 0;
  return {
    name: "fake", model: "fake", calls: 0,
    async extract() { this.calls = ++i; return results[Math.min(i - 1, results.length - 1)]; },
  } as ExtractionProvider & { calls: number };
}
const pdf = { docClass: "mill_declaration" as const, bytes: new Uint8Array([1]), contentType: "application/pdf" as const, scanned: false };

const withText = (text: string) => ({ readTextLayer: async () => text });

test("a near-empty read of a text-layer document is retried once and recovers", async () => {
  const provider = scripted(result(0), result(5));
  const out = await extractWithSafeguards(provider, pdf, withText("p0 p1 p2 p3 p4 ".repeat(40)));
  assert.equal(provider.calls, 2, "the dropout must trigger exactly one retry");
  assert.equal(out.safeguards.extraCalls, 1);
  assert.deepEqual(out.safeguards.dropoutRetry, { claimsBefore: 0, claimsAfter: 5, recovered: true });
  assert.equal(out.claims.length, 5, "the better read is kept");
  // Both calls are paid for, even though one result was discarded.
  assert.equal(out.usage.inputTokens, 200);
});

test("a healthy read is never retried — the retry costs nothing on the happy path", async () => {
  const provider = scripted(result(DROPOUT_CLAIM_FLOOR));
  const out = await extractWithSafeguards(provider, pdf, withText("p0 p1 p2 p3 p4 ".repeat(40)));
  assert.equal(provider.calls, 1);
  assert.equal(out.safeguards.extraCalls, 0);
  assert.equal(out.safeguards.dropoutRetry, undefined);
});

test("a retry that also drops out keeps the original and is still charged", async () => {
  const provider = scripted(result(2), result(0));
  const out = await extractWithSafeguards(provider, pdf, withText("p0 p1 p2 ".repeat(40)));
  assert.equal(out.claims.length, 2, "the original (better) read is kept");
  assert.equal(out.safeguards.dropoutRetry?.recovered, false);
  assert.equal(out.usage.inputTokens, 200, "the discarded retry is still paid for");
});

// --- Commit 7: majority tiebreak --------------------------------------------

import { reconcileMajority } from "../src/lib/extraction/safeguards.ts";

const img = { docClass: "mill_declaration" as const, bytes: new Uint8Array([1]), contentType: "image/jpeg" as const, scanned: true };
const noText = { readTextLayer: async () => null };

test("2-of-3 agreement carries the value", () => {
  const a = [claim({ value: "55" })], b = [claim({ value: "25" })], c = [claim({ value: "55" })];
  const out = reconcileMajority([a, b, c]);
  assert.equal(out.claims[0].value, "55");
  assert.equal(out.resolved, 1);
  assert.equal(out.split, 0);
});

test("the majority reading wins even when the first pass was the odd one out", () => {
  const a = [claim({ value: "25" })], b = [claim({ value: "55" })], c = [claim({ value: "55" })];
  const out = reconcileMajority([a, b, c]);
  assert.equal(out.claims[0].value, "55", "adopts the majority, not pass 1");
});

test("a genuine three-way split is still withheld", () => {
  const a = [claim({ value: "25" })], b = [claim({ value: "55" })], c = [claim({ value: "95" })];
  const out = reconcileMajority([a, b, c]);
  assert.equal(out.claims[0].value, null);
  assert.equal(out.claims[0].validation, "pass_disagreement");
  assert.equal(out.split, 1);
});

test("a third pass is only paid for when the first two disagree", async () => {
  const agree = scripted(result(3), result(3));
  const outAgree = await extractWithSafeguards(agree, img, noText);
  assert.equal(agree.calls, 2, "agreement must not buy a third opinion");
  assert.equal(outAgree.safeguards.extraCalls, 1);

  // Disagreeing values on a verdict-driving field → third pass.
  const r1: ExtractionResult = { ...result(1), claims: [claim({ value: "25" })] };
  const r2: ExtractionResult = { ...result(1), claims: [claim({ value: "55" })] };
  const r3: ExtractionResult = { ...result(1), claims: [claim({ value: "55" })] };
  const disagree = scripted(r1, r2, r3);
  const out = await extractWithSafeguards(disagree, img, noText);
  assert.equal(disagree.calls, 3);
  assert.equal(out.safeguards.extraCalls, 2);
  assert.equal(out.claims[0].value, "55", "rescued by 2-of-3");
  assert.equal(out.safeguards.majorityResolved, 1);
  assert.equal(out.safeguards.passDisagreement, 0);
});

test("metadata is never voted on", () => {
  const m = (v: string) => [claim({ claimType: "document_reference", parameter: "ref", value: v })];
  const out = reconcileMajority([m("A"), m("B"), m("C")]);
  assert.equal(out.claims[0].value, "A");
  assert.equal(out.split, 0);
});
