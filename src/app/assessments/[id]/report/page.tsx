import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssessment, loadCorpus } from "@/db/assessments";
import { evaluatePack, type CheckpointCard } from "@/lib/engine/pack";
import { describeDeltaAction, describeRequirement } from "@/lib/report/deltaActions";
import { SCREENING_DISCLAIMER } from "@/lib/report/language";

const VERDICT_STYLE: Record<string, string> = {
  qualified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  conditional: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  gap: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  not_applicable: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  pending: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

function Badge({ verdict }: { verdict: string }) {
  const label = verdict.replace(/_/g, " ");
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${VERDICT_STYLE[verdict] ?? VERDICT_STYLE.not_applicable}`}>
      {label}
    </span>
  );
}

function VerdictCard({ card }: { card: CheckpointCard }) {
  const outcome = card.outcome!;
  const delta = describeDeltaAction(card);
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-neutral-500">{card.checkpointId}@{card.version}</p>
          <p className="mt-0.5 text-sm">{card.requirementText}</p>
        </div>
        {outcome.verdict && <Badge verdict={outcome.verdict} />}
      </div>
      <dl className="mt-3 grid gap-1 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex gap-2">
          <dt className="font-medium">Reason</dt>
          <dd>{outcome.reasonCode}{outcome.risk ? ` · risk ${outcome.risk}` : ""}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Evidence required</dt>
          <dd>{describeRequirement(card.evidenceRequirements)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Citation</dt>
          <dd className="truncate">{card.citation.split(". http")[0]}</dd>
        </div>
      </dl>
      {delta && (
        <p className="mt-3 rounded bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
          <span className="font-semibold">Action: </span>
          {delta}
        </p>
      )}
    </div>
  );
}

function CaveatCard({ card }: { card: CheckpointCard }) {
  const isContext = card.caveat?.label.includes("context") || card.caveat?.reason.toLowerCase().includes("context");
  const tone = isContext
    ? "border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40"
    : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30";
  return (
    <div className={`rounded-md border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-neutral-500">{card.checkpointId}@{card.version}</p>
        <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold dark:bg-black/30">
          {card.caveat?.label}
        </span>
      </div>
      <p className="mt-1 text-sm">{card.requirementText}</p>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">{card.caveat?.reason}</p>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-lg font-semibold">{n}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

export default async function ReportPage({ params }: PageProps<"/assessments/[id]/report">) {
  const { id } = await params;
  const numId = Number(id);
  const assessment = Number.isInteger(numId) ? await getAssessment(numId) : null;
  if (!assessment) notFound();

  const corpus = await loadCorpus();
  const report = evaluatePack({
    checkpoints: corpus,
    context: assessment.context,
    components: assessment.components.map((c) => ({
      line: c.line,
      name: c.name,
      material: c.material,
      composition: c.composition ?? undefined,
      documents: c.documents,
    })),
    asOf: assessment.asOf,
    corpusVersion: assessment.corpusVersion,
  });

  const hasVerdicts = report.overall.evaluatedCount > 0;

  return (
    <div className="space-y-6">
      {/* Persistent screening-only header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{assessment.packName}</h1>
            <p className="text-sm text-neutral-500">Qualification screening report</p>
          </div>
          <Badge verdict={report.overall.verdict} />
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          <div>Corpus version: <span className="font-medium text-neutral-700 dark:text-neutral-300">{report.corpusVersion}</span></div>
          <div>As of: <span className="font-medium text-neutral-700 dark:text-neutral-300">{report.asOf}</span></div>
          <div>Assessment #{assessment.id}</div>
        </dl>
        <p className="mt-3 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800">
          {SCREENING_DISCLAIMER}
        </p>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Count n={report.counts.qualified} label="Qualified" />
        <Count n={report.counts.conditional} label="Conditional" />
        <Count n={report.counts.gap} label="Gap" />
        <Count n={report.counts.not_applicable} label="N/A" />
        <Count n={report.counts.caveat} label="Caveats" />
      </div>

      {/* Caveats — visibly distinct, not errors */}
      {report.caveats.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Pending &amp; caveats ({report.caveats.length})
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            These checkpoints do not yield a verdict yet — the corpus rule is a draft pending regulatory
            approval, is under challenge, or needs context this assessment does not capture. This is expected,
            not an error.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {report.caveats.map((c, i) => (
              <CaveatCard key={`${c.checkpointId}-${i}`} card={c} />
            ))}
          </div>
        </section>
      )}

      {/* Component verdicts */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Components</h2>
        <div className="space-y-4">
          {report.componentSections.map((s) => (
            <div key={s.component.line}>
              <h3 className="mb-2 text-sm font-medium">
                {s.component.line}. {s.component.name}{" "}
                <span className="text-neutral-400">· {s.component.material}</span>
              </h3>
              {s.cards.length > 0 ? (
                <div className="grid gap-2">
                  {s.cards.map((card, i) => (
                    <VerdictCard key={`${card.checkpointId}-${i}`} card={card} />
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700">
                  No verdicts yet — applicable checkpoints are pending regulatory approval (see caveats above).
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {report.packagingUnit.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Packaging unit</h2>
          <div className="grid gap-2">
            {report.packagingUnit.map((card, i) => (
              <VerdictCard key={`${card.checkpointId}-${i}`} card={card} />
            ))}
          </div>
        </section>
      )}

      {report.organisation.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Organisation</h2>
          <div className="grid gap-2">
            {report.organisation.map((card, i) => (
              <VerdictCard key={`${card.checkpointId}-${i}`} card={card} />
            ))}
          </div>
        </section>
      )}

      {!hasVerdicts && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          No verdicts have been produced: every applicable checkpoint in the corpus is still a draft pending
          regulatory approval. Once approved, this report renders verdicts with no change to the assessment.
        </p>
      )}

      <Link href="/" className="inline-block text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        ← Back to assessments
      </Link>
    </div>
  );
}
