import { and, eq } from "drizzle-orm";
import type { db as Db } from "./index.ts";
import { checkpointApprovals, checkpoints } from "./schema.ts";

// The single legal path from `draft` to `in_force`.
//
// The database trigger (drizzle/0001_approval-trigger.sql) refuses to set a
// checkpoint `in_force` unless a matching checkpoint_approvals row already
// exists. Application code must therefore record the approval and flip the
// status together, in that order, atomically — otherwise the UPDATE trips the
// trigger. This helper is that path; nothing else should write `in_force`.

export type ApprovalInput = {
  checkpointId: string;
  checkpointVersion: number;
  corpusVersionId: number;
  /** Named regulatory owner (brief: hard gate, not a review). */
  approvedBy: string;
  /** Primary source the approver opened — an EUR-Lex/CPCB/gazette article URL. */
  primarySourceUrl: string;
  notes?: string;
};

/**
 * Approves a draft checkpoint and promotes it to `in_force` in one
 * transaction. Throws if the checkpoint is not currently `draft` — promotion
 * is only ever from draft, and re-promoting is a mistake worth surfacing.
 */
export async function promoteCheckpointToInForce(
  database: typeof Db,
  input: ApprovalInput,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: checkpoints.status })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.id, input.checkpointId),
          eq(checkpoints.version, input.checkpointVersion),
        ),
      );

    if (!current) {
      throw new Error(
        `checkpoint ${input.checkpointId}@${input.checkpointVersion} does not exist`,
      );
    }
    if (current.status !== "draft") {
      throw new Error(
        `checkpoint ${input.checkpointId}@${input.checkpointVersion} is '${current.status}', not 'draft'; only drafts are promoted`,
      );
    }

    await tx.insert(checkpointApprovals).values({
      checkpointId: input.checkpointId,
      checkpointVersion: input.checkpointVersion,
      corpusVersionId: input.corpusVersionId,
      approvedBy: input.approvedBy,
      primarySourceUrl: input.primarySourceUrl,
      notes: input.notes,
    });

    // Trigger re-checks the approval row exists; the insert above satisfies it.
    await tx
      .update(checkpoints)
      .set({ status: "in_force" })
      .where(
        and(
          eq(checkpoints.id, input.checkpointId),
          eq(checkpoints.version, input.checkpointVersion),
        ),
      );
  });
}

/**
 * Stamps a human's verification that an in_force checkpoint's citation was
 * checked against primary. Touches only citation_verified_date/by — never the
 * approved requirement content (which the immutability trigger freezes anyway).
 * Refuses anything not in_force. Run only via the human-only corpus:verify CLI.
 */
export async function verifyCheckpoint(
  database: typeof Db,
  input: { checkpointId: string; checkpointVersion: number; verifiedBy: string },
): Promise<void> {
  const [current] = await database
    .select({ status: checkpoints.status })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.version, input.checkpointVersion),
      ),
    );
  if (!current) {
    throw new Error(`checkpoint ${input.checkpointId}@${input.checkpointVersion} does not exist`);
  }
  if (current.status !== "in_force") {
    throw new Error(
      `checkpoint ${input.checkpointId}@${input.checkpointVersion} is '${current.status}', not 'in_force'; only in_force checkpoints are verified`,
    );
  }
  await database
    .update(checkpoints)
    .set({
      citationVerifiedDate: new Date().toISOString().slice(0, 10),
      citationVerifiedBy: input.verifiedBy,
    })
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.version, input.checkpointVersion),
      ),
    );
}

/**
 * Retires a checkpoint by moving it to `superseded`, optionally recording why.
 * Checkpoints are never deleted (the approval FK is ON DELETE RESTRICT and
 * blocks it anyway) — this is the retirement path, so the checkpoint and its
 * cited approval survive for reproducibility. Also the reject path for a draft
 * that fails the primary-source check, so the review queue empties either way.
 */
export async function supersedeCheckpoint(
  database: typeof Db,
  checkpointId: string,
  checkpointVersion: number,
  reason?: string,
): Promise<void> {
  const [current] = await database
    .select({ notes: checkpoints.notes })
    .from(checkpoints)
    .where(
      and(eq(checkpoints.id, checkpointId), eq(checkpoints.version, checkpointVersion)),
    );
  if (!current) {
    throw new Error(`checkpoint ${checkpointId}@${checkpointVersion} does not exist`);
  }
  const notes = reason
    ? [current.notes, `SUPERSEDED: ${reason}`].filter(Boolean).join(" | ")
    : current.notes;
  await database
    .update(checkpoints)
    .set({ status: "superseded", notes })
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.version, checkpointVersion),
      ),
    );
}
