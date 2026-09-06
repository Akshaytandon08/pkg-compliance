import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./index.ts";
import {
  assessmentComponents,
  assessmentEvidence,
  assessments,
  checkpointApprovals,
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
  /** Demonstration data — renders a visible tag; never a real screening. */
  demo?: boolean;
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
        demo: input.demo ?? false,
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
  demo: boolean;
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
    demo: a.demo,
    components,
  };
}

export type AssessmentSummary = {
  id: number;
  packName: string;
  createdAt: Date;
  corpusVersion: string;
  asOf: string;
  demo: boolean;
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
      demo: assessments.demo,
    })
    .from(assessments)
    .orderBy(desc(assessments.createdAt));
  return rows;
}

function toProductionCheckpoint(c: typeof checkpoints.$inferSelect): ProductionCheckpoint {
  return {
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
    recurrence: c.recurrence,
    citation: c.citation,
    triggerDate: c.triggerDate,
    sunsetDate: c.sunsetDate,
    testMethod: c.testMethod,
    notes: c.notes,
  };
}

/** Loads the whole corpus (all statuses) for the production evaluator. */
export async function loadCorpus(database: typeof db = db): Promise<ProductionCheckpoint[]> {
  const rows = await database.select().from(checkpoints);
  return rows.map(toProductionCheckpoint);
}

/**
 * Loads the corpus AS OF a stamped corpus version — the pin that makes a report
 * reproducible. A checkpoint is included only if it is `in_force` under an
 * approval whose corpus version was approved no later than the pinned one.
 * Later approvals — and drafts, which have no approval — are excluded entirely,
 * so approving Batch 2 cannot change a report an assessment stamped `batch-1`
 * already produced.
 *
 * If the label does not resolve to an approved corpus version (e.g. the
 * pre-approval sentinel, when the whole corpus is still draft), there is nothing
 * to pin to: fall back to the full corpus so drafts render as the pending
 * caveats they are, matching the pre-approval report.
 *
 * Note: a row in force at pin time but since moved to `superseded` drops out —
 * full temporal replay of retired rules is out of scope for the prototype; the
 * pin's job here is to keep newer approvals from leaking backwards.
 */
export async function loadCorpusAsOf(
  corpusVersionLabel: string,
  database: typeof db = db,
): Promise<ProductionCheckpoint[]> {
  const [pin] = await database
    .select({ id: corpusVersions.id })
    .from(corpusVersions)
    .where(eq(corpusVersions.label, corpusVersionLabel));
  if (!pin) return loadCorpus(database);

  // The boundary comparison stays in SQL: approved_at is a microsecond-precision
  // timestamptz, and round-tripping it through a JS Date truncates to
  // milliseconds — which would drop the pinned version's own rows (its stored
  // sub-millisecond fraction is > the truncated value). Compare against the pin
  // by id so full precision is preserved.
  const rows = await database
    .select({ cp: checkpoints })
    .from(checkpoints)
    .innerJoin(
      checkpointApprovals,
      and(
        eq(checkpointApprovals.checkpointId, checkpoints.id),
        eq(checkpointApprovals.checkpointVersion, checkpoints.version),
      ),
    )
    .innerJoin(corpusVersions, eq(corpusVersions.id, checkpointApprovals.corpusVersionId))
    .where(
      and(
        eq(checkpoints.status, "in_force"),
        sql`${corpusVersions.approvedAt} <= (select approved_at from ${corpusVersions} where ${corpusVersions.id} = ${pin.id})`,
      ),
    );

  return rows.map((r) => toProductionCheckpoint(r.cp));
}
