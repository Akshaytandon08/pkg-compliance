"use client";

import { useEffect, useState } from "react";
import { LEGAL_ROLES } from "@/lib/vocab";
import { legalRoleLabel, preparedForLine } from "@/lib/report/labels";

// Select the obligated economic operator this screening is prepared for, or
// create one inline. Minimal on purpose: the fields here are exactly the ones a
// report header, a passport declarant block and DoC element 2 need. A screening
// tool is not a CRM, and every extra field is one more thing to keep true.
//
// Selection stays OPTIONAL — an assessment with no organisation is valid, and
// the report says "No organisation recorded" rather than inventing one.

export interface OrganisationOption {
  id: number;
  legalName: string;
  country: string;
  roleDefault: string | null;
  demo: boolean;
}

const input =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900";
const label = "block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1";
const btnGhost =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export function OrganisationPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [country, setCountry] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");
  const [roleDefault, setRoleDefault] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [regJurisdiction, setRegJurisdiction] = useState("");
  const [regName, setRegName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/organisations");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load organisations.");
        if (!cancelled) setOrgs(data.organisations);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load organisations.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          tradingName: tradingName || null,
          country,
          registeredAddress: registeredAddress || null,
          primaryContact: primaryContact || null,
          roleDefault: roleDefault || null,
          // One registration inline covers the common case (a producer register
          // in the Member State of first placing). More are added per Member
          // State on the organisation itself.
          registrations:
            regNumber && regJurisdiction
              ? [
                  {
                    scheme: "epr_packaging",
                    registerName: regName || null,
                    registrationNumber: regNumber,
                    jurisdiction: regJurisdiction,
                  },
                ]
              : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create the organisation.");
      const created: OrganisationOption = {
        id: data.id,
        legalName,
        country: country.toUpperCase(),
        roleDefault: roleDefault || null,
        demo: false,
      };
      setOrgs((prev) => [...prev, created].sort((a, b) => a.legalName.localeCompare(b.legalName)));
      onChange(data.id);
      setCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create the organisation.");
    } finally {
      setSaving(false);
    }
  }

  const selected = orgs.find((o) => o.id === value) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className={label} htmlFor="organisation">
            Prepared for
          </label>
          <select
            id="organisation"
            className={input}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— not recorded —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.legalName}
                {o.roleDefault ? ` — ${legalRoleLabel(o.roleDefault)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={btnGhost} onClick={() => setCreating((c) => !c)}>
          {creating ? "Cancel" : "New organisation"}
        </button>
      </div>

      {loadError && <p className="mt-2 text-xs text-red-600">{loadError}</p>}
      {selected && !creating && (
        <p className="mt-2 text-xs text-neutral-500">
          The report header, the public passport and any declaration draft will read{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{preparedForLine(selected)}</span>.
        </p>
      )}
      {!selected && !creating && (
        <p className="mt-2 text-xs text-neutral-500">
          Optional. Left blank, the report reads &ldquo;No organisation recorded&rdquo; — it does not
          guess who the screening is for.
        </p>
      )}

      {creating && (
        <div className="mt-3 grid gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
          <div>
            <label className={label}>Registered legal name *</label>
            <input className={input} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Trading name</label>
            <input className={input} value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Country (ISO 3166-1 alpha-2) *</label>
            <input
              className={input}
              maxLength={2}
              placeholder="DE"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className={label}>Usual legal role</label>
            <select className={input} value={roleDefault} onChange={(e) => setRoleDefault(e.target.value)}>
              <option value="">— none —</option>
              {LEGAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {legalRoleLabel(r)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              A starting point only. The role that drives this screening is derived from the
              legal-role facts below.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Registered address</label>
            <input
              className={input}
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Primary contact</label>
            <input className={input} value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} />
          </div>
          <div>
            <label className={label}>Producer registration number</label>
            <input className={input} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
          </div>
          <div>
            <label className={label}>Member State of that registration</label>
            <input
              className={input}
              maxLength={2}
              placeholder="DE"
              value={regJurisdiction}
              onChange={(e) => setRegJurisdiction(e.target.value.toUpperCase())}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Register name</label>
            <input
              className={input}
              placeholder="e.g. LUCID (Zentrale Stelle Verpackungsregister)"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
            <p className="mt-1 text-xs text-neutral-500">
              One registration per Member State. Add the rest after creating the organisation.
            </p>
          </div>
          {createError && <p className="text-xs text-red-600 sm:col-span-2">{createError}</p>}
          <div className="sm:col-span-2">
            <button
              type="button"
              className={btnGhost}
              disabled={saving || !legalName.trim() || country.trim().length !== 2}
              onClick={create}
            >
              {saving ? "Saving…" : "Save organisation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
