import { getAssessment, loadCorpusAsOf } from "./assessments.ts";
import { evaluatePack, type PackReport } from "../lib/engine/pack.ts";

// A compact verdict snapshot for an assessment — the same evaluation the report
// runs, reduced to its counts + overall verdict. Used to detect whether confirming
// a claim actually moved the verdict (B4 activity feed). Pins the corpus to the
// assessment's stamped version, exactly like the report.
export type VerdictSummary = { counts: PackReport["counts"]; overall: PackReport["overall"] };

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
  const keys = Object.keys(a.counts) as (keyof PackReport["counts"])[];
  return keys.some((k) => a.counts[k] !== b.counts[k]);
}
