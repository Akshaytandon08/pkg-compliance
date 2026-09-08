// C1 — notifications: the expiry-window classifier and the digest text. Pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isExpiringSoon,
  buildNotificationDigest,
  isDigestEnabled,
  NOTIFICATION_EXPIRY_WINDOW_DAYS,
  type NotificationItem,
} from "../src/lib/notifications/digest.ts";

test("isExpiringSoon covers only the window ahead, not the past or beyond", () => {
  const asOf = "2026-09-08";
  assert.equal(isExpiringSoon("2026-10-01", asOf), true); // within 60 days
  assert.equal(isExpiringSoon("2026-09-08", asOf), true); // today
  assert.equal(isExpiringSoon("2026-09-07", asOf), false); // already past
  assert.equal(isExpiringSoon("2027-01-01", asOf), false); // beyond the window
  // Exactly at the horizon is included.
  assert.equal(isExpiringSoon("2026-11-07", asOf, NOTIFICATION_EXPIRY_WINDOW_DAYS), true);
});

test("the digest groups items by kind and reports an empty state", () => {
  const items: NotificationItem[] = [
    { kind: "awaiting_confirmation", assessmentId: 1, packName: "Carton A", detail: "2 claims awaiting confirmation", count: 2 },
    { kind: "expiring", assessmentId: 2, packName: "Tray B", detail: "test report expiring", date: "2026-10-01" },
  ];
  const d = buildNotificationDigest(items);
  assert.match(d.subject, /2 items need attention/);
  assert.match(d.body, /Awaiting confirmation:/);
  assert.match(d.body, /Carton A: 2 claims/);
  assert.match(d.body, /Tray B: test report expiring \(expires 2026-10-01\)/);

  const empty = buildNotificationDigest([]);
  assert.match(empty.subject, /nothing outstanding/);
});

test("the digest email is off unless a transport AND the flag are set", () => {
  const save = { r: process.env.RESEND_API_KEY, s: process.env.SMTP_URL, d: process.env.NOTIFICATIONS_DIGEST };
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_URL;
    delete process.env.NOTIFICATIONS_DIGEST;
    assert.equal(isDigestEnabled(), false);
    process.env.NOTIFICATIONS_DIGEST = "1";
    assert.equal(isDigestEnabled(), false, "flag alone is not enough");
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(isDigestEnabled(), true);
  } finally {
    if (save.r === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = save.r;
    if (save.s === undefined) delete process.env.SMTP_URL; else process.env.SMTP_URL = save.s;
    if (save.d === undefined) delete process.env.NOTIFICATIONS_DIGEST; else process.env.NOTIFICATIONS_DIGEST = save.d;
  }
});
