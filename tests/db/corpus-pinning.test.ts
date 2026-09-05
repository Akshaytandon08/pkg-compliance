// Corpus pinning: a report is reproducible against the corpus version stamped
// on its assessment. Approving a NEWER corpus version must not change a report
// an assessment pinned to an OLDER version already produced. Skips without a DB.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema.ts";
import { loadCorpusAsOf } from "../../src/db/assessments.ts";
import { evaluatePack, type ProductionCheckpoint } from "../../src/lib/engine/pack.ts";
import type { AssessmentContext } from "../../src/lib/engine/evaluate.ts";

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
    reachable = true;
    orm = drizzle(sql, { schema });
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}

const dbRequired = { skip: reachable ? false : "no reachable DATABASE_URL (run: docker compose up -d)" };

const V1 = "PINtst-v1";
const V2 = "PINtst-v2";
const A = "PINtst-A"; // approved under v1 (older)
const B = "PINtst-B"; // approved under v2 (newer)

const CONTEXT: AssessmentContext = {
  destination_markets: ["EU"],
  destination_member_states: [],
  food_contact: false,
  persona: "2a",
  declared_reusable: false,
  legal_role_facts: {},
};

const insertDraft = (db: NonNullable<typeof sql>, id: string) =>
  db`
    insert into checkpoints (id, version, geography, jurisdiction_level, stack, subject, material,
      legal_role, persona_relevance, packaging_level, status, requirement_text, evidence_requirements, citation)
    values (${id}, 1, 'EU', 'EU', 'A', 'component', '{all}', '{manufacturer}', '{2a}', '{transport}',
      'draft', ${`Requirement ${id}.`}, '{"allOf":[{"anyOf":["supplier_declaration"]}]}'::jsonb,
      'Regulation (EU) 2025/40, Article 5. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng')
  `;

async function approveUnder(db: NonNullable<typeof sql>, id: string, corpusLabel: string, approvedAtIso: string) {
  const [corpus] = await db`
    insert into corpus_versions (label, approved_by, approved_at)
    values (${corpusLabel}, 'Test Owner', ${approvedAtIso})
    on conflict (label) do update set approved_at = excluded.approved_at
    returning id
  `;
  await db`
    insert into checkpoint_approvals
      (checkpoint_id, checkpoint_version, corpus_version_id, approved_by, primary_source_url)
    values (${id}, 1, ${corpus.id}, 'Test Owner', 'https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng')
  `;
  await db`update checkpoints set status = 'in_force' where id = ${id}`;
}

async function cleanup(db: NonNullable<typeof sql>) {
  await db`delete from checkpoint_approvals where checkpoint_id like 'PINtst-%'`;
  await db`delete from checkpoints where id like 'PINtst-%'`;
  await db`delete from corpus_versions where label like 'PINtst-%'`;
}

const ONE_COMPONENT = [
  { line: "1", name: "Test film", material: "plastics", documents: [] },
];

function reportFor(corpus: ProductionCheckpoint[]) {
  return evaluatePack({
    checkpoints: corpus,
    context: CONTEXT,
    components: ONE_COMPONENT,
    asOf: "2026-09-05",
    corpusVersion: V1,
  });
}

before(async () => {
  if (reachable && sql) await cleanup(sql);
});
after(async () => {
  if (!sql) return;
  if (reachable) await cleanup(sql);
  await sql.end({ timeout: 5 });
});

test("a pin excludes checkpoints approved under a later corpus version", dbRequired, async () => {
  const db = sql!;
  await insertDraft(db, A);
  await insertDraft(db, B);
  // v1 approved earlier than v2.
  await approveUnder(db, A, V1, "2026-08-11T00:00:00Z");
  await approveUnder(db, B, V2, "2026-09-01T00:00:00Z");

  const asV1 = await loadCorpusAsOf(V1, orm!);
  const idsV1 = asV1.map((c) => c.id);
  assert.ok(idsV1.includes(A), "v1 pin includes its own checkpoint");
  assert.ok(!idsV1.includes(B), "v1 pin excludes the later v2 checkpoint");

  const asV2 = await loadCorpusAsOf(V2, orm!);
  const idsV2 = asV2.map((c) => c.id);
  assert.ok(idsV2.includes(A) && idsV2.includes(B), "v2 pin includes both (v1 ≤ v2)");
});

test("approving a newer corpus version does not change an older pinned report", dbRequired, async () => {
  const db = sql!;
  // Fresh state: only A exists and is approved under v1.
  await cleanup(db);
  await insertDraft(db, A);
  await approveUnder(db, A, V1, "2026-08-11T00:00:00Z");

  const before = reportFor((await loadCorpusAsOf(V1, orm!)).filter((c) => c.id.startsWith("PINtst-")));

  // Later: B is seeded and approved under a newer version.
  await insertDraft(db, B);
  await approveUnder(db, B, V2, "2026-09-01T00:00:00Z");

  const after = reportFor((await loadCorpusAsOf(V1, orm!)).filter((c) => c.id.startsWith("PINtst-")));

  assert.deepEqual(after, before, "the v1-pinned report is byte-identical before and after v2 approval");
});
