import { db } from "./index.ts";
import { evidenceRequests } from "./schema.ts";
import { generateRequestToken } from "../lib/evidence-requests/message.ts";
import { logActivity } from "./activity.ts";

// Create a token-scoped evidence request for a gap and record it on the activity
// feed. The returned token drives the public /evidence/[token] page. No mail is
// sent here (see message.ts): the caller renders the message for the assessor.
export async function createEvidenceRequest(input: {
  assessmentId: number;
  checkpointId: string;
  componentId?: number | null;
  note?: string | null;
  expiresAt?: Date | null;
  createdBy?: string | null;
}): Promise<{ id: number; token: string }> {
  const token = generateRequestToken();
  const [row] = await db
    .insert(evidenceRequests)
    .values({
      assessmentId: input.assessmentId,
      checkpointId: input.checkpointId,
      componentId: input.componentId ?? null,
      token,
      note: input.note ?? null,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: evidenceRequests.id });

  await logActivity(input.assessmentId, {
    kind: "request_created",
    actor: input.createdBy ?? "Assessor",
    summary: `Evidence request created for ${input.checkpointId}`,
    meta: { checkpointId: input.checkpointId, requestId: row.id },
  });
  return { id: row.id, token };
}
