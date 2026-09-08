"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Claim {
  id: number;
  claimType: string;
  parameter: string | null;
  value: string | null;
  unit: string | null;
  issuer: string | null;
  expiry: string | null;
  confidence: number | null;
  status: string;
  provenance: { page: number } | null;
  documentFilename: string;
  componentId: number | null;
  model: string;
  promptVersion: string;
  sourceUrl: string;
}
interface Component {
  id: number;
  name: string;
  material: string;
}

const LOW_CONFIDENCE = 0.7;

export function ClaimReview({
  assessmentId,
  claims,
  components,
}: {
  assessmentId: number;
  claims: Claim[];
  components: Component[];
}) {
  return (
    <div className="space-y-3">
      {claims.map((c) => (
        <ClaimRow key={c.id} assessmentId={assessmentId} claim={c} components={components} />
      ))}
    </div>
  );
}

function ClaimRow({
  assessmentId,
  claim,
  components,
}: {
  assessmentId: number;
  claim: Claim;
  components: Component[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(claim.value ?? "");
  const [expiry, setExpiry] = useState(claim.expiry ?? "");
  const [componentId, setComponentId] = useState<number | "">(claim.componentId ?? "");

  const pending = claim.status === "pending";
  const lowConfidence = claim.confidence != null && claim.confidence < LOW_CONFIDENCE;

  async function act(body: Record<string, unknown>, method: "POST" | "PATCH") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/claims/${claim.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId: componentId === "" ? undefined : componentId, ...body }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Action failed.");
      }
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const badge =
    claim.status === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : claim.status === "rejected"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">{claim.claimType}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${badge}`}>{claim.status}</span>
            {lowConfidence && pending && (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                low confidence — verify
              </span>
            )}
          </div>
          {!editing ? (
            <p className="mt-1 text-sm text-neutral-700">
              {claim.parameter ? `${claim.parameter}: ` : ""}
              <span className="font-medium">{claim.value ?? "—"}</span>
              {claim.unit ? ` ${claim.unit}` : ""}
              {claim.expiry ? ` · expires ${claim.expiry}` : ""}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="value"
              />
              <input
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="expiry YYYY-MM-DD"
              />
            </div>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {claim.confidence != null && <>confidence {(claim.confidence * 100).toFixed(0)}% · </>}
            <a href={claim.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-neutral-700">
              {claim.documentFilename}
              {claim.provenance ? `, p.${claim.provenance.page}` : ""}
            </a>
            {" · "}
            {claim.model} / {claim.promptVersion}
          </p>
        </div>
      </div>

      {pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
            value={componentId}
            onChange={(e) => setComponentId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Attach to component…</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.material})
              </option>
            ))}
          </select>
          {!editing ? (
            <>
              <button
                disabled={busy}
                onClick={() => act({ action: "confirm" }, "POST")}
                className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                disabled={busy}
                onClick={() => setEditing(true)}
                className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() => act({ action: "reject" }, "POST")}
                className="rounded border border-neutral-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                disabled={busy}
                onClick={() => act({ edits: { value, expiry: expiry || null } }, "PATCH")}
                className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save &amp; confirm
              </button>
              <button
                disabled={busy}
                onClick={() => setEditing(false)}
                className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
