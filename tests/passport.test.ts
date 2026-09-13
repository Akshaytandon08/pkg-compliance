// Passport generation: unguessable stable token, hash-chained versions, no-op on
// unchanged data, and a public payload that never carries evidence or
// per-checkpoint detail. App modules are dynamic-imported AFTER the env is
// loaded so the shared db client initialises with DATABASE_URL. Skips without a
// DB (or an unseeded corpus).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL may still be set in the environment
}

const url = process.env.DATABASE_URL;
let sql: ReturnType<typeof postgres> | undefined;
let reachable = false;
let P: typeof import("../src/db/passport.ts") | undefined;
let A: typeof import("../src/db/assessments.ts") | undefined;

if (url) {
  sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
  try {
    await sql`select 1`;
    const [cp] = await sql`select 1 from checkpoints where status = 'in_force' limit 1`;
    reachable = !!cp;
    P = await import("../src/db/passport.ts");
    A = await import("../src/db/assessments.ts");
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}

const dbRequired = { skip: reachable ? false : "no reachable DB / seeded in-force corpus" };
const NAME = "PASSPORT-TEST-pack";

const CONTEXT = {
  destination_markets: ["EU"],
  destination_member_states: ["DE"],
  food_contact: false,
  persona: "2b",
  declared_reusable: false,
  legal_role_facts: {},
};

async function cleanup(db: NonNullable<typeof sql>) {
  await db`delete from assessments where pack_name like 'PASSPORT-TEST-%'`;
}

before(async () => {
  if (reachable && sql) await cleanup(sql);
});
after(async () => {
  if (!sql) return;
  if (reachable) await cleanup(sql);
  await sql.end({ timeout: 5 });
  // generatePassport/getPassportByToken use the shared db client (index.ts),
  // which is cached on globalThis and would otherwise keep the event loop alive
  // and hang the test process. Close it here.
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
});

test("content hash is order-independent (canonical)", dbRequired, () => {
  const a = {
    disclosureModel: "v2" as const,
    packName: "P", corpusVersion: "batch-1", asOf: "2026-08-12", demo: true,
    materialComposition: [{ material: "corrugated", componentCount: 1 }],
    counts: { qualified: 1, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 },
    overallVerdict: "qualified",
    checkpoints: [],
    pcf: { totalKgCo2e: 1.23, unit: "kg CO2e", resolvedComponents: 1, unresolvedComponents: 0 },
  };
  const b = { pcf: a.pcf, checkpoints: a.checkpoints, overallVerdict: a.overallVerdict, counts: a.counts, materialComposition: a.materialComposition, demo: a.demo, asOf: a.asOf, corpusVersion: a.corpusVersion, packName: a.packName, disclosureModel: a.disclosureModel };
  assert.equal(P!.passportContentHash(a), P!.passportContentHash(b));
});

test("generate → v1 (unguessable token), idempotent, new hash-chained version on change", dbRequired, async () => {
  const id = await A!.createAssessment({
    packName: NAME,
    asOf: "2026-08-12",
    context: CONTEXT,
    components: [{ line: "1", name: "Outer carton", material: "corrugated", weightGrams: 500, evidence: [] }],
  });

  const r1 = await P!.generatePassport(id);
  assert.equal(r1.version, 1);
  assert.equal(r1.changed, true);
  assert.notEqual(r1.token, String(id), "token must not be the assessment id");
  assert.ok(/^[0-9a-f]{32}$/.test(r1.token), "token is a 32-hex unguessable string");

  // Regenerating unchanged data is a no-op — no new version.
  const r2 = await P!.generatePassport(id);
  assert.equal(r2.changed, false);
  assert.equal(r2.version, 1);

  // Change the underlying data: a supplier declaration flips the corrugated
  // component's checkpoints conditional → qualified, so counts change.
  const a = await A!.getAssessment(id);
  await A!.addEvidence(id, a!.components[0].id, { evidenceType: "supplier_declaration", reference: "PASSPORT-TEST-sd" });

  const r3 = await P!.generatePassport(id);
  assert.equal(r3.changed, true);
  assert.equal(r3.version, 2);
  assert.equal(r3.token, r1.token, "token is stable across versions");

  const loaded = await P!.getPassportByToken(r1.token);
  assert.equal(loaded!.version, 2);
  assert.equal(loaded!.prevHash, r1.contentHash, "prev_hash chains to the prior content hash");
  assert.ok(loaded!.changelog && loaded!.changelog.length > 0);

  // Disclosure model v2: per-checkpoint detail is present...
  const payload = loaded!.payload;
  assert.equal(payload.disclosureModel, "v2");
  assert.ok(Array.isArray(payload.checkpoints) && payload.checkpoints.length > 0, "checkpoints present");
  for (const c of payload.checkpoints) {
    assert.ok(c.checkpointId && c.requirement && c.verdict && c.reasonCategory, "checkpoint fields present");
    assert.ok(["qualified", "conditional", "gap", "not_applicable"].includes(c.verdict));
  }
  // ...and the public/gated line, AS IT NOW STANDS.
  //
  // Sprint 10 moved this line deliberately (DEVELOPMENT_PLAN decision log,
  // 2026-09-13): component identity, evidence references and issuers ARE public
  // now, because "Qualified" with no visible proof is the weakest useful thing a
  // passport can say. This test was asserting the OLD line and had to change —
  // so it is rewritten to assert the new one rather than deleted, which would
  // have removed the only automated guard on public disclosure.
  //
  // The rule the new line encodes: IDENTITY AND OUTCOME are public; NARRATIVE,
  // CONTACT ROUTES and RAW DOCUMENTS are not.
  const blob = JSON.stringify(payload);

  // Still gated. Each of these is a thing a reader could act on to someone's
  // detriment, or an internal judgement that is not the reader's business.
  for (const secret of [
    "riskRationale",       // the assessor's reasoning about a supplier's product
    "riskAnnotatedBy",     // who inside the operator made that judgement
    "sourcedFrom",         // the commercial sourcing route, distinct from origin
    "deltaAction",         // what the operator must do next
    "primaryContact",      // the operator's contact route
    "registeredAddress",   // ditto
  ]) {
    assert.ok(!blob.includes(secret), `payload must not leak "${secret}"`);
  }
  for (const forbidden of ["cards", "documents", "delta", "claims"]) {
    assert.ok(!Object.keys(payload).includes(forbidden), `payload must not expose "${forbidden}"`);
  }

  // Now public, and asserted positively so the widening cannot be silently
  // reverted either: a regression that dropped these would make the passport
  // unfalsifiable again.
  assert.ok(Array.isArray(payload.components) && payload.components.length > 0, "components are disclosed");
  const comp = payload.components![0];
  assert.equal(comp.name, "Outer carton", "component identity is public");
  assert.ok("countryOfOrigin" in comp && "supplierName" in comp && "recycledShare" in comp);
  assert.ok(payload.corpus?.asOf, "rule-set provenance is disclosed once");
});

test("unknown token resolves to null", dbRequired, async () => {
  assert.equal(await P!.getPassportByToken("deadbeef".repeat(4)), null);
});
