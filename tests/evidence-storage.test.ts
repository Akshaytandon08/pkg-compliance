// A1 — evidence document storage: the local adapter must round-trip bytes and
// refuse any key that escapes its root, and signed download links must verify,
// expire, and reject tampering. No database and no server — pure adapter + crypto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalFilesystemAdapter } from "../src/lib/storage/local.ts";
import { isSafeStorageKey } from "../src/lib/storage/types.ts";
import { signDownload, verifyDownload } from "../src/lib/storage/signing.ts";
import { resolveStorageBackend } from "../src/lib/storage/index.ts";

test("local adapter round-trips bytes and reports existence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evstore-"));
  try {
    const store = new LocalFilesystemAdapter(root);
    const key = "evidence/42/deadbeef.pdf";
    const bytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3]); // "%PDF" + noise
    assert.equal(await store.exists(key), false);
    await store.put(key, bytes, "application/pdf");
    assert.equal(await store.exists(key), true);
    assert.deepEqual(await store.getBytes(key), bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the adapter refuses keys that escape its root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evstore-"));
  try {
    const store = new LocalFilesystemAdapter(root);
    for (const bad of ["../secret", "/etc/passwd", "a/../../b", "evidence/./x", ""]) {
      await assert.rejects(() => store.getBytes(bad), `${bad} must be rejected`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local adapter delete is idempotent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evstore-"));
  try {
    const store = new LocalFilesystemAdapter(root);
    const key = "healthcheck/abc.txt";
    await store.delete(key); // absent → no throw
    await store.put(key, new Uint8Array([1, 2, 3]), "text/plain");
    assert.equal(await store.exists(key), true);
    await store.delete(key);
    assert.equal(await store.exists(key), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolveStorageBackend: auto-selects blob by token, refuses local-FS in production", () => {
  const saved = {
    backend: process.env.EVIDENCE_STORAGE_BACKEND,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    env: process.env.VERCEL_ENV,
  };
  const restore = () => {
    for (const [k, v] of [["EVIDENCE_STORAGE_BACKEND", saved.backend], ["BLOB_READ_WRITE_TOKEN", saved.token], ["VERCEL_ENV", saved.env]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    delete process.env.EVIDENCE_STORAGE_BACKEND;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_ENV;
    assert.equal(resolveStorageBackend(), "local"); // dev default

    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_xxx";
    assert.equal(resolveStorageBackend(), "blob"); // auto-select when token present

    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL_ENV = "production";
    assert.throws(() => resolveStorageBackend(), /read-only|refusing local/i); // prod + no blob → refuse

    process.env.VERCEL_ENV = "preview";
    assert.throws(() => resolveStorageBackend(), /read-only|refusing local/i); // preview is read-only too

    process.env.VERCEL_ENV = "development";
    assert.equal(resolveStorageBackend(), "local"); // `vercel dev` has a writable FS

    process.env.VERCEL_ENV = "production";
    process.env.EVIDENCE_STORAGE_BACKEND = "local";
    assert.throws(() => resolveStorageBackend(), /deployed environment/i); // explicit local in prod still refused

    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_xxx";
    process.env.EVIDENCE_STORAGE_BACKEND = "blob";
    assert.equal(resolveStorageBackend(), "blob"); // blob fine in prod
  } finally {
    restore();
  }
});

test("isSafeStorageKey pins the allowed key shape", () => {
  assert.equal(isSafeStorageKey("evidence/1/abc.pdf"), true);
  for (const bad of ["", "/abs", "a\\b", "..", "a/../b", "a/./b", "a//b"]) {
    assert.equal(isSafeStorageKey(bad), false, `${bad} must be unsafe`);
  }
});

test("a fresh signed link verifies; expiry and tampering are caught", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const signed = signDownload(7, 300, now);
  assert.equal(verifyDownload(7, signed.exp, signed.sig, now), "ok");
  // One second past expiry.
  assert.equal(verifyDownload(7, signed.exp, signed.sig, now + 301_000), "expired");
  // Tampered signature.
  const flipped = signed.sig.slice(0, -1) + (signed.sig.endsWith("0") ? "1" : "0");
  assert.equal(verifyDownload(7, signed.exp, flipped, now), "bad-signature");
  // A link signed for document 7 does not work for document 8.
  assert.equal(verifyDownload(8, signed.exp, signed.sig, now), "bad-signature");
});
