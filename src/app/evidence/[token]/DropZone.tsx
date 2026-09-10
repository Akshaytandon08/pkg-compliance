"use client";

import { useEffect, useState } from "react";

// Client drop zone for the public intake. Posts one file to the token-scoped
// public API. Client-side type/size hints are UX only — the server sniffs and
// validates authoritatively.
const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_BYTES = 15 * 1024 * 1024;

type State = { kind: "idle" } | { kind: "uploading" } | { kind: "done" } | { kind: "error"; message: string };

// Extraction runs inside the upload request and takes ~45s at the median, so a
// static "Uploading…" looks frozen for most of a minute. Count elapsed seconds
// and say what is actually happening — reading the document — with the expected
// duration, so waiting feels like progress rather than a hang.
const READING_AFTER_SECONDS = 3;

export function DropZone({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Subscribe only: the counter is reset where the upload starts, so this
    // effect never calls setState synchronously in its body.
    if (state.kind !== "uploading") return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state.kind]);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: "File is too large (max 15 MB)." });
      return;
    }
    setElapsed(0);
    setState({ kind: "uploading" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/public/evidence/${token}`, { method: "POST", body: form });
      if (res.ok) {
        setState({ kind: "done" });
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ kind: "error", message: data.error ?? "Upload failed. Please try again." });
      }
    } catch {
      setState({ kind: "error", message: "Upload failed. Please check your connection." });
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
  }

  if (state.kind === "done") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thank you — your document has been received. You may close this page.
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors ${
          dragging ? "border-emerald-400 bg-emerald-50" : "border-neutral-300 bg-neutral-50 hover:border-neutral-400"
        }`}
      >
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={state.kind === "uploading"}
          onChange={(e) => onFiles(e.target.files)}
        />
        {state.kind === "uploading" ? (
          <span className="flex flex-col items-center" role="status" aria-live="polite">
            <span className="font-medium text-neutral-700">
              {elapsed < READING_AFTER_SECONDS ? "Uploading…" : "Reading document…"}
            </span>
            <span className="mt-1 text-xs text-neutral-500">
              {elapsed}s elapsed{elapsed >= READING_AFTER_SECONDS ? " · usually about 45 seconds" : ""}
            </span>
            {/* Indeterminate bar: honest about not knowing the fraction done. */}
            <span aria-hidden="true" className="mt-2 block h-1 w-40 overflow-hidden rounded bg-neutral-200">
              <span className="block h-full w-1/3 animate-pulse rounded bg-p600" />
            </span>
          </span>
        ) : (
          <>
            <span className="font-medium text-neutral-700">Drop a file here or click to choose</span>
            <span className="mt-1 text-xs text-neutral-500">PDF, JPG or PNG · up to 15 MB</span>
          </>
        )}
      </label>
      {state.kind === "error" && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
    </div>
  );
}
