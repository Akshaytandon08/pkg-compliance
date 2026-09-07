"use client";

import { useState } from "react";

type Result = {
  token: string;
  version: number;
  contentHash: string;
  changed: boolean;
  url: string;
  qrDataUrl: string;
};

export function GeneratePassport({ assessmentId }: { assessmentId: number }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/passport`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate passport.");
      setResult(data as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate passport.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Public passport</h2>
          <p className="mt-1 text-xs text-neutral-500">
            A shareable public-tier page (material summary, verdict counts, footprint) — no evidence, no
            per-checkpoint detail. The link is unguessable; regenerating after a data change adds a new
            hash-chained version.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {busy ? "Generating…" : result ? "Regenerate passport" : "Generate passport"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qrDataUrl} alt="Passport QR code" width={160} height={160} className="rounded border border-neutral-200 dark:border-neutral-700" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="text-neutral-500">
              {result.changed ? `Version ${result.version} created.` : `No data change — showing version ${result.version}.`}
            </p>
            <p className="mt-2 font-medium">Public URL</p>
            <a href={result.url} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline dark:text-sky-300">
              {result.url}
            </a>
            <p className="mt-2 font-medium">Content hash</p>
            <p className="break-all font-mono text-neutral-500">{result.contentHash}</p>
            <div className="mt-3 flex gap-2">
              <a href={result.qrDataUrl} download={`passport-${result.token}.png`} className="rounded border border-neutral-300 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                ↓ Download QR
              </a>
              <a href={result.url} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                Open passport ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
