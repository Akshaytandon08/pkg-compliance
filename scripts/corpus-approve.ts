// Checkpoint:
//   npm run corpus:approve -- --id <id> --version <v> --source-url <url>
//     --approved-by "Akshay Tandon" [--notes "..."] [--corpus-version <label>]
//   Promotes the checkpoint to in_force (via promoteCheckpointToInForce);
//   refuses unless --source-url is a primary-source domain.
//
// Evidence guidance:
//   npm run corpus:approve -- --guidance --id <checkpoint-id> --version <v>
//     --evidence-type <type> --approved-by "Akshay Tandon" [--corpus-version <label>]
//   Promotes a draft guidance row to approved. No source-url — guidance is
//   derived from the (already primary-cited) checkpoint, not a new source.
//
// Document template (e.g. PPWR Annex VIII encoding):
//   npm run corpus:approve -- --doc-template --id <template-id> --version <v>
//     --approved-by "Akshay Tandon" [--corpus-version <label>]
//   Promotes a draft doc_template to approved. The approver confirms the encoded
//   elements match the primary Annex text (docs/reference/…). No source-url — the
//   template already stores its source_citation + source_url.
//
// All are human-run. Nothing self-approves.
import { eq } from "drizzle-orm";
import { corpusVersions } from "../src/db/schema.ts";
import { promoteCheckpointToInForce } from "../src/db/corpus.ts";
import { approveGuidance } from "../src/db/guidance.ts";
import { approveDocTemplate } from "../src/db/doc-templates.ts";
import { connect, isPrimarySourceUrl, parseArgs, primaryDomains, requireString } from "./corpus-lib.ts";

const args = parseArgs(process.argv.slice(2));
const id = requireString(args, "id");
const version = Number(requireString(args, "version"));
const approvedBy = requireString(args, "approved-by");
const isGuidance = args.guidance === true;
const isDocTemplate = args["doc-template"] === true;

if (!Number.isInteger(version) || version < 1) {
  console.error(`--version must be a positive integer (got ${JSON.stringify(args.version)})`);
  process.exit(1);
}

const defaultLabel = `corpus-${new Date().toISOString().slice(0, 10)}`;

if (isDocTemplate) {
  const label = typeof args["corpus-version"] === "string" ? args["corpus-version"] : defaultLabel;
  const { sql, db } = connect();
  try {
    await approveDocTemplate(db, { templateId: id, version, approvedBy, corpusVersion: label });
    console.log(`Approved doc_template ${id}@${version} → approved (by ${approvedBy}).`);
  } catch (err) {
    console.error(`Doc-template approval failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(process.exitCode ?? 0);
}

if (isGuidance) {
  const evidenceType = requireString(args, "evidence-type");
  const label = typeof args["corpus-version"] === "string" ? args["corpus-version"] : defaultLabel;
  const { sql, db } = connect();
  try {
    await approveGuidance(db, {
      checkpointId: id,
      checkpointVersion: version,
      evidenceType,
      approvedBy,
      corpusVersion: label,
    });
    console.log(`Approved guidance ${id}@${version}/${evidenceType} → approved (by ${approvedBy}).`);
  } catch (err) {
    console.error(`Guidance approval failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(process.exitCode ?? 0);
}

const sourceUrl = requireString(args, "source-url");
const notes = typeof args.notes === "string" ? args.notes : undefined;

if (!isPrimarySourceUrl(sourceUrl)) {
  console.error(
    `Refusing to approve: --source-url must be a primary source. Allowed domains: ${primaryDomains().join(", ")}.\n` +
      `Got: ${sourceUrl}\n` +
      "Approval must cite primary law, not an aggregator or consultancy summary.",
  );
  process.exit(1);
}

const label =
  typeof args["corpus-version"] === "string"
    ? args["corpus-version"]
    : `corpus-${new Date().toISOString().slice(0, 10)}`;

const { sql, db } = connect();
try {
  let [cv] = await db.select().from(corpusVersions).where(eq(corpusVersions.label, label));
  if (!cv) {
    [cv] = await db.insert(corpusVersions).values({ label, approvedBy }).returning();
    console.log(`Created corpus version "${label}".`);
  }

  await promoteCheckpointToInForce(db, {
    checkpointId: id,
    checkpointVersion: version,
    corpusVersionId: cv.id,
    approvedBy,
    primarySourceUrl: sourceUrl,
    notes,
  });

  console.log(`Approved ${id}@${version} → in_force (corpus version "${label}", by ${approvedBy}).`);
} catch (err) {
  console.error(`Approval failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
