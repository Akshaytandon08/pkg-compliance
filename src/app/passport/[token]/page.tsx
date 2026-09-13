import { notFound } from "next/navigation";
import { getPassportByToken, type PassportCheckpoint, type PassportPayload } from "@/db/passport";
import { PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "@/lib/report/language";
import { StatusChip, toChipStatus } from "@/app/_components/StatusChip";
import {
  RULE_REFERENCE_TOOLTIP,
  countryLabel,
  factorSourceLabel,
  factorTierLabel,
  formatFactorValue,
  legalRoleLabel,
  materialLabel,
  ruleName,
  ruleReference,
  verdictAriaLabel,
  verdictLabel,
} from "@/lib/report/labels";
import { Wordmark } from "@/app/_components/Wordmark";

/** The tab title on a page reached by QR, so a reader with several open can tell
 *  them apart. The pack name is public under the Sprint 10 disclosure line. */
export async function generateMetadata({ params }: PageProps<"/passport/[token]">) {
  const { token } = await params;
  const passport = await getPassportByToken(token);
  if (!passport) return { title: "Passport not found" };
  return {
    title: `${passport.payload.packName} — packaging passport`,
    description: `Packaging compliance passport for ${passport.payload.packName}. Screening output, not a Declaration of Conformity.`,
  };
}

// Public tier — reached without the access gate (see src/proxy.ts). Renders only
// the passport payload, which by construction carries no evidence, no
// per-checkpoint detail, and nothing from a draft/contested checkpoint.
export const dynamic = "force-dynamic";

function Count({ n, label, href }: { n: number; label: string; href?: string }) {
  const body = (
    <>
      <div className="text-lg font-semibold">{n}</div>
      <div className="text-[11px] leading-tight text-neutral-500">{label}</div>
    </>
  );
  const cls = "block rounded-md border border-neutral-200 bg-white px-2 py-2 text-center";
  return href ? (
    <a href={href} className={`${cls} hover:border-neutral-400`}>{body}</a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// `anchor` is written out rather than derived from `verdict` so no verdict token
// is ever interpolated into markup — the enum-leak tripwire bans that shape, and
// it is right to: today's anchor is tomorrow's visible label.
const ACTIVE_GROUPS: { verdict: string; label: string; anchor: string }[] = [
  { verdict: "qualified", label: "Qualified", anchor: "cp-qualified" },
  { verdict: "conditional", label: "Conditional", anchor: "cp-conditional" },
  { verdict: "gap", label: "Gap", anchor: "cp-gap" },
];

/**
 * Rules the reader does not have to act on today. Each collapses to ONE line
 * with the reason, because giving a not-applicable rule the same vertical space
 * as a gap is what made the old list unreadable on a phone — and it invited the
 * reader to skim past the rows that do matter.
 */
const QUIET_GROUPS: {
  verdict: string;
  label: string;
  anchor: string;
  blurb: (rows: PassportCheckpoint[]) => string;
}[] = [
  {
    verdict: "not_applicable",
    label: "Not applicable",
    anchor: "cp-not_applicable",
    // The reasons are near-identical across rows in practice (destination and
    // food-contact), so the summary states them once rather than repeating.
    blurb: (rows) => {
      const reasons = [...new Set(rows.map((r) => r.notApplicableReason).filter(Boolean))] as string[];
      return reasons.length ? reasons.slice(0, 2).join("; ") : "does not apply to this packaging";
    },
  },
  {
    verdict: "upcoming",
    label: "Not yet applicable",
    anchor: "cp-upcoming",
    blurb: (rows) => {
      const dates = [...new Set(rows.map((r) => r.appliesFrom).filter(Boolean))] as string[];
      return dates.length ? `applies from ${dates.sort()[0]}` : "applies from a future date";
    },
  },
];

const ISSUER_TYPE_LABEL: Record<string, string> = {
  manufacturer_qa: "manufacturer's own quality function",
  accredited_lab: "accredited laboratory",
  treatment_provider: "treatment provider",
  mill: "mill's own quality function",
};

/** One rule. Collapsed: verdict + plain name. Expanded: what meets it and who
 *  stands behind that, in the order a sceptical reader asks. */
function RuleRow({ c }: { c: PassportCheckpoint }) {
  const name = ruleName(c.checkpointId);
  const proof = c.proof ?? [];
  return (
    <details className="group rounded-md border border-neutral-200 bg-white open:border-neutral-300">
      <summary className="flex cursor-pointer list-none items-start gap-2 p-3 marker:content-none">
        <StatusChip
          status={toChipStatus(c.verdict)}
          label={verdictLabel(c.verdict)}
          ariaLabel={verdictAriaLabel(c.verdict, name)}
        />
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-neutral-800">{name}</span>
        <span aria-hidden className="mt-0.5 shrink-0 text-xs text-neutral-400 group-open:hidden">+</span>
        <span aria-hidden className="mt-0.5 hidden shrink-0 text-xs text-neutral-400 group-open:inline">−</span>
      </summary>

      <div className="space-y-3 border-t border-neutral-100 px-3 pb-3 pt-3 text-xs">
        {proof.length > 0 && (
          <Field label="Proof">
            <ul className="space-y-2">
              {proof.map((d, i) => (
                <li key={`${d.evidenceType}-${i}`}>
                  <span className="font-medium text-neutral-800">{d.evidenceTypeLabel}</span>
                  {d.reference && <span className="block text-neutral-600">{d.reference}</span>}
                  {d.validity && <span className="block text-neutral-400">{d.validity}</span>}
                  {d.issuerName && (
                    <span className="mt-1 block text-neutral-600">
                      <span className="text-neutral-400">Issued by </span>
                      {d.issuerName}
                      {d.issuerType && (
                        <span className="text-neutral-400"> — {ISSUER_TYPE_LABEL[d.issuerType] ?? d.issuerType}</span>
                      )}
                      {d.accreditationRef && (
                        <span className="block text-neutral-500">Accreditation: {d.accreditationRef}</span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Field>
        )}

        {c.keyValue && (
          <Field label="Key value">
            <span className="font-medium text-neutral-800">
              {c.keyValue.parameter} {c.keyValue.measured}
              {c.keyValue.measuredUnit ? ` ${c.keyValue.measuredUnit}` : ""}
            </span>
            <span className="text-neutral-500"> against {c.keyValue.limitText}</span>
          </Field>
        )}

        {c.ruleVerifiedBy && (
          <Field label="Rule verified by">
            {c.ruleVerifiedBy.name}
            <span className="text-neutral-400"> — regulatory owner, {c.ruleVerifiedBy.verifiedOn}</span>
            <span className="mt-0.5 block text-neutral-400">
              Verification is of this rule&rsquo;s wording against the primary source, not of the packaging.
            </span>
          </Field>
        )}

        {c.evidenceConfirmedBy && (
          <Field label="Evidence confirmed by">
            {c.evidenceConfirmedBy.name}
            <span className="text-neutral-400"> — {c.evidenceConfirmedBy.confirmedOn}</span>
          </Field>
        )}

        <Field label="Reason">
          <span className="text-neutral-600">{c.reasonCategory}</span>
          {c.subjectToExemptions && <span className="text-neutral-400"> · subject to exemptions</span>}
        </Field>

        <p className="text-neutral-500">
          {c.citationText}
          {c.citationUrl && (
            <>
              {" "}
              <a href={c.citationUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                primary source ↗
              </a>
            </>
          )}
        </p>

        {c.fullRuleText && (
          <details className="rounded border border-neutral-100 bg-neutral-50">
            <summary className="cursor-pointer list-none px-2.5 py-1.5 text-neutral-600 marker:content-none">
              <span className="text-sky-700 underline">Read the full rule</span>
            </summary>
            <p className="px-2.5 pb-2.5 leading-relaxed text-neutral-600">{c.fullRuleText}</p>
          </details>
        )}

        <p className="font-mono text-[11px] text-neutral-300" title={RULE_REFERENCE_TOOLTIP}>
          {ruleReference(c.checkpointId, c.version)}
        </p>
      </div>
    </details>
  );
}

/** One field in a component card. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-neutral-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-neutral-700">{children}</dd>
    </div>
  );
}

/** "3 components · corrugated board · 1.27 kg · origin Germany". Origins are
 *  listed only when they are few; a pack sourced from six places says so rather
 *  than printing all six in a summary line. */
function materialsSummary(components: NonNullable<PassportPayload["components"]>): string {
  const mass = components.reduce((a, c) => a + (c.massKg ?? 0), 0);
  const materials = [...new Set(components.map((c) => materialLabel(c.material)))];
  const origins = [...new Set(components.map((c) => c.countryOfOrigin).filter(Boolean))] as string[];
  // Collapse "Tamil Nadu, India" + "Gujarat, India" to "India" for the summary —
  // the card keeps the region.
  const countries = [...new Set(origins.map((o) => o.split(",").pop()!.trim()))];
  const parts = [
    `${components.length} component${components.length === 1 ? "" : "s"}`,
    materials.join(", "),
    mass > 0 ? `${Number(mass.toPrecision(3))} kg` : null,
    countries.length > 0 && countries.length <= 3 ? `origin ${countries.join(", ")}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** A labelled line inside an expanded rule. The label is muted and the value
 *  leads — the reader is scanning for the value, not the label. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="mt-0.5 text-neutral-700">{children}</div>
    </div>
  );
}

export default async function PassportPage({ params }: PageProps<"/passport/[token]">) {
  const { token } = await params;
  const passport = await getPassportByToken(token);
  if (!passport) notFound();

  const p = passport.payload;
  const composition = p.materialComposition.map((m) => `${materialLabel(m.material)} ×${m.componentCount}`).join(", ");
  // A passport minted before disclosure model v2 has no checkpoints array.
  const checkpoints = p.checkpoints ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Minimal public shell — full-colour logo on white, no app navigation. */}
      <div className="flex items-center justify-between">
        <Wordmark />
        {p.demo && <StatusChip status="demo" />}
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Packaging compliance passport</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{p.packName}</h1>
            {p.declarant && (
              <p className="mt-0.5 text-sm text-neutral-600">
                Declared by <span className="font-medium text-neutral-800">{p.declarant.legalName}</span>
                {` · ${countryLabel(p.declarant.country)}`}
                {p.declarant.role ? ` · ${legalRoleLabel(p.declarant.role)}` : ""}
              </p>
            )}
          </div>
          <StatusChip status={toChipStatus(p.overallVerdict)} />
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

      {/* Declarant registrations — per Member State. A producer register is a
          PUBLIC register; showing the number here is how a reader checks the
          operator is registered where it places packaging. Address and contact
          details stay out of the public tier. */}
      {p.declarant && (p.declarant.registrations?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Producer registrations
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Registration numbers held by {p.declarant.legalName}, per Member State. This screening
            does not check them against the register.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {p.declarant.registrations!.map((r) => (
              <li key={`${r.jurisdiction}-${r.registrationNumber}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{countryLabel(r.jurisdiction)}</span>
                <span className="font-mono text-xs text-neutral-700">{r.registrationNumber}</span>
                <span className="text-xs text-neutral-500">{r.registerName ?? r.scheme}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Counted from the RULE LIST below, not from payload.counts.
          payload.counts is per CARD — a rule that applies to three components
          counts three times there — while the list groups those into one row.
          The two disagreed on screen (4 qualified, a list of 3), and a count that
          does not match the thing beneath it is worse than no count.
          payload.counts stays in the payload untouched, for hash compatibility
          and for the gated report, which legitimately counts per card. */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[...ACTIVE_GROUPS, ...QUIET_GROUPS].map((g) => (
          <Count
            key={g.anchor}
            n={checkpoints.filter((c) => c.verdict === g.verdict).length}
            label={g.label}
            href={`#${g.anchor}`}
          />
        ))}
      </div>

      {/* Per-rule public detail (disclosure model v3-lite). The rule set is public
          law, so showing which rules are met removes doubt; Sprint 10 adds WHAT
          meets them and WHO stands behind it, because "Qualified" alone lets a
          reader assume the strongest possible evidence. See the 2026-09-13
          decision-log entry widening the public tier.

          Rows are <details>: collapsed shows only a verdict and a plain rule
          name, which is all that fits usefully at 375px. No client JavaScript —
          this page is reached by QR on whatever phone is to hand. */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Rules</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          Every rule that applies to this packaging, what meets it, and who stands behind that.
          Tap a rule to open it.
        </p>

        {p.corpus && (
          <p className="mt-2 text-xs text-neutral-400">
            Rule set as of {p.corpus.asOf} — {p.corpus.releases.length === 1 ? "release" : "releases"}{" "}
            {p.corpus.releases.join(", ")}.
          </p>
        )}

        <div className="mt-4 space-y-5">
          {ACTIVE_GROUPS.map(({ verdict, label, anchor }) => {
            const rows = checkpoints.filter((c) => c.verdict === verdict);
            if (rows.length === 0) return <div key={anchor} id={anchor} className="scroll-mt-4" />;
            return (
              <section key={anchor} id={anchor} className="scroll-mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {label} ({rows.length})
                </h3>
                <ul className="space-y-2">
                  {rows.map((c) => (
                    <li key={`${c.checkpointId}-${c.version}`}>
                      <RuleRow c={c} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* Not-applicable and Upcoming collapse to ONE line each. Neither is
              something the reader has to act on, and giving them the same weight
              as a gap is what made the old list unreadable on a phone. */}
          {QUIET_GROUPS.map(({ verdict, label, anchor, blurb }) => {
            const rows = checkpoints.filter((c) => c.verdict === verdict);
            if (rows.length === 0) return <div key={anchor} id={anchor} className="scroll-mt-4" />;
            return (
              <details key={anchor} id={anchor} className="scroll-mt-4 rounded-md border border-neutral-100 bg-neutral-50">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-xs text-neutral-600 marker:content-none">
                  <span className="font-semibold uppercase tracking-wide text-neutral-400">
                    {label} ({rows.length})
                  </span>
                  <span className="ml-2 text-neutral-500">{blurb(rows)}</span>
                  <span className="ml-2 text-sky-700 underline">show</span>
                </summary>
                <ul className="space-y-2 px-3 pb-3">
                  {rows.map((c) => (
                    <li key={`${c.checkpointId}-${c.version}`}>
                      <RuleRow c={c} />
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </div>

      {/* Materials — the traceability tier. One card per component, because at
          375px a table of nine fields is unreadable and a phone user scrolls
          happily. Public-tier rules hold: no contact routes, no document bodies,
          no measured values beyond a rule's key-value line. */}
      {(p.components?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Materials</h2>
          <p className="mt-1 text-xs text-neutral-600">{materialsSummary(p.components!)}</p>
          <ul className="mt-3 space-y-3">
            {p.components!.map((c) => (
              <li key={c.line} className="rounded-md border border-neutral-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug text-neutral-800">{c.name}</p>
                  <span className="shrink-0 text-xs text-neutral-400">{c.line}</span>
                </div>
                <dl className="mt-2 space-y-1 text-xs">
                  <Row label="Material">{materialLabel(c.material)}</Row>
                  {c.massKg != null && <Row label="Mass">{Number(c.massKg.toPrecision(3))} kg</Row>}
                  {c.countryOfOrigin && <Row label="Origin">{c.countryOfOrigin}</Row>}
                  {c.supplierName && <Row label="Made by">{c.supplierName}</Row>}
                  <Row label="Recycled share">
                    {c.recycledShare == null ? (
                      /* Not stated is NOT zero. Rendering a blank as 0% would put
                         a claim in the supplier's mouth that nobody made. */
                      <span className="text-neutral-400">not stated</span>
                    ) : (
                      `${Math.round(c.recycledShare * 100)}%`
                    )}
                  </Row>
                  <Row label="Footprint">
                    {c.footprint ? (
                      <>
                        {c.footprint.kgCo2e} kg CO<sub>2</sub>e
                        <span className="block text-neutral-400">{c.footprint.datasetName}</span>
                      </>
                    ) : (
                      <span className="text-neutral-400">excluded — {c.footprintExcludedReason}</span>
                    )}
                  </Row>
                </dl>
                {c.attestations.length > 0 && (
                  <div className="mt-2 border-t border-neutral-100 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Attestations
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-neutral-600">
                      {c.attestations.map((a, i) => (
                        <li key={i}>
                          <span className="font-medium text-neutral-800">{a.evidenceTypeLabel}</span>
                          {a.issuerName && <span> — {a.issuerName}</span>}
                          {a.issuerType && (
                            <span className="text-neutral-400"> ({ISSUER_TYPE_LABEL[a.issuerType] ?? a.issuerType})</span>
                          )}
                          {a.issuedDate && <span className="text-neutral-400"> · {a.issuedDate}</span>}
                          {a.accreditationRef && (
                            <span className="block text-neutral-500">Accreditation: {a.accreditationRef}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Cradle-to-gate footprint</h2>
          <div className="text-lg font-semibold">{p.pcf.totalKgCo2e} {p.pcf.unit}</div>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{PCF_DISCLAIMER}</p>
        {p.pcf.unresolvedComponents > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            {p.pcf.unresolvedComponents} component(s) excluded — no weight, or no emission factor
            selected for the material. The figure above is therefore partial.
          </p>
        )}
        {/* Attribution for the datasets the figure rests on. The source NAME is
            always shown: a number whose origin is secret is not evidence of
            anything. The factor VALUE is the dataset owner's licensed content
            and appears only where the terms were read and recorded as
            permitting it. */}
        {(p.pcf.factorSources?.length ?? 0) > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <p className="text-xs font-medium text-neutral-600">Emission factors used</p>
            <ul className="mt-1.5 space-y-1 text-xs text-neutral-500">
              {p.pcf.factorSources!.map((f) => (
                <li key={`${f.material}-${f.source}-${f.year}`}>
                  <span className="font-medium text-neutral-700">{materialLabel(f.material)}</span>
                  {" — "}
                  {factorSourceLabel(f)} · {f.region} · {f.year} · {factorTierLabel(f.tier)}
                  {f.value != null && f.unit ? (
                    <span className="font-mono"> · {formatFactorValue(f.value)} {f.unit}</span>
                  ) : (
                    <span className="italic"> · value not republished under the dataset licence</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
