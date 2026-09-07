// Post-deploy smoke test. GET <origin>/api/health and require the app to report
// {status:"ok", database:"connected"}. Exits non-zero on anything else — a
// non-200, a non-JSON body (e.g. a platform auth/interstitial page), or a
// degraded database. Pure Node (global fetch), no dependencies.
//   Run:  node scripts/smoke.ts https://your-app.example.com
export {}; // make this a module so top-level await is allowed

const targetOrigin = process.argv[2] ?? process.env.SMOKE_ORIGIN;
if (!targetOrigin) {
  console.error("usage: node scripts/smoke.ts <origin>");
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
