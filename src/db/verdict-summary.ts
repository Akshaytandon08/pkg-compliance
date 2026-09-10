import { getAssessment, loadCorpusAsOf } from "./assessments.ts";
import { evaluatePack, type PackReport } from "../lib/engine/pack.ts";

// A compact verdict snapshot for an assessment — the same evaluation the report
// runs, reduced to its counts + overall verdict. Used to detect whether confirming
// a claim actually moved the verdict (B4 activity feed). Pins the corpus to the
// assessment's stamped version, exactly like the report.
// `upcoming` is optional here (but required on PackReport) because summaries are
// PERSISTED: snapshots written before the temporal state existed have no such
// key, and they must still load and compare. Missing is treated as 0.
export type VerdictSummary = {
  counts: Omit<PackReport["counts"], "upcoming"> & { upcoming?: number };
  overall: PackReport["overall"];
};

export async function summarizeAssessmentVerdicts(assessmentId: number): Promise<VerdictSummary | null> {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) return null;
  const corpus = await loadCorpusAsOf(assessment.corpusVersion);
  const report = evaluatePack({
    checkpoints: corpus,
    context: assessment.context,
    components: assessment.components.map((c) => ({
      id: c.id,
      line: c.line,
      name: c.name,
      material: c.material,
      composition: c.composition ?? undefined,
      documents: c.documents,
      designAssessment:
        c.riskAnnotation === "at_risk"
          ? "at_risk"
          : c.riskAnnotation === "no_inherent_risk"
            ? "no_inherent_risk"
            : undefined,
      riskRationale: c.riskRationale,
      riskAnnotatedBy: c.riskAnnotatedBy,
    })),
    asOf: assessment.asOf,
    corpusVersion: assessment.corpusVersion,
  });
  return { counts: report.counts, overall: report.overall };
}

// True when two snapshots differ (any count or the overall verdict).
export function verdictsDiffer(a: VerdictSummary, b: VerdictSummary): boolean {
  if (a.overall.verdict !== b.overall.verdict) return true;
  // Union of both key sets, so a key present on only one side is still compared;
  // absent counts read as 0 so an older snapshot without `upcoming` does not
  // register as a spurious change.
  const keys = new Set([...Object.keys(a.counts), ...Object.keys(b.counts)]) as Set<keyof PackReport["counts"]>;
  return [...keys].some((k) => (a.counts[k] ?? 0) !== (b.counts[k] ?? 0));
}
