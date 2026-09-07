// Official register / PRO domains corroborate a checkpoint but are not
// legislation, so they may only be source_corroborating — never the primary
// citation. This scans the corpus and enforces that split. Skips without a DB.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { isCorroboratingOnlyUrl, splitCitation } from "../../scripts/corpus-lib.ts";

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

test("no primary citation uses a corroborating-only (register/PRO) domain", dbRequired, async () => {
  const rows = await sql!`select id, version, citation from checkpoints`;
  for (const r of rows) {
    const { url: citeUrl } = splitCitation(String(r.citation));
    if (!citeUrl) continue;
    assert.ok(
      !isCorroboratingOnlyUrl(citeUrl),
      `${r.id}@${r.version}: primary citation uses a corroborating-only domain (${citeUrl})`,
    );
  }
});
