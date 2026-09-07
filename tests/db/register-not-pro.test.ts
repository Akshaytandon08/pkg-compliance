// A producer responsibility organisation (PRO / éco-organisme, e.g. CITEO,
// CONAI) is NOT an official statutory register. The DB CHECK
// (checkpoints_register_not_pro) refuses the same value in both columns; this
// test adds semantic cover — a known PRO name must never appear in
// official_register on any checkpoint. Skips without a reachable DB.
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

// PRO / éco-organisme names that must never be recorded as an official register.
const KNOWN_PROS = ["CITEO", "CONAI", "ECOEMBES", "DER GRÜNE PUNKT", "DSD"];

after(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

test("no checkpoint stores a PRO name in official_register", dbRequired, async () => {
  const rows = await sql!`select id, version, official_register, producer_responsibility_organisation from checkpoints where official_register is not null`;
  for (const r of rows) {
    const reg = String(r.official_register).toUpperCase();
    for (const pro of KNOWN_PROS) {
      assert.ok(!reg.includes(pro), `${r.id}@${r.version}: official_register "${r.official_register}" contains PRO "${pro}"`);
    }
  }
});

test("official_register and PRO are never the same value (DB CHECK holds)", dbRequired, async () => {
  const rows = await sql!`
    select id, version from checkpoints
    where official_register is not null and producer_responsibility_organisation is not null
      and official_register = producer_responsibility_organisation`;
  assert.equal(rows.length, 0, "official_register must differ from the PRO");
});
