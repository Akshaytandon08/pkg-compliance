// B4 — the activity feed. createEvidenceRequest records a request_created event;
// logActivity/listActivity append and read newest-first; verdictsDiffer compares
// two summaries. Skips without a reachable DB.
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

async function newAssessment(s: ReturnType<typeof postgres>): Promise<number> {
  const [a] = await s`
    insert into assessments (pack_name, assessment_context, corpus_version, as_of)
    values ('ACTIVITY-TEST', '{"destination_markets":["EU"]}'::jsonb, 'test', current_date) returning id`;
  return a.id as number;
}

test("createEvidenceRequest records a request_created event and returns a token", dbRequired, async () => {
  const s = sql!;
  const assessmentId = await newAssessment(s);
  try {
    const { createEvidenceRequest } = await import("../../src/db/evidence-requests.ts");
    const { listActivity } = await import("../../src/db/activity.ts");
    const { token } = await createEvidenceRequest({
      assessmentId,
      checkpointId: "EU-recycled-content",
      note: "please send the declaration",
    });
    assert.match(token, /^[0-9a-f]{32}$/);
    const feed = await listActivity(assessmentId);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].kind, "request_created");
    assert.match(feed[0].summary, /EU-recycled-content/);
  } finally {
    await s`delete from assessments where id = ${assessmentId}`;
  }
});

test("listActivity returns events newest-first", dbRequired, async () => {
  const s = sql!;
  const assessmentId = await newAssessment(s);
  try {
    const { logActivity, listActivity } = await import("../../src/db/activity.ts");
    await logActivity(assessmentId, { kind: "document_received", actor: "supplier (magic-link)", summary: "first" });
    await logActivity(assessmentId, { kind: "claim_confirmed", actor: "Assessor", summary: "second" });
    const feed = await listActivity(assessmentId);
    assert.equal(feed.length, 2);
    assert.equal(feed[0].summary, "second"); // newest first
    assert.equal(feed[1].summary, "first");
  } finally {
    await s`delete from assessments where id = ${assessmentId}`;
  }
});

test("verdictsDiffer detects a changed overall verdict or count", async () => {
  const { verdictsDiffer } = await import("../../src/db/verdict-summary.ts");
  const base = {
    counts: { qualified: 1, conditional: 0, gap: 2, not_applicable: 0, caveat: 0 },
    overall: { verdict: "gap" as const, evaluatedCount: 3 },
  };
  assert.equal(verdictsDiffer(base, base), false);
  assert.equal(
    verdictsDiffer(base, { ...base, overall: { verdict: "qualified", evaluatedCount: 3 } }),
    true,
  );
  assert.equal(
    verdictsDiffer(base, { ...base, counts: { ...base.counts, gap: 1, qualified: 2 } }),
    true,
  );
});
