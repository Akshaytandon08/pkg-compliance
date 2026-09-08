import { randomBytes } from "node:crypto";
import { LocalFilesystemAdapter } from "./local.ts";
import type { StorageAdapter } from "./types.ts";

export * from "./types.ts";
export * from "./signing.ts";
export { LocalFilesystemAdapter } from "./local.ts";

// Select the storage adapter from env. 'local' (default) is fully implemented;
// 'blob'/'s3' are reserved slots — the interface exists, but until an adapter is
// wired they throw a clear "not configured" error rather than silently degrading.
export function getStorageAdapter(): StorageAdapter {
  const backend = process.env.EVIDENCE_STORAGE_BACKEND ?? "local";
  switch (backend) {
    case "local":
      return new LocalFilesystemAdapter();
    case "blob":
    case "s3":
      throw new Error(
        `EVIDENCE_STORAGE_BACKEND="${backend}" is reserved but not yet implemented — set it to "local" or wire the adapter`,
      );
    default:
      throw new Error(`unknown EVIDENCE_STORAGE_BACKEND: ${backend}`);
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
