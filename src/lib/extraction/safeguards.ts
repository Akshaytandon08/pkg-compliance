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

export interface SafeguardCounts {
  /** Verdict-driving values rejected because their quoted span is not in the document. */
  ungrounded: number;
  /** Verdict-driving values rejected because two independent passes disagreed. */
  passDisagreement: number;
  /** Which safeguard ran: grounding (text layer) or two-pass (image-only). */
  mode: "grounding" | "two_pass" | "none";
  /** Extra API calls this document cost beyond one. */
  extraCalls: number;
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
): Promise<SafeguardedResult> {
  const textLayer = await extractTextLayer(input.bytes, input.contentType);
  const first = await provider.extract(input);

  if (first.status !== "succeeded") {
    return { ...first, safeguards: { ungrounded: 0, passDisagreement: 0, mode: "none", extraCalls: 0 } };
  }

  if (textLayer) {
    const { claims, ungrounded } = groundClaims(first.claims, textLayer);
    return { ...first, claims, safeguards: { ungrounded, passDisagreement: 0, mode: "grounding", extraCalls: 0 } };
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
  const { claims, disagreements } = reconcilePasses(first.claims, second.claims);
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
