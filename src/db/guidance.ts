import { and, eq } from "drizzle-orm";
import type { db as Db } from "./index.ts";
import { evidenceGuidance, type GuidanceStatus } from "./schema.ts";

export type GuidanceRow = {
  checkpointId: string;
  checkpointVersion: number;
  evidenceType: string;
  status: GuidanceStatus;
  issuerGuidance: string | null;
  mustContain: string[] | null;
  redFlags: string[] | null;
  typicalSourceOrgRole: string | null;
  costTurnaroundNote: string | null;
};

function shape(r: typeof evidenceGuidance.$inferSelect): GuidanceRow {
  return {
    checkpointId: r.checkpointId,
    checkpointVersion: r.checkpointVersion,
    evidenceType: r.evidenceType,
    status: r.status,
    issuerGuidance: r.issuerGuidance,
    mustContain: r.mustContain,
    redFlags: r.redFlags,
    typicalSourceOrgRole: r.typicalSourceOrgRole,
    costTurnaroundNote: r.costTurnaroundNote,
  };
}

/** All guidance rows (any status) for a checkpoint version, keyed by evidence type. */
export async function getGuidanceForCheckpoint(
  database: typeof Db,
  checkpointId: string,
  checkpointVersion: number,
): Promise<Map<string, GuidanceRow>> {
  const rows = await database
    .select()
    .from(evidenceGuidance)
    .where(
      and(
        eq(evidenceGuidance.checkpointId, checkpointId),
        eq(evidenceGuidance.checkpointVersion, checkpointVersion),
      ),
    );
  return new Map(rows.map((r) => [r.evidenceType, shape(r)]));
}

export async function listGuidanceByStatus(
  database: typeof Db,
  status: GuidanceStatus,
): Promise<GuidanceRow[]> {
  const rows = await database
    .select()
    .from(evidenceGuidance)
    .where(eq(evidenceGuidance.status, status));
  return rows.map(shape);
}

export type ApproveGuidanceInput = {
  checkpointId: string;
  checkpointVersion: number;
  evidenceType: string;
  approvedBy: string;
  corpusVersion: string;
};

/**
 * Promotes a draft guidance row to `approved`. Human-only path (run via
 * corpus:approve). Throws if the row is missing or already approved — guidance
 * follows the same draft→approved discipline as checkpoints, so the report only
 * ever renders human-approved advice.
 */
export async function approveGuidance(
  database: typeof Db,
  input: ApproveGuidanceInput,
): Promise<void> {
  const key = and(
    eq(evidenceGuidance.checkpointId, input.checkpointId),
    eq(evidenceGuidance.checkpointVersion, input.checkpointVersion),
    eq(evidenceGuidance.evidenceType, input.evidenceType),
  );
  const [current] = await database.select().from(evidenceGuidance).where(key);
  if (!current) {
    throw new Error(
      `no guidance for ${input.checkpointId}@${input.checkpointVersion}/${input.evidenceType}`,
    );
  }
  if (current.status === "approved") {
    throw new Error(
      `guidance ${input.checkpointId}@${input.checkpointVersion}/${input.evidenceType} is already approved`,
    );
  }
  await database
    .update(evidenceGuidance)
    .set({
      status: "approved",
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
      corpusVersion: input.corpusVersion,
    })
    .where(key);
}
