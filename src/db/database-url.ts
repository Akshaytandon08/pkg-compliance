// Single resolver for the Postgres connection string, honouring Vercel's
// environment split. Kept dependency-free so both the runtime client
// (src/db/index.ts) and the migration config (drizzle.config.ts) can use it —
// migrations and runtime must always agree on which database they touch.
//
// On a Vercel PREVIEW deployment (VERCEL_ENV=preview) it uses PREVIEW_DATABASE_URL
// so previews never read or migrate the PRODUCTION database. Everywhere else
// (production, local, CI) it uses DATABASE_URL. If a preview deployment has no
// PREVIEW_DATABASE_URL it warns and falls back to DATABASE_URL — set the preview
// var (see README) so previews stay isolated.
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.VERCEL_ENV === "preview") {
    if (env.PREVIEW_DATABASE_URL && env.PREVIEW_DATABASE_URL.length > 0) {
      return env.PREVIEW_DATABASE_URL;
    }
    console.warn(
      "[db] VERCEL_ENV=preview but PREVIEW_DATABASE_URL is unset — falling back to " +
        "DATABASE_URL; this preview will share the PRODUCTION database. Set " +
        "PREVIEW_DATABASE_URL (Preview scope) to isolate it.",
    );
  }
  return env.DATABASE_URL ?? "";
}
