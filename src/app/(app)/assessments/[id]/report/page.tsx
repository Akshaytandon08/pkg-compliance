import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getAssessment, loadCorpusAsOf } from "@/db/assessments";
import { loadEmissionFactors } from "@/db/factors";
import { listClaimsForAssessment } from "@/db/claims";
import { doCDraftEligibility } from "@/db/generate-doc-draft";
import { listDrafts } from "@/db/doc-drafts";
import { languageOptionsFor } from "@/lib/doc-export/languages";
import { signDownload, downloadPath } from "@/lib/storage";
import { DoCDraftPanel } from "./DoCDraftPanel";
import { computePackFootprint } from "@/lib/engine/pcf";
import { getAllGuidance, guidanceKey, type GuidanceRow } from "@/db/guidance";
import { evaluatePack, type CheckpointCard, type ComponentInput } from "@/lib/engine/pack";
import { buildObligationCalendar } from "@/lib/report/obligations";
import { describeDeltaAction, describeRequirement } from "@/lib/report/deltaActions";
import { PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "@/lib/report/language";
import { StatusChip, toChipStatus } from "@/app/_components/StatusChip";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
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
  const preview = "text-neutral-500 underline hover:text-neutral-700";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-neutral-500">Request templates:</span>
      {hasSupplier && (
        <span className="inline-flex items-center gap-1.5">
          <a href={`${base}&kind=supplier_declaration&format=docx`} className={link}>↓ Supplier declaration request (.docx)</a>
          <a href={`${base}&kind=supplier_declaration&format=pdf`} target="_blank" rel="noreferrer" className={preview}>preview</a>
        </span>
      )}
      {hasLab && (
        <span className="inline-flex items-center gap-1.5">
          <a href={`${base}&kind=lab_test&format=docx`} className={link}>↓ Lab test request (.docx)</a>
          <a href={`${base}&kind=lab_test&format=pdf`} target="_blank" rel="noreferrer" className={preview}>preview</a>
        </span>
      )}
    </div>
  );
}

