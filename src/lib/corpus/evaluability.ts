// An unapproved checkpoint must not be able to produce a verdict. Status is
// gated in the database (only an approval record permits `in_force`); this is
// the matching application-layer gate, so the evaluator cannot accidentally
// consume a draft, contested or not-yet-triggered checkpoint.

export type CheckpointStatus =
  | "draft"
  | "in_force"
  | "upcoming"
  | "contested"
  | "superseded";

export type EvaluabilityInput = {
  id: string;
  version: number;
  status: CheckpointStatus;
  triggerDate: string | null;
  sunsetDate: string | null;
  citation: string;
};

export type Evaluability =
  | { evaluable: true }
  // `caveat` renders in the report as a visible flag but never as a verdict.
  | { evaluable: false; disposition: "caveat" | "excluded"; reason: string };

/**
 * Decides whether a checkpoint may yield a pass/fail verdict as of a date.
 * Anything not `in_force` and in-window is either a caveat or excluded —
 * never a verdict.
 */
export function evaluability(
  checkpoint: EvaluabilityInput,
  asOf: string,
): Evaluability {
  if (!checkpoint.citation.trim()) {
    return {
      evaluable: false,
      disposition: "excluded",
      reason: "No primary citation — cannot ship (brief §5).",
    };
  }

  switch (checkpoint.status) {
    case "draft":
      return {
        evaluable: false,
        disposition: "excluded",
        reason: "Awaiting regulatory-owner approval; not part of any corpus version.",
      };
    case "contested":
      return {
        evaluable: false,
        disposition: "caveat",
        reason: "Requirement is under legal challenge; screened with caveat, no verdict.",
      };
    case "superseded":
      return {
        evaluable: false,
        disposition: "excluded",
        reason: "Superseded by a later version.",
      };
    case "upcoming":
      return {
        evaluable: false,
        disposition: "caveat",
        reason: "Not yet in force; reported as a forward flag.",
      };
    case "in_force":
      break;
  }

  if (checkpoint.triggerDate && asOf < checkpoint.triggerDate) {
    return {
      evaluable: false,
      disposition: "caveat",
      reason: `Applies from ${checkpoint.triggerDate}; reported as a forward flag.`,
    };
  }
  if (checkpoint.sunsetDate && asOf > checkpoint.sunsetDate) {
    return {
      evaluable: false,
      disposition: "excluded",
      reason: `Sunset on ${checkpoint.sunsetDate}.`,
    };
  }

  return { evaluable: true };
}

/** Throws rather than silently degrading — verdict paths must opt in loudly. */
export function assertEvaluable(
  checkpoint: EvaluabilityInput,
  asOf: string,
): void {
  const result = evaluability(checkpoint, asOf);
  if (!result.evaluable) {
    throw new Error(
      `Refusing to evaluate ${checkpoint.id}@${checkpoint.version} as of ${asOf}: ${result.reason}`,
    );
  }
}
