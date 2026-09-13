// The single CONFIRMED extracted claim in the demo suite.
//
// Every other demo evidence record is metadata only, which is why the key-value
// line ("17.0 mg/kg against ≤ 100 mg/kg") had nothing to render. This seeds the
// document → run → claim chain the real pipeline produces, so the line is driven
// by the same data path in the demo as in production. No extraction code is
// touched and no model is called: the values are transcribed from the owner's
// synthetic dossier.
//
// PROVENANCE — every figure below comes VERBATIM from manifest entry SYN-06
// (`06_lab_test_report_A.pdf`, class lab_test_report, tier A, trap: none) in
// reference/extraction-set-synthetic/synthetic_packaging_dossier/manifest.json.
// Nothing here is invented. The manifest's own scope is "PP Cap PC38, natural";
// attaching it to the demo PET strap is a DEMO SYNTHESIS and is labelled
// SYNTHETIC-DEMO wherever it surfaces.
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import {
  assessmentComponents,
  evidenceDocuments,
  extractedClaims,
  extractionRuns,
} from "../src/db/schema.ts";

const SD = "SYNTHETIC-DEMO";
const STRAP = "Green polyester strap (PET)";

/** Manifest SYN-06, heavy_metals_sum. */
const MANIFEST = {
  documentId: "SYN-06",
  file: "06_lab_test_report_A.pdf",
  parameter: "Pb+Cd+Hg+Cr(VI) sum",
  value: "17.0",
  unit: "mg/kg",
  testMethod: "CR 13695-1:2000",
  issuer: "Orvantis Materials Laboratory",
  accreditationRef: "NABL-TC-SYN-001",
  issueDate: "2026-08-24",
  documentReference: "SYN/2026/0006",
} as const;

/**
 * Returns the new claim id, or null when the strap is not in this pack.
 * Idempotent by construction: the seed deletes and recreates the assessment, so
 * the document/run/claim chain goes with it via ON DELETE CASCADE.
 */
export async function seedConfirmedHeavyMetalsClaim(assessmentId: number): Promise<number | null> {
  const [strap] = await db
    .select({ id: assessmentComponents.id })
    .from(assessmentComponents)
    .where(and(eq(assessmentComponents.assessmentId, assessmentId), eq(assessmentComponents.name, STRAP)));
  if (!strap) return null;

  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(evidenceDocuments)
      .values({
        assessmentId,
        componentId: strap.id,
        filename: `${SD}-${MANIFEST.file}`,
        contentType: "application/pdf",
        // The bytes are NOT stored: this is a seeded record of a document from
        // the owner's dossier, not a copy of it. byteSize/sha256 are recorded as
        // the manifest states them so the row is not silently fictional.
        byteSize: 0,
        sha256: `${SD}-manifest-${MANIFEST.documentId}`,
        storageBackend: "none",
        storageKey: `${SD}/${MANIFEST.documentId}`,
        source: "seed",
        uploadedBy: `${SD} — demo seed`,
      })
      .returning({ id: evidenceDocuments.id });

    const [run] = await tx
      .insert(extractionRuns)
      .values({
        documentId: doc.id,
        provider: "seed",
        model: "none — transcribed from the dossier manifest",
        promptVersion: "n/a",
        docClass: "lab_test_report",
        status: "succeeded",
        finishedAt: new Date(),
      })
      .returning({ id: extractionRuns.id });

    const [claim] = await tx
      .insert(extractedClaims)
      .values({
        runId: run.id,
        claimType: "measured_parameter",
        parameter: MANIFEST.parameter,
        value: MANIFEST.value,
        unit: MANIFEST.unit,
        testMethod: MANIFEST.testMethod,
        issuer: `${SD} — ${MANIFEST.issuer}`,
        accreditationRef: `${SD} — ${MANIFEST.accreditationRef}`,
        issueDate: MANIFEST.issueDate,
        scopeText: `${MANIFEST.documentReference} (manifest ${MANIFEST.documentId})`,
        // No model produced this, so there is no self-score to record. NULL is
        // the honest value; a fabricated 1.0 would claim a confidence nobody has.
        confidence: null,
        provenance: { page: 1 },
        status: "confirmed",
        confirmedBy: "Akshay Tandon (demo assessor)",
        confirmedAt: new Date(),
      })
      .returning({ id: extractedClaims.id });

    return claim.id;
  });
}
