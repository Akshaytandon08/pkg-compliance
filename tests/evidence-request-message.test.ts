// B1 — evidence request token + generated message. Pure; no DB, no mail.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateRequestToken,
  renderRequestMessage,
  isOutboundMailConfigured,
} from "../src/lib/evidence-requests/message.ts";

test("request tokens are unguessable and unique", () => {
  const a = generateRequestToken();
  const b = generateRequestToken();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("the generated message carries the link, scope and requirement, and issues nothing", () => {
  const { subject, body } = renderRequestMessage({
    packName: "Retail carton v3",
    checkpointId: "EU-recycled-content",
    requirementText: "A supplier declaration stating the recycled-content percentage.",
    componentName: "Outer box",
    url: "https://app.example/evidence/abc123",
    expiresAt: new Date("2026-10-01T00:00:00Z"),
  });
  assert.match(subject, /Retail carton v3/);
  assert.match(subject, /Outer box/);
  assert.match(body, /https:\/\/app\.example\/evidence\/abc123/);
  assert.match(body, /recycled-content percentage/);
  assert.match(body, /expires on 2026-10-01/);
  // A request never asserts compliance or issues a document.
  assert.doesNotMatch(body, /\b(certif|we hereby|compliant|issued by)/i);
});

test("outbound mail is off unless a transport is configured", () => {
  const had = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const hadSmtp = process.env.SMTP_URL;
  delete process.env.SMTP_URL;
  try {
    assert.equal(isOutboundMailConfigured(), false);
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(isOutboundMailConfigured(), true);
  } finally {
    if (had === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = had;
    if (hadSmtp !== undefined) process.env.SMTP_URL = hadSmtp;
  }
});
