import type { ExtractedClaimDraft } from "../../src/lib/extraction/types.ts";
import type { ExpectedClaim } from "./manifest.ts";

// Canonicalised comparison for extraction field-accuracy (Part 2). It recovers
// class-(b) misses — the model read the RIGHT value but wrote it in a different
// surface form — WITHOUT ever letting a genuinely different value count as right.
// Every rule here is an equality-preserving normalisation or a whitelisted
// equivalence (unit, %, ISO date, punctuation/case, issuer alias). There is
// deliberately NO substring/subset rule: "Grade A" must not match "Grade B".

// ---- text ----------------------------------------------------------------
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s._/\\|,;:()\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Issuer / lab aliases: each row is one entity written several ways. Matching is
// by normalised equality against any variant in the same row. Kept small and
// explicit — a real alias table grows from the product owner's document set.
const ALIAS_ROWS: string[][] = [
  ["sgs", "sgs sa", "sgs group", "societe generale de surveillance"],
  ["intertek", "intertek testing services", "intertek group"],
  ["tuv", "tuv rheinland", "tuev rheinland", "tuv rheinland group"],
  ["bureau veritas", "bureau veritas sa", "bv"],
  ["eurofins", "eurofins scientific"],
];
function aliasEqual(a: string, b: string): boolean {
  const na = normText(a);
  const nb = normText(b);
  if (na === nb) return true;
  for (const row of ALIAS_ROWS) {
    const set = new Set(row.map(normText));
    if (set.has(na) && set.has(nb)) return true;
  }
  return false;
}

// ---- dates ---------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
/** Parse a date in ISO, D/M/Y, D Month Y, or Month D, Y form → "YYYY-MM-DD", else null. */
export function canonDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); // D/M/Y (day-first; the set is EU-form)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/); // 1 March 2026
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/); // March 1, 2026
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

// ---- numbers + units -----------------------------------------------------
// Unit classes we treat as interchangeable. mg/kg ≡ ppm (mass fraction, 1:1).
// Percent is its own class (we do NOT auto-convert % ↔ ppm — too error-prone).
const MASSFRAC = new Set(["ppm", "mg/kg", "mgkg", "mg kg", "mkg"]);
const PERCENT = new Set(["%", "percent", "pct", "percentage"]);
function unitClass(u: string | null | undefined): "massfrac" | "percent" | "none" | "other" {
  if (!u) return "none";
  const n = u.toLowerCase().replace(/\s+/g, "");
  if (MASSFRAC.has(n) || n === "mg/kg") return "massfrac";
  if (PERCENT.has(n) || n === "%") return "percent";
  return "other";
}
// A value is "numeric-form" only when it is WHOLLY a number with an optional unit
// (e.g. "50", "50 mg/kg", "30%") — not a code that merely contains digits
// ("EN 71-3", "LOT-2026-3"). This gate keeps the number rule from treating a
// standard designation as its embedded integer (so EN 71-3 ≠ EN 71-1).
function isNumericForm(s: string): boolean {
  return /^-?\d[\d,]*(?:\.\d+)?\s*(?:%|[a-zA-Zµ]+(?:\/[a-zA-Z]+)?)?$/.test(s.trim());
}
/** Pull the number and optional trailing unit from a numeric-form string. */
function parseNumUnit(s: string): { num: number; unit: string } | null {
  if (!isNumericForm(s)) return null;
  const m = s.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*(%|[a-zA-Zµ]+(?:\/[a-zA-Z]+)?)?$/);
  if (!m) return null;
  return { num: Number(m[1]), unit: (m[2] ?? "").trim() };
}
function numUnitEqual(expVal: string, expUnit: string | null, got: string): boolean {
  const e = parseNumUnit(expVal);
  const g = parseNumUnit(got);
  if (!e || !g) return false;
  if (Math.abs(e.num - g.num) > 1e-6) return false; // SAME number required — never loosened
  // Resolve each side's unit class, preferring the explicit expected unit field.
  const ec = unitClass(expUnit) !== "none" ? unitClass(expUnit) : unitClass(e.unit);
  const gc = unitClass(g.unit);
  if (ec === "none" || gc === "none") return true; // one side unitless → number identity is enough
  if (ec === "other" || gc === "other") return ec === gc || e.unit.toLowerCase() === g.unit.toLowerCase();
  return ec === gc; // massfrac↔massfrac (mg/kg≡ppm) or percent↔percent
}

// ---- one field ------------------------------------------------------------
/** All string fields a claim exposes a value through. */
function claimValues(c: ExtractedClaimDraft): string[] {
  return [c.value, c.scopeText, c.testMethod, c.issuer, c.parameter].filter(Boolean) as string[];
}

// Strict baseline matcher: exact normalised-string equality OR exact numeric
// equality (number identity, unit ignored). No unit/%/date/alias equivalences and
// — deliberately — NO substring/subset rule. This is the conservative floor; the
// class-(b) recovery is exactly canonicalMatch − strictMatch.
export function strictMatch(expected: ExpectedClaim, claims: ExtractedClaimDraft[]): boolean {
  const expStr = String(expected.value ?? "").trim();
  if (!expStr) return false;
  const expNorm = normText(expStr);
  const expNum = expStr.replace(/,/g, "").match(/^-?\d+(?:\.\d+)?$/) ? Number(expStr.replace(/,/g, "")) : null;
  for (const c of claims) {
    for (const raw of claimValues(c)) {
      if (normText(raw) === expNorm) return true;
      if (expNum != null) {
        const g = raw.replace(/,/g, "").match(/^-?\d+(?:\.\d+)?$/);
        if (g && Math.abs(Number(g[0]) - expNum) < 1e-6) return true;
      }
    }
  }
  return false;
}

export type MatchKind = "date" | "number" | "alias" | "text";

/** Does `expected` match any of `claims` under canonicalisation? Returns the rule
 *  that fired (for reporting) or null. Equality-preserving only. */
export function canonicalMatch(expected: ExpectedClaim, claims: ExtractedClaimDraft[]): MatchKind | null {
  const expStr = String(expected.value ?? "").trim();
  if (!expStr) return null;
  const expDate = canonDate(expStr);
  const expNum = parseNumUnit(expStr);
  const expNorm = normText(expStr);

  for (const c of claims) {
    for (const raw of claimValues(c)) {
      // date equivalence
      if (expDate) {
        const gd = canonDate(raw.trim());
        if (gd && gd === expDate) return "date";
      }
      // number + unit equivalence (mg/kg≡ppm, % forms, punctuation)
      if (expNum && numUnitEqual(expStr, expected.unit, raw)) return "number";
      // issuer / lab alias (only meaningful for the issuer-ish fields, but safe
      // to test generally since it requires whole-string normalised equality)
      if (expected.issuer && aliasEqual(expStr, raw)) return "alias";
      // case / whitespace / punctuation-insensitive whole-string equality
      if (expNorm.length > 0 && normText(raw) === expNorm) return "text";
    }
  }
  return null;
}
