// C1 — notifications. Three kinds, all derived from state (nothing to mark-read in
// v1): documents received awaiting extraction, claims awaiting confirmation, and
// confirmed evidence expiring within the window. The digest email is OFF unless
// both a transport and the digest flag are set — never sent silently.

export const NOTIFICATION_EXPIRY_WINDOW_DAYS = 60;

export type NotificationKind = "received" | "awaiting_confirmation" | "expiring";

export interface NotificationItem {
  kind: NotificationKind;
  assessmentId: number;
  packName: string;
  detail: string;
  /** For 'expiring', the ISO date it lapses; otherwise omitted. */
  date?: string;
  count?: number;
}

/** True when `expiry` falls within `windowDays` after `asOf` (inclusive), and is
 *  not already past. Dates are ISO (YYYY-MM-DD); comparison is calendar-based. */
export function isExpiringSoon(
  expiry: string,
  asOf: string,
  windowDays = NOTIFICATION_EXPIRY_WINDOW_DAYS,
): boolean {
  const exp = Date.parse(`${expiry}T00:00:00Z`);
  const from = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(exp) || Number.isNaN(from)) return false;
  const horizon = from + windowDays * 24 * 60 * 60 * 1000;
  return exp >= from && exp <= horizon;
}

const LABEL: Record<NotificationKind, string> = {
  received: "Documents received",
  awaiting_confirmation: "Awaiting confirmation",
  expiring: "Evidence expiring soon",
};

export interface Digest {
  subject: string;
  body: string;
}

// A plain digest of outstanding items, grouped by kind. Pure text — the caller
// decides whether to send it (only when configured + approved).
export function buildNotificationDigest(items: NotificationItem[]): Digest {
  const subject = `Packaging compliance: ${items.length} item${items.length === 1 ? "" : "s"} need attention`;
  if (items.length === 0) {
    return { subject: "Packaging compliance: nothing outstanding", body: "No items need attention." };
  }
  const lines: string[] = [];
  for (const kind of ["received", "awaiting_confirmation", "expiring"] as NotificationKind[]) {
    const group = items.filter((i) => i.kind === kind);
    if (group.length === 0) continue;
    lines.push(`${LABEL[kind]}:`);
    for (const i of group) {
      lines.push(`  - ${i.packName}: ${i.detail}${i.date ? ` (expires ${i.date})` : ""}`);
    }
    lines.push("");
  }
  return { subject, body: lines.join("\n").trimEnd() };
}

/** The digest email is enabled only when a transport exists AND the flag is set. */
export function isDigestEnabled(): boolean {
  const mail = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
  return mail && process.env.NOTIFICATIONS_DIGEST === "1";
}
