// The deterministic verdict rule table. The LLM extracts claims and evidence
// state; it never adjudicates. This function is the only place a verdict is
// decided, and it is a pure function of two axes:
//
//   designAssessment — is there an inherent design/chemistry problem?
//   evidenceState    — is the evidence that would close it on file?
//
// The manual Exide run labelled lines 1-6 "QUALIFIED — conditional" and line 7
// "CONDITIONAL — test recommended". Those are the SAME verdict (conditional)
// at different risk levels, distinguished by whether a routine declaration or a
// lab test is the closing evidence. Collapsing them to one verdict enum plus a
// risk level is what keeps the report reproducible.

export type DesignAssessment = "no_inherent_risk" | "at_risk" | "non_compliant";
export type EvidenceState = "complete" | "insufficient" | "absent" | "expired";
export type Verdict = "qualified" | "conditional" | "gap" | "not_applicable";
export type Risk = "low" | "medium" | "high";

export type VerdictInput = {
  designAssessment: DesignAssessment;
  evidenceState: EvidenceState;
};

export type VerdictResult = { verdict: Verdict; risk: Risk };

export function decideVerdict({
  designAssessment,
  evidenceState,
}: VerdictInput): VerdictResult {
  // A design/chemistry failure is a gap regardless of paperwork.
  if (designAssessment === "non_compliant") {
    return { verdict: "gap", risk: "high" };
  }

  if (evidenceState === "complete") {
    return { verdict: "qualified", risk: "low" };
  }

  // Evidence outstanding. Risk is driven by whether the underlying design
  // carries genuine chemistry risk — that is the difference between "get the
  // declaration" and "run the test".
  return {
    verdict: "conditional",
    risk: designAssessment === "at_risk" ? "medium" : "low",
  };
}
