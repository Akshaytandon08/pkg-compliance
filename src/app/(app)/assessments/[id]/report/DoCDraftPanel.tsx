"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LanguageOption } from "@/lib/doc-export/languages";

// Server error categories → human labels shown in the panel (Part 0d), so the
// user sees "Storage unavailable" / "Template not approved" etc., never a bare
// "Generation failed." The full error is in the server logs, keyed by assessment.
const CATEGORY_LABEL: Record<string, string> = {
  storage_unavailable: "Storage unavailable",
  template_not_approved: "Template not approved",
  eligibility_changed: "Eligibility changed",
  render_failed: "Render failed",
  not_found: "Assessment not found",
};

interface Draft {
  id: number;
  version: number;
  language: string;
  status: "draft" | "superseded";
  docxFilename: string;
  pdfFilename: string;
  createdAt: string;
}

export function DoCDraftPanel({
  assessmentId,
  eligible,
  blockers,
  languageOptions,
  drafts,
}: {
  assessmentId: number;
  eligible: boolean;
  blockers: string[];
  languageOptions: LanguageOption[];
  drafts: Draft[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/doc-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: selected }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string; blockers?: string[]; category?: string };
        // Prefer the server's error category label, then its message/blockers; the
        // bare "Generation failed." remains only for a non-JSON/network failure.
        const label = data.category ? `${CATEGORY_LABEL[data.category] ?? "Generation failed"}: ` : "";
        setError(label + (data.blockers?.join(" ") ?? data.error ?? "Generation failed."));
      }
    } catch {
      setError("Generation failed (network error).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="doc-draft" className="scroll-mt-14 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Draft EU declaration of conformity</h2>
      <p className="mt-1 text-xs text-neutral-500">
        A data-assembly aid for the manufacturer to complete and sign. It is a DRAFT — never a declaration,
        and never issued by this tool.
      </p>

      {!eligible ? (
        <div className="mt-3">
          <button
            type="button"
            disabled
            title="Not available yet"
            className="cursor-not-allowed rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800"
          >
            Generate draft (unavailable)
          </button>
          <ul className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-300">
            {blockers.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3">
          {languageOptions.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span className="font-medium">English is always generated. Also generate:</span>
              {languageOptions.map((l) => (
                <label key={l.code} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selected.includes(l.code)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, l.code] : s.filter((x) => x !== l.code)))
                    }
                  />
                  {l.label}
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-md bg-p600 px-3 py-1.5 text-sm font-medium text-white hover:bg-p700 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate draft (.docx + PDF preview)"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Generated drafts</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className={d.status === "superseded" ? "text-neutral-400 line-through" : "text-neutral-700"}>
                  v{d.version} · {d.language.toUpperCase()}
                </span>
                <a href={`/api/assessments/${assessmentId}/doc-draft/${d.id}?format=pdf`} target="_blank" rel="noreferrer" className="text-neutral-500 underline hover:text-neutral-700">
                  preview PDF
                </a>
                <a href={`/api/assessments/${assessmentId}/doc-draft/${d.id}?format=docx`} className="text-neutral-500 underline hover:text-neutral-700">
                  download .docx
                </a>
                {d.status === "superseded" && <span className="text-xs text-neutral-400">(superseded)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
