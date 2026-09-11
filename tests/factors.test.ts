// The emission-factor store. Three properties are load-bearing and are pinned
// against a real database rather than asserted in prose:
//
//   1. PINNING — a report re-rendered after the owner selects a better factor
//      still shows the number it showed. A screening is a dated artefact.
//   2. PRECEDENCE — a Fitsol `primary` factor outranks a `secondary_database`
//      one for the same material, whatever order they were selected in.
//   3. `none` IS A DECISION — a material the owner explicitly chose no factor
//      for resolves like an absent one, and is never rescued by a parent
//      category's factor.
//
// App modules are dynamic-imported AFTER the env is loaded so the shared db
// client initialises with DATABASE_URL.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import type { AssessmentContextRecord } from "../src/db/schema.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL may still be set in the environment
}

const url = process.env.DATABASE_URL;
let sql: ReturnType<typeof postgres> | undefined;
let reachable = false;
let F: typeof import("../src/db/factors.ts") | undefined;
let A: typeof import("../src/db/assessments.ts") | undefined;

// Materials outside the real vocabulary, so these rows can never collide with or
// disturb factors the owner has actually selected. One per test: the store is
// append-only, so a shared material would let an earlier test's selection decide
// a later test's outcome.
const PREFIX = "factor-test-";
const MAT_VERSIONS = `${PREFIX}versions`;
const MAT_PRECEDENCE = `${PREFIX}precedence`;
const MAT_PIN = `${PREFIX}pin`;
const MAT_EMPTY = `${PREFIX}empty`;
const MAT_NONE = `${PREFIX}none`;
const PACK = "FACTOR-TEST-pack";

const CONTEXT: AssessmentContextRecord = {
  destination_markets: ["EU"], destination_member_states: ["DE"], food_contact: false,
  persona: "2b", declared_reusable: false, legal_role_facts: {},
};

async function cleanup(s: ReturnType<typeof postgres>) {
  await s`delete from assessments where pack_name = ${PACK}`;
  await s`delete from emission_factors where material like ${PREFIX + "%"}`;
}

if (url) {
  sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
  try {
    await sql`select tier from emission_factors limit 1`;
    reachable = true;
    F = await import("../src/db/factors.ts");
    A = await import("../src/db/assessments.ts");
    await cleanup(sql);
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}

const dbRequired = { skip: reachable ? false : "no reachable DB with the Sprint 9 factor columns" };

after(async () => {
  if (!sql) return;
  if (reachable) await cleanup(sql);
  await sql.end({ timeout: 5 });
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
});

const base = {
  process: "production",
  unit: "kgCO2e/kg",
  region: "GLOBAL",
  year: 2024,
  selectedBy: "factors.test.ts",
};

test("selecting a factor appends a version; it never overwrites", dbRequired, async () => {
  const v1 = await F!.selectFactor({ ...base, material: MAT_VERSIONS, factor: 1.0, tier: "secondary_database", source: "DB-A" });
  const v2 = await F!.selectFactor({ ...base, material: MAT_VERSIONS, factor: 2.0, tier: "secondary_database", source: "DB-B" });
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);

  const current = (await F!.currentFactorSet()).filter((f) => f.material === MAT_VERSIONS);
  assert.equal(current.length, 1, "one current factor per (material, process)");
  assert.equal(current[0].factor, 2.0, "the newest version is current");
  // Version 1 is still there — nothing was overwritten.
  const history = (await F!.listFactorHistory()).filter((f) => f.material === MAT_VERSIONS);
  assert.equal(history.length, 2);
});

test("a Fitsol primary factor outranks a newer secondary one", dbRequired, async () => {
  await F!.selectFactor({ ...base, material: MAT_PRECEDENCE, factor: 0.5, tier: "primary", source: "Fitsol" });
  // ...and then a NEWER secondary is selected. Recency must not beat the
  // owner's own measurement.
  await F!.selectFactor({ ...base, material: MAT_PRECEDENCE, factor: 9.9, tier: "secondary_database", source: "DB-C" });

  const [current] = (await F!.currentFactorSet()).filter((f) => f.material === MAT_PRECEDENCE);
  assert.equal(current.tier, "primary");
  assert.equal(current.factor, 0.5, "primary wins regardless of selection order");
});

test("an assessment pins its factor set and keeps it when a better factor lands", dbRequired, async () => {
  await F!.selectFactor({ ...base, material: MAT_PIN, factor: 3.0, tier: "secondary_database", source: "DB-pin" });

  const id = await A!.createAssessment({
    packName: PACK, asOf: "2026-09-11", context: CONTEXT,
    components: [{ line: "1", name: "part", material: MAT_PIN, weightGrams: 1000, evidence: [] }],
  });

  const first = await F!.pinnedFactorSet(id);
  const pinned = first.find((f) => f.material === MAT_PIN)!;
  assert.equal(pinned.factor, 3.0);

  // The owner selects a better factor AFTER this assessment was evaluated.
  await F!.selectFactor({ ...base, material: MAT_PIN, factor: 4.4, tier: "primary", source: "Fitsol" });
  assert.equal(
    (await F!.currentFactorSet()).find((f) => f.material === MAT_PIN)!.factor,
    4.4,
    "the store has moved on",
  );

  const second = await F!.pinnedFactorSet(id);
  assert.equal(
    second.find((f) => f.material === MAT_PIN)!.factor,
    3.0,
    "the report must still show the number it reported",
  );
  assert.equal(second.find((f) => f.material === MAT_PIN)!.id, pinned.id, "the same row, not an equal one");
});

test("pinning is recorded even when NOTHING was selected — so it never re-pins later", dbRequired, async () => {
  const id = await A!.createAssessment({
    packName: PACK, asOf: "2026-09-11", context: CONTEXT,
    components: [{ line: "1", name: "part", material: MAT_EMPTY, weightGrams: 500, evidence: [] }],
  });
  // Evaluate while the store holds nothing for this material.
  await F!.pinnedFactorSet(id);
  const [row] = await sql!`select factors_pinned_at from assessments where id = ${id}`;
  assert.ok(row.factors_pinned_at, "an empty pin set must still be recorded as pinned");

  await F!.selectFactor({ ...base, material: MAT_EMPTY, factor: 7.0, tier: "primary", source: "Fitsol" });
  const after = await F!.pinnedFactorSet(id);
  assert.equal(
    after.find((f) => f.material === MAT_EMPTY),
    undefined,
    "a later selection must not leak into an already-evaluated assessment",
  );
  await sql!`delete from emission_factors where material = ${MAT_EMPTY}`;
});

test("tier `none` is a recorded decision, not a factor", dbRequired, async () => {
  const { computePackFootprint } = await import("../src/lib/engine/pcf.ts");
  await F!.selectFactor({
    ...base, material: MAT_NONE, factor: 0, tier: "none", source: "none selected",
    notes: "no representative dataset",
  });
  const factors = (await F!.currentFactorSet()).filter((f) => f.material === MAT_NONE);
  assert.equal(factors.length, 1);
  assert.equal(factors[0].tier, "none");

  const fp = computePackFootprint(
    [{ line: "1", name: "part", material: MAT_NONE, weightGrams: 1000 }],
    factors,
  );
  assert.equal(fp.totalKgCo2e, 0, "a `none` row contributes nothing");
  assert.equal(fp.components[0].unresolvedReason, "no_factor");
  assert.deepEqual(fp.unresolved, ["part"], "and the component is named as excluded");
});
