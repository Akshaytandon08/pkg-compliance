"use client";

import { useState } from "react";
import { FileText, Pencil } from "lucide-react";
import type { EvidenceRelied } from "@/lib/report/ruleRows";
import { EvidenceDrawer } from "./EvidenceDrawer";

// The "Evidence on file" list. Each entry opens the same drawer the in-row chips
// use, so evidence is viewable from wherever it is mentioned. Previously this
// list printed the raw evidence type (`supplier_declaration`).
export function EvidenceList({ items, pendingCount }: { items: EvidenceRelied[]; pendingCount: number }) {
  const [drawerItem, setDrawerItem] = useState<EvidenceRelied | null>(null);
  if (items.length === 0 && pendingCount === 0) return null;
  return (
    <div className="mt-1 mb-2 rounded-md border border-n200 bg-n50/60 px-3 py-2 text-xs">
      <EvidenceDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
      <p className="font-medium text-n700">Evidence on file</p>
      {items.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {items.map((item) => {
            const openable = item.source === "extracted" || item.sourceDocumentId !== null;
            const Glyph = openable ? FileText : Pencil;
            const detail = [item.typeLabel, item.reference, item.validity].filter(Boolean).join(" · ");
            return (
              <li key={item.docId}>
                <button
                  type="button"
                  onClick={() => setDrawerItem(item)}
                  aria-label={`${openable ? "Open" : "View"} evidence: ${detail}`}
                  className="inline-flex items-center gap-1 rounded-full border border-n300 bg-white px-2 py-0.5 text-n800 hover:bg-n100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p600"
                >
                  <Glyph aria-hidden="true" className="size-3 shrink-0" />
                  <span>{detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pendingCount > 0 && (
        <p className="mt-1 text-amber-700">
          {pendingCount} extracted {pendingCount === 1 ? "value" : "values"} awaiting confirmation — not yet counted as evidence.
        </p>
      )}
    </div>
  );
}
