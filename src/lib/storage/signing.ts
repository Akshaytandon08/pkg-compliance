import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// Short-lived signed download URLs for evidence files. A download link is
// (document id + expiry) signed with an HMAC over a server secret, so a link
// cannot be forged and stops working after its TTL. This is defence in DEPTH,
// not the only gate: the download route also stays behind the access gate, so a
// valid signature alone never exposes a file on an open URL.
//
// The secret comes from EVIDENCE_URL_SECRET. In production it is REQUIRED — a
// missing secret throws rather than falling back, so we never sign with a known
// value. In dev/tests a per-process random secret is used when none is set
// (links are valid only within that process, which is what dev wants).
let devSecret: string | undefined;
function secret(): string {
  const fromEnv = process.env.EVIDENCE_URL_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("EVIDENCE_URL_SECRET is required in production to sign evidence URLs");
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function mac(documentId: number, expEpochSec: number): string {
  return createHmac("sha256", secret()).update(`${documentId}.${expEpochSec}`).digest("hex");
}

export interface SignedDownload {
  exp: number; // absolute expiry, epoch seconds
  sig: string;
}

/** Sign a download of `documentId` valid for `ttlSeconds` (default 5 min). */
export function signDownload(documentId: number, ttlSeconds = 300, now = Date.now()): SignedDownload {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return { exp, sig: mac(documentId, exp) };
}

/** Build the relative download path for a document. */
export function downloadPath(documentId: number, signed: SignedDownload): string {
  return `/api/evidence-file/${documentId}?exp=${signed.exp}&sig=${signed.sig}`;
}

export type VerifyResult = "ok" | "expired" | "bad-signature";

/** Verify a signed download. Constant-time signature compare; expiry checked. */
export function verifyDownload(
  documentId: number,
  exp: number,
  sig: string,
  now = Date.now(),
): VerifyResult {
  if (!Number.isFinite(exp)) return "bad-signature";
  const expected = mac(documentId, exp);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "bad-signature";
  if (Math.floor(now / 1000) > exp) return "expired";
  return "ok";
}
