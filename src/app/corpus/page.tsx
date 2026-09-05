import { loadCorpus } from "@/db/assessments";
import type { ProductionCheckpoint } from "@/lib/engine/pack";

// Reads live corpus — render on demand, never prerender a build-time snapshot.
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  in_force: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  contested: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  superseded: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  upcoming: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
};

function hasGuidance(notes: string | null): boolean {
  return !!notes && /\bFAQ\b|interpretive/i.test(notes);
}

function renderCnf(req: ProductionCheckpoint["evidenceRequirements"]): string {
  const clauses = (req?.allOf ?? []).map((c) => c.anyOf.join(" OR "));
  if (clauses.length === 0) return "—";
  return clauses.length > 1 ? clauses.map((c) => `(${c})`).join(" AND ") : clauses[0];
}

function renderThresholds(ts: ProductionCheckpoint["thresholds"]): string {
  if (!ts || ts.length === 0) return "—";
  return ts
    .map((t) => `${t.parameter} ${t.operator} ${t.value} ${t.unit}${t.applies_when ? ` (${t.applies_when})` : ""}`)
    .join("; ");
}

function renderAppliesWhen(aw: ProductionCheckpoint["appliesWhen"]): string {
  if (!aw || Object.keys(aw).length === 0) return "always";
  return Object.entries(aw).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("; ");
}

function citationParts(citation: string): { text: string; url: string | null } {
  const m = citation.match(/https?:\/\/\S+/);
  return { text: citation.replace(/\s*https?:\/\/\S+.*/, "").trim(), url: m ? m[0] : null };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <dt className="w-28 shrink-0 font-medium text-neutral-500">{label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
  );
}

function CheckpointCard({ cp }: { cp: ProductionCheckpoint }) {
  const guidance = hasGuidance(cp.notes);
  const citation = citationParts(cp.citation);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm font-medium">{cp.id}@{cp.version}</p>
        <div className="flex items-center gap-2">
          {guidance && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              Interpretive guidance
            </span>
          )}
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-neutral-500">
            {cp.subject}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[cp.status]}`}>
            {cp.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm">{cp.requirementText}</p>

      <dl className="mt-3 space-y-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <Field label="Thresholds" value={renderThresholds(cp.thresholds)} />
        <Field label="Evidence" value={renderCnf(cp.evidenceRequirements)} />
        <Field label="Applies when" value={renderAppliesWhen(cp.appliesWhen)} />
        <Field label="Test method" value={cp.testMethod ?? "—"} />
        <div className="flex gap-2 text-xs">
          <dt className="w-28 shrink-0 font-medium text-neutral-500">Citation</dt>
          <dd className="text-neutral-700 dark:text-neutral-300">
            {citation.text}{" "}
            {citation.url && (
              <a href={citation.url} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-300">
                (source)
              </a>
            )}
          </dd>
        </div>
      </dl>

      {cp.notes && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-xs ${
            guidance
              ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              : "bg-neutral-50 text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300"
          }`}
        >
          <span className="font-semibold">Notes: </span>
          {cp.notes}
        </div>
      )}
    </div>
  );
}

export default async function CorpusPage() {
  const corpus = await loadCorpus();
  const guidanceRows = corpus.filter((c) => hasGuidance(c.notes)).sort((a, b) => a.id.localeCompare(b.id));
  const otherRows = corpus.filter((c) => !hasGuidance(c.notes)).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Corpus</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {corpus.length} checkpoints. {guidanceRows.length} carry Commission PPWR FAQ interpretive
          guidance (non-binding — recorded in notes/test method, never in the citation).
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Guidance-amended checkpoints ({guidanceRows.length})
        </h2>
        <div className="space-y-3">
          {guidanceRows.map((cp) => (
            <CheckpointCard key={cp.id} cp={cp} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Other checkpoints ({otherRows.length})
        </h2>
        <div className="space-y-3">
          {otherRows.map((cp) => (
            <CheckpointCard key={cp.id} cp={cp} />
          ))}
        </div>
      </section>
    </div>
  );
}
