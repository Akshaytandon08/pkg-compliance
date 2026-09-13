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

test("a short ton uses the exact NIST conversion, not an approximation", () => {
  const c = toPerKilogram(150, "kg/short ton");
  assert.ok(Math.abs(c.factor - 150 / 907.18474) < 1e-15);
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
