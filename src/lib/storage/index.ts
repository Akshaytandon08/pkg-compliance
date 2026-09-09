import { randomBytes } from "node:crypto";
import { LocalFilesystemAdapter } from "./local.ts";
import { BlobStorageAdapter } from "./blob.ts";
import type { StorageAdapter } from "./types.ts";

export * from "./types.ts";
export * from "./signing.ts";
export { LocalFilesystemAdapter } from "./local.ts";
export { BlobStorageAdapter } from "./blob.ts";

// Resolve which storage backend to use, from env, WITHOUT constructing it — so a
// startup check and the per-call factory share one rule. Explicit
// EVIDENCE_STORAGE_BACKEND wins; otherwise Blob is used when its token is present
// (production), else local-FS (dev/test). Vercel's serverless filesystem is
// read-only, so local-FS on production is a guaranteed write failure ("Generation
// failed"): we refuse it loudly rather than let a request discover it.
export function resolveStorageBackend(): "local" | "blob" | "s3" {
  const explicit = process.env.EVIDENCE_STORAGE_BACKEND;
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const backend = explicit ?? (hasBlobToken ? "blob" : "local");
  if (backend !== "local" && backend !== "blob" && backend !== "s3") {
    throw new Error(`unknown EVIDENCE_STORAGE_BACKEND: ${backend}`);
  }
  if (backend === "local" && process.env.VERCEL_ENV === "production") {
    throw new Error(
      "refusing local-filesystem storage in production (VERCEL_ENV=production): Vercel's filesystem is read-only, so document/evidence writes would fail. Create a Vercel Blob store so BLOB_READ_WRITE_TOKEN is set (Storage → Blob), or set EVIDENCE_STORAGE_BACKEND explicitly.",
    );
  }
  return backend;
}

let loggedActiveAdapter = false;
// Boot-time check (call from instrumentation): log which adapter is active and,
// crucially, WARN — never throw — when production would fall back to local-FS, so
// a misconfiguration is loud in the logs at startup without taking the whole app
// down. Actual enforcement (the throw) lives in getStorageAdapter, so only
// storage operations fail, not health/reports. Logs at most once per process.
export function logStorageConfig(): void {
  if (loggedActiveAdapter) return;
  loggedActiveAdapter = true;
  const env = process.env.VERCEL_ENV ?? "unset";
  try {
    const backend = resolveStorageBackend();
    console.log(`[storage] active adapter: ${backend} (VERCEL_ENV=${env})`);
  } catch (e) {
    console.error(`[storage] MISCONFIGURED (VERCEL_ENV=${env}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Select the storage adapter. 'local' is the dev/test adapter; 'blob' is the
// production adapter (Vercel Blob, private access). 's3' remains a reserved slot.
// resolveStorageBackend throws here when production would use local-FS, so a
// storage operation fails with a clear message rather than a raw EROFS.
export function getStorageAdapter(): StorageAdapter {
  const backend = resolveStorageBackend();
  logStorageConfig();
  switch (backend) {
    case "local":
      return new LocalFilesystemAdapter();
    case "blob":
      return new BlobStorageAdapter();
    case "s3":
      throw new Error(
        'EVIDENCE_STORAGE_BACKEND="s3" is reserved but not yet implemented — set it to "local"/"blob" or wire the adapter',
      );
  }
}

// Storage round-trip self-test for the post-deploy smoke (Part 0d): write a tiny
// throwaway object, read it back, verify the bytes, delete it. Proves the SAME
// generate→store→read path the DoC draft uses works on the deployed platform,
// with no durable write and no seeded data — a red result here is exactly the
// production "Generation failed" (e.g. local-FS refused, or Blob token missing).
export async function storageSelfTest(): Promise<
  { ok: true; backend: string } | { ok: false; backend: string; error: string }
> {
  let backend = "unknown";
  try {
    const adapter = getStorageAdapter();
    backend = adapter.backend;
    const key = `healthcheck/${randomBytes(16).toString("hex")}.txt`;
    const payload = new TextEncoder().encode(`storage-selftest ${Date.now()}`);
    await adapter.put(key, payload, "text/plain");
    const readBack = await adapter.getBytes(key);
    const match = Buffer.from(readBack).equals(Buffer.from(payload));
    await adapter.delete(key);
    if (!match) return { ok: false, backend, error: "round-trip byte mismatch" };
    return { ok: true, backend };
  } catch (e) {
    return { ok: false, backend, error: e instanceof Error ? e.message : String(e) };
  }
}

// A generated storage key for an evidence file: evidence/<assessmentId>/<rand>.<ext>.
// The random segment (not the client filename) makes the key unguessable and
// traversal-safe; the extension is derived only from an allowlist.
const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function generateStorageKey(assessmentId: number, contentType: string): string {
  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  return `evidence/${assessmentId}/${randomBytes(16).toString("hex")}.${ext}`;
}
