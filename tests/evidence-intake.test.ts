// B2 — public intake core: type/size validation, magic-byte sniffing, the rate
// limiter, and the virus-scan hook. Pure; no DB, no route. The upload route wires
// these together; here we pin the primitives that keep it safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateUpload,
  sniffContentType,
  MAX_UPLOAD_BYTES,
} from "../src/lib/evidence-intake/validate.ts";
import { FixedWindowRateLimiter } from "../src/lib/evidence-intake/rate-limit.ts";
import { scanForViruses, setVirusScanner, stubScanner } from "../src/lib/evidence-intake/scan.ts";

test("validateUpload accepts allowed types within the cap and rejects the rest", () => {
  assert.deepEqual(validateUpload({ contentType: "application/pdf", size: 1000 }), {
    ok: true,
    contentType: "application/pdf",
  });
  assert.equal(validateUpload({ contentType: "image/gif", size: 1000 }).ok, false);
  assert.equal(validateUpload({ contentType: "application/pdf", size: 0 }).ok, false);
  assert.equal(validateUpload({ contentType: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }).ok, false);
});

test("sniffContentType reads the real format from bytes, ignoring a spoofed MIME", () => {
  assert.equal(sniffContentType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), "application/pdf");
  assert.equal(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    sniffContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  // An executable/script masquerading as a PDF sniffs to null → rejected upstream.
  assert.equal(sniffContentType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])), null);
});

test("the rate limiter spends its window then refuses until reset", () => {
  const rl = new FixedWindowRateLimiter(2, 1000);
  const t0 = 10_000;
  assert.equal(rl.take("tok", t0), true);
  assert.equal(rl.take("tok", t0), true);
  assert.equal(rl.take("tok", t0), false, "third in-window attempt is refused");
  assert.equal(rl.take("tok", t0 + 1001), true, "next window resets");
  // A different key has its own budget.
  assert.equal(rl.take("other", t0), true);
});

test("the virus-scan stub passes bytes but the hook is swappable", async () => {
  assert.equal(await scanForViruses(new Uint8Array([1, 2, 3])), "clean");
  try {
    setVirusScanner({ async scan() { return "infected"; } });
    assert.equal(await scanForViruses(new Uint8Array([1])), "infected");
  } finally {
    setVirusScanner(stubScanner);
  }
});
