// Demonstration harness for the DoC draft generator (Sprint 4b). Evaluates an
// assessment, prints its eligibility (the button state the report shows), and — for
// an eligible pack — renders the draft .docx + PDF to an output directory and prints
// each file's sha256. Read-only except for writing the sample files.
//
//   node --env-file=.env scripts/sample-doc.ts [assessmentId] [outDir]
//
// It loads the APPROVED Annex VIII template when one exists; until the regulatory
// owner approves the encoding it falls back to the DRAFT template FOR DEMONSTRATION
// ONLY and says so — the production route always requires the approved template.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { getAssessment, loadCorpusAsOf } from "../src/db/assessments.ts";
import { evaluatePack } from "../src/lib/engine/pack.ts";
import { loadApprovedDocTemplate, loadDocTemplate } from "../src/db/doc-templates.ts";
import { assessDoCEligibility } from "../src/lib/doc-export/eligibility.ts";
import { buildDoCDraft } from "../src/lib/doc-export/doc-draft.ts";
import { renderDocx } from "../src/lib/doc-export/docx.ts";
import { renderPdf } from "../src/lib/doc-export/pdf.ts";
import { exportFilename, DOC_KINDS } from "../src/lib/doc-export/filename.ts";

const assessmentId = Number(process.argv[2] ?? "7");
const outDir = process.argv[3] ?? "/tmp/doc-sample";

const assessment = await getAssessment(assessmentId);
if (!assessment) {
  console.error(`Assessment ${assessmentId} not found.`);
  process.exit(1);
}
const corpus = await loadCorpusAsOf(assessment.corpusVersion);
const report = evaluatePack({
  checkpoints: corpus,
  context: assessment.context,
  components: assessment.components.map((c) => ({
    id: c.id, line: c.line, name: c.name, material: c.material, composition: c.composition ?? undefined,
    documents: c.documents,
    designAssessment: c.riskAnnotation === "at_risk" ? "at_risk" : c.riskAnnotation === "no_inherent_risk" ? "no_inherent_risk" : undefined,
    riskRationale: c.riskRationale, riskAnnotatedBy: c.riskAnnotatedBy,
  })),
  asOf: assessment.asOf,
  corpusVersion: assessment.corpusVersion,
});

const eligibility = assessDoCEligibility(assessment.context, report);
console.log(`\n#${assessmentId} ${assessment.packName}`);
console.log(`  eligible (assessment): ${eligibility.eligible}`);
for (const b of eligibility.blockers) console.log(`    ✗ ${b}`);

if (!eligibility.eligible) {
  console.log("  → button rendered DISABLED with the reasons above.\n");
  const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
  if (shared) await shared.end({ timeout: 5 });
  process.exit(0);
}

let template = await loadApprovedDocTemplate("EU-DoC-AnnexVIII");
if (!template) {
  template = await loadDocTemplate("EU-DoC-AnnexVIII");
  console.log("  ⚠ Annex VIII template is DRAFT (not yet approved) — generating a sample FOR DEMONSTRATION ONLY.");
  console.log("     The production route requires the approved template.");
}
if (!template) {
  console.error("No Annex VIII template found.");
  process.exit(1);
}

const generatedDate = new Date().toISOString().slice(0, 10);
const model = buildDoCDraft({
  template, packName: assessment.packName, draftVersion: 1, context: assessment.context, report,
  components: assessment.components.map((c) => ({ line: c.line, name: c.name, material: c.material, composition: c.composition, weightGrams: c.weightGrams })),
  language: "en", generatedDate,
});

mkdirSync(outDir, { recursive: true });
const docx = await renderDocx(model);
const pdf = await renderPdf(model);
const docxName = exportFilename({ kind: DOC_KINDS.doc, subject: assessment.packName, date: generatedDate, language: "en", ext: "docx" });
const pdfName = exportFilename({ kind: DOC_KINDS.doc, subject: assessment.packName, date: generatedDate, language: "en", ext: "pdf" });
writeFileSync(`${outDir}/${docxName}`, docx);
writeFileSync(`${outDir}/${pdfName}`, pdf);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
console.log(`  ✓ ${outDir}/${docxName}  (${docx.length} bytes, sha256 ${sha(docx).slice(0, 16)}…)`);
console.log(`  ✓ ${outDir}/${pdfName}  (${pdf.length} bytes, sha256 ${sha(pdf).slice(0, 16)}…)\n`);

const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
if (shared) await shared.end({ timeout: 5 });
