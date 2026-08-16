// Human-readable delta actions, spelled out from a checkpoint's CNF evidence
// requirement. This is user-facing output, so it must never present the system
// as issuer/certifier (brief §1) — it instructs the user about THEIR evidence.
// Covered by tests/report-deltas.test.ts (findLanguageViolations + snapshots).

import type { EvidenceRequirement } from "../../db/schema.ts";
import type { CheckpointCard } from "../engine/pack.ts";

const EVIDENCE_LABELS: Record<string, string> = {
  supplier_declaration: "a supplier declaration",
  lab_test: "a lab test",
  test_report: "a test report",
  technical_file: "a technical file",
  marking: "an on-pack marking",
  registration: "a producer registration",
  pigment_spec: "a pigment specification",
  // Names the obligated operator's own document — not a system output.
  conformity_declaration: "a declaration of conformity drawn up by the obligated operator",
};

function labelFor(type: string): string {
  return EVIDENCE_LABELS[type] ?? `a ${type.replace(/_/g, " ")}`;
}

/** "a supplier declaration, a test report or a lab test" */
export function describeRequirement(requirement: EvidenceRequirement): string {
  const clauses = (requirement.allOf ?? []).map((clause) => {
    const options = clause.anyOf.map(labelFor);
    if (options.length === 1) return options[0];
    return `${options.slice(0, -1).join(", ")} or ${options[options.length - 1]}`;
  });
  if (clauses.length === 0) return "no further evidence";
  return clauses.join("; and ");
}

/**
 * The action that would close (or explain) a card's outcome. Returns null when
 * there is nothing to do (qualified) or the card is not a verdict.
 */
export function describeDeltaAction(card: CheckpointCard): string | null {
  const outcome = card.outcome;
  if (!outcome || outcome.disposition !== "verdict") return null;

  if (outcome.reasonCode === "DESIGN_NONCOMPLIANT") {
    return "Design or chemistry failure — this cannot be closed by paperwork; substitute the material or redesign the component.";
  }
  if (outcome.verdict === "qualified") return null;

  const req = describeRequirement(card.evidenceRequirements);
  const scope = card.componentName ? ` covering ${card.componentName}` : " for this packaging unit";

  switch (outcome.reasonCode) {
    case "EVIDENCE_INCOMPLETE":
      return `Evidence is on file but does not cover this component. Provide ${req}${scope}.`;
    case "EVIDENCE_EXPIRED":
      return `The evidence on file has expired. Provide current ${req}${scope}.`;
    case "TEST_REQUIRED":
      return `Genuine chemistry risk — provide ${req}${scope} (a lab test is the recommended closing evidence).`;
    default:
      return `Provide ${req}${scope}.`;
  }
}
