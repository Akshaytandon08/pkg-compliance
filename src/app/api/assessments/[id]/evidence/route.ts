import { addEvidence, type NewEvidence } from "@/db/assessments";

type Body = NewEvidence & { componentId?: number };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isInteger(assessmentId)) {
    return Response.json({ error: "Invalid assessment id." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Number.isInteger(body.componentId)) {
    return Response.json({ error: "componentId is required." }, { status: 400 });
  }
  if (!body.evidenceType?.trim()) {
    return Response.json({ error: "evidenceType is required." }, { status: 400 });
  }

  try {
    const ok = await addEvidence(assessmentId, body.componentId!, {
      evidenceType: body.evidenceType,
      reference: body.reference ?? null,
      issuedDate: body.issuedDate ?? null,
      expiryDate: body.expiryDate ?? null,
      scopeComponents: body.scopeComponents,
      scopeMaterials: body.scopeMaterials,
      scopeParameters: body.scopeParameters,
    });
    if (!ok) {
      return Response.json({ error: "Component not found in this assessment." }, { status: 404 });
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to add evidence." },
      { status: 500 },
    );
  }
}
