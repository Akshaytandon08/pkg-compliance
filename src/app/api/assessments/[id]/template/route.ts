import { getAssessment, loadCorpus } from "@/db/assessments";
import { renderTemplate, type TemplateKind } from "@/lib/report/templates";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  const url = new URL(request.url);
  const componentId = Number(url.searchParams.get("component"));
  const checkpointId = url.searchParams.get("checkpoint") ?? "";
  const version = Number(url.searchParams.get("version"));
  const kind = (url.searchParams.get("kind") ?? "supplier_declaration") as TemplateKind;

  if (!Number.isInteger(assessmentId) || !Number.isInteger(componentId) || !checkpointId || !Number.isInteger(version)) {
    return new Response("Bad request", { status: 400 });
  }

  const assessment = await getAssessment(assessmentId);
  const component = assessment?.components.find((c) => c.id === componentId);
  if (!assessment || !component) return new Response("Not found", { status: 404 });

  const corpus = await loadCorpus();
  const cp = corpus.find((c) => c.id === checkpointId && c.version === version);
  if (!cp) return new Response("Checkpoint not found", { status: 404 });

  const text = renderTemplate(kind, {
    packName: assessment.packName,
    asOf: assessment.asOf,
    component: { name: component.name, material: component.material, composition: component.composition },
    checkpoint: {
      id: cp.id,
      requirementText: cp.requirementText,
      thresholds: cp.thresholds,
      testMethod: cp.testMethod,
      citation: cp.citation,
    },
  });

  const slug = component.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `${kind}-request_${checkpointId}_${slug}.md`;
  return new Response(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
