"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { evidenceTypeLabel } from "@/lib/report/labels";

const input =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";

export function AddEvidenceForm({
  assessmentId,
  componentId,
  componentName,
  evidenceTypes,
}: {
  assessmentId: number;
  componentId: number;
  componentName: string;
  evidenceTypes: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(evidenceTypes[0] ?? "supplier_declaration");
  const [reference, setReference] = useState("");
  const [issued, setIssued] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          evidenceType: type,
          reference: reference || null,
          issuedDate: issued || null,
          expiryDate: expiry || null,
          // Pre-scoped to this component, so the added document covers it.
          scopeComponents: [componentName],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add evidence.");
      setOpen(false);
      setReference("");
      setIssued("");
      setExpiry("");
      // Re-evaluate and refresh the card in place (server component refetch).
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add evidence.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        + Add evidence
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
      <p className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        Add evidence for {componentName}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Type
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {evidenceTypes.map((t) => (
              <option key={t} value={t}>
                {evidenceTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Reference
          <input className={input} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="text-xs">
          Issued
          <input type="date" className={input} value={issued} onChange={(e) => setIssued(e.target.value)} />
        </label>
        <label className="text-xs">
          Expires
          <input type="date" className={input} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saving ? "Saving…" : "Save evidence"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