// C2 — the evidence-on-file column. Each item is tagged by provenance (manual vs
// extracted-and-confirmed) and, when it came from a stored file, links to that
// source (signed, short-lived, still gated). A pending count nudges the reviewer
// to the claim-review surface. This is GATED report only — the passport is unchanged.
function EvidenceOnFile({
  documents,
  sourceLinks,
  pendingCount,
  assessmentId,
}: {
  documents: ComponentInput["documents"];
  sourceLinks: Map<number, string>;
  pendingCount: number;
  assessmentId: number;
}) {
  if (documents.length === 0 && pendingCount === 0) return null;
  return (
    <div className="mt-1 mb-2 rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
      <p className="font-medium text-neutral-600 dark:text-neutral-300">Evidence on file</p>
      {documents.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {documents.map((d, i) => {
            const extracted = d.source === "extracted";
            const link = d.sourceDocumentId != null ? sourceLinks.get(d.sourceDocumentId) : undefined;
            return (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    extracted
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {extracted ? "Extracted · confirmed" : "Manual"}
                </span>
                <span className="text-neutral-700 dark:text-neutral-300">{d.type}</span>
                {d.expiryDate && <span className="text-neutral-400">· expires {d.expiryDate}</span>}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer" className="text-neutral-500 underline hover:text-neutral-700">
                    source
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {pendingCount > 0 && (
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          {pendingCount} extracted claim{pendingCount === 1 ? "" : "s"} awaiting confirmation —{" "}
          <Link href={`/assessments/${assessmentId}/evidence`} className="underline">
            review
          </Link>
        </p>
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
        {card.confidence && (
          <div className="flex gap-2">
            <dt className="font-medium">Confidence</dt>
            <dd>{card.confidence === "H" ? "High" : card.confidence === "M" ? "Medium" : "Low"}</dd>
          </div>
        )}
        {card.laterOfCondition && (
          <div className="flex gap-2">
            <dt className="font-medium">Phase-in</dt>
            <dd>{card.laterOfCondition}</dd>
          </div>
        )}
      </dl>
      {card.exemptions && card.exemptions.length > 0 && (
        <div className="mt-2 rounded bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <span className="font-semibold">Subject to exemptions ({card.exemptions.length}):</span>
          <ul className="ml-4 mt-1 list-disc">
            {card.exemptions.map((e, i) => (
              <li key={i}>{e.scope} <span className="text-sky-700 dark:text-sky-300">({e.basis_pinpoint})</span></li>
            ))}
          </ul>
        </div>
      )}
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

function Count({ n, label, href }: { n: number; label: string; href?: string }) {
  const cls = "block rounded-md border border-n50 bg-card px-3 py-2 text-center";
  const body = (
    <>
      <div className="text-lg font-semibold text-n800">{n}</div>
      <div className="text-xs text-n500">{label}</div>
    </>
  );
  return href ? <a href={href} className={`${cls} hover:border-n300`}>{body}</a> : <div className={cls}>{body}</div>;
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

  // C2 — provenance for the evidence-on-file column. Sign a short-lived source
  // link per stored file referenced by any evidence item, and count pending
  // extracted claims per component.
  const sourceLinks = new Map<number, string>();
  for (const c of assessment.components) {
    for (const d of c.documents) {
      if (d.sourceDocumentId != null && !sourceLinks.has(d.sourceDocumentId)) {
        sourceLinks.set(d.sourceDocumentId, downloadPath(d.sourceDocumentId, signDownload(d.sourceDocumentId)));
      }
    }
  }
  const pendingByComponent = new Map<number, number>();
  for (const claim of await listClaimsForAssessment(assessment.id)) {
    if (claim.status === "pending" && claim.componentId != null) {
      pendingByComponent.set(claim.componentId, (pendingByComponent.get(claim.componentId) ?? 0) + 1);
    }
  }

  // Draft EU declaration of conformity — eligibility (button state) + existing drafts.
  const docEligibility = (await doCDraftEligibility(assessment.id)) ?? { eligible: false, blockers: ["Assessment not found."] };
  const docDrafts = (await listDrafts(assessment.id)).map((d) => ({
    id: d.id,
    version: d.version,
    language: d.language,
    status: d.status,
    docxFilename: d.docxFilename,
    pdfFilename: d.pdfFilename,
    createdAt: d.createdAt.toISOString(),
  }));
  const docLanguageOptions = languageOptionsFor(assessment.context.destination_member_states);

  const hasVerdicts = report.overall.evaluatedCount > 0;
  const bomMaterials = [...new Set(assessment.components.map((c) => c.material))];
  const obligations = buildObligationCalendar(corpus, assessment.context, bomMaterials, assessment.asOf);

  const factors = await loadEmissionFactors();
  const footprint = computePackFootprint(
    assessment.components.map((c) => ({ line: c.line, name: c.name, material: c.material, weightGrams: c.weightGrams })),
    factors,
    assessment.context.inbound_transport,
  );

  const sections = [
    { id: "summary", label: "Summary" },
    ...(report.caveats.length > 0 ? [{ id: "caveats", label: "Pending & caveats" }] : []),
    ...(report.upcoming.length > 0 ? [{ id: "upcoming", label: "Not yet applicable" }] : []),
    { id: "components", label: "Components" },
    ...(report.packagingUnit.length > 0 ? [{ id: "packaging-unit", label: "Packaging unit" }] : []),
    ...(report.organisation.length > 0 ? [{ id: "organisation", label: "Organisation" }] : []),
    { id: "footprint", label: "Footprint" },
    { id: "passport", label: "Passport" },
    ...(obligations.length > 0 ? [{ id: "calendar", label: "Calendar" }] : []),
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Assessments", href: "/" },
          { label: assessment.packName },
          { label: "Report" },
        ]}
      />

      {/* Persistent screening-only header */}
      <div id="summary" className="scroll-mt-4 rounded-lg border border-n50 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-n800">{assessment.packName}</h1>
            <p className="text-sm text-n500">Qualification screening report</p>
          </div>
          <div className="flex items-center gap-2">
            {assessment.demo && <StatusChip status="demo" />}
            <StatusChip status={toChipStatus(report.overall.verdict)} />
          </div>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-n500">
          <div>Corpus version: <span className="font-medium text-n700">{report.corpusVersion}</span></div>
          <div>As of: <span className="font-medium text-n700">{report.asOf}</span></div>
          <div>Assessment #{assessment.id}</div>
        </dl>
        <p className="mt-3 border-t border-n50 pt-3 text-xs leading-relaxed text-n500">
          {SCREENING_DISCLAIMER}
        </p>
      </div>

      {/* Sticky in-page section index */}
      <nav className="sticky top-0 z-10 -mx-6 flex gap-4 overflow-x-auto border-b border-n50 bg-page/90 px-6 py-2 text-xs text-n600 backdrop-blur">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap hover:text-n900">
            {s.label}
          </a>
        ))}
      </nav>

      {/* Counts — anchor to their sections */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Count n={report.counts.qualified} label="Qualified" href="#components" />
        <Count n={report.counts.conditional} label="Conditional" href="#components" />
        <Count n={report.counts.gap} label="Gap" href="#components" />
        <Count n={report.counts.not_applicable} label="N/A" href="#components" />
        <Count n={report.counts.upcoming} label="Upcoming" href={report.upcoming.length > 0 ? "#upcoming" : "#components"} />
        <Count n={report.counts.caveat} label="Caveats" href={report.caveats.length > 0 ? "#caveats" : "#components"} />
      </div>

      {/* Screening-grade cradle-to-gate footprint (Stack D) */}
      <div id="footprint" className="scroll-mt-14">
        <FootprintCard footprint={footprint} />
      </div>

      {/* Draft EU declaration of conformity (data-assembly aid, gated) */}
      <DoCDraftPanel
        assessmentId={assessment.id}
        eligible={docEligibility.eligible}
        blockers={docEligibility.blockers}
        languageOptions={docLanguageOptions}
        drafts={docDrafts}
      />

      {/* Public passport (Stack C) */}
      <div id="passport" className="scroll-mt-14">
        <GeneratePassport assessmentId={assessment.id} />
      </div>

      {/* Caveats — visibly distinct, not errors */}
      {report.caveats.length > 0 && (
        <section id="caveats" className="scroll-mt-14">
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

      {/* Not yet applicable — informational. These requirements exist but their
          trigger date is after this assessment's as-of date, so they cannot be
          satisfied today and are excluded from the qualified/conditional/gap
          counts. They never block anything. */}
      {report.upcoming.length > 0 && (
        <section id="upcoming" className="scroll-mt-14">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Not yet applicable ({report.upcoming.length})
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            These requirements are in the corpus but do not apply as of {report.asOf}. They are shown so the
            date is visible in advance; they are not gaps and do not affect the verdict counts or the
            declaration-of-conformity gate.
          </p>
          <ul className="space-y-2">
            {report.upcoming.map((c, i) => (
              <li key={`${c.checkpointId}-${i}`} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-mono text-xs text-neutral-500">{c.checkpointId}@{c.version}</p>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {c.outcome?.detail}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">{c.requirementText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Component verdicts */}
      <section id="components" className="scroll-mt-14">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Components</h2>
        <div className="space-y-4">
          {report.componentSections.map((s) => (
            <div key={s.component.line}>
              <h3 className="mb-1 text-sm font-medium">
                {s.component.line}. {s.component.name}{" "}
                <span className="text-neutral-400">· {s.component.material}</span>
              </h3>
              <AnnotationLine component={s.component} />
              <EvidenceOnFile
                documents={s.component.documents}
                sourceLinks={sourceLinks}
                pendingCount={s.component.id != null ? (pendingByComponent.get(s.component.id) ?? 0) : 0}
                assessmentId={assessment.id}
              />
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
        <section id="packaging-unit" className="scroll-mt-14">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Packaging unit</h2>
          <div className="grid gap-2">
            {report.packagingUnit.map((card, i) => (
              <VerdictCard key={`${card.checkpointId}-${i}`} card={card} guidance={guidanceMap} assessmentId={assessment.id} />
            ))}
          </div>
        </section>
      )}

      {report.organisation.length > 0 && (
        <section id="organisation" className="scroll-mt-14">
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
        <section id="calendar" className="scroll-mt-14">
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
