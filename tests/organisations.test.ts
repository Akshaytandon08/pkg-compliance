// The obligated economic operator a screening is prepared for. Two things here
// are load-bearing and are therefore pinned against a real database rather than
// asserted in prose: EPR registration is PER MEMBER STATE (one operator, several
// registers), and removing an operator must NOT remove the screenings prepared
// for it — an assessment is an audit artefact (CLAUDE.md, data governance 1), so
// the foreign key is ON DELETE SET NULL, never CASCADE.
//
// App modules are dynamic-imported AFTER the env is loaded so the shared db
// client initialises with DATABASE_URL. Needs only a reachable DB — no corpus.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import type { AssessmentContextRecord } from "../src/db/schema.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL may still be set in the environment
}

const url = process.env.DATABASE_URL;
let sql: ReturnType<typeof postgres> | undefined;
let reachable = false;
let O: typeof import("../src/db/organisations.ts") | undefined;
let A: typeof import("../src/db/assessments.ts") | undefined;

const CONTEXT: AssessmentContextRecord = {
  destination_markets: ["EU"],
  destination_member_states: ["DE"],
  food_contact: false,
  persona: "2b",
  declared_reusable: false,
  legal_role_facts: {},
};

const LEGAL_NAME = "ORG-TEST — Brakewater Packaging N.V.";
const PACK = "ORG-TEST-pack";

async function cleanup(s: ReturnType<typeof postgres>) {
  await s`delete from assessments where pack_name = ${PACK}`;
  await s`delete from organisations where legal_name = ${LEGAL_NAME}`;
}

if (url) {
  sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3 });
  try {
    await sql`select 1 from organisations limit 1`;
    reachable = true;
    O = await import("../src/db/organisations.ts");
    A = await import("../src/db/assessments.ts");
    await cleanup(sql);
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    sql = undefined;
  }
}

const dbRequired = { skip: reachable ? false : "no reachable DB with the organisations table" };

after(async () => {
  if (!sql) return;
  if (reachable) await cleanup(sql);
  await sql.end({ timeout: 5 });
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
});

test("an operator carries one registration per Member State, not one overall", dbRequired, async () => {
  const id = await O!.createOrganisation({
    legalName: LEGAL_NAME,
    country: "nl", // lower case in, ISO alpha-2 out
    roleDefault: "epr_producer",
    registrations: [
      { scheme: "epr_packaging", registerName: "LUCID", registrationNumber: "DE1", jurisdiction: "de" },
      { scheme: "epr_packaging", registerName: "Mijn Verpact", registrationNumber: "NL1", jurisdiction: "nl" },
    ],
  });

  const org = await O!.getOrganisation(id);
  assert.equal(org!.country, "NL", "country is normalised to ISO 3166-1 alpha-2");
  assert.equal(org!.demo, false, "demo is opt-in — a real operator is never tagged as demo data");
  assert.deepEqual(
    org!.registrations.map((r) => `${r.jurisdiction}:${r.registrationNumber}`),
    ["DE:DE1", "NL:NL1"],
    "both Member States are held; a single column could not have carried them",
  );
});

test("a screening records who it is prepared for, and may record nobody", dbRequired, async () => {
  const orgId = await O!.createOrganisation({ legalName: LEGAL_NAME, country: "NL" });
  const withOrg = await A!.createAssessment({
    packName: PACK,
    asOf: "2026-08-12",
    context: CONTEXT,
    organisationId: orgId,
    components: [],
  });
  const without = await A!.createAssessment({
    packName: PACK,
    asOf: "2026-08-12",
    context: CONTEXT,
    components: [],
  });

  assert.equal((await A!.getAssessment(withOrg))!.organisationId, orgId);
  // Nullable on purpose: every assessment created before organisations existed
  // has no truthful answer, and an unknown addressee must render as unknown.
  assert.equal((await A!.getAssessment(without))!.organisationId, null);
});

test("deleting an operator clears the link but never deletes the screening", dbRequired, async () => {
  const orgId = await O!.createOrganisation({
    legalName: LEGAL_NAME,
    country: "NL",
    registrations: [
      { scheme: "epr_packaging", registrationNumber: "DE1", jurisdiction: "DE" },
    ],
  });
  const id = await A!.createAssessment({
    packName: PACK,
    asOf: "2026-08-12",
    context: CONTEXT,
    organisationId: orgId,
    components: [],
  });

  await sql!`delete from organisations where id = ${orgId}`;

  const reloaded = await A!.getAssessment(id);
  assert.ok(reloaded, "the assessment survives — it is an audit artefact, not a child record");
  assert.equal(reloaded!.organisationId, null, "the dangling link is cleared, not left pointing at nothing");

  // The operator's own registrations DO cascade: they have no meaning without it.
  const regs = await sql!`select 1 from org_registrations where organisation_id = ${orgId}`;
  assert.equal(regs.length, 0);
});
