import type { ExtractedClaimDraft } from "../../src/lib/extraction/types.ts";
import type { ManifestDoc } from "./manifest.ts";

// Deterministic matcher/flag-derivation for the harness (B1). Given a document's
// extracted claims plus the EXTERNAL requested_scope, derive the set of flags the
// pipeline would raise, and detect SILENT ERRORS (a wrong/guessed value emitted
// with confidence and no flag). These are heuristics over the extraction output —
// the point is to measure a synthetic ceiling, not to be the production judge.

export const EVAL_DATE = "2026-09-08";
export const LOW_CONFIDENCE = 0.7;
// Heavy-metals reference method that is CORRECT for Reg (EU) 2025/40 Art 5(4).
const HEAVY_METAL_STANDARDS = ["EN 13695-1", "CR 13695-1"];

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens(s: string | null | undefined): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length >= 3));
}
function shareToken(a: string | null | undefined, b: string | null | undefined): boolean {
  const A = tokens(a);
  for (const t of tokens(b)) if (A.has(t)) return true;
  return false;
}

/** The claim (if any) the model treated as the document's scope/product. */
function extractedScope(claims: ExtractedClaimDraft[]): ExtractedClaimDraft | undefined {
  return claims.find((c) => /scope|grade|material|product|declaration_scope|sample/i.test(c.claimType) && c.value) ?? claims.find((c) => c.scopeText);
}

function heavyMetalClaims(claims: ExtractedClaimDraft[]): ExtractedClaimDraft[] {
  return claims.filter((c) => /metal|lead|cadmium|mercury|chrom|pb|cd|hg|sum|substance|parameter|limit/i.test(`${c.claimType} ${c.parameter ?? ""}`));
}

export interface DerivedFlags {
  flags: Set<string>;
  reasons: Record<string, string>;
}

export function deriveFlags(doc: ManifestDoc, claims: ExtractedClaimDraft[], requestedScope: string | null): DerivedFlags {
  const flags = new Set<string>();
  const reasons: Record<string, string> = {};
  const add = (f: string, why: string) => {
    flags.add(f);
    reasons[f] = why;
  };

  // flag_low_confidence — the model abstained or was unsure on an obscured field.
  for (const ob of doc.obscured_fields ?? []) {
    const hit = claims.find((c) => shareToken(c.parameter, ob.parameter) || shareToken(c.claimType, ob.parameter));
    if (!hit || hit.value == null || hit.confidence < LOW_CONFIDENCE) {
      add("flag_low_confidence", `abstained/low-confidence on obscured "${ob.parameter}"`);
    }
  }
  // Also raise it whenever ANY claim is below threshold (the pipeline surfaces it).
  if (!flags.has("flag_low_confidence") && claims.some((c) => c.confidence < LOW_CONFIDENCE)) {
    add("flag_low_confidence", "a claim was below the confidence threshold");
  }

  // flag_scope_mismatch — external requested scope vs the document's own scope.
  if (requestedScope) {
    const scope = extractedScope(claims);
    const docScope = scope?.value ?? scope?.scopeText ?? null;
    if (docScope && !shareToken(requestedScope, docScope)) {
      add("flag_scope_mismatch", `requested "${requestedScope}" ≠ document "${docScope}"`);
    }
  }

  // flag_expired — a validity date already past the evaluation date.
  for (const c of claims) {
    const d = c.expiry;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d < EVAL_DATE) {
      add("flag_expired", `validity ${d} is before ${EVAL_DATE}`);
      break;
    }
  }

  // flag_missing_sum — per-metal values present but no aggregate sum extracted.
  const hm = heavyMetalClaims(claims);
  const hasPerMetal = hm.some((c) => /lead|cadmium|mercury|chrom|pb|cd|hg/i.test(`${c.claimType} ${c.parameter ?? ""}`));
  const hasSum = hm.some((c) => /sum|aggregate|total/i.test(`${c.claimType} ${c.parameter ?? ""}`) && c.value != null);
  if (hasPerMetal && !hasSum) add("flag_missing_sum", "per-metal values present but no aggregate sum");

  // flag_wrong_standard — the cited heavy-metals method is not the correct one.
  for (const c of claims) {
    const method = `${c.testMethod ?? ""} ${c.value ?? ""}`;
    if (/13695|heavy metal|substance|art(icle)?\s*5/i.test(`${c.parameter ?? ""} ${c.claimType} ${method}`)) {
      const cited = c.testMethod ?? "";
      if (cited && !HEAVY_METAL_STANDARDS.some((s) => norm(cited).includes(norm(s)))) {
        add("flag_wrong_standard", `cited "${cited}" is not the heavy-metals reference method`);
      }
    }
  }

  // flag_unit_conversion — a heavy-metals value in % where the limit is mass-based.
  if (hm.some((c) => (c.unit ?? "").includes("%"))) {
    add("flag_unit_conversion", "a heavy-metals value is in % and needs conversion to mg/kg");
  }

  // flag_issuer — the issuer is not an authoritative source for the claim.
  for (const c of claims) {
    const t = norm(`${c.issuer ?? ""} ${c.parameter ?? ""}`);
    if (/trader|distributor|reseller|trading/.test(t)) {
      add("flag_issuer", "issuer appears to be a trader/distributor, not the manufacturer or lab");
      break;
    }
  }

  return { flags, reasons };
}

export interface SilentError {
  file: string;
  kind: string;
  detail: string;
}

// A SILENT ERROR is a wrong or guessed value emitted confidently with NO flag. The
// canonical case: an obscured Tier-C field extracted to (near) the authored value
// at high confidence — the model guessed instead of abstaining.
export function detectSilentErrors(doc: ManifestDoc, claims: ExtractedClaimDraft[], derived: Set<string>): SilentError[] {
  const out: SilentError[] = [];

  for (const ob of doc.obscured_fields ?? []) {
    const hit = claims.find((c) => shareToken(c.parameter, ob.parameter) || shareToken(c.claimType, ob.parameter));
    if (hit && hit.value != null && hit.confidence >= LOW_CONFIDENCE && !derived.has("flag_low_confidence")) {
      out.push({
        file: doc.file,
        kind: "guessed_obscured_value",
        detail: `extracted "${ob.parameter}" = "${hit.value}" at confidence ${hit.confidence} on an OBSCURED field, without flag_low_confidence` +
          (ob.authored_value ? ` (generator truth was "${ob.authored_value}")` : ""),
      });
    }
  }

  // Scope transfer: a scope_mismatch document whose extraction claims a value FOR
  // the requested (uncovered) scope, unflagged.
  if (doc.expected_flags.includes("flag_scope_mismatch") && !derived.has("flag_scope_mismatch")) {
    out.push({ file: doc.file, kind: "scope_transfer", detail: `document does not cover the requested scope "${doc.requested_scope}" but no flag_scope_mismatch was raised` });
  }

  // Fabricated sum: a missing-sum document where the extraction produced a sum value.
  if (doc.expected_flags.includes("flag_missing_sum") && !derived.has("flag_missing_sum")) {
    const sum = claims.find((c) => /sum|aggregate|total/i.test(`${c.claimType} ${c.parameter ?? ""}`) && c.value != null);
    if (sum) out.push({ file: doc.file, kind: "fabricated_sum", detail: `aggregate sum is absent in the source but extraction produced "${sum.value}"` });
  }

  return out;
}
