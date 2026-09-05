import { and, desc, eq } from "drizzle-orm";
import { db } from "./index.ts";
import {
  assessmentComponents,
  assessmentEvidence,
  assessments,
  checkpoints,
  corpusVersions,
  type AssessmentContextRecord,
} from "./schema.ts";
import type { ProductionCheckpoint } from "../lib/engine/pack.ts";
import type { EvidenceDocument } from "../lib/engine/evaluate.ts";

export type NewEvidence = {
  evidenceType: string;
  reference?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  scopeComponents?: string[];
  scopeMaterials?: string[];
  scopeParameters?: string[];
};

export type NewComponent = {
  line: string;
  name: string;
  material: string;
  composition?: string | null;
  weightGrams?: number | null;
  sourcedFrom?: string | null;
  riskAnnotation?: string | null;
  riskRationale?: string | null;
  riskAnnotatedBy?: string | null;
  evidence: NewEvidence[];
};

export type NewAssessment = {
  packName: string;
  description?: string | null;
  asOf: string;
  context: AssessmentContextRecord;
  components: NewComponent[];
};

/** The corpus version stamped on a new assessment. */
export async function currentCorpusVersionLabel(): Promise<string> {
  const [latest] = await db
    .select({ label: corpusVersions.label })
    .from(corpusVersions)
    .orderBy(desc(corpusVersions.approvedAt))
    .limit(1);
  // No approved corpus yet — the whole corpus is still draft. Stamp a sentinel
  // rather than a fake version, so the report is honest about reproducibility.
  return latest?.label ?? "pre-approval (no corpus version in force)";
}

export async function createAssessment(input: NewAssessment): Promise<number> {
  const corpusVersion = await currentCorpusVersionLabel();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(assessments)
      .values({
        packName: input.packName,
        description: input.description ?? null,
        assessmentContext: input.context,
        corpusVersion,
        asOf: input.asOf,
      })
      .returning({ id: assessments.id });

    for (const c of input.components) {
      const [comp] = await tx
        .insert(assessmentComponents)
        .values({
          assessmentId: row.id,
          line: c.line,
          name: c.name,
          material: c.material,
          composition: c.composition ?? null,
          weightGrams: c.weightGrams ?? null,
          sourcedFrom: c.sourcedFrom ?? null,
          riskAnnotation: c.riskAnnotation ?? null,
          riskRationale: c.riskRationale ?? null,
          riskAnnotatedBy: c.riskAnnotatedBy ?? null,
        })
        .returning({ id: assessmentComponents.id });

      for (const e of c.evidence) {
        await tx.insert(assessmentEvidence).values({
          componentId: comp.id,
          evidenceType: e.evidenceType,
          reference: e.reference ?? null,
          issuedDate: e.issuedDate ?? null,
          expiryDate: e.expiryDate ?? null,
          scopeComponents: e.scopeComponents ?? null,
          scopeMaterials: e.scopeMaterials ?? null,
          scopeParameters: e.scopeParameters ?? null,
        });
      }
    }
    return row.id;
  });
}

export type LoadedComponent = {
  id: number;
  line: string;
  name: string;
  material: string;
  composition: string | null;
  weightGrams: number | null;
  sourcedFrom: string | null;
  riskAnnotation: string | null;
  riskRationale: string | null;
  riskAnnotatedBy: string | null;
  documents: EvidenceDocument[];
};

export type LoadedAssessment = {
  id: number;
  createdAt: Date;
  packName: string;
  description: string | null;
  context: AssessmentContextRecord;
  corpusVersion: string;
  asOf: string;
  components: LoadedComponent[];
};

export async function getAssessment(id: number): Promise<LoadedAssessment | null> {
  const [a] = await db.select().from(assessments).where(eq(assessments.id, id));
  if (!a) return null;

  const comps = await db
    .select()
    .from(assessmentComponents)
    .where(eq(assessmentComponents.assessmentId, id));

  const components: LoadedComponent[] = [];
  for (const c of comps) {
    const ev = await db
      .select()
      .from(assessmentEvidence)
      .where(eq(assessmentEvidence.componentId, c.id));
    components.push({
      id: c.id,
      line: c.line,
      name: c.name,
      material: c.material,
      composition: c.composition,
      weightGrams: c.weightGrams,
      sourcedFrom: c.sourcedFrom,
      riskAnnotation: c.riskAnnotation,
      riskRationale: c.riskRationale,
      riskAnnotatedBy: c.riskAnnotatedBy,
      documents: ev.map((e) => ({
        docId: String(e.id),
        type: e.evidenceType,
        issuedDate: e.issuedDate,
        expiryDate: e.expiryDate,
        scope: {
          components: e.scopeComponents ?? undefined,
          materials: e.scopeMaterials ?? undefined,
          parameters: e.scopeParameters ?? undefined,
        },
      })),
    });
  }

  return {
    id: a.id,
    createdAt: a.createdAt,
    packName: a.packName,
    description: a.description,
    context: a.assessmentContext,
    corpusVersion: a.corpusVersion,
    asOf: a.asOf,
    components,
  };
}

export type AssessmentSummary = {
  id: number;
  packName: string;
  createdAt: Date;
  corpusVersion: string;
  asOf: string;
};

/**
 * Adds one evidence-metadata row to a component, after verifying the component
 * belongs to the given assessment (so the report's inline form cannot write
 * across assessments). Returns false if the component is not in the assessment.
 */
export async function addEvidence(
  assessmentId: number,
  componentId: number,
  e: NewEvidence,
): Promise<boolean> {
  const [comp] = await db
    .select({ id: assessmentComponents.id })
    .from(assessmentComponents)
    .where(
      and(
        eq(assessmentComponents.id, componentId),
        eq(assessmentComponents.assessmentId, assessmentId),
      ),
    );
  if (!comp) return false;
  await db.insert(assessmentEvidence).values({
    componentId,
    evidenceType: e.evidenceType,
    reference: e.reference ?? null,
    issuedDate: e.issuedDate ?? null,
    expiryDate: e.expiryDate ?? null,
    scopeComponents: e.scopeComponents ?? null,
    scopeMaterials: e.scopeMaterials ?? null,
    scopeParameters: e.scopeParameters ?? null,
  });
  return true;
}

export async function listAssessments(): Promise<AssessmentSummary[]> {
  const rows = await db
    .select({
      id: assessments.id,
      packName: assessments.packName,
      createdAt: assessments.createdAt,
      corpusVersion: assessments.corpusVersion,
      asOf: assessments.asOf,
    })
    .from(assessments)
    .orderBy(desc(assessments.createdAt));
  return rows;
}

/** Loads the whole corpus (all statuses) for the production evaluator. */
export async function loadCorpus(): Promise<ProductionCheckpoint[]> {
  const rows = await db.select().from(checkpoints);
  return rows.map((c) => ({
    id: c.id,
    version: c.version,
    status: c.status,
    subject: c.subject,
    material: c.material,
    legalRole: c.legalRole,
    requirementText: c.requirementText,
    evidenceRequirements: c.evidenceRequirements,
    appliesWhen: c.appliesWhen,
    thresholds: c.thresholds,
    citation: c.citation,
    triggerDate: c.triggerDate,
    sunsetDate: c.sunsetDate,
    testMethod: c.testMethod,
    notes: c.notes,
  }));
}
