// HUMAN-ONLY. Claude Code must never run this (see AGENTS.md / CLAUDE.md).
//
// Checkpoint: npm run corpus:verify -- --id <id> --version <v>
//   --verified-by "Akshay Tandon" [--notes "..."]
//   Stamps citation_verified_date + verifier on an in_force checkpoint without
//   touching approved requirement content.
//
// Guidance:   npm run corpus:verify -- --guidance --id <checkpoint-id>
//   --version <v> --evidence-type <type> --verified-by "Akshay Tandon"
import { verifyCheckpoint } from "../src/db/corpus.ts";
import { verifyGuidance } from "../src/db/guidance.ts";
import { connect, parseArgs, requireString } from "./corpus-lib.ts";

const args = parseArgs(process.argv.slice(2));
const id = requireString(args, "id");
const version = Number(requireString(args, "version"));
const verifiedBy = requireString(args, "verified-by");
const isGuidance = args.guidance === true;

if (!Number.isInteger(version) || version < 1) {
  console.error(`--version must be a positive integer (got ${JSON.stringify(args.version)})`);
  process.exit(1);
}

const { sql, db } = connect();
try {
  if (isGuidance) {
    const evidenceType = requireString(args, "evidence-type");
    await verifyGuidance(db, { checkpointId: id, checkpointVersion: version, evidenceType, verifiedBy });
    console.log(`Verified guidance ${id}@${version}/${evidenceType} (by ${verifiedBy}).`);
  } else {
    await verifyCheckpoint(db, { checkpointId: id, checkpointVersion: version, verifiedBy });
    console.log(`Verified ${id}@${version} citation against primary (by ${verifiedBy}).`);
  }
} catch (err) {
  console.error(`Verification failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
