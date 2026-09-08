// C1 — getNotifications derives the three kinds from live state. Seeds one
// assessment with a received (un-extracted) document, a pending claim, and an
// expiring evidence row, then checks each surfaces. Skips without a reachable DB.
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
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
});

test("getNotifications surfaces received, awaiting, and expiring items", dbRequired, async () => {
  const s = sql!;
  // as_of today so the expiry window is measured from now.
  const [a] = await s`
    insert into assessments (pack_name, assessment_context, corpus_version, as_of)
    values ('NOTIFY-TEST', '{"destination_markets":["EU"]}'::jsonb, 'test', current_date) returning id`;
  const assessmentId = a.id as number;
  try {
    const [comp] = await s`
      insert into assessment_components (assessment_id, line, name, material)
      values (${assessmentId}, '1', 'Film', 'plastic') returning id`;
    // A received document with NO extraction run.
    const [recvDoc] = await s`
      insert into evidence_documents (assessment_id, component_id, filename, content_type, byte_size, sha256, storage_backend, storage_key, source)
      values (${assessmentId}, ${comp.id}, 'recv.pdf', 'application/pdf', 3, 'x', 'local', 'evidence/x/recv.pdf', 'magic-link') returning id`;
    // A second document WITH a run and a pending claim.
    const [doc2] = await s`
      insert into evidence_documents (assessment_id, component_id, filename, content_type, byte_size, sha256, storage_backend, storage_key, source)
      values (${assessmentId}, ${comp.id}, 'lab.pdf', 'application/pdf', 3, 'y', 'local', 'evidence/x/lab.pdf', 'manual') returning id`;
    const [run] = await s`
      insert into extraction_runs (document_id, provider, model, prompt_version, status)
      values (${doc2.id}, 'anthropic', 'claude-sonnet-5', '1.0.0', 'succeeded') returning id`;
    await s`insert into extracted_claims (run_id, claim_type, value, status, confidence)
      values (${run.id}, 'recycled_content', '40', 'pending', 0.9)`;
    // Confirmed evidence expiring in 30 days.
    await s`insert into assessment_evidence (component_id, evidence_type, reference, expiry_date)
      values (${comp.id}, 'test_report', 'lab cert', (current_date + interval '30 days')::date)`;

    const { getNotifications } = await import("../../src/db/notifications.ts");
    const items = (await getNotifications()).filter((i) => i.assessmentId === assessmentId);
    const kinds = new Set(items.map((i) => i.kind));
    assert.ok(kinds.has("received"), "received document should surface");
    assert.ok(kinds.has("awaiting_confirmation"), "pending claim should surface");
    assert.ok(kinds.has("expiring"), "expiring evidence should surface");
    // recvDoc is the only un-extracted doc → received count 1.
    const received = items.find((i) => i.kind === "received");
    assert.equal(received?.count, 1);
    assert.ok(recvDoc.id);
  } finally {
    await s`delete from assessments where id = ${assessmentId}`;
  }
});
