// DYNAMIC passport-auth test. Against a RUNNING, access-gated server it fetches a
// real passport page, enumerates every same-origin asset it references, and
// requires each to load WITHOUT credentials (200) while a gated route (/) stays
// 401. Because it derives the asset list from the actual rendered HTML, it
// catches a NEW un-bypassed subresource (e.g. the /brand/ logo) that a hardcoded
// list would miss. Skips unless PASSPORT_SMOKE_ORIGIN + PASSPORT_SMOKE_TOKEN are
// set (so `npm test` skips it; run it against a live auth server or post-deploy).
//   PASSPORT_SMOKE_ORIGIN=https://app PASSPORT_SMOKE_TOKEN=<tok> node --test tests/passport-auth-live.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

const origin = process.env.PASSPORT_SMOKE_ORIGIN;
const token = process.env.PASSPORT_SMOKE_TOKEN;
const configured = !!(origin && token);
const dynReq = { skip: configured ? false : "set PASSPORT_SMOKE_ORIGIN + PASSPORT_SMOKE_TOKEN to run" };

const get = (path: string) => fetch(`${origin!.replace(/\/+$/, "")}${path}`, { redirect: "manual" });

test("the access gate is active on the target (/ → 401)", dynReq, async () => {
  const res = await get("/");
  assert.equal(res.status, 401, "target must be access-gated (BASIC_AUTH) or this test cannot prove the passport is silent");
});

test("the public passport and every asset it references load without credentials", dynReq, async () => {
  const pageRes = await get(`/passport/${token}`);
  assert.equal(pageRes.status, 200, "passport page must be public");
  const html = await pageRes.text();

  // Same-origin asset paths the parser would load.
  const paths = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="(\/[^"?#]*)/g)) paths.add(m[1]);

  const failures: string[] = [];
  for (const p of paths) {
    const r = await get(p);
    if (r.status !== 200) failures.push(`${r.status} ${p}`);
  }
  assert.deepEqual(failures, [], `these passport subresources require auth (would pop a Basic Auth dialog): ${failures.join(", ")}`);
});
