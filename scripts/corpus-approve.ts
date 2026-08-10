// npm run corpus:approve -- --id <id> --version <v> --source-url <url>
//   --approved-by "Akshay Tandon" [--notes "..."] [--corpus-version <label>]
//
// Records the approval and promotes the checkpoint to in_force in one
// transaction (via promoteCheckpointToInForce). Refuses unless --source-url is
// a primary-source domain — approval must cite primary, structurally.
import { eq } from "drizzle-orm";
import { corpusVersions } from "../src/db/schema.ts";
import { promoteCheckpointToInForce } from "../src/db/corpus.ts";
import { connect, isPrimarySourceUrl, parseArgs, primaryDomains, requireString } from "./corpus-lib.ts";

const args = parseArgs(process.argv.slice(2));
const id = requireString(args, "id");
const version = Number(requireString(args, "version"));
const sourceUrl = requireString(args, "source-url");
const approvedBy = requireString(args, "approved-by");
const notes = typeof args.notes === "string" ? args.notes : undefined;

if (!Number.isInteger(version) || version < 1) {
  console.error(`--version must be a positive integer (got ${JSON.stringify(args.version)})`);
  process.exit(1);
}

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
