// What a READER is shown about an emission factor, on each of the two tiers.
//
// The line this file defends: the source NAME is ours to publish (a figure whose
// origin is secret is not evidence of anything), while the factor VALUE is the
// dataset owner's licensed content and leaves the public passport only where the
// owner has read that dataset's terms and recorded that they permit it.
//
// Pure — no DB, no server — so it runs in `npm run check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePackFootprint, type EmissionFactor } from "../src/lib/engine/pcf.ts";
import { NO_FACTOR_LABEL, factorSourceLabel, factorTierLabel } from "../src/lib/report/labels.ts";
import { PCF_DISCLAIMER } from "../src/lib/report/language.ts";
import { findLanguageViolations } from "../src/lib/report/language.ts";
import { passportContentHash, type PassportPayload } from "../src/db/passport.ts";

let nextId = 1;
const ef = (material: string, over: Partial<EmissionFactor> = {}): EmissionFactor => ({
  id: nextId++, material, process: "production", version: 1, factor: 0.9, unit: "kgCO2e/kg",
  tier: "secondary_database", source: "ecoinvent", sourceDataset: "ecoinvent 3.10 cut-off",
  activityId: `paper-${material}`, region: "GLOBAL", year: 2023,
  methodology: "AR6 GWP100, cradle-to-gate", licenceNote: null, valueDisplayPermitted: false, ...over,
});

// --- the report tier (gated) ------------------------------------------------

test("a resolved row carries publisher, dataset, region, year and tier", () => {
  const f = ef("corrugated");
  assert.equal(factorSourceLabel(f), "ecoinvent / ecoinvent 3.10 cut-off");
  assert.equal(factorTierLabel(f.tier), "Secondary database");
  assert.equal(f.region, "GLOBAL");
  assert.equal(f.year, 2023);
});

test("a material with no selected factor is excluded and named, never zeroed", () => {
  const fp = computePackFootprint(
    [
      { line: "1", name: "Outer carton", material: "corrugated", weightGrams: 900 },
      { line: "2", name: "PET strap", material: "plastic", weightGrams: 60 },
    ],
    [ef("corrugated")],
  );
  assert.equal(fp.components[1].factor, null);
  assert.equal(fp.components[1].unresolvedReason, "no_factor");
  assert.equal(fp.components[1].kgCo2e, null, "excluded, not counted as zero emissions");
  assert.deepEqual(fp.unresolved, ["PET strap"]);
  // The total is the resolvable legs only — and the card labels it partial.
  assert.ok(Math.abs(fp.totalKgCo2e - 0.81) < 1e-9);
});

test("a `none` row does not fall back to the parent material's factor", () => {
  const fp = computePackFootprint(
    [{ line: "1", name: "Plywood insert", material: "wood_processed", weightGrams: 500 }],
    [ef("wood"), ef("wood_processed", { tier: "none", factor: 0, source: "none selected" })],
  );
  assert.equal(fp.components[0].factor, null, "an explicit decision is not rescued by the parent");
  assert.equal(fp.totalKgCo2e, 0);
});

// --- the public tier (licence-gated) ----------------------------------------

const basePayload: PassportPayload = {
  disclosureModel: "v2",
  packName: "Carton", corpusVersion: "batch-1", asOf: "2026-09-11", demo: false,
  materialComposition: [{ material: "corrugated", componentCount: 1 }],
  counts: { qualified: 1, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 },
  overallVerdict: "qualified", checkpoints: [],
  pcf: { totalKgCo2e: 0.81, unit: "kg CO2e", resolvedComponents: 1, unresolvedComponents: 0 },
};

const attribution = {
  material: "corrugated", source: "ecoinvent", sourceDataset: "ecoinvent 3.10 cut-off",
  region: "GLOBAL", year: 2023, tier: "secondary_database",
};

test("the public tier always carries attribution — the computed result and the source name", () => {
  const payload: PassportPayload = {
    ...basePayload,
    pcf: { ...basePayload.pcf, factorSources: [attribution] },
  };
  const [f] = payload.pcf.factorSources!;
  assert.equal(factorSourceLabel(f), "ecoinvent / ecoinvent 3.10 cut-off");
  assert.equal(f.value, undefined, "the licensed value is withheld by default");
  assert.equal(payload.pcf.totalKgCo2e, 0.81, "the computed result IS published");
});

test("the value appears only when the owner recorded that the terms permit it", () => {
  const permitted: PassportPayload = {
    ...basePayload,
    pcf: { ...basePayload.pcf, factorSources: [{ ...attribution, value: 0.9, unit: "kgCO2e/kg" }] },
  };
  assert.equal(permitted.pcf.factorSources![0].value, 0.9);
  // And permitting it is a content change, so it chains a new passport version.
  const withheld: PassportPayload = {
    ...basePayload,
    pcf: { ...basePayload.pcf, factorSources: [attribution] },
  };
  assert.notEqual(passportContentHash(permitted), passportContentHash(withheld));
});

test("a passport minted before factor attribution existed still hashes the same", () => {
  const before = passportContentHash(basePayload);
  const after = passportContentHash({
    ...basePayload,
    pcf: { ...basePayload.pcf, factorSources: undefined },
  });
  assert.equal(after, before, "an absent attribution list must not perturb the hash chain");
});

// --- language guardrail on everything new -----------------------------------

test("every new factor string passes the output-language guardrail", () => {
  const strings = [
    NO_FACTOR_LABEL,
    PCF_DISCLAIMER,
    factorTierLabel("primary"),
    factorTierLabel("secondary_database"),
    factorTierLabel("none"),
    factorSourceLabel(ef("corrugated")),
    "Excluded from the total: a component is excluded when it has no weight, or when no " +
      "emission factor has been selected for its material — the total above is therefore a " +
      "partial figure, not a whole-pack one.",
    "value not republished under the dataset licence",
    "Emission factors used",
  ];
  for (const s of strings) {
    assert.deepEqual(findLanguageViolations(s), [], `guardrail violation in: ${s}`);
  }
});

test("no factor string claims this system measured, certified or verified anything", () => {
  const forbidden = /\bwe (certify|verify|measured)\b|verified (carbon )?footprint|audit-grade/i;
  for (const s of [NO_FACTOR_LABEL, PCF_DISCLAIMER, factorTierLabel("primary")]) {
    assert.doesNotMatch(s, forbidden);
  }
  // "Primary (Fitsol)" names whose DATA it is, which is attribution, not a claim
  // that this tool verified it.
  assert.match(factorTierLabel("primary"), /Fitsol/);
});
