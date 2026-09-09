import { mkdir, readFile, writeFile, access, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { isSafeStorageKey, type StorageAdapter } from "./types.ts";

// Local-filesystem storage for dev and tests. Bytes are written UNDER a single
// root directory (env EVIDENCE_STORAGE_DIR, default .evidence-store — gitignored).
// Every key is validated and the resolved absolute path is re-checked to be
// inside the root, so a crafted key can never write or read outside it.
export class LocalFilesystemAdapter implements StorageAdapter {
  readonly backend = "local" as const;
  private readonly root: string;

  constructor(root?: string) {
    // turbopackIgnore: the root is runtime-configured, so Next's static analysis
    // cannot scope it and would trace the WHOLE project into any function that
    // reaches this module. This adapter is dev/test only — deployed environments
    // refuse it (see resolveStorageBackend) — so nothing needs tracing here.
    this.root = path.resolve(/*turbopackIgnore: true*/ root ?? process.env.EVIDENCE_STORAGE_DIR ?? ".evidence-store");
  }

  private resolve(key: string): string {
    if (!isSafeStorageKey(key)) throw new Error(`unsafe storage key: ${key}`);
    const abs = path.resolve(this.root, key);
    const rel = path.relative(this.root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return abs;
  }

  async put(key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    // contentType is carried on the DB row; the local filesystem needs only bytes.
    void _contentType;
    const abs = this.resolve(key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  }

  async getBytes(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return; // idempotent
      throw e;
    }
  }
}
