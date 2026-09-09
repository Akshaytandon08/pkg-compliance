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
  // Every failure returns a category the panel renders verbatim, plus specifics,
  // instead of a bare "Generation failed." The full error is already logged
  // server-side (with the assessment id) by the generator.
  switch (result.reason) {
    case "not_found":
      return Response.json({ error: "Assessment not found.", category: "not_found" }, { status: 404 });
    case "not_eligible":
      return Response.json(
        { error: "Eligibility changed — this assessment no longer qualifies for a draft.", category: "eligibility_changed", blockers: result.eligibility.blockers },
        { status: 409 },
      );
    case "template_pending":
      return Response.json({ error: result.message, category: "template_not_approved", blockers: [result.message] }, { status: 409 });
    case "render_failed":
      return Response.json({ error: result.message, category: "render_failed" }, { status: 500 });
    case "storage_unavailable":
      return Response.json({ error: result.message, category: "storage_unavailable" }, { status: 503 });
  }
}
