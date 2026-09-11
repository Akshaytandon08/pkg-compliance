"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BOM_MATERIALS,
  CUSTOM_VS_STANDARDISED,
  DESTINATION_MARKETS,
  EU_MEMBER_STATES,
  EVIDENCE_TYPES,
  PERSONAS,
  RISK_ANNOTATIONS,
  SPEC_DEFINED_BY,
} from "@/lib/vocab";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { OrganisationPicker } from "./OrganisationPicker";

const input =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900";
const label = "block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1";
const card =
  "rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
const btn =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
const btnGhost =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

type EvidenceRow = {
  evidenceType: string;
  reference: string;
  issuedDate: string;
  expiryDate: string;
  scopeComponents: string;
  scopeMaterials: string;
  scopeParameters: string;
};

type ComponentRow = {
  name: string;
  material: string;
  composition: string;
  weight: string;
  sourcedFrom: string;
  riskAnnotation: string; // "" = none | "no_inherent_risk" | "at_risk"
  riskRationale: string;
  evidence: EvidenceRow[];
};

const emptyEvidence = (): EvidenceRow => ({
  evidenceType: EVIDENCE_TYPES[0],
  reference: "",
  issuedDate: "",
  expiryDate: "",
  scopeComponents: "",
  scopeMaterials: "",
  scopeParameters: "",
});

const emptyComponent = (): ComponentRow => ({
  name: "",
  material: BOM_MATERIALS[0],
  composition: "",
  weight: "",
  sourcedFrom: "",
  riskAnnotation: "",
  riskRationale: "",
  evidence: [],
});

const csv = (s: string): string[] | undefined => {
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
};

