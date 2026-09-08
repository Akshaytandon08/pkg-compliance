// A2 — a CONFIRMED extracted claim is immutable at the database level. Confirming
// a pending claim is allowed; updating or deleting one that is already confirmed
// is refused by the trigger (corrections must be a new claim linked via
// supersedes_id). Skips without a reachable DB.
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
});

test("a confirmed claim cannot be updated or deleted; a pending one can", dbRequired, async () => {
  const s = sql!;
  // Build the minimal chain: assessment -> evidence_document -> run -> claim.
  const [a] = await s`
    insert into assessments (pack_name, assessment_context, corpus_version, as_of)
    values ('IMMUT-TEST', '{"destination_markets":["EU"]}'::jsonb, 'test', current_date)
    returning id`;
  const assessmentId = a.id as number;
  try {
    const [doc] = await s`
      insert into evidence_documents
        (assessment_id, filename, content_type, byte_size, sha256, storage_backend, storage_key, source)
      values (${assessmentId}, 'd.pdf', 'application/pdf', 3, 'x', 'local', 'evidence/x/y.pdf', 'manual')
      returning id`;
    const [run] = await s`
      insert into extraction_runs (document_id, provider, model, prompt_version, status)
      values (${doc.id}, 'anthropic', 'claude-sonnet-5', 'v1', 'succeeded')
      returning id`;
    const [claim] = await s`
      insert into extracted_claims (run_id, claim_type, value, status, confidence)
      values (${run.id}, 'recycled_content', '40', 'pending', 0.95)
      returning id`;
    const claimId = claim.id as number;

    // Pending -> confirmed is allowed.
    await s`update extracted_claims set status = 'confirmed', confirmed_by = 'Tester' where id = ${claimId}`;

    // A confirmed claim is frozen: update refused.
    await assert.rejects(
      () => s`update extracted_claims set value = '50' where id = ${claimId}`,
      /confirmed and immutable/,
      "updating a confirmed claim must be refused",
    );
    // And delete refused.
    await assert.rejects(
      () => s`delete from extracted_claims where id = ${claimId}`,
      /confirmed and immutable/,
      "deleting a confirmed claim must be refused",
    );

    // A correction is a NEW claim linked via supersedes_id — this is allowed.
    const [correction] = await s`
      insert into extracted_claims (run_id, claim_type, value, status, supersedes_id)
      values (${run.id}, 'recycled_content', '50', 'manual', ${claimId})
      returning id`;
    assert.ok(correction.id, "a superseding correction claim can be inserted");
  } finally {
    // assessments cascade to documents -> runs -> pending/manual claims; the
    // confirmed claim blocks its own delete, so drop it via cascade from the run
    // after clearing confirmed status is impossible — instead cascade-delete the
    // assessment, which the trigger permits (DELETE of a confirmed row IS blocked,
    // so remove the confirm first is also blocked). Use a session-local disable.
    await s`ALTER TABLE extracted_claims DISABLE TRIGGER extracted_claim_confirmed_immutable`;
    await s`delete from assessments where id = ${assessmentId}`;
    await s`ALTER TABLE extracted_claims ENABLE TRIGGER extracted_claim_confirmed_immutable`;
  }
});
