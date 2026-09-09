// Deploy-time migration runner (used by `vercel-build`). It applies pending
// migrations with drizzle's postgres-js migrator, but — unlike `drizzle-kit
// migrate`, which swallowed the SQL error behind spinner frames in the Part 0
// preview-deploy triage (the Vercel log showed only NOTICEs then "exited 1") —
// on failure it prints the FAILING migration's SQL and the full Postgres error
// (code, detail, hint, position). Same __drizzle_migrations bookkeeping as
// drizzle-kit, so the two remain interchangeable.
import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolveDatabaseUrl } from "../src/db/database-url.ts";

const MIGRATIONS_DIR = path.resolve("drizzle");

interface JournalEntry {
  idx: number;
  tag: string;
}

/** The migration the sequential migrator is about to apply = the first journal
 *  entry beyond those already recorded in __drizzle_migrations. Best-effort: if
 *  the ledger cannot be read (e.g. first run, before the table exists), assume
 *  the very first migration. */
async function nextPendingTag(sql: postgres.Sql): Promise<string | null> {
  let journal: { entries: JournalEntry[] };
  try {
    journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"));
  } catch {
    return null;
  }
  let appliedCount = 0;
  try {
    const rows = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    appliedCount = rows[0]?.n ?? 0;
  } catch {
    appliedCount = 0;
  }
  const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
  return sorted[appliedCount]?.tag ?? null;
}

const client = postgres(resolveDatabaseUrl(), { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  console.log("[migrate] all migrations applied.");
} catch (err) {
  const e = err as { message?: string; code?: string; detail?: string; hint?: string; where?: string; position?: string; query?: string };
  console.error("[migrate] MIGRATION FAILED.");
  console.error(`  error:    ${e.message ?? String(err)}`);
  if (e.code) console.error(`  pg code:  ${e.code}`);
  if (e.detail) console.error(`  detail:   ${e.detail}`);
  if (e.hint) console.error(`  hint:     ${e.hint}`);
  if (e.where) console.error(`  where:    ${e.where}`);
  if (e.position) console.error(`  position: ${e.position}`);
  if (e.query) console.error(`  query:    ${e.query}`);
  const tag = await nextPendingTag(client).catch(() => null);
  if (tag) {
    console.error(`  failing migration (first unapplied): ${tag}`);
    try {
      const body = readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
      console.error(`  --- ${tag}.sql ---\n${body}\n  --- end ---`);
    } catch {
      /* file unreadable — the pg fields above still identify the failure */
    }
  }
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
process.exit(process.exitCode ?? 0);
