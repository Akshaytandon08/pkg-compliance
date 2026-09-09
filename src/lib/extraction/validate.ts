import type { ExtractedClaimDraft } from "./types.ts";

// Deterministic post-validation of model-proposed claims (Part 3a). The LLM
// EXTRACTS; this layer decides whether what it produced is even the right SHAPE
// for the field. A value of the wrong type — the canonical observed failure was
// `heavy_metals_sum` = "CR 13695-1:2000", a method string where a number belongs —
// is rejected as `type_mismatch`: the value is nulled, the offending text kept in
// `rejectedValue` for a reviewer, and the claim carries a verdict the flag layer
// turns into a visible flag. A rejected value is NEVER stored as a value, so it
// cannot become a silent wrong answer.

/** Parameter/claim shapes whose value must be numeric (a measurement or limit). */
const NUMERIC_PARAMETER = /(^|_)(sum|total|aggregate|content|share|percentage|pct|limit|quantity|temperature|duration|solids|weight|mass|thickness|gsm|grammage|load|length|width|height|capacity|count|value)($|_)/i;
const NUMERIC_CLAIM_TYPE = /^(measured_parameter|stated_limit|recycled_content|virgin_fibre_share)$/i;

/** Does this claim's field require a numeric value? */
export function expectsNumericValue(c: ExtractedClaimDraft): boolean {
  if (NUMERIC_CLAIM_TYPE.test(c.claimType)) return true;
  return NUMERIC_PARAMETER.test(c.parameter ?? "");
}

// Numeric-ish: an optional comparator/approximation, then a digit. Accepts
// "12.4", "<0.5", "≤ 0.1", "30%", "50 mg/kg", "1,200". Rejects "CR 13695-1:2000",
// "not detected", "see annex" — anything that does not START with a number.
const NUMERIC_VALUE = /^[<>≤≥~±]?\s*-?\d/;
export function isNumericValue(v: string): boolean {
  return NUMERIC_VALUE.test(v.trim());
}

/**
 * Validate one claim. Returns the claim unchanged when it is fine, or a copy with
 * the value rejected. Pure — no I/O, so it is trivially testable and runs
 * identically in the harness and in production.
 */
export function validateClaim(c: ExtractedClaimDraft): ExtractedClaimDraft {
  // A field the model reported as not fully legible must carry no value. If it
  // does anyway, drop the value: the legibility self-report wins over the guess.
  if (c.legibility && c.legibility !== "clear" && c.value != null) {
    return { ...c, value: null, rejectedValue: c.value, validation: "type_mismatch" };
  }
  if (c.value != null && expectsNumericValue(c) && !isNumericValue(c.value)) {
    return { ...c, value: null, rejectedValue: c.value, validation: "type_mismatch" };
  }
  return c.validation ? c : { ...c, validation: "ok" };
}

export function validateClaims(claims: ExtractedClaimDraft[]): ExtractedClaimDraft[] {
  return claims.map(validateClaim);
}
