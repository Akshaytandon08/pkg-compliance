import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Shared-secret access gate for the hosted pilot (Next 16 `proxy` convention,
// formerly `middleware`). Client BOM data must not sit on an open URL, so when
// BASIC_AUTH_USER/PASSWORD are set (production), every route requires HTTP Basic
// Auth. When they are unset (local dev), the gate is transparent. The corpus
// approval CLIs are NOT web routes and are unaffected — they stay local.
export function proxy(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next(); // no gate configured

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="pkg-compliance"' },
  });
}

// The gate matcher MUST be a static string literal here — Next statically parses
// `config.matcher` at build time and rejects an imported/computed value. The
// SAME pattern and its bypass reasoning live in src/lib/access-gate.ts (kept
// next-free so it is unit-testable, tests/passport-auth.test.ts); keep the two in
// sync. Bypassed: _next/static, _next/image, favicon.ico, the public brand assets,
// the public passport/ tier, the public evidence/ intake page, the public
// api/public/ namespace, and the health probe (api/health — only {status,
// database}, no user data, so the post-deploy smoke reaches it on the production
// alias; anchored `$` so nothing under it is bypassed). Everything else — app
// routes and every other API route, including the authoring APIs — stays gated.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|passport/|evidence/|api/public/|api/health$).*)"],
};