export default function NewAssessmentPage() {
  const [packName, setPackName] = useState("");
  const [description, setDescription] = useState("");
  const [asOf, setAsOf] = useState("2026-08-12");

  const [markets, setMarkets] = useState<string[]>(["EU"]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [extraDestinations, setExtraDestinations] = useState("");
  const [foodContact, setFoodContact] = useState(false);
  const [persona, setPersona] = useState<string>(PERSONAS[1].value);
  const [declaredReusable, setDeclaredReusable] = useState(false);
  const [packagingBranded, setPackagingBranded] = useState(false);
  const [customVsStd, setCustomVsStd] = useState<string>(CUSTOM_VS_STANDARDISED[0]);
  const [specDefinedBy, setSpecDefinedBy] = useState<string>(SPEC_DEFINED_BY[0]);
  const [assessorName, setAssessorName] = useState("");
  const [organisationId, setOrganisationId] = useState<number | null>(null);

  const [components, setComponents] = useState<ComponentRow[]>([emptyComponent()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const toggleDestination = (ms: string) =>
    setDestinations((d) => (d.includes(ms) ? d.filter((x) => x !== ms) : [...d, ms]));
  const toggleMarket = (m: string) =>
    setMarkets((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  const updateComponent = (i: number, patch: Partial<ComponentRow>) =>
    setComponents((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const updateEvidence = (ci: number, ei: number, patch: Partial<EvidenceRow>) =>
    setComponents((cs) =>
      cs.map((c, idx) =>
        idx === ci
          ? { ...c, evidence: c.evidence.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : c,
      ),
    );

  async function submit() {
    setSubmitting(true);
    setError(null);
    const allDestinations = [...destinations, ...(csv(extraDestinations) ?? [])];
    // Keep the superset invariant: choosing any EU Member State implies the "EU"
    // market, even if the market chip was deselected.
    const allMarkets = [...new Set([...markets, ...(allDestinations.length ? ["EU"] : [])])];
    const payload = {
      packName,
      description: description || null,
      asOf,
      organisationId,
      context: {
        destination_markets: allMarkets,
        destination_member_states: allDestinations,
        food_contact: foodContact,
        persona,
        declared_reusable: declaredReusable,
        legal_role_facts: {
          packaging_branded: packagingBranded,
          custom_vs_standardised: customVsStd,
          spec_defined_by: specDefinedBy,
        },
      },
      components: components.map((c, i) => ({
        line: String(i + 1),
        name: c.name,
        material: c.material,
        composition: c.composition || null,
        weightGrams: c.weight ? Number(c.weight) : null,
        sourcedFrom: c.sourcedFrom || null,
        riskAnnotation: c.riskAnnotation || null,
        riskRationale: c.riskAnnotation ? c.riskRationale || null : null,
        riskAnnotatedBy: c.riskAnnotation ? assessorName || "unattributed" : null,
        evidence: c.evidence.map((e) => ({
          evidenceType: e.evidenceType,
          reference: e.reference || null,
          issuedDate: e.issuedDate || null,
          expiryDate: e.expiryDate || null,
          scopeComponents: csv(e.scopeComponents),
          scopeMaterials: csv(e.scopeMaterials),
          scopeParameters: csv(e.scopeParameters),
        })),
      })),
    };

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create assessment.");
      setCreatedId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdId !== null) {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold">Assessment created</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          Pack <strong>{packName}</strong> saved as assessment #{createdId}. The corpus version in
          force was stamped at creation.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href={`/assessments/${createdId}/report`} className={btn}>
            View screening report →
          </Link>
          <Link href="/" className={btnGhost}>
            Back to assessments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Assessments", href: "/" }, { label: "New assessment" }]} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New assessment</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          Capture the assessment context and the bill of materials with available evidence. No files
          are parsed — evidence is recorded as metadata only.
        </p>
      </div>

      {/* Who the screening is FOR. First, because it is the first thing the
          report says and the party every downstream artefact is addressed to. */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Organisation
        </h2>
        <OrganisationPicker value={organisationId} onChange={setOrganisationId} />
      </section>

      {/* Assessment context */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Assessment context
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Pack name *</label>
            <input className={input} value={packName} onChange={(e) => setPackName(e.target.value)} />
          </div>
          <div>
            <label className={label}>As-of date</label>
            <input type="date" className={input} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <input
              className={input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Persona</label>
            <select className={input} value={persona} onChange={(e) => setPersona(e.target.value)}>
              {PERSONAS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value} — {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={foodContact} onChange={(e) => setFoodContact(e.target.checked)} />
              Food contact
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={declaredReusable}
                onChange={(e) => setDeclaredReusable(e.target.checked)}
              />
              Declared reusable
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Destination markets</label>
            <div className="flex flex-wrap gap-2">
              {DESTINATION_MARKETS.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => toggleMarket(m.code)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    markets.includes(m.code)
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {m.code} — {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              The regimes this pack ships into. India obligations apply only when IN is selected.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Destination Member States (of first placing)</label>
            <div className="flex flex-wrap gap-2">
              {EU_MEMBER_STATES.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => toggleDestination(ms)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    destinations.includes(ms)
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {ms}
                </button>
              ))}
            </div>
            <input
              className={`${input} mt-2`}
              placeholder="Additional Member States (comma-separated, e.g. FI, DK)"
              value={extraDestinations}
              onChange={(e) => setExtraDestinations(e.target.value)}
            />
          </div>
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Legal-role facts (drive role derivation — never a role)
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={packagingBranded}
              onChange={(e) => setPackagingBranded(e.target.checked)}
            />
            Packaging branded
          </label>
          <div>
            <label className={label}>Custom vs standardised</label>
            <select className={input} value={customVsStd} onChange={(e) => setCustomVsStd(e.target.value)}>
              {CUSTOM_VS_STANDARDISED.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Specification defined by</label>
            <select className={input} value={specDefinedBy} onChange={(e) => setSpecDefinedBy(e.target.value)}>
              {SPEC_DEFINED_BY.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Assessor name (attribution for any risk annotations)</label>
            <input className={input} value={assessorName} onChange={(e) => setAssessorName(e.target.value)} />
          </div>
        </div>
      </section>

      {/* BOM */}
      <section className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Bill of materials
          </h2>
          <button type="button" className={btnGhost} onClick={() => setComponents((c) => [...c, emptyComponent()])}>
            + Add component
          </button>
        </div>
        <div className="space-y-5">
          {components.map((c, ci) => (
            <div key={ci} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500">Component {ci + 1}</span>
                {components.length > 1 && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setComponents((cs) => cs.filter((_, i) => i !== ci))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={label}>Name</label>
                  <input className={input} value={c.name} onChange={(e) => updateComponent(ci, { name: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Material</label>
                  <select
                    className={input}
                    value={c.material}
                    onChange={(e) => updateComponent(ci, { material: e.target.value })}
                  >
                    {BOM_MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Weight (g)</label>
                  <input
                    type="number"
                    className={input}
                    value={c.weight}
                    onChange={(e) => updateComponent(ci, { weight: e.target.value })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className={label}>Composition</label>
                  <input
                    className={input}
                    value={c.composition}
                    onChange={(e) => updateComponent(ci, { composition: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Sourced from</label>
                  <input
                    className={input}
                    value={c.sourcedFrom}
                    onChange={(e) => updateComponent(ci, { sourcedFrom: e.target.value })}
                  />
                </div>
              </div>

              {/* Assessor risk annotation (optional) */}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label}>Risk annotation (optional)</label>
                  <select
                    className={input}
                    value={c.riskAnnotation}
                    onChange={(e) => updateComponent(ci, { riskAnnotation: e.target.value })}
                  >
                    <option value="">Not annotated (defaults to no inherent risk)</option>
                    {RISK_ANNOTATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                {c.riskAnnotation === "at_risk" && (
                  <div className="sm:col-span-2">
                    <label className={label}>Rationale (why at risk)</label>
                    <input
                      className={input}
                      value={c.riskRationale}
                      onChange={(e) => updateComponent(ci, { riskRationale: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Evidence */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Evidence ({c.evidence.length})</span>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => updateComponent(ci, { evidence: [...c.evidence, emptyEvidence()] })}
                  >
                    + Add evidence
                  </button>
                </div>
                {c.evidence.map((e, ei) => (
                  <div key={ei} className="mb-2 grid gap-2 rounded border border-neutral-200 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
                    <div>
                      <label className={label}>Type</label>
                      <select
                        className={input}
                        value={e.evidenceType}
                        onChange={(ev) => updateEvidence(ci, ei, { evidenceType: ev.target.value })}
                      >
                        {EVIDENCE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>Reference</label>
                      <input className={input} value={e.reference} onChange={(ev) => updateEvidence(ci, ei, { reference: ev.target.value })} />
                    </div>
                    <div>
                      <label className={label}>Issued</label>
                      <input type="date" className={input} value={e.issuedDate} onChange={(ev) => updateEvidence(ci, ei, { issuedDate: ev.target.value })} />
                    </div>
                    <div>
                      <label className={label}>Expires</label>
                      <input type="date" className={input} value={e.expiryDate} onChange={(ev) => updateEvidence(ci, ei, { expiryDate: ev.target.value })} />
                    </div>
                    <div>
                      <label className={label}>Scope — components</label>
                      <input className={input} placeholder="comma-separated" value={e.scopeComponents} onChange={(ev) => updateEvidence(ci, ei, { scopeComponents: ev.target.value })} />
                    </div>
                    <div>
                      <label className={label}>Scope — materials</label>
                      <input className={input} placeholder="comma-separated" value={e.scopeMaterials} onChange={(ev) => updateEvidence(ci, ei, { scopeMaterials: ev.target.value })} />
                    </div>
                    <div>
                      <label className={label}>Scope — parameters</label>
                      <input className={input} placeholder="e.g. Pb, Cd, Hg" value={e.scopeParameters} onChange={(ev) => updateEvidence(ci, ei, { scopeParameters: ev.target.value })} />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => updateComponent(ci, { evidence: c.evidence.filter((_, j) => j !== ei) })}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={submitting} onClick={submit}>
          {submitting ? "Saving…" : "Create assessment"}
        </button>
        <Link href="/" className={btnGhost}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
