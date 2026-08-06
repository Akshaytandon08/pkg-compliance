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
 * Retires a checkpoint by moving it to `superseded`. Checkpoints are never
 * deleted (the approval FK is ON DELETE RESTRICT and blocks it anyway) — this
 * is the retirement path, so the checkpoint and its cited approval survive for
 * reproducibility.
 */
export async function supersedeCheckpoint(
  database: typeof Db,
  checkpointId: string,
  checkpointVersion: number,
): Promise<void> {
  await database
    .update(checkpoints)
    .set({ status: "superseded" })
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.version, checkpointVersion),
      ),
    );
}
