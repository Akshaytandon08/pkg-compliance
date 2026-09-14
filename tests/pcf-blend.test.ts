// Recycled-content blend: factor_effective = primary × (1 − r) + closed_loop × r.
//
// Fixture values are the owner's REAL selections and the BEIS closed-loop rows
// listed in docs/factor-selection-runbook.md — no invented numbers. Every total
// below is also computed by hand in the assertion message so a reviewer can
// check the arithmetic without running anything.
//
// Pure: no DB, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLOSED_LOOP_PROCESS,
  blendFor,
  computePackFootprint,
  type EmissionFactor,
} from "../src/lib/engine/pcf.ts";

let nextId = 1;
const ef = (material: string, process: string, factor: number): EmissionFactor => ({
  id: nextId++, material, process, version: 1, factor, unit: "kgCO2e/kg",
  tier: "secondary_database", source: "BEIS",
  sourceDataset: "Greenhouse gas reporting: conversion factors 2026",
  activityId: `${material}-${process}`, dataVersion: "^36", region: "GB", year: 2026,
  methodology: "cradle_to_gate", licenceNote: "OGL v3.0", valueDisplayPermitted: true,
});

// The owner's selections (primary) and the BEIS closed-loop rows for the same
// materials, both at 2026 — see the runbook.
const CORRUGATED_PRIMARY = 1.19823866;
const CORRUGATED_CLOSED = 1.09662766;
const PLASTIC_PRIMARY = 3.86158251;
const PLASTIC_CLOSED = 2.21158251;

const FACTORS: EmissionFactor[] = [
  ef("corrugated", "production", CORRUGATED_PRIMARY),
  ef("corrugated", CLOSED_LOOP_PROCESS, CORRUGATED_CLOSED),
  ef("plastic", "production", PLASTIC_PRIMARY),
  ef("plastic", CLOSED_LOOP_PROCESS, PLASTIC_CLOSED),
  // metal deliberately has NO closed-loop row in this fixture.
  ef("metal", "production", 3.82194858),
];

const near = (a: number, b: number, what: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} != ${b}`);

// --- the four values of r ---------------------------------------------------

test("r = 0.45 blends both factors", () => {
  const b = blendFor(FACTORS[0], FACTORS[1], 0.45);
  assert.equal(b.reason, "blended");
  // 1.19823866 × 0.55 + 1.09662766 × 0.45 = 0.659031263 + 0.493482447 = 1.15251371
  near(b.effective, 1.15251371, "45% recycled corrugated");
  assert.equal(b.recycledShare, 0.45);
  assert.equal(b.closedLoop!.factor, CORRUGATED_CLOSED);
});

test("r = 0 uses the primary factor and records that zero was STATED", () => {
  const b = blendFor(FACTORS[0], FACTORS[1], 0);
  assert.equal(b.effective, CORRUGATED_PRIMARY, "no recycled content means the virgin factor");
  assert.equal(b.reason, "share_zero", "stated-as-none, which is a claim");
  assert.equal(b.recycledShare, 0);
});

test("r = 1 is the closed-loop factor exactly", () => {
  const b = blendFor(FACTORS[0], FACTORS[1], 1);
  near(b.effective, CORRUGATED_CLOSED, "fully recycled corrugated");
  assert.equal(b.reason, "blended");
});

test("r = null uses the primary factor and says the share was NOT stated", () => {
  const b = blendFor(FACTORS[0], FACTORS[1], null);
  assert.equal(b.effective, CORRUGATED_PRIMARY);
  assert.equal(b.reason, "share_not_stated");
  assert.equal(b.recycledShare, null, "null is never coerced to 0 — they are different facts");
  // undefined (the field simply absent) behaves identically.
  assert.equal(blendFor(FACTORS[0], FACTORS[1], undefined).reason, "share_not_stated");
});

test("a material with NO closed-loop factor stays primary, and says why", () => {
  // A stated share that cannot be honoured must not silently read as unstated:
  // the reader needs to know the share exists and the factor to apply it is
  // missing, not that nobody asked.
  const b = blendFor(FACTORS[4], null, 0.62);
  assert.equal(b.effective, 3.82194858, "primary only");
  assert.equal(b.reason, "no_closed_loop_factor");
  assert.equal(b.recycledShare, 0.62, "the stated share is preserved for display");
});

// --- through the whole footprint --------------------------------------------

test("pack totals recompute from the blend, verified by hand", () => {
  const fp = computePackFootprint(
    [
      { line: "1", name: "Outer carton", material: "corrugated", weightGrams: 900, recycledShare: 0.74 },
      { line: "2", name: "Label", material: "corrugated", weightGrams: 100, recycledShare: null },
      { line: "3", name: "Strap", material: "plastic", weightGrams: 60, recycledShare: 0.3 },
      { line: "4", name: "Nails", material: "metal", weightGrams: 200, recycledShare: 0.62 },
    ],
    FACTORS,
  );

  // 1. 0.9 kg × (1.19823866×0.26 + 1.09662766×0.74) = 0.9 × 1.12304652 = 1.010741868
  near(fp.components[0].kgCo2e!, 1.010741868, "carton, 74% recycled");
  // 2. share not stated → primary: 0.1 × 1.19823866 = 0.119823866
  near(fp.components[1].kgCo2e!, 0.119823866, "label, share not stated");
  assert.equal(fp.components[1].blend!.reason, "share_not_stated");
  // 3. 0.06 × (3.86158251×0.7 + 2.21158251×0.3) = 0.06 × 3.36658251 = 0.2019949506
  near(fp.components[2].kgCo2e!, 0.2019949506, "strap, 30% recycled");
  // 4. metal has no closed-loop row → primary: 0.2 × 3.82194858 = 0.764389716
  near(fp.components[3].kgCo2e!, 0.764389716, "nails, no closed-loop factor");
  assert.equal(fp.components[3].blend!.reason, "no_closed_loop_factor");

  // Total: 1.010741868 + 0.119823866 + 0.2019949506 + 0.764389716 = 2.0969504006
  near(fp.totalKgCo2e, 2.0969504006, "pack total");
});

test("the blend only ever LOWERS a factor when closed-loop is cheaper, and never below it", () => {
  // A property rather than a case: for every r in [0,1] the effective factor
  // stays between the two inputs. This is what stops a blend producing a number
  // that is not defensible from either source.
  for (const r of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    const b = blendFor(FACTORS[2], FACTORS[3], r);
    assert.ok(
      b.effective <= PLASTIC_PRIMARY + 1e-12 && b.effective >= PLASTIC_CLOSED - 1e-12,
      `r=${r} produced ${b.effective}, outside [${PLASTIC_CLOSED}, ${PLASTIC_PRIMARY}]`,
    );
  }
});

test("the blended factor carries no floating-point artefact", () => {
  // Same discipline as the unit conversion: an artefact tail reaching a
  // customer's report is the defect, not the twelfth decimal place.
  const b = blendFor(FACTORS[0], FACTORS[1], 0.45);
  assert.ok(String(b.effective).length <= 14, `rendered as ${b.effective}`);
});

test("an unresolved component carries no blend rather than a misleading one", () => {
  const fp = computePackFootprint(
    [{ line: "1", name: "Weightless", material: "corrugated", weightGrams: null, recycledShare: 0.5 }],
    FACTORS,
  );
  assert.equal(fp.components[0].blend, null, "no mass means no factor was applied at all");
  assert.equal(fp.components[0].kgCo2e, null);
});
