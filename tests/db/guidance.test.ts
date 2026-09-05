// Evidence guidance follows the same draft→approved discipline as checkpoints:
// seeds draft, only a human-run approval flips it. Skips without a DB.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema.ts";
import { approveGuidance, verifyGuidance } from "../../src/db/guidance.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL may still be set in the environment
}

const url = process.env.DATABASE_URL;
let sql: ReturnType<typeof postgres> | undefined;
let orm: ReturnType<typeof drizzle<typeof schema>> | undefined;
let reachable = false;

if (url) {
  sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
  try {
    await sql`select 1`;
    // A real checkpoint the guidance FK can reference.
    const [cp] = await sql`select 1 from checkpoints where id = 'EU-PPWR-heavy-metals' and version = 1`;
    reachable = !!cp;
    orm = drizzle(sql, { schema });
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}

const dbRequired = { skip: reachable ? false : "no reachable DATABASE_URL / seeded corpus" };
const ETYPE = "TEST-guidance";

async function cleanup(db: NonNullable<typeof sql>) {
  await db`delete from evidence_guidance where evidence_type like 'TEST-%'`;
}

before(async () => {
  if (reachable && sql) await cleanup(sql);
});
after(async () => {
  if (!sql) return;
  if (reachable) await cleanup(sql);
  await sql.end({ timeout: 5 });
});

test("guidance inserts as draft", dbRequired, async () => {
  const db = sql!;
  await db`
    insert into evidence_guidance (checkpoint_id, checkpoint_version, evidence_type, issuer_guidance)
    values ('EU-PPWR-heavy-metals', 1, ${ETYPE}, 'test')
  `;
  const [row] = await db`select status from evidence_guidance where evidence_type = ${ETYPE}`;
  assert.equal(row.status, "draft");
});

test("approveGuidance promotes draft → approved with attribution", dbRequired, async () => {
  await approveGuidance(orm!, {
    checkpointId: "EU-PPWR-heavy-metals",
    checkpointVersion: 1,
    evidenceType: ETYPE,
    approvedBy: "Test Owner",
    corpusVersion: "batch-1",
  });
  const [row] = await sql!`select status, approved_by from evidence_guidance where evidence_type = ${ETYPE}`;
  assert.equal(row.status, "approved");
  assert.equal(row.approved_by, "Test Owner");
});

test("re-approving an approved guidance row is refused", dbRequired, async () => {
  await assert.rejects(
    () =>
      approveGuidance(orm!, {
        checkpointId: "EU-PPWR-heavy-metals",
        checkpointVersion: 1,
        evidenceType: ETYPE,
        approvedBy: "Test Owner",
        corpusVersion: "batch-1",
      }),
    /already approved/,
  );
});

test("approving a non-existent guidance row is refused", dbRequired, async () => {
  await assert.rejects(
    () =>
      approveGuidance(orm!, {
        checkpointId: "EU-PPWR-heavy-metals",
        checkpointVersion: 1,
        evidenceType: "TEST-missing",
        approvedBy: "Test Owner",
        corpusVersion: "batch-1",
      }),
    /no guidance/,
  );
});

// --- Trigger-level gate (parity with checkpoints) ------------------------
// The application path (approveGuidance) always supplies attribution; these
// prove the DB itself refuses a bad state even if written by hand.

test("trigger refuses status='approved' without approved_by/corpus_version", dbRequired, async () => {
  const db = sql!;
  await assert.rejects(
    () =>
      db`
        insert into evidence_guidance (checkpoint_id, checkpoint_version, evidence_type, status)
        values ('EU-PPWR-heavy-metals', 1, 'TEST-badapprove', 'approved')
      `,
    /cannot be approved without approved_by/,
  );
});

test("trigger freezes an approved guidance row's content", dbRequired, async () => {
  // ETYPE is approved by the earlier test; its advice must now be immutable.
  const db = sql!;
  await assert.rejects(
    () => db`update evidence_guidance set issuer_guidance = 'changed' where evidence_type = ${ETYPE}`,
    /immutable/,
  );
});

// --- Verification (corpus:verify --guidance path) ------------------------

test("verifyGuidance stamps verifier on an approved row", dbRequired, async () => {
  await verifyGuidance(orm!, {
    checkpointId: "EU-PPWR-heavy-metals",
    checkpointVersion: 1,
    evidenceType: ETYPE,
    verifiedBy: "Test Verifier",
  });
  const [row] = await sql!`select verified_by, verified_at from evidence_guidance where evidence_type = ${ETYPE}`;
  assert.equal(row.verified_by, "Test Verifier");
  assert.ok(row.verified_at, "verified_at should be set");
});

test("verifyGuidance refuses a draft (non-approved) row", dbRequired, async () => {
  const db = sql!;
  await db`
    insert into evidence_guidance (checkpoint_id, checkpoint_version, evidence_type, issuer_guidance)
    values ('EU-PPWR-heavy-metals', 1, 'TEST-draft-verify', 'draft')
  `;
  await assert.rejects(
    () =>
      verifyGuidance(orm!, {
        checkpointId: "EU-PPWR-heavy-metals",
        checkpointVersion: 1,
        evidenceType: "TEST-draft-verify",
        verifiedBy: "Test Verifier",
      }),
    /not 'approved'/,
  );
});
