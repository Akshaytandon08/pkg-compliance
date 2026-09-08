import { confirmClaim, editAndConfirmClaim, rejectClaim, type ClaimEdit } from "@/db/claims";

// Gated claim actions (behind the access gate). Confirm / Reject via POST,
// Edit-and-confirm via PATCH. A confirm materialises evidence and — because the
// report recomputes from evidence on load — flows through to the verdict.
function actor(body: { by?: unknown }): string {
  return typeof body.by === "string" && body.by.trim() ? body.by.trim() : "Assessor";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; claimId: string }> },
) {
  const { claimId } = await params;
  const id = Number(claimId);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid claim id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; by?: string; componentId?: number };
  const componentId = Number.isInteger(body.componentId) ? (body.componentId as number) : null;

  const result =
    body.action === "reject"
      ? await rejectClaim(id, actor(body))
      : body.action === "confirm"
        ? await confirmClaim(id, actor(body), componentId)
        : null;
  if (!result) return Response.json({ error: "Unknown action." }, { status: 400 });
  if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
  return Response.json(result, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; claimId: string }> },
) {
  const { claimId } = await params;
  const id = Number(claimId);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid claim id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    edits?: ClaimEdit;
    by?: string;
    componentId?: number;
  };
  const componentId = Number.isInteger(body.componentId) ? (body.componentId as number) : null;
  const result = await editAndConfirmClaim(id, body.edits ?? {}, actor(body), componentId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
  return Response.json(result, { status: 200 });
}
