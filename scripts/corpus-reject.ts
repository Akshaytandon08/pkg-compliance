// npm run corpus:reject -- --id <id> --version <v> --reason "<why>"
//
// Marks a draft superseded with the reason recorded in notes — for rows that
// fail the primary-source check or are otherwise not fit to ship. Empties the
// review queue either way (approve or reject).
import { supersedeCheckpoint } from "../src/db/corpus.ts";
import { connect, parseArgs, requireString } from "./corpus-lib.ts";

const args = parseArgs(process.argv.slice(2));
const id = requireString(args, "id");
const version = Number(requireString(args, "version"));
const reason = requireString(args, "reason");

if (!Number.isInteger(version) || version < 1) {
  console.error(`--version must be a positive integer (got ${JSON.stringify(args.version)})`);
  process.exit(1);
}

const { sql, db } = connect();
try {
  await supersedeCheckpoint(db, id, version, reason);
  console.log(`Rejected ${id}@${version} → superseded. Reason recorded: ${reason}`);
} catch (err) {
  console.error(`Reject failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
