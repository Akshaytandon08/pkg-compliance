import { getAssessment, loadCorpusAsOf } from "./assessments.ts";
import { evaluatePack, type PackReport } from "../lib/engine/pack.ts";
import { loadApprovedDocTemplate } from "./doc-templates.ts";
import { storeDraft, type StoredDraft } from "./doc-drafts.ts";
import { assessDoCEligibility, type Eligibility } from "../lib/doc-export/eligibility.ts";
import { buildDoCDraft } from "../lib/doc-export/doc-draft.ts";
import { renderDocx } from "../lib/doc-export/docx.ts";
import { renderPdf } from "../lib/doc-export/pdf.ts";
import { exportFilename, DOC_KINDS } from "../lib/doc-export/filename.ts";

const DOC_TEMPLATE_ID = "EU-DoC-AnnexVIII";

export type GenerateResult =
  | { ok: true; drafts: StoredDraft[] }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_eligible"; eligibility: Eligibility }
  | { ok: false; reason: "template_pending"; message: string }
  | { ok: false; reason: "render_failed"; message: string }
  | { ok: false; reason: "storage_unavailable"; message: string };

// Log the full error server-side (with the assessment id and phase) so a bare
// "Generation failed." in the UI always has a diagnosable counterpart in the
// function logs. The message returned to the client is a category, never a stack.
function logGenError(assessmentId: number, phase: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(`[doc-draft] assessment ${assessmentId} — ${phase} failed: ${e.message}`, e.stack);
}

// Evaluate the assessment exactly as the report does (corpus pinned to the
// assessment's version), so eligibility and the draft rest on the same verdicts.
async function evaluate(assessmentId: number) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) return null;
  const corpus = await loadCorpusAsOf(assessment.corpusVersion);
  const report: PackReport = evaluatePack({
    checkpoints: corpus,
    context: assessment.context,
    components: assessment.components.map((c) => ({
      id: c.id,
      line: c.line,
      name: c.name,
      material: c.material,
      composition: c.composition ?? undefined,
      documents: c.documents,
      designAssessment:
        c.riskAnnotation === "at_risk" ? "at_risk" : c.riskAnnotation === "no_inherent_risk" ? "no_inherent_risk" : undefined,
      riskRationale: c.riskRationale,
      riskAnnotatedBy: c.riskAnnotatedBy,
    })),
    asOf: assessment.asOf,
    corpusVersion: assessment.corpusVersion,
  });
  return { assessment, report };
}

/** Eligibility only (for rendering the button state), no generation. */
export async function doCDraftEligibility(assessmentId: number): Promise<Eligibility | null> {
  const ev = await evaluate(assessmentId);
  if (!ev) return null;
  const base = assessDoCEligibility(ev.assessment.context, ev.report);
  // Surface the template-approval gate as an additional blocker on the button.
  const approved = await loadApprovedDocTemplate(DOC_TEMPLATE_ID);
  if (!approved) {
    return {
      eligible: false,
      blockers: [
        ...base.blockers,
        "The EU declaration-of-conformity template (Annex VIII) has not yet been approved by the regulatory owner.",
      ],
    };
  }
  return base;
}

export async function generateDoCDraft(
  assessmentId: number,
  languages: string[],
  createdBy?: string,
): Promise<GenerateResult> {
  const ev = await evaluate(assessmentId);
  if (!ev) return { ok: false, reason: "not_found" };
  const { assessment, report } = ev;

  const eligibility = assessDoCEligibility(assessment.context, report);
  if (!eligibility.eligible) return { ok: false, reason: "not_eligible", eligibility };

  const template = await loadApprovedDocTemplate(DOC_TEMPLATE_ID);
  if (!template) {
    return {
      ok: false,
      reason: "template_pending",
      message: "The EU declaration-of-conformity template (Annex VIII) has not yet been approved by the regulatory owner.",
    };
  }

  // English first, then any additional selected languages.
  const langs = ["en", ...languages.filter((l) => l.toLowerCase() !== "en")];
  const generatedDate = new Date().toISOString().slice(0, 10);
  const qualified = report.counts.qualified;
  const changelog = `Generated from corpus ${report.corpusVersion}; ${assessment.components.length} component(s), ${qualified} qualified requirement(s), as of ${assessment.asOf}.`;

  const drafts: StoredDraft[] = [];
  for (const language of langs) {
    const model = buildDoCDraft({
      template,
      packName: assessment.packName,
      draftVersion: 1, // storeDraft assigns the real version; the header shows it after
      context: assessment.context,
      report,
      components: assessment.components.map((c) => ({ line: c.line, name: c.name, material: c.material, composition: c.composition, weightGrams: c.weightGrams })),
      language,
      generatedDate,
    });
    let docx: Buffer;
    let pdf: Buffer;
    try {
      docx = await renderDocx(model);
      pdf = await renderPdf(model);
    } catch (err) {
      logGenError(assessmentId, `render (${language})`, err);
      return { ok: false, reason: "render_failed", message: `Failed to render the ${language.toUpperCase()} document.` };
    }
    const docxFilename = exportFilename({ kind: DOC_KINDS.doc, subject: assessment.packName, date: generatedDate, language, ext: "docx" });
    const pdfFilename = exportFilename({ kind: DOC_KINDS.doc, subject: assessment.packName, date: generatedDate, language, ext: "pdf" });
    let stored: StoredDraft;
    try {
      stored = await storeDraft({
        assessmentId,
        templateId: template.templateId,
        templateVersion: template.version,
        corpusVersion: report.corpusVersion,
        language,
        docx,
        pdf,
        docxFilename,
        pdfFilename,
        changelog,
        createdBy,
      });
    } catch (err) {
      logGenError(assessmentId, `store (${language})`, err);
      return { ok: false, reason: "storage_unavailable", message: "Document storage is unavailable — the drafts were rendered but could not be saved." };
    }
    drafts.push(stored);
  }

  return { ok: true, drafts };
}
