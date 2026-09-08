import { and, eq } from "drizzle-orm";
import { db } from "./index.ts";
import {
  assessmentComponents,
  assessmentEvidence,
  evidenceDocuments,
  extractedClaims,
  extractionRuns,
} from "./schema.ts";
import { claimToNewEvidence } from "../lib/extraction/matching.ts";

// B3 — human confirmation of extracted claims. A pending claim is EVIDENCE, not a
// verdict; only a human's Confirm materialises an assessment_evidence row that the
// evaluator reads. Reject and Edit-and-confirm are the other two moves. Re-eval is
// implicit: the report recomputes from assessment_evidence on load, so a confirm
// flows straight through to the verdict once the page refreshes.

export interface ClaimEdit {
  value?: string | null;
  parameter?: string | null;
  unit?: string | null;
  testMethod?: string | null;
  issuer?: string | null;
  accreditationRef?: string | null;
  issueDate?: string | null;
  expiry?: string | null;
  scopeText?: string | null;
}

export interface ClaimForReview {
  id: number;
  claimType: string;
  parameter: string | null;
  value: string | null;
  unit: string | null;
  issuer: string | null;
  expiry: string | null;
  confidence: number | null;
  status: string;
  provenance: { page: number } | null;
  documentId: number;
  documentFilename: string;
  componentId: number | null;
  model: string;
  promptVersion: string;
}

// All claims extracted for an assessment's documents, newest first, with the
// provenance + model/prompt the reviewer needs. Read-only.
export async function listClaimsForAssessment(assessmentId: number): Promise<ClaimForReview[]> {
  const rows = await db
    .select({
      id: extractedClaims.id,
      claimType: extractedClaims.claimType,
      parameter: extractedClaims.parameter,
      value: extractedClaims.value,
      unit: extractedClaims.unit,
      issuer: extractedClaims.issuer,
      expiry: extractedClaims.expiry,
      confidence: extractedClaims.confidence,
      status: extractedClaims.status,
      provenance: extractedClaims.provenance,
      documentId: evidenceDocuments.id,
      documentFilename: evidenceDocuments.filename,
      componentId: evidenceDocuments.componentId,
      model: extractionRuns.model,
      promptVersion: extractionRuns.promptVersion,
    })
    .from(extractedClaims)
    .innerJoin(extractionRuns, eq(extractedClaims.runId, extractionRuns.id))
    .innerJoin(evidenceDocuments, eq(extractionRuns.documentId, evidenceDocuments.id))
    .where(eq(evidenceDocuments.assessmentId, assessmentId));
  return rows.map((r) => ({
    ...r,
    provenance: (r.provenance as { page: number } | null) ?? null,
    expiry: r.expiry ?? null,
    issueDate: null,
  })) as ClaimForReview[];
}

async function resolveComponent(
  assessmentId: number,
  documentComponentId: number | null,
  explicitComponentId: number | null,
): Promise<{ id: number; name: string; material: string } | null> {
  const wanted = explicitComponentId ?? documentComponentId;
  if (wanted == null) return null;
  const [c] = await db
    .select({ id: assessmentComponents.id, name: assessmentComponents.name, material: assessmentComponents.material })
    .from(assessmentComponents)
    .where(and(eq(assessmentComponents.id, wanted), eq(assessmentComponents.assessmentId, assessmentId)));
  return c ?? null;
}

async function loadClaim(claimId: number) {
  const [row] = await db
    .select({
      claim: extractedClaims,
      documentComponentId: evidenceDocuments.componentId,
      assessmentId: evidenceDocuments.assessmentId,
    })
    .from(extractedClaims)
    .innerJoin(extractionRuns, eq(extractedClaims.runId, extractionRuns.id))
    .innerJoin(evidenceDocuments, eq(extractionRuns.documentId, evidenceDocuments.id))
    .where(eq(extractedClaims.id, claimId));
  return row ?? null;
}

export type ConfirmOutcome =
  | { ok: true; materialised: boolean; note?: string }
  | { ok: false; reason: string };

// Confirm a pending claim. Marks it confirmed (immutable thereafter) and, when a
// component resolves and the claim maps to an evidence type, inserts the
// assessment_evidence row so the evaluator can rely on it.
export async function confirmClaim(
  claimId: number,
  by: string,
  explicitComponentId: number | null = null,
): Promise<ConfirmOutcome> {
  const row = await loadClaim(claimId);
  if (!row) return { ok: false, reason: "claim not found" };
  if (row.claim.status !== "pending") return { ok: false, reason: `claim is ${row.claim.status}, not pending` };

  const component = await resolveComponent(row.assessmentId, row.documentComponentId, explicitComponentId);
  const evidence = component
    ? claimToNewEvidence(
        { claimType: row.claim.claimType, parameter: row.claim.parameter, expiry: row.claim.expiry },
        component,
      )
    : null;

  await db.transaction(async (tx) => {
    await tx
      .update(extractedClaims)
      .set({ status: "confirmed", confirmedBy: by, confirmedAt: new Date() })
      .where(eq(extractedClaims.id, claimId));
    if (component && evidence) {
      await tx.insert(assessmentEvidence).values({ componentId: component.id, ...evidence });
    }
  });

  if (!component) return { ok: true, materialised: false, note: "confirmed; attach to a component to affect a verdict" };
  if (!evidence) return { ok: true, materialised: false, note: "confirmed; this claim type carries no evidence" };
  return { ok: true, materialised: true };
}

export async function rejectClaim(claimId: number, by: string): Promise<ConfirmOutcome> {
  const row = await loadClaim(claimId);
  if (!row) return { ok: false, reason: "claim not found" };
  if (row.claim.status !== "pending") return { ok: false, reason: `claim is ${row.claim.status}, not pending` };
  await db
    .update(extractedClaims)
    .set({ status: "rejected", confirmedBy: by, confirmedAt: new Date() })
    .where(eq(extractedClaims.id, claimId));
  return { ok: true, materialised: false };
}

// Edit a pending claim's transcribed values, then confirm. Allowed because the
// claim is still pending (the immutability trigger only freezes confirmed rows).
export async function editAndConfirmClaim(
  claimId: number,
  edits: ClaimEdit,
  by: string,
  explicitComponentId: number | null = null,
): Promise<ConfirmOutcome> {
  const row = await loadClaim(claimId);
  if (!row) return { ok: false, reason: "claim not found" };
  if (row.claim.status !== "pending") return { ok: false, reason: `claim is ${row.claim.status}, not pending` };
  await db.update(extractedClaims).set(edits).where(eq(extractedClaims.id, claimId));
  return confirmClaim(claimId, by, explicitComponentId);
}
