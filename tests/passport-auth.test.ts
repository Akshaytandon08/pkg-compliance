// The access gate must challenge app routes but never the public passport or the
// framework static assets it loads — otherwise a gated subresource pops a Basic
// Auth dialog on the public page. This pins the proxy matcher: a path that
// MATCHES runs the gate (→ 401 without credentials); a path that does NOT match
// is bypassed (served openly). Pure — no server needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isGatedPath } from "../src/lib/access-gate.ts";

const gated = (path: string) => isGatedPath(path);

test("the public passport and its framework subresources are NOT gated", () => {
  for (const path of [
    "/passport/a2be43bdc4019854c5e036ef2ea0d2d6",
    "/_next/static/chunks/abc.js",
    "/_next/static/media/font.woff2",
    "/_next/static/chunks/styles.css",
    "/_next/image",
    "/favicon.ico",
    // Public brand assets — the logo the passport renders (no user data).
    "/brand/fitsol-logo-full-colour.svg",
    "/brand/fitsol-logo-white.svg",
  ]) {
    assert.equal(gated(path), false, `${path} must be bypassed (public / framework asset)`);
  }
});

test("app routes and the passport authoring API stay gated", () => {
  for (const path of [
    "/",
    "/corpus",
    "/assessments/new",
    "/assessments/5/report",
    "/api/assessments/5/passport", // authoring endpoint — gated, not bypassed
    "/api/assessments",
  ]) {
    assert.equal(gated(path), true, `${path} must stay behind the access gate`);
  }
});
