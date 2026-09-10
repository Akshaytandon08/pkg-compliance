"use client";

import { useEffect, useRef } from "react";
import { FileText, Pencil, X } from "lucide-react";
import type { EvidenceRelied } from "@/lib/report/ruleRows";

// Evidence you can actually look at. A chip that names a document but cannot show
// it asks the reader to trust the verdict; this opens the record — the stored file
// itself where there is one, with the provenance the extraction recorded.
//
// Dialog semantics are done by hand rather than with <dialog>, so focus behaviour
// is explicit and testable: Escape closes, focus is trapped, focus returns to the
// chip that opened it, and the dialog is labelled and marked aria-modal.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-n600">{label}</dt>
      <dd className="text-sm text-n800">{children}</dd>
    </div>
  );
}

export function EvidenceDrawer({ item, onClose }: { item: EvidenceRelied | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The element that had focus before opening, so it can be restored on close.
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!item) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap: cycle within the panel.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus?.();
    };
  }, [item, onClose]);

  if (!item) return null;

  const extracted = item.source === "extracted";
  const Glyph = extracted || item.sourceUrl ? FileText : Pencil;
  const titleId = "evidence-drawer-title";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* Scrim. Clicking it closes, but it is not the only way out (Escape works). */}
      <button type="button" aria-label="Close evidence details" onClick={onClose} className="absolute inset-0 cursor-default bg-n900/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-n200 px-4 py-3">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-n900">
            <Glyph aria-hidden="true" className="size-4 shrink-0 text-n600" />
            {item.typeLabel}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded p-1 text-n600 hover:bg-n100 hover:text-n800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
            aria-label="Close evidence details"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <dl className="divide-y divide-n100">
            <Row label="Kind">{extracted ? "Read from a document" : "Entered manually"}</Row>
            {item.reference && <Row label="Reference">{item.reference}</Row>}
            {item.issuedDate && <Row label="Issued">{item.issuedDate}</Row>}
            {item.expiryDate && <Row label="Valid to">{item.expiryDate}</Row>}
            {item.scope.components.length > 0 && <Row label="Covers components">{item.scope.components.join(", ")}</Row>}
            {item.scope.materials.length > 0 && <Row label="Covers materials">{item.scope.materials.join(", ")}</Row>}
            {item.scope.parameters.length > 0 && <Row label="Covers parameters">{item.scope.parameters.join(", ")}</Row>}
          </dl>

          {item.claims.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-n600">Values read from this component&apos;s documents</h3>
              {/* Matched by component: the stored evidence row does not carry the
                  extracted-claim id, so this is the component's claim set rather
                  than this row's alone. Said plainly rather than implied. */}
              <ul className="mt-2 space-y-1 text-sm">
                {item.claims.map((c, i) => (
                  <li key={i} className="rounded border border-n200 px-2 py-1">
                    <span className="font-medium text-n800">{c.parameter ?? "—"}</span>
                    {c.value && <span className="text-n800">: {c.value}</span>}
                    {c.issuer && <span className="text-n600"> · {c.issuer}</span>}
                    {c.page != null && <span className="text-n600"> · page {c.page}</span>}
                    <span className="ml-1 text-xs text-n600">({c.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.sourceUrl ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-n600">Document</h3>
              <iframe
                src={item.sourceUrl}
                title={`${item.typeLabel} — stored document`}
                className="mt-2 h-96 w-full rounded border border-n200"
              />
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-sm text-p700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
              >
                Open in a new tab
              </a>
            </div>
          ) : (
            <p className="mt-4 rounded border border-dashed border-n300 px-3 py-2 text-sm text-n600">
              No stored file for this entry — it is a typed record, so there is nothing to preview.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
