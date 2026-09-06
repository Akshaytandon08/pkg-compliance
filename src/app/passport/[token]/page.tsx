import { notFound } from "next/navigation";
import { getPassportByToken } from "@/db/passport";
import { PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "@/lib/report/language";
import { StatusChip, toChipStatus } from "@/app/_components/StatusChip";

// Public tier — reached without the access gate (see src/proxy.ts). Renders only
// the passport payload, which by construction carries no evidence, no
// per-checkpoint detail, and nothing from a draft/contested checkpoint.
export const dynamic = "force-dynamic";

function Count({ n, label, href }: { n: number; label: string; href?: string }) {
  const body = (
    <>
      <div className="text-lg font-semibold">{n}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </>
  );
  const cls = "block rounded-md border border-neutral-200 bg-white px-3 py-2 text-center";
  return href ? (
    <a href={href} className={`${cls} hover:border-neutral-400`}>{body}</a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const VERDICT_GROUPS: { verdict: string; label: string }[] = [
  { verdict: "qualified", label: "Qualified" },
  { verdict: "conditional", label: "Conditional" },
  { verdict: "gap", label: "Gap" },
  { verdict: "not_applicable", label: "Not applicable" },
];

export default async function PassportPage({ params }: PageProps<"/passport/[token]">) {
  const { token } = await params;
  const passport = await getPassportByToken(token);
  if (!passport) notFound();

  const p = passport.payload;
  const composition = p.materialComposition.map((m) => `${m.material} ×${m.componentCount}`).join(", ");
  // A passport minted before disclosure model v2 has no checkpoints array.
  const checkpoints = p.checkpoints ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Packaging compliance passport</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{p.packName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {p.demo && <StatusChip status="demo" />}
            <StatusChip status={toChipStatus(p.overallVerdict)} />
          </div>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          <div>Materials: <span className="font-medium text-neutral-700">{composition || "—"}</span></div>
          <div>Corpus version: <span className="font-medium text-neutral-700">{p.corpusVersion}</span></div>
          <div>As of: <span className="font-medium text-neutral-700">{p.asOf}</span></div>
        </dl>
        <p className="mt-3 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
          {SCREENING_DISCLAIMER}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Count n={p.counts.qualified} label="Qualified" href="#cp-qualified" />
        <Count n={p.counts.conditional} label="Conditional" href="#cp-conditional" />
        <Count n={p.counts.gap} label="Gap" href="#cp-gap" />
        <Count n={p.counts.not_applicable} label="N/A" href="#cp-not_applicable" />
        <Count n={p.counts.caveat} label="Caveats" />
      </div>

      {/* Per-checkpoint public detail (disclosure model v2). The rule set is
          public law: showing which rules are met removes doubt. */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Checkpoints</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Every applicable rule with its verdict and primary legal citation. Evidence, supplier and
          component detail are not shown here.
        </p>
        <div className="mt-3 space-y-5">
          {VERDICT_GROUPS.map(({ verdict, label }) => {
            const rows = checkpoints.filter((c) => c.verdict === verdict);
            if (rows.length === 0) return <div key={verdict} id={`cp-${verdict}`} className="scroll-mt-4" />;
            return (
              <div key={verdict} id={`cp-${verdict}`} className="scroll-mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {label} ({rows.length})
                </h3>
                <ul className="space-y-2">
                  {rows.map((c) => (
                    <li key={`${c.checkpointId}-${c.version}`} className="rounded-md border border-neutral-100 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-mono text-xs text-neutral-500">{c.checkpointId}@{c.version}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">{c.reasonCategory}</span>
                          <StatusChip status={toChipStatus(c.verdict)} label={c.verdict.replace(/_/g, " ")} />
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-neutral-700">{c.requirement}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {c.citationText}
                        {c.citationUrl && (
                          <>
                            {" "}
                            <a href={c.citationUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
                              primary source ↗
                            </a>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">Corpus version {p.corpusVersion}.</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Cradle-to-gate footprint</h2>
          <div className="text-lg font-semibold">{p.pcf.totalKgCo2e} {p.pcf.unit}</div>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{PCF_DISCLAIMER}</p>
        {p.pcf.unresolvedComponents > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            {p.pcf.unresolvedComponents} component(s) excluded (no weight or emission factor).
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
        <p className="font-medium text-neutral-600">Integrity</p>
        <p className="mt-1">Version {passport.version}{passport.changelog ? ` — ${passport.changelog}` : ""}</p>
        <p className="mt-1 break-all">Content hash: <span className="font-mono">{passport.contentHash}</span></p>
        {passport.prevHash && <p className="mt-1 break-all">Previous version hash: <span className="font-mono">{passport.prevHash}</span></p>}
        <p className="mt-1">Generated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(passport.createdAt)}.</p>
      </div>
    </div>
  );
}
