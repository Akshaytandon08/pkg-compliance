// Liability guardrail (docs/BRIEF.md §1). The rule is NOT "never say the words"
// — the corpus must state legal terminology precisely ("issue a Declaration of
// Conformity per Annex VIII" is a user obligation the report has to instruct)
// and questionnaire auto-fill must reference certifications the client holds.
// The rule is: this system must never present itself as the issuer, certifier
// or verifier. So we detect FIRST-PERSON ISSUING CLAIMS, plus a short list of
// phrases that have no legitimate use.

export type LanguageViolation = {
  match: string;
  rule: string;
};

// Phrases that are never acceptable regardless of speaker.
const ABSOLUTE_PHRASES: { pattern: RegExp; rule: string }[] = [
  {
    pattern: /audit[- ]grade/gi,
    rule: 'PCF is screening-grade; "audit-grade" is never permitted (§1)',
  },
  {
    pattern: /\bverified (?:pcf|carbon footprint|emissions)\b/gi,
    rule: 'PCF output must not be described as "verified" (§1)',
  },
];

// The system claiming to certify / declare / verify / warrant. Covers
// first-person ("we certify", "Fitsol certifies"), self-referential ("this
// report certifies", "this document declares"), and passive-by-us
// ("is hereby certified").
const ISSUING_CLAIMS: { pattern: RegExp; rule: string }[] = [
  {
    pattern:
      /\b(?:we|fitsol|this (?:report|document|page|passport|tool|system|platform|assessment))\s+(?:hereby\s+)?(?:certif(?:y|ies)|declares?|attests?|warrants?|guarantees?|confirms? conformity|verif(?:y|ies))\b/gi,
    rule: "system must never present itself as issuer/certifier/verifier (§1)",
  },
  {
    pattern: /\b(?:is|are)\s+hereby\s+(?:certified|declared|attested|verified)\b/gi,
    rule: "system must never present itself as issuer/certifier/verifier (§1)",
  },
  {
    pattern: /\bwe\s+(?:issue|have issued)\s+(?:a|this|the)\s+declaration of conformity\b/gi,
    rule: "system never issues a Declaration of Conformity (§1)",
  },
];

const RULES = [...ABSOLUTE_PHRASES, ...ISSUING_CLAIMS];

/** Returns every forbidden-language violation found in `text`. */
export function findLanguageViolations(text: string): LanguageViolation[] {
  const violations: LanguageViolation[] = [];
  for (const { pattern, rule } of RULES) {
    for (const match of text.matchAll(pattern)) {
      violations.push({ match: match[0], rule });
    }
  }
  return violations;
}

// Every rendered qualification report must carry this, verbatim, so no report
// can be mistaken for a conformity document.
export const SCREENING_DISCLAIMER =
  "This is a qualification screening and evidence assembly output. " +
  "It is not a Declaration of Conformity, a certificate, or a statement of conformity, " +
  "and it does not verify compliance. Responsibility for compiling conformity " +
  "documentation and for any declaration rests with the obligated economic operator.";
