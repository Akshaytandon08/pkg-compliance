"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink, FileText, Pencil } from "lucide-react";
import { StatusChip, toChipStatus } from "@/app/_components/StatusChip";
import { AddEvidenceForm } from "./AddEvidenceForm";
import type { RuleRow, EvidenceRelied } from "@/lib/report/ruleRows";

// One row per applicable rule, in a real table: a packaging manager scans down a
// column to answer "what is outstanding?", which a list of cards cannot support.
// Below the md breakpoint the same rows render as stacked cards in the SAME field
// order — a table squeezed into 375px is unreadable, but the reading order that
// makes sense on a phone is the one the columns already imply.

type SortKey = "name" | "verdict";

// Most urgent first when sorted by verdict. `upcoming` sorts last: it is not
// outstanding today.
const VERDICT_ORDER: Record<string, number> = {
  gap: 0, conditional: 1, qualified: 2, not_applicable: 3, upcoming: 4,
};

function EvidenceChip({ item, onOpen }: { item: EvidenceRelied; onOpen?: (item: EvidenceRelied) => void }) {
  const openable = item.source === "extracted" || item.sourceDocumentId !== null;
  const Glyph = openable ? FileText : Pencil;
  const label = [item.typeLabel, item.reference, item.validity].filter(Boolean).join(" · ");
  const common = "inline-flex max-w-full items-center gap-1 rounded-full border border-n300 bg-n50 px-2 py-0.5 text-xs text-n800";
  if (!onOpen) {
    return (
      <span className={common}>
        <Glyph aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`${common} cursor-pointer hover:bg-n100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600`}
      aria-label={`${openable ? "Open" : "View"} evidence: ${label}`}
    >
      <Glyph aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CitationLink({ row }: { row: RuleRow }) {
  if (!row.citationUrl) return <span className="text-n600">{row.citationText}</span>;
  return (
    <a
      href={row.citationUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-start gap-1 text-p700 underline decoration-p700/40 underline-offset-2 hover:decoration-p700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
    >
      <span>{row.citationText}</span>
      <ExternalLink aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      <span className="sr-only">(opens the primary source in a new tab)</span>
    </a>
  );
}

function EvidenceCell({ row, onOpenEvidence }: { row: RuleRow; onOpenEvidence?: (i: EvidenceRelied) => void }) {
  if (row.reliedOn.length > 0) {
    return (
      <ul className="flex flex-col items-start gap-1">
        {row.reliedOn.map((e) => (
          <li key={e.docId} className="max-w-full">
            <EvidenceChip item={e} onOpen={onOpenEvidence} />
          </li>
        ))}
      </ul>
    );
  }
  if (row.requiredText) return <span className="text-n700">{row.requiredText}</span>;
  return <span className="text-n600">—</span>;
}

function Details({ row, id }: { row: RuleRow; id: string }) {
  return (
    <div id={id} className="space-y-2 bg-n50/60 px-3 py-3 text-sm">
      <p className="text-n700">{row.requirementText}</p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {row.thresholds.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Thresholds</dt>
            <dd className="text-n800">
              <ul className="list-disc pl-4">{row.thresholds.map((t) => <li key={t}>{t}</li>)}</ul>
            </dd>
          </div>
        )}
        {row.phaseIn && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Phase-in</dt>
            <dd className="text-n800">{row.phaseIn}</dd>
          </div>
        )}
        {row.exemptions.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Exemptions</dt>
            <dd className="text-n800">
              <ul className="list-disc pl-4">
                {row.exemptions.map((e, i) => <li key={i}>{e.scope} <span className="text-n600">({e.basis})</span></li>)}
              </ul>
            </dd>
          </div>
        )}
        {row.confidence && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Analyst confidence</dt>
            <dd className="text-n800">{row.confidence}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Rule reference</dt>
          <dd className="font-mono text-xs text-n600">{row.checkpointId}@{row.version}</dd>
        </div>
      </dl>
      {row.guidance.length > 0 && (
        <div className="rounded border border-n200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-n600">How to obtain this evidence</p>
          <div className="space-y-2">
            {row.guidance.map((g) => (
              <div key={g.typeLabel} className="text-xs">
                <p className="font-medium text-n800">{g.typeLabel}</p>
                {g.pending ? (
                  <p className="text-n600">Guidance pending approval.</p>
                ) : (
                  <div className="mt-0.5 space-y-1 text-n700">
                    {g.issuerGuidance && <p>{g.issuerGuidance}</p>}
                    {g.mustContain.length > 0 && (
                      <div>
                        <span className="font-medium">Must contain:</span>
                        <ul className="ml-4 list-disc">{g.mustContain.map((m) => <li key={m}>{m}</li>)}</ul>
                      </div>
                    )}
                    {g.redFlags.length > 0 && (
                      <div>
                        <span className="font-medium">Watch for:</span>
                        <ul className="ml-4 list-disc">{g.redFlags.map((m) => <li key={m}>{m}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Only when an assessor actually annotated the component. */}
      {row.assessorFlag && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Assessor flag: </span>{row.assessorFlag}
        </p>
      )}
    </div>
  );
}

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

/** Declared at module scope: a component created during render would reset its
 *  state on every keystroke of the parent. */
function SortButton({
  k,
  sort,
  onToggle,
  children,
}: {
  k: SortKey;
  sort: SortState;
  onToggle: (k: SortKey) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className="inline-flex items-center gap-1 font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
    >
      {children}
      <span aria-hidden="true" className="text-n500">{sort?.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

/** The Action cell: the delta action in words, plus the inline Add-evidence form
 *  where one applies. An informational row gets neither — there is nothing to do
 *  about a rule that does not apply yet. */
function ActionCell({
  row,
  assessmentId,
  componentId,
  componentName,
}: {
  row: RuleRow;
  assessmentId?: number;
  componentId?: number;
  componentName?: string;
}) {
  if (row.informational) return <span className="text-n600">—</span>;
  const canAdd = row.requiredText !== null && assessmentId != null && componentId != null;
  return (
    <div className="space-y-2">
      {row.action ? <span className="text-n800">{row.action}</span> : <span className="text-n600">—</span>}
      {row.requestTemplates.length > 0 && (
        <div className="space-y-1 text-xs">
          <span className="text-n600">Request evidence:</span>
          {row.requestTemplates.map((t) => (
            <div key={t.label} className="flex flex-wrap items-center gap-1.5">
              <a
                href={t.docxUrl}
                className="rounded border border-n300 px-2 py-0.5 hover:bg-n100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
              >
                ↓ {t.label} (.docx)
              </a>
              <a
                href={t.pdfUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-n600 underline hover:text-n800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
              >
                preview
              </a>
            </div>
          ))}
        </div>
      )}
      {canAdd && (
        <AddEvidenceForm
          assessmentId={assessmentId}
          componentId={componentId}
          componentName={componentName ?? ""}
          evidenceTypes={row.acceptedEvidenceTypes}
        />
      )}
    </div>
  );
}

export function RuleTable({
  rows,
  caption,
  onOpenEvidence,
  assessmentId,
  componentId,
  componentName,
}: {
  rows: RuleRow[];
  caption: string;
  onOpenEvidence?: (item: EvidenceRelied) => void;
  /** Present for component sections, so a row can offer the inline form. */
  assessmentId?: number;
  componentId?: number;
  componentName?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "name") return factor * a.name.localeCompare(b.name);
      const av = VERDICT_ORDER[a.verdict ?? "zz"] ?? 9;
      const bv = VERDICT_ORDER[b.verdict ?? "zz"] ?? 9;
      return factor * (av - bv || a.name.localeCompare(b.name));
    });
  }, [rows, sort]);

  const ariaSort = (key: SortKey) =>
    sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const toggleRow = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (rows.length === 0) return null;

  return (
    <>
      {/* ---------- table (md and up) ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-n300 text-xs uppercase tracking-wide text-n600">
              <th scope="col" aria-sort={ariaSort("name")} className="py-2 pr-3"><SortButton k="name" sort={sort} onToggle={toggleSort}>Rule</SortButton></th>
              <th scope="col" aria-sort={ariaSort("verdict")} className="py-2 pr-3"><SortButton k="verdict" sort={sort} onToggle={toggleSort}>Verdict</SortButton></th>
              <th scope="col" className="py-2 pr-3 font-semibold">Why</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Evidence relied on</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Citation</th>
              <th scope="col" className="py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const detailsId = `details-${row.key}`;
              const isOpen = open.has(row.key);
              return (
                <Fragment key={row.key}>
                  <tr className={`border-b border-n200 align-top ${row.informational ? "text-n600" : ""}`}>
                    <th scope="row" className="py-3 pr-3 font-normal">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.key)}
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        className="flex items-start gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
                      >
                        <ChevronRight aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-n600 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        <span>
                          <span className={`font-semibold ${row.informational ? "text-n700" : "text-n900"}`}>{row.name}</span>
                          <span className="sr-only">{isOpen ? " (details shown)" : " (show details)"}</span>
                        </span>
                      </button>
                    </th>
                    <td className="py-3 pr-3">
                      <StatusChip status={toChipStatus(row.verdict ?? "pending")} label={row.verdictText} ariaLabel={row.verdictAria} />
                    </td>
                    <td className="py-3 pr-3 text-n700">{row.why}</td>
                    <td className="py-3 pr-3"><EvidenceCell row={row} onOpenEvidence={onOpenEvidence} /></td>
                    <td className="py-3 pr-3 max-w-[18rem]"><CitationLink row={row} /></td>
                    <td className="py-3 min-w-[12rem]"><ActionCell row={row} assessmentId={assessmentId} componentId={componentId} componentName={componentName} /></td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-n200">
                      <td colSpan={6} className="p-0"><Details row={row} id={detailsId} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------- stacked cards (below md), same field order ---------- */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((row) => {
          const detailsId = `m-details-${row.key}`;
          const isOpen = open.has(row.key);
          return (
            <li key={row.key} className={`rounded-md border border-n200 p-3 ${row.informational ? "text-n600" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <h4 className={`text-sm font-semibold ${row.informational ? "text-n700" : "text-n900"}`}>{row.name}</h4>
                <StatusChip status={toChipStatus(row.verdict ?? "pending")} label={row.verdictText} ariaLabel={row.verdictAria} />
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-n600">Why</dt><dd className="text-n700">{row.why}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-n600">Evidence relied on</dt><dd><EvidenceCell row={row} onOpenEvidence={onOpenEvidence} /></dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-n600">Citation</dt><dd><CitationLink row={row} /></dd></div>
                {!row.informational && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-n600">Action</dt>
                    <dd><ActionCell row={row} assessmentId={assessmentId} componentId={componentId} componentName={componentName} /></dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                onClick={() => toggleRow(row.key)}
                aria-expanded={isOpen}
                aria-controls={detailsId}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-p700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
              >
                <ChevronRight aria-hidden="true" className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                {isOpen ? "Hide details" : "Show details"}
              </button>
              {isOpen && <div className="mt-2 rounded border border-n200"><Details row={row} id={detailsId} /></div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
