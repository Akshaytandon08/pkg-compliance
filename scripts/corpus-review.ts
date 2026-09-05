// npm run corpus:review — prints every draft checkpoint for a single review
// sitting: id, requirement one-liner, thresholds, evidence CNF, applicability,
// citation pinpoint and its primary-source URL. Read-only.
import { eq } from "drizzle-orm";
import { checkpoints } from "../src/db/schema.ts";
import { listGuidanceByStatus } from "../src/db/guidance.ts";
import {
  connect,
  oneLiner,
  renderAppliesWhen,
  renderCnf,
  renderThresholds,
  splitCitation,
} from "./corpus-lib.ts";

const SUBJECT_ORDER: Record<string, number> = {
  component: 0,
  packaging_unit: 1,
  organisation: 2,
};

const { sql, db } = connect();
try {
  const rows = await db.select().from(checkpoints).where(eq(checkpoints.status, "draft"));

  rows.sort(
    (a, b) =>
      a.stack.localeCompare(b.stack) ||
      (SUBJECT_ORDER[a.subject] ?? 9) - (SUBJECT_ORDER[b.subject] ?? 9) ||
      a.id.localeCompare(b.id),
  );

  console.log(`\nCorpus review — ${rows.length} draft checkpoint(s) awaiting approval`);
  console.log("Ordered for a single sitting (stack, subject, id).");
  console.log(
    'Approve: npm run corpus:approve -- --id <id> --version <v> --source-url <primary-url> --approved-by "Akshay Tandon"',
  );
  console.log('Reject:  npm run corpus:reject  -- --id <id> --version <v> --reason "<why>"');

  let group = "";
  let n = 0;
  for (const r of rows) {
    const header = `Stack ${r.stack} · ${r.subject}`;
    if (header !== group) {
      group = header;
      console.log(`\n── ${header} ${"─".repeat(Math.max(0, 60 - header.length))}`);
    }
    n++;
    const { pinpoint, url } = splitCitation(r.citation);
    console.log(`\n[${n}] ${r.id} @${r.version}   (${r.legalRole.join(", ")})`);
    console.log(`    Requirement: ${oneLiner(r.requirementText)}`);
    console.log(`    Thresholds:  ${renderThresholds(r.thresholds)}`);
    console.log(`    Evidence:    ${renderCnf(r.evidenceRequirements)}`);
    console.log(`    Applies:     ${renderAppliesWhen(r.appliesWhen)}`);
    console.log(`    Citation:    ${pinpoint || "(pinpoint blank — to be pinned at approval)"}`);
    console.log(`    Source:      ${url || "(none)"}`);
    if (r.notes) console.log(`    Notes:       ${oneLiner(r.notes, 200)}`);
  }
  console.log("");

  // Evidence guidance drafts (Sprint 2b) — same draft→approved discipline.
  const guidance = await listGuidanceByStatus(db, "draft");
  console.log(`── Evidence guidance — ${guidance.length} draft row(s) awaiting approval ──`);
  console.log(
    'Approve: npm run corpus:approve -- --guidance --id <checkpoint-id> --version <v> --evidence-type <type> --approved-by "Akshay Tandon"',
  );
  for (const g of guidance) {
    console.log(`\n  ${g.checkpointId}@${g.checkpointVersion} / ${g.evidenceType}`);
    console.log(`    Issuer:       ${oneLiner(g.issuerGuidance ?? "—", 160)}`);
    console.log(
      `    Must contain: ${(g.mustContain ?? []).length} item(s) · Red flags: ${(g.redFlags ?? []).length} · Source: ${g.typicalSourceOrgRole ?? "—"}`,
    );
  }
  console.log("");
} finally {
  await sql.end({ timeout: 5 });
}
