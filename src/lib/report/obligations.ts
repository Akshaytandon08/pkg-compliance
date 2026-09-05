// The obligation calendar (brief §3, Stack B). Recurring filings — registration
// renewals, annual declarations — are not one-off verdicts; they recur. This
// derives, from the pinned corpus + the assessment context, the recurring
// obligations that actually apply to the pack and their next due date computed
// from the as-of date. Pure: no DB, no I/O.
import { evaluateApplicability, type AssessmentContext } from "../engine/evaluate.ts";
import type { ProductionCheckpoint } from "../engine/pack.ts";

export type ObligationEntry = {
  checkpointId: string;
  requirementText: string;
  citation: string;
  cadenceLabel: string;
  // ISO date of the next occurrence on/after the as-of date, or null when the
  // statutory anchor is not yet confirmed (cadence known, date to be confirmed).
  nextDue: string | null;
};

const CADENCE_LABEL: Record<string, string> = {
  P1Y: "Annual",
  P6M: "Every 6 months",
  P3M: "Quarterly",
  P1M: "Monthly",
};

function cadenceLabel(every: string): string {
  return CADENCE_LABEL[every] ?? `Every ${every}`;
}

/**
 * Next occurrence of an annual "--MM-DD" anchor on or after `from` (ISO date).
 * Returns null for anything not an annual --MM-DD anchor (kept deliberately
 * small — the only cadence the corpus carries today is P1Y).
 */
export function nextAnnualDue(dueAnchor: string, from: string): string | null {
  const m = /^--(\d{2})-(\d{2})$/.exec(dueAnchor);
  if (!m) return null;
  const [, mm, dd] = m;
  const fromYear = Number(from.slice(0, 4));
  const candidate = `${fromYear}-${mm}-${dd}`;
  return candidate >= from ? candidate : `${fromYear + 1}-${mm}-${dd}`;
}

export function buildObligationCalendar(
  checkpoints: ProductionCheckpoint[],
  context: AssessmentContext,
  bomMaterials: string[],
  asOf: string,
): ObligationEntry[] {
  const entries: ObligationEntry[] = [];
  for (const cp of checkpoints) {
    if (!cp.recurrence) continue;
    // Only obligations the pack actually triggers land on the calendar; a rule
    // that is out of scope, or whose applicability we cannot confirm, does not.
    if (evaluateApplicability(cp.appliesWhen, { context, bomMaterials }) !== "applicable") continue;

    // The obligation cannot fall due before the rule is in force.
    const from = cp.triggerDate && cp.triggerDate > asOf ? cp.triggerDate : asOf;
    entries.push({
      checkpointId: cp.id,
      requirementText: cp.requirementText,
      citation: cp.citation,
      cadenceLabel: cadenceLabel(cp.recurrence.every),
      nextDue: cp.recurrence.due ? nextAnnualDue(cp.recurrence.due, from) : null,
    });
  }
  // Dated rows first (soonest due), then cadence-only rows, stable by id.
  return entries.sort((a, b) => {
    if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue) || a.checkpointId.localeCompare(b.checkpointId);
    if (a.nextDue) return -1;
    if (b.nextDue) return 1;
    return a.checkpointId.localeCompare(b.checkpointId);
  });
}
