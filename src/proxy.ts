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

// Gate everything except Next's static assets and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
