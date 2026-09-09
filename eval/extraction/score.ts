import type { ExtractedClaimDraft, ExtractionResult } from "../../src/lib/extraction/types.ts";
import type { ManifestDoc, ExpectedClaim } from "./manifest.ts";
import { deriveFlags, detectSilentErrors, type SilentError } from "./flags.ts";
import { strictMatch, canonicalMatch, normText, type MatchKind } from "./canonical.ts";

// Per-model pricing (USD per 1M tokens), verified against the current Claude API
// reference (see prompts/README.md). Used only to report cost/doc on the harness.
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-opus-5": { in: 5, out: 25 },
};

// Does any claim look like it is ABOUT the same field as `expected` (parameter /
// claim-type overlap), regardless of value? Used to separate a wrong value
// (aligned claim exists) from an abstention (no claim about the field at all).
function hasAlignedClaim(expected: ExpectedClaim, claims: ExtractedClaimDraft[]): boolean {
  const toks = normText(String(expected.parameter ?? "")).split(" ").filter((t) => t.length >= 4);
  if (toks.length === 0) return claims.length > 0; // no parameter to align on → any claim counts
  for (const c of claims) {
    const hay = normText([c.parameter, c.claimType, c.value, c.scopeText, c.testMethod].filter(Boolean).join(" "));
    if (toks.some((t) => hay.includes(t))) return true;
  }
  return false;
}

export type FieldClass = "match" | "b_comparison" | "a_model_wrong" | "c_abstained";
export interface FieldRecord {
  parameter: string;
  expected: string;
  strict: boolean;
  canonical: boolean;
  kind: MatchKind | null; // which canonical rule recovered it, if any
  classification: FieldClass;
}

/** Expected claims the model is EXPECTED to extract: a present, visible value. An
 *  obscured field or a deliberately-absent value is NOT scored for field accuracy. */
function extractableClaims(doc: ManifestDoc): ExpectedClaim[] {
  return doc.expected_claims.filter((c) => c.value != null && c.visibility !== "obscured" && c.presence !== "absent");
}

