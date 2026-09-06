import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getAssessment, loadCorpusAsOf } from "@/db/assessments";
import { loadEmissionFactors } from "@/db/factors";
import { computePackFootprint } from "@/lib/engine/pcf";
import { getAllGuidance, guidanceKey, type GuidanceRow } from "@/db/guidance";
import { evaluatePack, type CheckpointCard, type ComponentInput } from "@/lib/engine/pack";
import { buildObligationCalendar } from "@/lib/report/obligations";
import { describeDeltaAction, describeRequirement } from "@/lib/report/deltaActions";
import { PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "@/lib/report/language";
import { StatusChip, toChipStatus } from "@/app/_components/StatusChip";
import { AddEvidenceForm } from "./AddEvidenceForm";
import { GeneratePassport } from "./GeneratePassport";

function evidenceTypesOf(card: CheckpointCard): string[] {
  return [...new Set((card.evidenceRequirements.allOf ?? []).flatMap((c) => c.anyOf))];
}

function GuidancePanel({ card, guidance }: { card: CheckpointCard; guidance: Map<string, GuidanceRow> }) {
  const entries = evidenceTypesOf(card)
    .map((t) => ({ t, g: guidance.get(guidanceKey(card.checkpointId, card.version, t)) }))
    .filter((e): e is { t: string; g: GuidanceRow } => !!e.g);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        How to obtain this evidence
      </p>
      <div className="space-y-3">
        {entries.map(({ t, g }) => (
          <div key={t} className="text-xs">
            <p className="font-medium">{t.replace(/_/g, " ")}</p>
            {g.status === "draft" ? (
              <p className="text-neutral-500">Guidance pending approval.</p>
            ) : (
              <div className="mt-1 space-y-1 text-neutral-600 dark:text-neutral-400">
                {g.issuerGuidance && <p>{g.issuerGuidance}</p>}
                {g.mustContain && g.mustContain.length > 0 && (
                  <div>
                    <span className="font-medium">Must contain:</span>
                    <ul className="ml-4 list-disc">
                      {g.mustContain.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {g.redFlags && g.redFlags.length > 0 && (
                  <div>
                    <span className="font-medium">Watch for:</span>
                    <ul className="ml-4 list-disc">
                      {g.redFlags.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {g.typicalSourceOrgRole && (
                  <p>
                    <span className="font-medium">Typical source:</span> {g.typicalSourceOrgRole}
                  </p>
                )}
                {g.costTurnaroundNote && (
                  <p>
                    <span className="font-medium">Cost &amp; turnaround:</span> {g.costTurnaroundNote}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnotationLine({ component }: { component: ComponentInput }) {
  const by = component.riskAnnotatedBy ? ` (by ${component.riskAnnotatedBy})` : "";
  if (!component.designAssessment) {
    return (
      <p className="mb-2 text-xs text-neutral-500">
        No risk annotation provided — defaulting to no inherent risk.
      </p>
    );
  }
  if (component.designAssessment === "at_risk") {
    return (
      <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Assessor risk annotation: <strong>at risk</strong>
        {by}
        {component.riskRationale ? ` — ${component.riskRationale}` : ""}
      </p>
    );
  }
  return (
    <p className="mb-2 text-xs text-neutral-500">
      Assessor risk annotation: no inherent risk{by}.
    </p>
  );
}

function TemplateLinks({
  card,
  assessmentId,
  componentId,
}: {
  card: CheckpointCard;
  assessmentId: number;
  componentId: number;
}) {
  const types = evidenceTypesOf(card);
  const hasSupplier = types.includes("supplier_declaration");
  const hasLab = types.includes("lab_test") || types.includes("test_report");
  if (!hasSupplier && !hasLab) return null;
  const base = `/api/assessments/${assessmentId}/template?component=${componentId}&checkpoint=${encodeURIComponent(card.checkpointId)}&version=${card.version}`;
  const link = "rounded border border-neutral-300 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-neutral-500">Request templates:</span>
      {hasSupplier && (
        <a href={`${base}&kind=supplier_declaration`} className={link}>
          ↓ Supplier declaration request
        </a>
      )}
      {hasLab && (
        <a href={`${base}&kind=lab_test`} className={link}>
          ↓ Lab test request
        </a>
      )}
    </div>
  );
}

function VerdictCard({
  card,
  rationale,
  guidance,
  assessmentId,
  componentId,
}: {
  card: CheckpointCard;
  rationale?: string | null;
  guidance: Map<string, GuidanceRow>;
  assessmentId: number;
  componentId?: number;
}) {
  const outcome = card.outcome!;
  const delta = describeDeltaAction(card);
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-neutral-500">{card.checkpointId}@{card.version}</p>
          <p className="mt-0.5 text-sm">{card.requirementText}</p>
        </div>
        {outcome.verdict && <StatusChip status={toChipStatus(outcome.verdict)} />}
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
      {outcome.reasonCode === "TEST_REQUIRED" && rationale && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">Assessor rationale (at risk): </span>
          {rationale}
        </p>
      )}
      {delta && (
        <p className="mt-3 rounded bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
          <span className="font-semibold">Action: </span>
          {delta}
        </p>
      )}
      {delta && <GuidancePanel card={card} guidance={guidance} />}
      {delta && componentId !== undefined && (
        <TemplateLinks card={card} assessmentId={assessmentId} componentId={componentId} />
      )}
      {delta && componentId !== undefined && (
        <AddEvidenceForm
          assessmentId={assessmentId}
          componentId={componentId}
          componentName={card.componentName ?? ""}
          evidenceTypes={evidenceTypesOf(card)}
        />
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

// 3 significant figures, screening-grade — never implies precision we don't have.
function kg(n: number): string {
  return `${Number(n.toPrecision(3))} kg CO₂e`;
}

function FootprintCard({ footprint }: { footprint: ReturnType<typeof computePackFootprint> }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Cradle-to-gate footprint (screening-grade)
        </h2>
        <div className="text-lg font-semibold">{kg(footprint.totalKgCo2e)}</div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{PCF_DISCLAIMER}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Component</th>
              <th className="py-1 pr-3 font-medium">Mass</th>
              <th className="py-1 pr-3 font-medium">Factor</th>
              <th className="py-1 pr-3 font-medium">Source · tier</th>
              <th className="py-1 pr-3 text-right font-medium">kg CO₂e</th>
            </tr>
          </thead>
          <tbody>
            {footprint.components.map((c) => (
              <tr key={c.line} className="border-t border-neutral-100 dark:border-neutral-800/60">
                <td className="py-1 pr-3">{c.line}. {c.name}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{c.massKg != null ? `${Number((c.massKg).toPrecision(3))} kg` : "—"}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{c.factor ? `${c.factor.factor} ${c.factor.unit}` : "—"}</td>
                <td className="py-1 pr-3">{c.factor ? `${c.factor.source} · ${c.factor.dataQuality}` : "—"}</td>
                <td className="py-1 pr-3 text-right whitespace-nowrap">
                  {c.kgCo2e != null
                    ? Number(c.kgCo2e.toPrecision(3))
                    : c.unresolvedReason === "no_weight"
                      ? "no weight"
                      : "no factor"}
                </td>
              </tr>
            ))}
            {footprint.transport && (
              <tr className="border-t border-neutral-100 dark:border-neutral-800/60">
                <td className="py-1 pr-3">Inbound transport ({footprint.transport.mode}, {footprint.transport.km} km)</td>
                <td className="py-1 pr-3 whitespace-nowrap">{Number(footprint.transport.massKg.toPrecision(3))} kg</td>
                <td className="py-1 pr-3 whitespace-nowrap">{footprint.transport.factor.factor} {footprint.transport.factor.unit}</td>
                <td className="py-1 pr-3">{footprint.transport.factor.source} · {footprint.transport.factor.dataQuality}</td>
                <td className="py-1 pr-3 text-right whitespace-nowrap">{Number(footprint.transport.kgCo2e.toPrecision(3))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footprint.unresolved.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Excluded from the total (no weight or no emission factor on file): {footprint.unresolved.join(", ")}.
        </p>
      )}
    </section>
  );
}

export default async function ReportPage({ params }: PageProps<"/assessments/[id]/report">) {
  const { id } = await params;
  const numId = Number(id);
  const assessment = Number.isInteger(numId) ? await getAssessment(numId) : null;
  if (!assessment) notFound();

  // Pin the corpus to the version stamped on the assessment — a later batch's
  // approval must never change a report this assessment already produced.
  const corpus = await loadCorpusAsOf(assessment.corpusVersion);
  const guidanceMap = await getAllGuidance(db);
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
      designAssessment: c.riskAnnotation === "at_risk" ? "at_risk" : c.riskAnnotation === "no_inherent_risk" ? "no_inherent_risk" : undefined,
      riskRationale: c.riskRationale,
      riskAnnotatedBy: c.riskAnnotatedBy,
    })),
    asOf: assessment.asOf,
    corpusVersion: assessment.corpusVersion,
  });

  const hasVerdicts = report.overall.evaluatedCount > 0;
  const bomMaterials = [...new Set(assessment.components.map((c) => c.material))];
  const obligations = buildObligationCalendar(corpus, assessment.context, bomMaterials, assessment.asOf);

  const factors = await loadEmissionFactors();
  const footprint = computePackFootprint(
    assessment.components.map((c) => ({ line: c.line, name: c.name, material: c.material, weightGrams: c.weightGrams })),
    factors,
    assessment.context.inbound_transport,
  );

  return (
    <div className="space-y-6">
      {/* Persistent screening-only header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{assessment.packName}</h1>
            <p className="text-sm text-neutral-500">Qualification screening report</p>
          </div>
          <div className="flex items-center gap-2">
            {assessment.demo && <StatusChip status="demo" />}
            <StatusChip status={toChipStatus(report.overall.verdict)} />
          </div>
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

      {/* Screening-grade cradle-to-gate footprint (Stack D) */}
      <FootprintCard footprint={footprint} />

      {/* Public passport (Stack C) */}
      <GeneratePassport assessmentId={assessment.id} />

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
              <h3 className="mb-1 text-sm font-medium">
                {s.component.line}. {s.component.name}{" "}
                <span className="text-neutral-400">· {s.component.material}</span>
              </h3>
              <AnnotationLine component={s.component} />
              {s.cards.length > 0 ? (
                <div className="grid gap-2">
                  {s.cards.map((card, i) => (
                    <VerdictCard
                      key={`${card.checkpointId}-${i}`}
                      card={card}
                      rationale={s.component.riskRationale}
                      guidance={guidanceMap}
                      assessmentId={assessment.id}
                      componentId={s.component.id}
                    />
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
              <VerdictCard key={`${card.checkpointId}-${i}`} card={card} guidance={guidanceMap} assessmentId={assessment.id} />
            ))}
          </div>
        </section>
      )}

      {report.organisation.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Organisation</h2>
          <div className="grid gap-2">
            {report.organisation.map((card, i) => (
              <VerdictCard key={`${card.checkpointId}-${i}`} card={card} guidance={guidanceMap} assessmentId={assessment.id} />
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

      {obligations.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Compliance calendar ({obligations.length})
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Recurring obligations that apply to this pack, with the next occurrence computed from the
            as-of date. Dates are indicative screening output; confirm the statutory deadline for each
            market against the primary source.
          </p>
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {obligations.map((o) => (
              <li key={o.checkpointId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-neutral-500">{o.checkpointId}</p>
                  <p className="text-sm">{o.requirementText}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium text-neutral-700 dark:text-neutral-300">{o.cadenceLabel}</p>
                  <p className="text-neutral-500">
                    {o.nextDue ? `Next due ${o.nextDue}` : "Next due date to be confirmed"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/" className="inline-block text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        ← Back to assessments
      </Link>
    </div>
  );
}
