import { EVIDENCE_TYPE_BY_CLAIM } from "./matching.ts";
import { extractTextLayer, snippetIsGrounded } from "./text-layer.ts";
import type {
  ExtractedClaimDraft,
  ExtractionInput,
  ExtractionProvider,
  ExtractionResult,
} from "./types.ts";

// Two safeguards against a SILENT ERROR — a wrong value that reaches a verdict
// with nothing to warn a reviewer. Each applies to exactly the documents it can
// help, which is also what keeps the cost down:
//
//   text-layer documents → VERBATIM GROUNDING. The model must quote the span it
//     read the value from; if that quote is not in the document's own text, the
//     value is not in the document, and it is rejected. Free (no extra call).
//
//   image-only documents → TWO-PASS AGREEMENT. There is no text to check
//     against, so the document is read twice and only values both passes agree
//     on survive. Costs a second call, so it is never used on text-layer docs.
//
// A rejected value is nulled and flagged, never stored — the whole point is that
// a wrong value must be visible as wrong rather than quietly become evidence.

/** A claim that can actually move a verdict. Document metadata (signatory,
 *  reference numbers, dates of issue) is not grounded or cross-checked: it never
 *  closes a checkpoint, and holding it to the same bar would cost calls for no
 *  safety gain. */
export function isVerdictDriving(c: ExtractedClaimDraft): boolean {
  return Object.hasOwn(EVIDENCE_TYPE_BY_CLAIM, c.claimType);
}

/** Identity of the field a claim is about, for cross-pass comparison. */
function fieldKey(c: ExtractedClaimDraft): string {
  return `${c.claimType}::${(c.parameter ?? "").toLowerCase().trim()}`;
}

