// Which database a write is about to go to — printed before every factor
// selection and every demo re-seed, and REFUSED when it is remote unless the
// caller said so explicitly.
//
// The near miss this exists for (2026-09-13): a long-lived shell still held a
// production DATABASE_URL exported from an earlier triage session. An export
// beats `.env`, so the window the owner was using as "local" resolved to the
// production Neon database. The credential happened to be stale, so it failed —
// but had it worked, five factors would have been written to PRODUCTION from the
// local window, and the production window would then have appended five more as
// version 2, leaving prod double-versioned and local empty.
//
// Nothing about the command would have looked wrong. That is the definition of a
// silent error, and this project's rule is that a wrong value must have been
// flagged.

export interface WriteTarget {
  host: string;
  database: string;
  isLocal: boolean;
  /** Safe to print: credentials are never included. */
  label: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

export function describeWriteTarget(databaseUrl: string | undefined): WriteTarget {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const u = new URL(databaseUrl);
  const database = u.pathname.replace(/^\//, "") || "(none)";
  const isLocal = LOCAL_HOSTS.has(u.hostname);
  return {
    host: u.hostname,
    database,
    isLocal,
    label: `${u.hostname}/${database}${isLocal ? " (local)" : " — REMOTE"}`,
  };
}

/**
 * Print the target, and stop if it is remote and `allowRemote` was not passed.
 * The message names the flag rather than just refusing, so the owner who DID
 * mean production can proceed in one step.
 */
export function requireIntendedTarget(allowRemote: boolean, what: string): WriteTarget {
  const target = describeWriteTarget(process.env.DATABASE_URL);
  console.log(`  target database: ${target.label}`);
  if (target.isLocal || allowRemote) return target;
  console.error(
    `\nREFUSING: ${what} would write to a REMOTE database (${target.host}/${target.database}).\n` +
      "DATABASE_URL is set in your environment, and an exported value overrides .env —\n" +
      "so a window you think is local can be pointed at production without saying so.\n\n" +
      "If you meant local:      unset DATABASE_URL\n" +
      "If you meant production: re-run the same command with --remote\n",
  );
  process.exit(1);
}
