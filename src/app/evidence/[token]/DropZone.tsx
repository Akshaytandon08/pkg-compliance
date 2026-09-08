"use client";

import { useState } from "react";

// Client drop zone for the public intake. Posts one file to the token-scoped
// public API. Client-side type/size hints are UX only — the server sniffs and
// validates authoritatively.
const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_BYTES = 15 * 1024 * 1024;

type State = { kind: "idle" } | { kind: "uploading" } | { kind: "done" } | { kind: "error"; message: string };

export function DropZone({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: "File is too large (max 15 MB)." });
      return;
    }
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
          <span className="text-neutral-600">Uploading…</span>
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
