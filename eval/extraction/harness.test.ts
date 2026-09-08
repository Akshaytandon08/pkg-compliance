// B1 — the extraction harness, DRY. This runs in `npm run check`: it validates the
// manifest + every file's SHA-256 and exercises the deterministic matcher, but
// NEVER calls the model (the live run is `node --env-file=.env eval/extraction/run.ts`).
// Skips cleanly if the synthetic set is not present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadExtractionSet, validateHashes } from "./manifest.ts";
import { deriveFlags, detectSilentErrors, LOW_CONFIDENCE } from "./flags.ts";
import { scoreDoc } from "./score.ts";
import { DOC_CLASSES, type ExtractedClaimDraft } from "../../src/lib/extraction/types.ts";

const docs = loadExtractionSet();
const present = { skip: docs ? false : "synthetic extraction set not present" };

test("the synthetic set loads: 25 documents across the four provider doc classes", present, () => {
  assert.equal(docs!.length, 25, "20-doc dossier + 5-doc presswood supplement");
  for (const d of docs!) assert.ok(DOC_CLASSES.includes(d.class), `${d.file}: class ${d.class} must be a provider DocClass`);
});

test("every document's SHA-256 validates against the manifest (integrity gate)", present, () => {
  const res = validateHashes(docs!);
  assert.equal(res.ok, true, `hash mismatches: ${JSON.stringify(res.mismatches)} missing: ${res.missing.join(",")}`);
});

test("the matcher flags a scope mismatch even with a perfectly extracted (but wrong-scope) value", present, () => {
  // Document 20: requested "Corrugated Sheet 5-ply CS5-620" but the doc covers a
  // Kraft Liner — perfect printed-value extraction must still flag the mismatch.
  const doc20 = docs!.find((d) => d.file.startsWith("20"))!;
  const claims: ExtractedClaimDraft[] = [
    { claimType: "declaration_scope", value: "Kraft Liner KL175, 175 GSM", scopeText: "Kraft Liner KL175, 175 GSM", confidence: 0.98, provenance: { page: 1 } },
  ];
  const { flags } = deriveFlags(doc20, claims, doc20.requested_scope);
  assert.ok(flags.has("flag_scope_mismatch"), "requested-vs-document scope mismatch must be flagged");
});

test("a confident extraction of an OBSCURED field, unflagged, is a SILENT ERROR", present, () => {
  const obscured = docs!.find((d) => (d.obscured_fields ?? []).length > 0)!;
  const ob = obscured.obscured_fields![0];
  // The model guesses the authored value at high confidence and raises no flag.
  const claims: ExtractedClaimDraft[] = [
    { claimType: ob.parameter, parameter: ob.parameter, value: ob.authored_value ?? "999", confidence: 0.95, provenance: { page: ob.page } },
  ];
  const { flags } = deriveFlags(obscured, claims, obscured.requested_scope);
  const silent = detectSilentErrors(obscured, claims, flags);
  assert.ok(silent.some((e) => e.kind === "guessed_obscured_value"), "guessing an obscured value must be a silent error");

  // Abstaining (absent, or below-threshold) is CORRECT — no silent error.
  const abstained: ExtractedClaimDraft[] = [
    { claimType: ob.parameter, parameter: ob.parameter, value: null, confidence: LOW_CONFIDENCE - 0.3, provenance: { page: ob.page } },
  ];
  const d2 = deriveFlags(obscured, abstained, obscured.requested_scope);
  assert.ok(d2.flags.has("flag_low_confidence"), "abstention raises flag_low_confidence");
  assert.equal(detectSilentErrors(obscured, abstained, d2.flags).length, 0, "abstention is not a silent error");
});

test("scoreDoc counts only expected-to-extract fields (obscured/absent excluded)", present, () => {
  const doc = docs!.find((d) => d.tier === "A" && d.class === "supplier_declaration")!;
  const score = scoreDoc(doc, { status: "succeeded", provider: "anthropic", model: "dry", promptVersion: "1.0.0", claims: [], usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0 });
  assert.ok(score.fieldTotal > 0, "a clean Tier-A supplier doc has extractable fields");
  assert.equal(score.fieldMatched, 0, "no claims extracted → nothing matched");
});
