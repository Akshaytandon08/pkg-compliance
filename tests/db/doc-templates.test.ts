// COMMIT 1 — the PPWR Annex VIII encoding is corpus-governed data: seeded DRAFT
// (never auto-approved), verbatim against the fetched reference, and generation is
// blocked until a human approves. Skips without a reachable DB.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { findLanguageViolations } from "../../src/lib/report/language.ts";

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

test("Annex VIII exists with 11 verbatim elements (seeded draft; may be human-approved)", dbRequired, async () => {
  const { loadDocTemplate } = await import("../../src/db/doc-templates.ts");
  const t = await loadDocTemplate("EU-DoC-AnnexVIII");
  assert.ok(t, "template must exist");
  // The migration seeds it 'draft'; a human may promote it to 'approved' via
  // corpus:approve (never Claude). Either is valid — status is not auto-set to
  // anything else.
  assert.ok(["draft", "approved"].includes(t.status), `status was ${t.status}`);
  assert.equal(t.elements.length, 11);
  assert.match(t.sourceCitation, /2025\/40.*Annex VIII/);

  // Element 3 (fixed) must be the exact Annex sentence.
  const three = t.elements.find((e) => e.ref === "3");
  assert.equal(
    three?.fixedText,
    "This declaration of conformity is issued under the sole responsibility of the manufacturer.",
  );
  assert.equal(three?.fillable, false);

  // The header and points 1,2,4–8 are fillable; 3 and the footnote are fixed.
  assert.equal(t.elements.find((e) => e.ref === "header")?.fillable, true);
  assert.equal(t.elements.find((e) => e.ref === "footnote")?.fillable, false);
});

test("the encoding matches the fetched EUR-Lex reference verbatim", dbRequired, async () => {
  const { loadDocTemplate } = await import("../../src/db/doc-templates.ts");
  const t = await loadDocTemplate("EU-DoC-AnnexVIII");
  // The reference is markdown; strip backslash escapes (e.g. \* → *) so the
  // comparison is against the verbatim legal text, not the markdown rendering.
  const reference = readFileSync("docs/reference/ppwr-annex-viii-2025-40.md", "utf8").replace(/\\([*(])/g, "$1");
  // Every fixed element's text must appear verbatim in the primary-source reference.
  for (const e of t!.elements) {
    // The signature element spans multiple reference lines; check its first line.
    const probe = e.fixedText.split("\n")[0];
    assert.ok(reference.includes(probe), `reference must contain: "${probe}"`);
  }
});

test("the approved-only loader never returns a non-approved template", dbRequired, async () => {
  const { loadApprovedDocTemplate } = await import("../../src/db/doc-templates.ts");
  // Whatever the live approval state, loadApprovedDocTemplate must only ever return
  // an 'approved' record (generation can never run against a draft encoding) …
  const approved = await loadApprovedDocTemplate("EU-DoC-AnnexVIII");
  if (approved) assert.equal(approved.status, "approved");
  // … and a template that does not exist yields null (generation blocked).
  assert.equal(await loadApprovedDocTemplate("EU-DoC-DoesNotExist"), null);
});

test("the verbatim Annex text passes the speaker-based language guardrail", dbRequired, async () => {
  const { loadDocTemplate } = await import("../../src/db/doc-templates.ts");
  const t = await loadDocTemplate("EU-DoC-AnnexVIII");
  // The Annex's own 'issued' wording (elements 3, 7) is the manufacturer's
  // declaration content, not a system issuing-claim — it must NOT be flagged.
  for (const e of t!.elements) {
    const violations = findLanguageViolations(e.fixedText);
    assert.deepEqual(violations, [], `element ${e.ref} must pass the guardrail, got ${JSON.stringify(violations)}`);
  }
});
