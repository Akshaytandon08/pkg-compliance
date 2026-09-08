// Post-deploy smoke test. GET <origin>/api/health and require the app to report
// {status:"ok", database:"connected"}. Exits non-zero on anything else — a
// non-200, a non-JSON body (e.g. a platform auth/interstitial page), or a
// degraded database. Pure Node (global fetch), no dependencies.
//   Run:  node scripts/smoke.ts https://pkg-compliance.vercel.app   (the PRODUCTION ALIAS)
//
// IMPORTANT: probe the stable PRODUCTION ALIAS, never a Vercel deployment-hash URL.
// Vercel deployment/preview URLs (…-<hash>-<team>-projects.vercel.app) sit behind
// Standard Protection and return HTTP 401 "Protected deployment" with an SSO
// redirect — so smoking one is meaningless. This script REFUSES such a host and
// explains why, so the failure is never mistaken for an app problem.
export {}; // make this a module so top-level await is allowed

const targetOrigin = process.argv[2] ?? process.env.SMOKE_ORIGIN;
if (!targetOrigin) {
  console.error("usage: node scripts/smoke.ts <origin>   (the production alias, e.g. https://pkg-compliance.vercel.app)");
  process.exit(2);
}

// Recurrence guard: a Vercel auto-generated deployment/preview host is not the
// alias and is protected by design. Detect its shapes and refuse.
function isVercelDeploymentHost(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host.endsWith(".vercel.app")) return false;
  const sub = host.slice(0, -".vercel.app".length);
  // account/team scope suffix Vercel appends to generated URLs (e.g. "-projects")
  if (sub.endsWith("-projects")) return true;
  // git-branch deployment URLs
  if (sub.includes("-git-")) return true;
  // a deployment-hash segment: 8+ alphanumerics containing a digit, between dashes
  if (/-(?=[a-z0-9]*[0-9])[a-z0-9]{8,}-/.test(sub)) return true;
  return false;
}

if (isVercelDeploymentHost(targetOrigin)) {
  console.error(
    `smoke REFUSED — "${targetOrigin}" is a Vercel deployment-hash URL, not the production alias.\n` +
      "These sit behind Vercel Standard Protection and return HTTP 401 'Protected deployment' (an SSO\n" +
      "interstitial), so probing one tells you nothing about the app. Point the smoke at the stable\n" +
      "production alias instead (set the PRODUCTION_URL repository variable, e.g. https://pkg-compliance.vercel.app).",
  );
  process.exit(2);
}

const url = `${targetOrigin.replace(/\/+$/, "")}/api/health`;
try {
  const res = await fetch(url, { headers: { accept: "application/json" }, redirect: "follow" });
  const body = await res.json().catch(() => null);
  if (res.ok && body && body.status === "ok" && body.database === "connected") {
    console.log(`smoke OK — ${url}`, body);
    process.exit(0);
  }
  console.error(`smoke FAILED — ${url} — HTTP ${res.status}`, body ?? "(non-JSON body)");
  process.exit(1);
} catch (err) {
  console.error(`smoke FAILED — ${url} —`, err instanceof Error ? err.message : err);
  process.exit(1);
}
