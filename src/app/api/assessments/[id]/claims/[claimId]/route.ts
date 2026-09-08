import { confirmClaim, editAndConfirmClaim, rejectClaim, type ClaimEdit } from "@/db/claims";
import { logActivity } from "@/db/activity";
import { summarizeAssessmentVerdicts, verdictsDiffer } from "@/db/verdict-summary";

// Gated claim actions (behind the access gate). Confirm / Reject via POST,
// Edit-and-confirm via PATCH. A confirm materialises evidence and — because the
// report recomputes from evidence on load — flows through to the verdict.
function actor(body: { by?: unknown }): string {
  return typeof body.by === "string" && body.by.trim() ? body.by.trim() : "Assessor";
}

// Run a confirming action, recording the claim event and — if the verdict summary
// actually moved — a verdict_changed event. The before-snapshot is taken first so
// the diff reflects only this action.
async function withVerdictDelta(
  assessmentId: number,
  claimId: number,
  by: string,
  kind: "claim_confirmed" | "claim_edited",
  run: () => Promise<Awaited<ReturnType<typeof confirmClaim>>>,
) {
  const before = await summarizeAssessmentVerdicts(assessmentId);
  const result = await run();
  if (result.ok) {
    await logActivity(assessmentId, {
      kind,
      actor: by,
      summary: `${kind === "claim_edited" ? "Edited and confirmed" : "Confirmed"} claim #${claimId}`,
      meta: { claimId, materialised: result.materialised },
    });
    if (result.materialised && before) {
      const after = await summarizeAssessmentVerdicts(assessmentId);
      if (after && verdictsDiffer(before, after)) {
        await logActivity(assessmentId, {
          kind: "verdict_changed",
          actor: by,
          summary: `Verdict updated (${before.overall.verdict} → ${after.overall.verdict})`,
          meta: { from: before, to: after, claimId },
        });
      }
    }
  }
  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; claimId: string }> },
) {
  const { id: idParam, claimId } = await params;
  const assessmentId = Number(idParam);
  const id = Number(claimId);
  if (!Number.isInteger(id) || !Number.isInteger(assessmentId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string; by?: string; componentId?: number };
  const componentId = Number.isInteger(body.componentId) ? (body.componentId as number) : null;
  const by = actor(body);

  if (body.action === "reject") {
    const result = await rejectClaim(id, by);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
    await logActivity(assessmentId, {
      kind: "claim_rejected",
      actor: by,
      summary: `Rejected claim #${id}`,
      meta: { claimId: id },
    });
    return Response.json(result, { status: 200 });
  }
  if (body.action === "confirm") {
    const result = await withVerdictDelta(assessmentId, id, by, "claim_confirmed", () =>
      confirmClaim(id, by, componentId),
    );
    if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
    return Response.json(result, { status: 200 });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; claimId: string }> },
) {
  const { id: idParam, claimId } = await params;
  const assessmentId = Number(idParam);
  const id = Number(claimId);
  if (!Number.isInteger(id) || !Number.isInteger(assessmentId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    edits?: ClaimEdit;
    by?: string;
    componentId?: number;
  };
  const componentId = Number.isInteger(body.componentId) ? (body.componentId as number) : null;
  const by = actor(body);
  const result = await withVerdictDelta(assessmentId, id, by, "claim_edited", () =>
    editAndConfirmClaim(id, body.edits ?? {}, by, componentId),
  );
  if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
  return Response.json(result, { status: 200 });
}
