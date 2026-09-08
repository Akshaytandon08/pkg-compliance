import { and, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "./index.ts";
import { docTemplates, type DocTemplateElement, type DocTemplateStatus } from "./schema.ts";

export type { DocTemplateElement, DocTemplateStatus } from "./schema.ts";

export interface DocTemplateRecord {
  templateId: string;
  version: number;
  title: string;
  sourceCitation: string;
  sourceUrl: string;
  elements: DocTemplateElement[];
  status: DocTemplateStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  corpusVersion: string | null;
  notes: string | null;
}

function toRecord(r: typeof docTemplates.$inferSelect): DocTemplateRecord {
  return {
    templateId: r.templateId,
    version: r.version,
    title: r.title,
    sourceCitation: r.sourceCitation,
    sourceUrl: r.sourceUrl,
    elements: r.elements,
    status: r.status,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt,
    corpusVersion: r.corpusVersion,
    notes: r.notes,
  };
}

type DbLike = typeof defaultDb;

/** Any version of a template (draft or approved) — for review/encoding checks. */
export async function loadDocTemplate(
  templateId: string,
  version?: number,
  db: DbLike = defaultDb,
): Promise<DocTemplateRecord | null> {
  const where =
    version != null
      ? and(eq(docTemplates.templateId, templateId), eq(docTemplates.version, version))
      : eq(docTemplates.templateId, templateId);
  const rows = await db.select().from(docTemplates).where(where).orderBy(desc(docTemplates.version)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

/**
 * The APPROVED template for generation. Returns null when no approved version
 * exists — the draft generator must never render an unapproved encoding of the
 * Annex (its fixed legal text has not been human-confirmed against primary).
 */
export async function loadApprovedDocTemplate(
  templateId: string,
  db: DbLike = defaultDb,
): Promise<DocTemplateRecord | null> {
  const rows = await db
    .select()
    .from(docTemplates)
    .where(and(eq(docTemplates.templateId, templateId), eq(docTemplates.status, "approved")))
    .orderBy(desc(docTemplates.version))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function listDocTemplates(db: DbLike = defaultDb): Promise<DocTemplateRecord[]> {
  const rows = await db.select().from(docTemplates).orderBy(docTemplates.templateId, desc(docTemplates.version));
  return rows.map(toRecord);
}

/**
 * HUMAN-ONLY. Promote a draft template to approved. Called ONLY from the
 * corpus:approve CLI, which a human runs from their own terminal after confirming
 * the encoding matches the primary Annex text. Claude Code never calls this.
 * Refuses to re-approve an already-approved version.
 */
export async function approveDocTemplate(
  db: DbLike,
  input: { templateId: string; version: number; approvedBy: string; corpusVersion: string },
): Promise<void> {
  const existing = await loadDocTemplate(input.templateId, input.version, db);
  if (!existing) throw new Error(`doc_template ${input.templateId}@${input.version} not found`);
  if (existing.status === "approved") {
    throw new Error(`doc_template ${input.templateId}@${input.version} is already approved`);
  }
  await db
    .update(docTemplates)
    .set({ status: "approved", approvedBy: input.approvedBy, approvedAt: new Date(), corpusVersion: input.corpusVersion })
    .where(and(eq(docTemplates.templateId, input.templateId), eq(docTemplates.version, input.version)));
}