function sameValue(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const nb = (b ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return na === nb;
}

/** A text-layer document that returns almost nothing has dropped out: the model
 *  answered "succeeded" with an empty or near-empty claim set even though the
 *  document demonstrably has text. Observed on tiers A/B at 0-2 claims where a
 *  healthy read gives ~19. Below this many claims we retry once. */
export const DROPOUT_CLAIM_FLOOR = 3;

export interface SafeguardCounts {
  /** Verdict-driving values rejected because their quoted span is not in the document. */
  ungrounded: number;
  /** Verdict-driving values rejected because two independent passes disagreed. */
  passDisagreement: number;
  /** Which safeguard ran: grounding (text layer) or two-pass (image-only). */
  mode: "grounding" | "two_pass" | "none";
  /** Extra API calls this document cost beyond one. */
  extraCalls: number;
  /** Set when a near-empty text-layer read was retried (Commit 6). */
  dropoutRetry?: { claimsBefore: number; claimsAfter: number; recovered: boolean };
  /** Values a third pass settled by 2-of-3 majority (Commit 7). */
  majorityResolved?: number;
}

/** Reject any verdict-driving value whose quoted snippet is absent from the text. */
export function groundClaims(
  claims: ExtractedClaimDraft[],
  textLayer: string,
): { claims: ExtractedClaimDraft[]; ungrounded: number } {
  let ungrounded = 0;
  const out = claims.map((c) => {
    if (c.value == null || !isVerdictDriving(c)) return c;
    const snippet = c.sourceSnippet ?? "";
    // No snippet at all, or a snippet that is not in the document, means the
    // value is not verifiably read FROM the document. Reject either way —
    // "I could not show you where this came from" is not good enough for a
    // value that can move a verdict.
    if (snippet.trim().length === 0 || !snippetIsGrounded(snippet, textLayer)) {
      ungrounded++;
      return { ...c, value: null, rejectedValue: c.value, validation: "ungrounded" as const };
    }
    return c;
  });
  return { claims: out, ungrounded };
}

/** Keep only verdict-driving values that BOTH passes read the same way. */
export function reconcilePasses(
  first: ExtractedClaimDraft[],
  second: ExtractedClaimDraft[],
): { claims: ExtractedClaimDraft[]; disagreements: number } {
  const secondByField = new Map<string, ExtractedClaimDraft>();
  for (const c of second) secondByField.set(fieldKey(c), c);

  let disagreements = 0;
  const claims = first.map((c) => {
    if (c.value == null || !isVerdictDriving(c)) return c;
    const other = secondByField.get(fieldKey(c));
    // Absent in the second pass is a disagreement too: one read produced a value
    // the other did not see at all.
    if (!other || !sameValue(c.value, other.value)) {
      disagreements++;
      return { ...c, value: null, rejectedValue: c.value, validation: "pass_disagreement" as const };
    }
    return c;
  });
  return { claims, disagreements };
}

/**
 * Majority vote across N reads of the same document (Commit 7). Two passes can
 * only ever say "these disagree" — which is safe but throws away a value even
 * when one read was simply wrong and the other two agree. A third pass turns the
 * common case into a decision: 2-of-3 carries, and only a genuine three-way
 * split is withheld.
 *
 * Structure follows the first pass; only verdict-driving values are voted on.
 */
export function reconcileMajority(passes: ExtractedClaimDraft[][]): {
  claims: ExtractedClaimDraft[];
  resolved: number;
  split: number;
} {
  const byField = passes.map((p) => {
    const m = new Map<string, ExtractedClaimDraft>();
    for (const c of p) m.set(fieldKey(c), c);
    return m;
  });
  let resolved = 0;
  let split = 0;
  const claims = passes[0].map((c) => {
    if (c.value == null || !isVerdictDriving(c)) return c;
    const key = fieldKey(c);
    // Tally normalised values, remembering one original spelling for each.
    const tally = new Map<string, { count: number; original: string }>();
    for (const m of byField) {
      const v = m.get(key)?.value;
      if (v == null) continue;
      const norm = v.toLowerCase().replace(/\s+/g, " ").trim();
      const entry = tally.get(norm) ?? { count: 0, original: v };
      entry.count++;
      tally.set(norm, entry);
    }
    let best: { count: number; original: string } | undefined;
    for (const e of tally.values()) if (!best || e.count > best.count) best = e;
    if (best && best.count >= 2) {
      resolved++;
      // Adopt the majority reading, which may not be this pass's own.
      return best.original === c.value ? c : { ...c, value: best.original };
    }
    split++;
    return { ...c, value: null, rejectedValue: c.value, validation: "pass_disagreement" as const };
  });
  return { claims, resolved, split };
}

export interface SafeguardedResult extends ExtractionResult {
  safeguards: SafeguardCounts;
}

/**
 * Extract with the safeguard appropriate to the document. This is the entry
 * point the pipeline and the harness should both use — the provider itself stays
 * a thin adapter.
 */
export async function extractWithSafeguards(
  provider: ExtractionProvider,
  input: ExtractionInput,
  /** Injected for tests: the real text-layer reader needs a real PDF, and the
   *  branch it selects is the whole point of this function. */
  deps: { readTextLayer?: typeof extractTextLayer } = {},
): Promise<SafeguardedResult> {
  const readTextLayer = deps.readTextLayer ?? extractTextLayer;
  const textLayer = await readTextLayer(input.bytes, input.contentType);
  const first = await provider.extract(input);

  if (first.status !== "succeeded") {
    return { ...first, safeguards: { ungrounded: 0, passDisagreement: 0, mode: "none", extraCalls: 0 } };
  }

  if (textLayer) {
    // RETRY-ON-EMPTY (Commit 6). A document with a real text layer that comes
    // back with almost no claims has dropped out, not been read. Retrying is
    // cheap because it fires only on failure — the healthy path costs nothing —
    // and it targets the actual cause of the mill_declaration instability, which
    // two-pass could never reach (two-pass is image-only).
    let chosen = first;
    let dropoutRetry: SafeguardCounts["dropoutRetry"];
    let extraCalls = 0;
    // Tokens spent across every call made for this document. A retry costs money
    // even when its result is discarded, so it is always counted — understating
    // spend would quietly defeat the budget ceiling.
    const usage = { inputTokens: first.usage.inputTokens, outputTokens: first.usage.outputTokens };
    if (first.claims.length < DROPOUT_CLAIM_FLOOR) {
      const retry = await provider.extract(input);
      extraCalls = 1;
      usage.inputTokens += retry.usage.inputTokens;
      usage.outputTokens += retry.usage.outputTokens;
      const before = first.claims.length;
      const after = retry.status === "succeeded" ? retry.claims.length : 0;
      // Keep the better read. A retry that also drops out leaves the original.
      if (retry.status === "succeeded" && retry.claims.length > first.claims.length) chosen = retry;
      dropoutRetry = { claimsBefore: before, claimsAfter: after, recovered: after >= DROPOUT_CLAIM_FLOOR };
      console.warn(
        `DROPOUT_RETRY textLayerChars=${textLayer.length} claimsBefore=${before} claimsAfter=${after} recovered=${dropoutRetry.recovered}`,
      );
    }
    const { claims, ungrounded } = groundClaims(chosen.claims, textLayer);
    return {
      ...chosen,
      claims,
      usage,
      safeguards: { ungrounded, passDisagreement: 0, mode: "grounding", extraCalls, dropoutRetry },
    };
  }

  // Image-only: no text to ground against, so read it twice.
  const second = await provider.extract(input);
  if (second.status !== "succeeded") {
    // One usable pass only — we cannot cross-check, so every verdict-driving
    // value is unconfirmed. Reject rather than trust a single unverifiable read.
    const { claims, disagreements } = reconcilePasses(first.claims, []);
    return {
      ...first,
      claims,
      usage: {
        inputTokens: first.usage.inputTokens + second.usage.inputTokens,
        outputTokens: first.usage.outputTokens + second.usage.outputTokens,
      },
      latencyMs: first.latencyMs + second.latencyMs,
      safeguards: { ungrounded: 0, passDisagreement: disagreements, mode: "two_pass", extraCalls: 1 },
    };
  }
  // Two passes tell us WHETHER they disagree. Only if they do is a third pass
  // worth paying for — on a document both reads agree on it would buy nothing.
  const twoPass = reconcilePasses(first.claims, second.claims);
  const usage = {
    inputTokens: first.usage.inputTokens + second.usage.inputTokens,
    outputTokens: first.usage.outputTokens + second.usage.outputTokens,
  };
  if (twoPass.disagreements === 0) {
    return {
      ...first,
      claims: twoPass.claims,
      usage,
      latencyMs: first.latencyMs + second.latencyMs,
      safeguards: { ungrounded: 0, passDisagreement: 0, mode: "two_pass", extraCalls: 1, majorityResolved: 0 },
    };
  }

  const third = await provider.extract(input);
  usage.inputTokens += third.usage.inputTokens;
  usage.outputTokens += third.usage.outputTokens;
  if (third.status !== "succeeded") {
    // No third opinion available — fall back to withholding every disputed value.
    return {
      ...first,
      claims: twoPass.claims,
      usage,
      latencyMs: first.latencyMs + second.latencyMs + third.latencyMs,
      safeguards: { ungrounded: 0, passDisagreement: twoPass.disagreements, mode: "two_pass", extraCalls: 2, majorityResolved: 0 },
    };
  }
  const majority = reconcileMajority([first.claims, second.claims, third.claims]);
  return {
    ...first,
    claims: majority.claims,
    usage,
    latencyMs: first.latencyMs + second.latencyMs + third.latencyMs,
    safeguards: {
      ungrounded: 0,
      passDisagreement: majority.split,
      mode: "two_pass",
      extraCalls: 2,
      // Values a lone third read rescued from being withheld.
      majorityResolved: Math.max(0, twoPass.disagreements - majority.split),
    },
  };
}
