import { put, get, head, del, BlobNotFoundError } from "@vercel/blob";
import { isSafeStorageKey, type StorageAdapter } from "./types.ts";

// Production storage on Vercel Blob. Bytes are stored PRIVATE (access:"private"),
// so a blob is never reachable by URL without the store token — the app reads
// bytes back server-side with the token and re-streams them through its own
// Basic-Auth-gated download routes, so no blob URL is ever handed to a client.
//
// The blob pathname IS our opaque storage key (addRandomSuffix:false), so a key
// maps deterministically to one blob for read-back; keys are already unguessable
// and traversal-safe (generateStorageKey / draftKey). This adapter is selected
// when BLOB_READ_WRITE_TOKEN is present (see getStorageAdapter) — the local-FS
// adapter cannot write on Vercel's read-only serverless filesystem.
export class BlobStorageAdapter implements StorageAdapter {
  readonly backend = "blob" as const;
  private readonly token: string;

  constructor(token?: string) {
    const t = token ?? process.env.BLOB_READ_WRITE_TOKEN;
    if (!t) {
      throw new Error(
        'BlobStorageAdapter requires BLOB_READ_WRITE_TOKEN (create a Blob store in Vercel → Storage → Blob; the token is injected as an env var).',
      );
    }
    this.token = t;
  }

  private guard(key: string): string {
    if (!isSafeStorageKey(key)) throw new Error(`unsafe storage key: ${key}`);
    return key;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    // pathname === key (no random suffix) so getBytes(key) resolves the same blob.
    // allowOverwrite:true because keys are content-addressed by the caller (a new
    // document version gets a new key), so re-writing the same key is idempotent.
    await put(this.guard(key), Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      token: this.token,
    });
  }

  async getBytes(key: string): Promise<Uint8Array> {
    const res = await get(this.guard(key), { access: "private", token: this.token });
    if (!res || !res.stream) throw new Error(`blob not found: ${key}`);
    const buf = await new Response(res.stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await head(this.guard(key), { token: this.token });
      return true;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return false;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    // del is idempotent server-side (deleting an absent blob is not an error).
    await del(this.guard(key), { token: this.token });
  }
}
