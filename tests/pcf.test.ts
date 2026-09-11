// Screening-grade PCF: deterministic arithmetic, pinned against the golden pack.
// The factors here are a LOCAL FIXTURE, not the store — the arithmetic is what is
// being pinned, so it must not move when the owner selects a different factor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePackFootprint, type EmissionFactor } from "../src/lib/engine/pcf.ts";

let nextId = 1;
const ef = (
  material: string, process: string, factor: number, unit: string,
  over: Partial<EmissionFactor> = {},
): EmissionFactor => ({
  id: nextId++, material, process, version: 1, factor, unit,
  tier: "secondary_database", source: "Fixture DB", sourceDataset: "fixture 1.0",
  activityId: `fixture-${material}-${process}`, region: "GLOBAL", year: 2024,
  methodology: "cradle-to-gate", licenceNote: null, valueDisplayPermitted: false, ...over,
});

const FACTORS: EmissionFactor[] = [
  ef("corrugated", "production", 0.9, "kgCO2e/kg"),
  ef("plastic", "production", 2.5, "kgCO2e/kg"),
  ef("wood", "production", 0.5, "kgCO2e/kg"),
  ef("metal", "production", 2.0, "kgCO2e/kg"),
  ef("transport", "sea", 0.00001, "kgCO2e/kg.km"),
];

// The golden pack (Client A traction-cell) component masses.
const GOLDEN = [
  { line: "1", name: "Pine wood pallet / crate (heat treated)", material: "wood", weightGrams: 12000 },
  { line: "2", name: "Nails (2\")", material: "metal", weightGrams: 200 },
  { line: "3", name: "Corrugated sheet", material: "corrugated", weightGrams: 800 },
  { line: "4", name: "Honeycomb buffer", material: "corrugated", weightGrams: 300 },
  { line: "5", name: "Edge board", material: "corrugated", weightGrams: 250 },
  { line: "6", name: "Poly packet (LDPE bag)", material: "plastic", weightGrams: 40 },
  { line: "7", name: "Green polyester strap (PET)", material: "plastic", weightGrams: 60 },
];

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);

test("golden pack cradle-to-gate footprint is pinned (7.865 kg CO2e)", () => {
  const fp = computePackFootprint(GOLDEN, FACTORS);
  near(fp.totalKgCo2e, 7.865, "total");
  near(fp.resolvedMassKg, 13.65, "resolved mass");
  assert.equal(fp.unresolved.length, 0);
  // Spot-check the heaviest leg (the wood pallet).
  const pallet = fp.components.find((c) => c.material === "wood")!;
  near(pallet.kgCo2e!, 6.0, "pallet");
  assert.equal(pallet.factor?.tier, "secondary_database");
});

test("a component with no weight is unresolved, not zeroed", () => {
  const fp = computePackFootprint(
    [{ line: "1", name: "Weightless part", material: "plastic", weightGrams: null }],
    FACTORS,
  );
  assert.equal(fp.totalKgCo2e, 0);
  assert.deepEqual(fp.unresolved, ["Weightless part"]);
  assert.equal(fp.components[0].unresolvedReason, "no_weight");
});

test("a material with no factor is unresolved, not zeroed", () => {
  const fp = computePackFootprint(
    [{ line: "1", name: "Glass bottle", material: "glass", weightGrams: 500 }],
    FACTORS,
  );
  assert.equal(fp.totalKgCo2e, 0);
  assert.equal(fp.components[0].unresolvedReason, "no_factor");
});

test("optional inbound transport leg adds mass × distance × factor", () => {
  const fp = computePackFootprint(
    [{ line: "1", name: "Board", material: "wood", weightGrams: 1000 }],
    FACTORS,
    { mode: "sea", km: 10000 },
  );
  // production 1kg × 0.5 = 0.5 ; transport 1kg × 10000km × 0.00001 = 0.1
  near(fp.transport!.kgCo2e, 0.1, "transport leg");
  near(fp.totalKgCo2e, 0.6, "total with transport");
});
