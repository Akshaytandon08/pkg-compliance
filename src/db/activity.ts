import { desc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import { assessmentActivity } from "./schema.ts";

// B4 — the per-assessment activity feed. Append-only: log an event when it
// happens, read the feed newest-first. Never updated or deleted.
export type ActivityKind =
  | "request_created"
  | "document_received"
  | "claim_confirmed"
  | "claim_rejected"
  | "claim_edited"
  | "verdict_changed";

export interface ActivityEvent {
  id: number;
  at: Date;
  actor: string;
  kind: ActivityKind;
  summary: string;
  meta: Record<string, unknown> | null;
}

export async function logActivity(
  assessmentId: number,
  event: { kind: ActivityKind; actor: string; summary: string; meta?: Record<string, unknown> },
): Promise<void> {
  await db.insert(assessmentActivity).values({
    assessmentId,
    kind: event.kind,
    actor: event.actor,
    summary: event.summary,
    meta: event.meta ?? null,
  });
}

export async function listActivity(assessmentId: number): Promise<ActivityEvent[]> {
  const rows = await db
    .select()
    .from(assessmentActivity)
    .where(eq(assessmentActivity.assessmentId, assessmentId))
    .orderBy(desc(assessmentActivity.at), desc(assessmentActivity.id));
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    actor: r.actor,
    kind: r.kind as ActivityKind,
    summary: r.summary,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
  }));
}
