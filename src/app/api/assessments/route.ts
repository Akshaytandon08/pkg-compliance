import { createAssessment, type NewAssessment } from "@/db/assessments";

export async function POST(request: Request) {
  let body: NewAssessment;
  try {
    body = (await request.json()) as NewAssessment;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.packName?.trim()) {
    return Response.json({ error: "A pack name is required." }, { status: 400 });
  }
  if (!Array.isArray(body.components) || body.components.length === 0) {
    return Response.json({ error: "At least one BOM component is required." }, { status: 400 });
  }

  try {
    const id = await createAssessment(body);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create assessment." },
      { status: 500 },
    );
  }
}
