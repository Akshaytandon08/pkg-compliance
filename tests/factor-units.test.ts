// The two guards between a provider's search result and a stored factor. Both
// were written because the real shortlists showed that the dangerous candidates
// look exactly like the right ones.
//
// Pure — no network, no DB — so they run in `npm run check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_MASS_UNIT,
  UnitError,
  isCarbonStorageVariant,
  isProductionBoundary,
  toPerKilogram,
} from "../src/lib/factors/units.ts";
import { DATASET_LICENCES, licenceFor } from "../src/lib/factors/licences.ts";

// --- units ------------------------------------------------------------------

test("a per-kg factor passes through untouched and unannotated", () => {
  const c = toPerKilogram(0.682, "kg/kg");
  assert.equal(c.factor, 0.682);
  assert.equal(c.unit, CANONICAL_MASS_UNIT);
  assert.equal(c.note, null, "nothing was converted, so there is nothing to explain");
});

test("BEIS kg/tonne is converted — the 1000x error this guard exists for", () => {
  // Board (primary material production), BEIS 2024. Stored verbatim, a 900 g
  // carton would have read 1074 kg CO2e instead of 1.07.
  const c = toPerKilogram(1193.96586, "kg/tonne");
  assert.ok(Math.abs(c.factor - 1.19396586) < 1e-12);
  assert.equal(c.unit, CANONICAL_MASS_UNIT);
  assert.match(c.note!, /Converted from 1193\.96586 kg\/tonne \(÷ 1000\)/);

  // And the arithmetic a reviewer would actually check.
  const carton = 0.9 * c.factor;
  assert.ok(Math.abs(carton - 1.074569274) < 1e-9, "900 g carton ≈ 1.07 kg CO2e, not 1074");
});

test("a short ton uses the NIST conversion, and says so", () => {
  const c = toPerKilogram(150, "kg/short ton");
  // Agreement to 12 significant figures, not to the last bit: the result is
  // rounded there to strip binary floating-point noise (see the artefact test
  // below). Rounding at the 12th significant figure permits a relative error up
  // to ~5e-12/mantissa, so the bound is 1e-11 — still about a billion times
  // finer than any published emission factor, and unobservable in a screening.
  assert.ok(Math.abs(c.factor - 150 / 907.18474) < 1e-11 * c.factor);
  assert.match(c.note!, /907\.18474/);
});

test("unit matching is case- and whitespace-insensitive", () => {
  assert.equal(toPerKilogram(2, "  KG/Tonne ").factor, 0.002);
});

test("an unrecognised unit is REFUSED, never passed through", () => {
  // The failure mode this prevents: "kg/m2" stored as if it were per kg, giving a
  // number whose scale nobody can recover from the row.
  assert.throws(() => toPerKilogram(1, "kg/m2"), UnitError);
  assert.throws(() => toPerKilogram(1, null), UnitError);
  assert.throws(() => toPerKilogram(1, "kgCO2e/kg.km"), UnitError, "transport units are not mass units");
  assert.throws(() => toPerKilogram(Number.NaN, "kg/kg"), UnitError);
});

test("the refusal message names the units that DO convert", () => {
  try {
    toPerKilogram(1, "kg/m2");
    assert.fail("should have thrown");
  } catch (err) {
    assert.match((err as Error).message, /kg\/kg/);
    assert.match((err as Error).message, /kg\/tonne/);
  }
});

// --- system boundary --------------------------------------------------------

test("only production boundaries are accepted for a cradle-to-gate screening", () => {
  assert.equal(isProductionBoundary("cradle_to_gate"), true);
  assert.equal(isProductionBoundary("cradle_to_shelf"), true);
  // The rows that flooded the real shortlists.
  assert.equal(isProductionBoundary("gate_to_grave"), false);
  assert.equal(isProductionBoundary("end_of_life"), false);
  // An unstated boundary is an assumption, and must be made deliberately.
  assert.equal(isProductionBoundary(null), false);
  assert.equal(isProductionBoundary("unknown"), false);
});

test("an ICE carbon-storage variant is recognised — it would flip a component's sign", () => {
  // ICE v3 publishes both for timber: plywood 0.682 cradle_to_gate and -0.933
  // carbon_storage-cradle_to_gate. Picking the second silently subtracts.
  assert.equal(isCarbonStorageVariant("carbon_storage-cradle_to_gate"), true);
  assert.equal(isCarbonStorageVariant("cradle_to_gate"), false);
});

// --- recorded licence readings ----------------------------------------------

