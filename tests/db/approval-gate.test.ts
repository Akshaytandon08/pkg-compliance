// Integration test for the database half of the approval gate. Skips cleanly
// when no database is reachable, so `npm test` works without Docker.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — DATABASE_URL may still be set in the environment
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

const dbRequired = {
  skip: reachable ? false : "no reachable DATABASE_URL (run: docker compose up -d)",
};

const ID = "TEST-approval-gate";

// Deliberately weak citation: proves the NOT NULL column alone is no gate.
const insertDraft = (db: NonNullable<typeof sql>, id: string, status = "draft") =>
  db`
    insert into checkpoints (id, version, geography, jurisdiction_level, stack, material,
      legal_role, persona_relevance, packaging_level, status, requirement_text, evidence_type, citation)
    values (${id}, 1, 'EU', 'EU', 'A', '{all}', '{manufacturer}', '{2a}', '{transport}',
      ${status}, 'Test requirement.', '{supplier_declaration}', 'plausible-looking string')
  `;

before(async () => {
  if (!reachable || !sql) return;
  await sql`delete from checkpoints where id like 'TEST-%'`;
  await sql`delete from corpus_versions where label like 'TEST-%'`;
});

after(async () => {
  if (!sql) return;
  if (reachable) {
    await sql`delete from checkpoints where id like 'TEST-%'`;
    await sql`delete from corpus_versions where label like 'TEST-%'`;
  }
  await sql.end({ timeout: 5 });
});

test("checkpoints insert as draft", dbRequired, async () => {
  const db = sql!;
  await insertDraft(db, ID);
  const [row] = await db`select status from checkpoints where id = ${ID}`;
  assert.equal(row.status, "draft");
});

test("cannot promote to in_force without an approval record", dbRequired, async () => {
  const db = sql!;
  await assert.rejects(
    () => db`update checkpoints set status = 'in_force' where id = ${ID}`,
    /cannot be in_force without an approval record/,
  );
});

test("cannot insert directly as in_force without an approval record", dbRequired, async () => {
  const db = sql!;
  await assert.rejects(
    () => insertDraft(db, `${ID}-sneaky`, "in_force"),
    /cannot be in_force without an approval record/,
  );
});

test("approval record permits in_force", dbRequired, async () => {
  const db = sql!;
  const [corpus] = await db`
    insert into corpus_versions (label, approved_by)
    values ('TEST-batch', 'Test Owner') returning id
  `;
  await db`
    insert into checkpoint_approvals
      (checkpoint_id, checkpoint_version, corpus_version_id, approved_by, primary_source_url)
    values (${ID}, 1, ${corpus.id}, 'Test Owner', 'https://eur-lex.europa.eu/eli/reg/2025/40/oj')
  `;
  await db`update checkpoints set status = 'in_force' where id = ${ID}`;
  const [row] = await db`select status from checkpoints where id = ${ID}`;
  assert.equal(row.status, "in_force");
});

test("approved content is immutable — edits require a new version", dbRequired, async () => {
  const db = sql!;
  await assert.rejects(
    () =>
      db`update checkpoints set requirement_text = 'Quietly weakened.' where id = ${ID}`,
    /substantive changes require a new version/,
  );
  await assert.rejects(
    () => db`update checkpoints set citation = 'swapped source' where id = ${ID}`,
    /substantive changes require a new version/,
  );
});

test("status may still move to contested or superseded", dbRequired, async () => {
  const db = sql!;
  await db`update checkpoints set status = 'contested' where id = ${ID}`;
  const [row] = await db`select status from checkpoints where id = ${ID}`;
  assert.equal(row.status, "contested");
});

test("deleting a checkpoint version cascades its approval away", dbRequired, async () => {
  const db = sql!;
  await db`delete from checkpoints where id = ${ID}`;
  const rows = await db`select 1 from checkpoint_approvals where checkpoint_id = ${ID}`;
  assert.equal(rows.length, 0, "stale approval survived its checkpoint version");
});
