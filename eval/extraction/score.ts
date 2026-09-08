import type { ExtractedClaimDraft, ExtractionResult } from "../../src/lib/extraction/types.ts";
import type { ManifestDoc, ExpectedClaim } from "./manifest.ts";
import { deriveFlags, detectSilentErrors, type SilentError } from "./flags.ts";

// Per-model pricing (USD per 1M tokens), verified against the current Claude API
// reference (see prompts/README.md). Used only to report cost/doc on the harness.
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-opus-5": { in: 5, out: 25 },
};

function normNum(s: string): number | null {
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function valueMatches(expected: string, claims: ExtractedClaimDraft[]): boolean {
  const exp = expected.toLowerCase().trim();
  const expNum = normNum(exp);
  for (const c of claims) {
    for (const v of [c.value, c.scopeText, c.testMethod, c.issuer].filter(Boolean) as string[]) {
      const got = v.toLowerCase().trim();
      if (expNum != null) {
        const gotNum = normNum(got);
        if (gotNum != null && Math.abs(gotNum - expNum) < 1e-6) return true;
      }
      if (got === exp) return true;
      // token-subset match for descriptive strings (grade/scope names)
      const expToks = exp.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      if (expToks.length > 0 && expToks.every((t) => got.includes(t))) return true;
    }
  }
  return false;
}

/** Expected claims the model is EXPECTED to extract: a present, visible value. An
 *  obscured field or a deliberately-absent value is NOT scored for field accuracy. */
function extractableClaims(doc: ManifestDoc): ExpectedClaim[] {
  return doc.expected_claims.filter((c) => c.value != null && c.visibility !== "obscured" && c.presence !== "absent");
}

export interface DocScore {
  file: string;
  tier: string;
  status: ExtractionResult["status"];
  usable: boolean;
  fieldTotal: number;
  fieldMatched: number;
  expectedFlags: string[];
  derivedFlags: string[];
  flagExactMatch: boolean;
  silentErrors: SilentError[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export function scoreDoc(doc: ManifestDoc, result: ExtractionResult): DocScore {
  const claims = result.claims;
  const expected = extractableClaims(doc);
  const fieldMatched = expected.filter((e) => valueMatches(String(e.value), claims)).length;

  const { flags } = deriveFlags(doc, claims, doc.requested_scope);
  const derived = [...flags].sort();
  const expectedFlags = [...doc.expected_flags].sort();
  const flagExactMatch = derived.join("|") === expectedFlags.join("|");
  const silentErrors = detectSilentErrors(doc, claims, flags);

  return {
    file: doc.file,
    tier: doc.tier,
    status: result.status,
    usable: result.status === "succeeded" && claims.length > 0,
    fieldTotal: expected.length,
    fieldMatched,
    expectedFlags,
    derivedFlags: derived,
    flagExactMatch,
    silentErrors,
    latencyMs: result.latencyMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}

export interface ModelReport {
  model: string;
  docs: number;
  fieldAccuracy: number; // matched / total over extractable fields
  flagExactRate: number; // docs whose derived flag-set exactly equals expected
  flagTP: number;
  flagFP: number;
  flagFN: number;
  silentErrorCount: number;
  silentErrors: SilentError[];
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
    flagExactRate: scores.length ? scores.filter((s) => s.flagExactMatch).length / scores.length : 0,
    flagTP: tp,
    flagFP: fp,
    flagFN: fn,
    silentErrorCount: silentErrors.length,
    silentErrors,
    refusals: scores.filter((s) => s.status === "refused").length,
    usableRate: scores.length ? scores.filter((s) => s.usable).length / scores.length : 0,
    medianLatencyMs: median(scores.map((s) => s.latencyMs)),
    costPerDocUsd: scores.length ? totalCost / scores.length : 0,
    totalCostUsd: totalCost,
  };
}
