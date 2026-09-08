import { sql } from "drizzle-orm";
import { db } from "./index.ts";
import { isExpiringSoon, type NotificationItem } from "../lib/notifications/digest.ts";

// Derive the outstanding notifications from live state (no stored notification
// rows in v1). Three queries — received-but-not-extracted documents, claims
// awaiting confirmation, and confirmed evidence expiring within the window —
// merged into one list the UI and the digest share.

export async function getNotifications(): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];

  // Documents received but with no extraction run yet.
  const received = (await db.execute(sql`
    select a.id as assessment_id, a.pack_name, count(*)::int as n
    from evidence_documents d
    join assessments a on a.id = d.assessment_id
    where not exists (select 1 from extraction_runs er where er.document_id = d.id)
    group by a.id, a.pack_name
  `)) as unknown as { assessment_id: number; pack_name: string; n: number }[];
  for (const r of received) {
    items.push({
      kind: "received",
      assessmentId: r.assessment_id,
      packName: r.pack_name,
      detail: `${r.n} document${r.n === 1 ? "" : "s"} awaiting extraction`,
      count: r.n,
    });
  }

  // Extracted claims still pending a human decision.
  const pending = (await db.execute(sql`
    select a.id as assessment_id, a.pack_name, count(*)::int as n
    from extracted_claims ec
    join extraction_runs er on er.id = ec.run_id
    join evidence_documents d on d.id = er.document_id
    join assessments a on a.id = d.assessment_id
    where ec.status = 'pending'
    group by a.id, a.pack_name
  `)) as unknown as { assessment_id: number; pack_name: string; n: number }[];
  for (const r of pending) {
    items.push({
      kind: "awaiting_confirmation",
      assessmentId: r.assessment_id,
      packName: r.pack_name,
      detail: `${r.n} claim${r.n === 1 ? "" : "s"} awaiting confirmation`,
      count: r.n,
    });
  }

  // Confirmed evidence with an expiry; filtered to the window against each
  // assessment's own as-of date.
  const expiring = (await db.execute(sql`
    select a.id as assessment_id, a.pack_name, to_char(a.as_of, 'YYYY-MM-DD') as as_of,
           to_char(e.expiry_date, 'YYYY-MM-DD') as expiry, e.reference
    from assessment_evidence e
    join assessment_components c on c.id = e.component_id
    join assessments a on a.id = c.assessment_id
    where e.expiry_date is not null
  `)) as unknown as { assessment_id: number; pack_name: string; as_of: string; expiry: string; reference: string | null }[];
  for (const r of expiring) {
    if (!isExpiringSoon(r.expiry, r.as_of)) continue;
    items.push({
      kind: "expiring",
      assessmentId: r.assessment_id,
      packName: r.pack_name,
      detail: r.reference ? `${r.reference} expiring` : "Evidence expiring",
      date: r.expiry,
    });
  }

  return items;
}