test("every recorded licence reading carries a source URL and a read date", () => {
  for (const l of DATASET_LICENCES) {
    assert.match(l.termsUrl, /^https?:\/\//, `${l.source} has no terms URL`);
    assert.match(l.readOn, /^\d{4}-\d{2}-\d{2}$/, `${l.source} has no read date`);
    assert.ok(l.summary.length > 0);
  }
});

test("a restricted dataset carries the reason, not just the verdict", () => {
  const ice = licenceFor("Circular Ecology")!;
  assert.equal(ice.valuePublication, "restricted");
  // The date matters more than the label: it is when the restriction bites.
  assert.match(ice.warning!, /2026-09-30/);
  assert.match(ice.warning!, /commercial/i);
});

test("the two open datasets are marked permitted", () => {
  assert.equal(licenceFor("BEIS")!.valuePublication, "permitted");
  assert.equal(licenceFor("ICM Database")!.valuePublication, "permitted");
});

test("an unread dataset returns null rather than a default permission", () => {
  // Absence of a reading must never read as "allowed".
  assert.equal(licenceFor("ADEME"), null);
  assert.equal(licenceFor(null), null);
  assert.equal(licenceFor(""), null);
});

// --- write-target guard ------------------------------------------------------

import { describeWriteTarget } from "../src/lib/factors/target.ts";

test("a localhost target is recognised as local", () => {
  for (const host of ["localhost", "127.0.0.1", "host.docker.internal"]) {
    const t = describeWriteTarget(`postgres://u:p@${host}:5433/pkg_compliance`);
    assert.equal(t.isLocal, true, host);
    assert.match(t.label, /\(local\)/);
  }
});

test("a Neon host is REMOTE — the case that nearly wrote five factors to production", () => {
  const t = describeWriteTarget("postgres://neondb_owner:secret@ep-x-1.eu-central-1.aws.neon.tech/neondb");
  assert.equal(t.isLocal, false);
  assert.equal(t.host, "ep-x-1.eu-central-1.aws.neon.tech");
  assert.equal(t.database, "neondb");
  assert.match(t.label, /REMOTE/);
});

test("the printable label never contains the credential", () => {
  const t = describeWriteTarget("postgres://neondb_owner:sup3rs3cret@ep-x-1.aws.neon.tech/neondb");
  assert.doesNotMatch(t.label, /sup3rs3cret/);
  assert.doesNotMatch(t.label, /neondb_owner/);
});

test("an absent DATABASE_URL is an error, not a silently local target", () => {
  assert.throws(() => describeWriteTarget(undefined), /DATABASE_URL is not set/);
});

// --- float artefacts must not reach the report ------------------------------

test("dividing by 1000 does not leak binary floating-point noise", () => {
  // BEIS 2026 metals. Before rounding this produced 3.8219485800000004, and that
  // artefact reached the customer-facing footprint card verbatim.
  const metal = toPerKilogram(3821.94858, "kg/tonne");
  assert.equal(metal.factor, 3.82194858);
  assert.equal(String(metal.factor), "3.82194858", "no trailing float noise in the rendered string");

  for (const [raw, expected] of [
    [1198.23866, 1.19823866],   // BEIS board
    [3861.58251, 3.86158251],   // BEIS PET
    [269.50416, 0.26950416],    // BEIS wood
    [1048.59114, 1.04859114],   // BEIS paper
  ] as [number, number][]) {
    const c = toPerKilogram(raw, "kg/tonne");
    assert.equal(c.factor, expected, `${raw} kg/tonne`);
    assert.ok(String(c.factor).length <= 12, `${raw} renders as ${c.factor}`);
  }
});

test("rounding preserves the value, it does not truncate precision", () => {
  // 12 significant figures is well beyond what any provider publishes, so a
  // legitimate long value survives intact.
  assert.equal(toPerKilogram(1.23456789012, "kg/kg").factor, 1.23456789012);
  // And the non-power-of-ten conversion still works.
  const st = toPerKilogram(150, "kg/short ton");
  assert.ok(Math.abs(st.factor - 150 / 907.18474) < 1e-12);
});

// --- the system boundary is a display value, not an identifier --------------

import { factorBoundaryLabel } from "../src/lib/report/labels.ts";

test("a provider's raw boundary identifier never reaches the report", () => {
  assert.equal(factorBoundaryLabel("cradle_to_gate"), "cradle-to-gate");
  assert.equal(factorBoundaryLabel("cradle_to_shelf"), "cradle-to-shelf");
  assert.equal(factorBoundaryLabel("end_of_life"), "end-of-life");
  // Unmapped values still lose their underscores rather than leaking raw.
  assert.equal(factorBoundaryLabel("some_new_boundary"), "some-new-boundary");
  for (const b of ["cradle_to_gate", "cradle_to_shelf", "end_of_life", "some_new_boundary"]) {
    assert.doesNotMatch(factorBoundaryLabel(b)!, /_/, `${b} still contains an underscore`);
  }
});

test("an absent boundary yields null, so the report omits it rather than printing a gap", () => {
  assert.equal(factorBoundaryLabel(null), null);
  assert.equal(factorBoundaryLabel(undefined), null);
  assert.equal(factorBoundaryLabel(""), null);
});
