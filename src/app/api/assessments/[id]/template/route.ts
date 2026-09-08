import { getAssessment, loadCorpus } from "@/db/assessments";
import type { TemplateKind } from "@/lib/report/templates";
import { buildRequestModel } from "@/lib/doc-export/request-doc";
import { renderDocx } from "@/lib/doc-export/docx";
import { renderPdf } from "@/lib/doc-export/pdf";
import { exportFilename, DOC_KINDS } from "@/lib/doc-export/filename";

// Supplier-declaration / lab-test REQUEST templates, exported as .docx (or a PDF
// preview) from the controlled document model — no markdown. Plain-language
// filenames, Fitsol-branded. These are drafting aids the user sends out; they are
// never conformity documents and never issued by this tool.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  const url = new URL(request.url);
  const componentId = Number(url.searchParams.get("component"));
  const checkpointId = url.searchParams.get("checkpoint") ?? "";
  const version = Number(url.searchParams.get("version"));
  const kind = (url.searchParams.get("kind") ?? "supplier_declaration") as TemplateKind;
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "docx";

  if (!Number.isInteger(assessmentId) || !Number.isInteger(componentId) || !checkpointId || !Number.isInteger(version)) {
    return new Response("Bad request", { status: 400 });
  }

  const assessment = await getAssessment(assessmentId);
  const component = assessment?.components.find((c) => c.id === componentId);
  if (!assessment || !component) return new Response("Not found", { status: 404 });

  const corpus = await loadCorpus();
  const cp = corpus.find((c) => c.id === checkpointId && c.version === version);
  if (!cp) return new Response("Checkpoint not found", { status: 404 });

  const model = buildRequestModel(kind, {
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

  const docKind = kind === "lab_test" ? DOC_KINDS.labRequest : DOC_KINDS.supplierRequest;
  const subject = `${assessment.packName} ${component.name}`;
  const filename = exportFilename({ kind: docKind, subject, date: assessment.asOf, ext: format });
  const bytes = format === "pdf" ? await renderPdf(model) : await renderDocx(model);
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
