// npm run corpus:review — prints every draft checkpoint for a single review
// sitting: id, requirement one-liner, thresholds, evidence CNF, applicability,
// citation pinpoint and its primary-source URL. Read-only.
//
// npm run corpus:review -- --verified-gap — instead lists in_force checkpoints
// (and approved guidance) whose citation has NOT yet been verified against
// primary by a human. This is the corpus:verify work queue. Read-only.
import { and, eq, isNull } from "drizzle-orm";
import { checkpoints, evidenceGuidance } from "../src/db/schema.ts";
import { listGuidanceByStatus } from "../src/db/guidance.ts";
import { listDocTemplates } from "../src/db/doc-templates.ts";
import {
  connect,
  oneLiner,
  parseArgs,
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

const args = parseArgs(process.argv.slice(2));
const { sql, db } = connect();

if (args["doc-templates"] === true) {
  // Read-only review of document-template encodings (e.g. PPWR Annex VIII), so a
  // human can confirm the encoded elements match the primary Annex text before
  // running corpus:approve --doc-template. Fixed legal text is shown verbatim;
  // fillable elements are marked [FILL].
  try {
    const templates = await listDocTemplates(db);
    console.log(`\nDocument templates — ${templates.length} record(s)\n`);
    for (const t of templates) {
      console.log(`${t.templateId}@${t.version}  [${t.status}]  ${t.title}`);
      console.log(`  Source: ${t.sourceCitation}`);
      console.log(`  URL:    ${t.sourceUrl}`);
      if (t.status === "approved") console.log(`  Approved by ${t.approvedBy} (${t.corpusVersion})`);
      console.log(`  Elements (${t.elements.length}):`);
      for (const e of t.elements) {
        const tag = e.fillable ? `[FILL: ${e.fillLabel ?? ""}]` : "[fixed]";
        console.log(`    (${e.ref}) ${tag}`);
        for (const line of e.fixedText.split("\n")) console.log(`        ${line}`);
      }
      console.log("");
    }
    if (templates.some((t) => t.status === "draft")) {
      console.log(
        "Draft templates await regulatory-owner approval. When the encoding matches the\n" +
          "primary Annex text, approve from your own terminal (HUMAN-ONLY):\n" +
          '  npm run corpus:approve -- --doc-template --id <template-id> --version <v> --approved-by "<name>"\n',
      );
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(0);
}

if (args["verified-gap"] === true) {
  try {
    const unverified = await db
      .select()
      .from(checkpoints)
      .where(and(eq(checkpoints.status, "in_force"), isNull(checkpoints.citationVerifiedDate)));
    unverified.sort((a, b) => a.geography.localeCompare(b.geography) || a.id.localeCompare(b.id));

    console.log(
      `\nVerification gap — ${unverified.length} in_force checkpoint(s) with no primary-source verification`,
    );
    console.log(
      'Verify: npm run corpus:verify -- --id <id> --version <v> --verified-by "Akshay Tandon"',
    );
    for (const r of unverified) {
      const { pinpoint, url } = splitCitation(r.citation);
      console.log(`\n  ${r.id}@${r.version}   ${r.geography} · Stack ${r.stack}`);
      console.log(`    Citation: ${pinpoint || "(pinpoint blank)"}`);
      console.log(`    Source:   ${url || "(none)"}`);
    }

    const unverifiedGuidance = await db
      .select()
      .from(evidenceGuidance)
      .where(and(eq(evidenceGuidance.status, "approved"), isNull(evidenceGuidance.verifiedAt)));
    console.log(
      `\n── Approved guidance with no verification — ${unverifiedGuidance.length} row(s) ──`,
    );
    console.log(
      'Verify: npm run corpus:verify -- --guidance --id <checkpoint-id> --version <v> --evidence-type <type> --verified-by "Akshay Tandon"',
    );
    for (const g of unverifiedGuidance) {
      console.log(`  ${g.checkpointId}@${g.checkpointVersion} / ${g.evidenceType}`);
    }
    console.log("");
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(0);
}

try {
  const rows = await db.select().from(checkpoints).where(eq(checkpoints.status, "draft"));

  rows.sort(
    (a, b) =>
      a.geography.localeCompare(b.geography) ||
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
    const header = `${r.geography} · Stack ${r.stack} · ${r.subject}`;
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
    console.log(`    Confidence:  ${r.confidence ?? "— (not set)"}`);
    if (r.laterOfCondition) console.log(`    Phase-in:    ${oneLiner(r.laterOfCondition, 180)}`);
    if (r.exemptions && r.exemptions.length > 0)
      console.log(`    Exemptions:  ${r.exemptions.length} — ${r.exemptions.map((e) => e.scope).join("; ").slice(0, 160)}`);
    if (r.officialRegister)
      console.log(`    Register:    ${r.officialRegister} (operator ${r.registerOperator ?? "—"}; PRO ${r.producerResponsibilityOrganisation ?? "—"})`);
    if (r.sourceCorroborating) console.log(`    Corroborate: ${r.sourceCorroborating}`);
    if (r.futureLawWatch) console.log(`    Watch:       ${oneLiner(r.futureLawWatch, 180)}`);
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
