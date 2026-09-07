// The path policy for the access gate, kept free of any next/server import so it
// is unit-testable in the plain node runner. NOTE: src/proxy.ts must repeat this
// pattern as a static string literal (Next requires `config.matcher` to be
// statically analysable and rejects an imported value) — keep the two in sync.
//
// Bypassed (never challenged): framework static assets (`_next/static`,
// `_next/image`), the favicon, the public brand assets (`brand/` — the logo the
// PUBLIC passport renders; no user data), and the DELIBERATELY public passport
// tier (`passport/`). A 401 on a parser-loaded static asset — or on a gated route
// linked from the public passport — pops the browser's Basic Auth dialog, so the
// public passport must emit none of them (it renders on the bare root layout,
// no app nav). Everything else, including the passport authoring API and all app
// routes, stays gated. API routes are NOT bypassed generically.
export const GATE_BYPASS_PREFIXES = ["_next/static", "_next/image", "favicon.ico", "brand/", "passport/"] as const;

// Next.js `config.matcher` pattern: a path that MATCHES runs the gate.
export const GATE_MATCHER = `/((?!${GATE_BYPASS_PREFIXES.join("|")}).*)`;

/** True when the access gate applies to this pathname (i.e. it is not bypassed). */
export function isGatedPath(pathname: string): boolean {
  return new RegExp(`^${GATE_MATCHER}$`).test(pathname);
}