export interface DocScore {
  file: string;
  class: string;
  tier: string;
  status: ExtractionResult["status"];
  usable: boolean;
  fieldTotal: number;
  fieldMatched: number; // canonical (the corrected metric — Part 2)
  fieldMatchedStrict: number; // exact-only baseline
  fields: FieldRecord[]; // per-field detail for error analysis (Part 1)
  expectedFlags: string[];
  derivedFlags: string[];
  falsePositiveFlags: string[]; // derived − expected, per doc (the 20 sonnet FPs)
  flagExactMatch: boolean;
  silentErrors: SilentError[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Per-field legibility self-reports and post-validator rejections (Part 3a). */
  legibility: { clear: number; partially_obscured: number; illegible: number; unreported: number };
  typeMismatches: number;
  rawClaims: ExtractedClaimDraft[]; // persisted so Part 2 can re-score offline
}

export function scoreDoc(doc: ManifestDoc, result: ExtractionResult): DocScore {
  const claims = result.claims;
  const expected = extractableClaims(doc);

  const fields: FieldRecord[] = expected.map((e) => {
    const strict = strictMatch(e, claims);
    const kind = strict ? null : canonicalMatch(e, claims);
    const canonical = strict || kind != null;
    let classification: FieldClass;
    if (strict) classification = "match";
    else if (canonical) classification = "b_comparison";
    else if (hasAlignedClaim(e, claims)) classification = "a_model_wrong";
    else classification = "c_abstained";
    return { parameter: String(e.parameter ?? ""), expected: String(e.value ?? ""), strict, canonical, kind, classification };
  });
  const fieldMatchedStrict = fields.filter((f) => f.strict).length;
  const fieldMatched = fields.filter((f) => f.canonical).length;

  const { flags } = deriveFlags(doc, claims, doc.requested_scope);
  const derived = [...flags].sort();
  const expectedFlags = [...doc.expected_flags].sort();
  const expSet = new Set(expectedFlags);
  const falsePositiveFlags = derived.filter((f) => !expSet.has(f));
  const flagExactMatch = derived.join("|") === expectedFlags.join("|");
  const silentErrors = detectSilentErrors(doc, claims, flags);

  const legibility = { clear: 0, partially_obscured: 0, illegible: 0, unreported: 0 };
  for (const c of claims) {
    if (c.legibility === "clear") legibility.clear++;
    else if (c.legibility === "partially_obscured") legibility.partially_obscured++;
    else if (c.legibility === "illegible") legibility.illegible++;
    else legibility.unreported++;
  }
  const typeMismatches = claims.filter((c) => c.validation === "type_mismatch").length;

  return {
    file: doc.file,
    class: doc.class,
    tier: doc.tier,
    status: result.status,
    usable: result.status === "succeeded" && claims.length > 0,
    fieldTotal: expected.length,
    fieldMatched,
    fieldMatchedStrict,
    fields,
    expectedFlags,
    derivedFlags: derived,
    falsePositiveFlags,
    flagExactMatch,
    silentErrors,
    latencyMs: result.latencyMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    legibility,
    typeMismatches,
    rawClaims: claims,
  };
}

export interface TierAccuracy {
  total: number;
  matched: number; // canonical
  matchedStrict: number;
}

export interface ModelReport {
  model: string;
  docs: number;
  fieldAccuracy: number; // canonical matched / total (the corrected metric)
  fieldAccuracyStrict: number; // exact-only baseline
  byTier: Record<string, TierAccuracy>;
  flagExactRate: number; // docs whose derived flag-set exactly equals expected
  flagTP: number;
  flagFP: number;
  flagFN: number;
  silentErrorCount: number;
  silentErrors: SilentError[];
  /** Summed per-field legibility reports and post-validator rejections. */
  legibility: { clear: number; partially_obscured: number; illegible: number; unreported: number };
  typeMismatches: number;
  refusals: number;
  usableRate: number;
  medianLatencyMs: number;
  costPerDocUsd: number;
  totalCostUsd: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function aggregate(model: string, scores: DocScore[]): ModelReport {
  const fieldTotal = scores.reduce((a, s) => a + s.fieldTotal, 0);
  const fieldMatched = scores.reduce((a, s) => a + s.fieldMatched, 0);
  const fieldMatchedStrict = scores.reduce((a, s) => a + s.fieldMatchedStrict, 0);
  const byTier: Record<string, TierAccuracy> = {};
  for (const s of scores) {
    const t = (byTier[s.tier] ??= { total: 0, matched: 0, matchedStrict: 0 });
    t.total += s.fieldTotal;
    t.matched += s.fieldMatched;
    t.matchedStrict += s.fieldMatchedStrict;
  }
  let tp = 0, fp = 0, fn = 0;
  for (const s of scores) {
    const exp = new Set(s.expectedFlags);
    const got = new Set(s.derivedFlags);
    for (const f of got) (exp.has(f) ? tp++ : fp++);
    for (const f of exp) if (!got.has(f)) fn++;
  }
  const silentErrors = scores.flatMap((s) => s.silentErrors);
  const pricing = PRICING[model] ?? { in: 0, out: 0 };
  const totalCost = scores.reduce((a, s) => a + (s.inputTokens * pricing.in + s.outputTokens * pricing.out) / 1e6, 0);
  return {
    model,
    docs: scores.length,
    fieldAccuracy: fieldTotal ? fieldMatched / fieldTotal : 0,
    fieldAccuracyStrict: fieldTotal ? fieldMatchedStrict / fieldTotal : 0,
    byTier,
    flagExactRate: scores.length ? scores.filter((s) => s.flagExactMatch).length / scores.length : 0,
    flagTP: tp,
    flagFP: fp,
    flagFN: fn,
    silentErrorCount: silentErrors.length,
    silentErrors,
    legibility: scores.reduce(
      (a, s2) => ({
        clear: a.clear + s2.legibility.clear,
        partially_obscured: a.partially_obscured + s2.legibility.partially_obscured,
        illegible: a.illegible + s2.legibility.illegible,
        unreported: a.unreported + s2.legibility.unreported,
      }),
      { clear: 0, partially_obscured: 0, illegible: 0, unreported: 0 },
    ),
    typeMismatches: scores.reduce((a, s2) => a + s2.typeMismatches, 0),
    refusals: scores.filter((s) => s.status === "refused").length,
    usableRate: scores.length ? scores.filter((s) => s.usable).length / scores.length : 0,
    medianLatencyMs: median(scores.map((s) => s.latencyMs)),
    costPerDocUsd: scores.length ? totalCost / scores.length : 0,
    totalCostUsd: totalCost,
  };
}
