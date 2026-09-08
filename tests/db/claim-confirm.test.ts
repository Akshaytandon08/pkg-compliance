// B3 — confirming an extracted claim materialises an assessment_evidence row and
// marks the claim confirmed; rejecting marks it rejected and creates no evidence;
// edit-and-confirm applies the edit before confirming. Skips without a reachable DB.
import { test, after } from "node:test";
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
if (url) {
  sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
  try {
    await sql`select 1`;
    reachable = true;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}
const dbRequired = { skip: reachable ? false : "no reachable DATABASE_URL" };

after(async () => {
  if (sql) await sql.end({ timeout: 5 });
  // claims.ts initialises the shared db client (src/db/index.ts) on the global;
  // close it so `node --test` can exit (mirrors tests/passport.test.ts).
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
});

// Build assessment -> component -> document -> run -> pending claim; return ids.
async function seed(s: ReturnType<typeof postgres>, claimType = "recycled_content") {
  const [a] = await s`
    insert into assessments (pack_name, assessment_context, corpus_version, as_of)
    values ('CONFIRM-TEST', '{"destination_markets":["EU"]}'::jsonb, 'test', current_date) returning id`;
  const [comp] = await s`
    insert into assessment_components (assessment_id, line, name, material)
    values (${a.id}, '1', 'Film wrap', 'plastic') returning id`;
  const [doc] = await s`
    insert into evidence_documents (assessment_id, component_id, filename, content_type, byte_size, sha256, storage_backend, storage_key, source)
    values (${a.id}, ${comp.id}, 'd.pdf', 'application/pdf', 3, 'x', 'local', 'evidence/x/y.pdf', 'magic-link') returning id`;
  const [run] = await s`
    insert into extraction_runs (document_id, provider, model, prompt_version, status)
    values (${doc.id}, 'anthropic', 'claude-sonnet-5', '1.0.0', 'succeeded') returning id`;
  const [claim] = await s`
    insert into extracted_claims (run_id, claim_type, parameter, value, status, confidence)
    values (${run.id}, ${claimType}, 'recycled_content', '40', 'pending', 0.95) returning id`;
  return { assessmentId: a.id as number, componentId: comp.id as number, claimId: claim.id as number };
}

async function cleanup(s: ReturnType<typeof postgres>, assessmentId: number) {
  await s`ALTER TABLE extracted_claims DISABLE TRIGGER extracted_claim_confirmed_immutable`;
  await s`delete from assessments where id = ${assessmentId}`;
  await s`ALTER TABLE extracted_claims ENABLE TRIGGER extracted_claim_confirmed_immutable`;
}

test("confirmClaim marks the claim confirmed and inserts a scoped evidence row", dbRequired, async () => {
  const s = sql!;
  const { assessmentId, componentId, claimId } = await seed(s);
  try {
    const { confirmClaim } = await import("../../src/db/claims.ts");
    const outcome = await confirmClaim(claimId, "Tester");
    assert.deepEqual(outcome, { ok: true, materialised: true });

    const [claim] = await s`select status, confirmed_by from extracted_claims where id = ${claimId}`;
    assert.equal(claim.status, "confirmed");
    assert.equal(claim.confirmed_by, "Tester");

    const ev = await s`select evidence_type, scope_components from assessment_evidence where component_id = ${componentId}`;
    assert.equal(ev.length, 1);
    assert.equal(ev[0].evidence_type, "supplier_declaration");
    assert.deepEqual(ev[0].scope_components, ["Film wrap"]);
  } finally {
    await cleanup(s, assessmentId);
  }
});

test("rejectClaim marks rejected and creates no evidence", dbRequired, async () => {
  const s = sql!;
  const { assessmentId, componentId, claimId } = await seed(s);
  try {
    const { rejectClaim } = await import("../../src/db/claims.ts");
    const outcome = await rejectClaim(claimId, "Tester");
    assert.equal(outcome.ok, true);
    const [claim] = await s`select status from extracted_claims where id = ${claimId}`;
    assert.equal(claim.status, "rejected");
    const ev = await s`select 1 from assessment_evidence where component_id = ${componentId}`;
    assert.equal(ev.length, 0);
  } finally {
    await cleanup(s, assessmentId);
  }
});

test("editAndConfirmClaim applies the edit then confirms", dbRequired, async () => {
  const s = sql!;
  const { assessmentId, claimId } = await seed(s);
  try {
    const { editAndConfirmClaim } = await import("../../src/db/claims.ts");
    const outcome = await editAndConfirmClaim(claimId, { value: "55", expiry: "2027-06-01" }, "Tester");
    assert.equal(outcome.ok, true);
    const [claim] = await s`select status, value, expiry from extracted_claims where id = ${claimId}`;
    assert.equal(claim.status, "confirmed");
    assert.equal(claim.value, "55");
    // a `date` column comes back as a JS Date; compare the calendar date.
    assert.equal(new Date(claim.expiry as string).toISOString().slice(0, 10), "2027-06-01");
  } finally {
    await cleanup(s, assessmentId);
  }
});
