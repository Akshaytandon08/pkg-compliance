import { generateDoCDraft } from "@/db/generate-doc-draft";

// Gated. Generate a DRAFT EU declaration of conformity for the assessment, one
// .docx (+ pdf preview) per selected Member State language, English first. The
// generator is the gate: it refuses when the assessment is not eligible or when
// the Annex VIII template has not been approved — returning the specific reasons.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isInteger(assessmentId)) return Response.json({ error: "Invalid assessment id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { languages?: unknown; by?: string };
  const languages = Array.isArray(body.languages) ? body.languages.filter((l): l is string => typeof l === "string") : [];
  const by = typeof body.by === "string" && body.by.trim() ? body.by.trim() : "Assessor";

  const result = await generateDoCDraft(assessmentId, languages, by);
  if (result.ok) return Response.json({ ok: true, drafts: result.drafts }, { status: 201 });
  if (result.reason === "not_found") return Response.json({ error: "Assessment not found." }, { status: 404 });
  if (result.reason === "not_eligible") {
    return Response.json({ error: "Not eligible for a draft.", blockers: result.eligibility.blockers }, { status: 409 });
  }
  return Response.json({ error: result.message, blockers: [result.message] }, { status: 409 });
}
