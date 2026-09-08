import { and, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "./index.ts";
import { documentDrafts } from "./schema.ts";
import { getStorageAdapter } from "../lib/storage/index.ts";
import { randomBytes } from "node:crypto";

// Persistence for generated DoC draft artefacts. A draft is stored (docx + pdf
// bytes via the object-storage adapter) and versioned per (assessment, language):
// regenerating supersedes the prior version (kept) and appends a new one with a
// changelog. Status is only ever 'draft' or 'superseded' — never 'issued'.

type DbLike = typeof defaultDb;

export interface StoredDraft {
  id: number;
  assessmentId: number;
  version: number;
  language: string;
  status: "draft" | "superseded";
  changelog: string | null;
  docxFilename: string;
  pdfFilename: string;
  createdAt: Date;
}

function draftKey(assessmentId: number, ext: string): string {
  return `doc-drafts/${assessmentId}/${randomBytes(12).toString("hex")}.${ext}`;
}

export interface StoreDraftInput {
  assessmentId: number;
  templateId: string;
  templateVersion: number;
  corpusVersion: string;
  language: string;
  docx: Buffer;
  pdf: Buffer;
  docxFilename: string;
  pdfFilename: string;
  changelog: string;
  createdBy?: string | null;
}

export async function storeDraft(input: StoreDraftInput, db: DbLike = defaultDb): Promise<StoredDraft> {
  const adapter = getStorageAdapter();
  const docxKey = draftKey(input.assessmentId, "docx");
  const pdfKey = draftKey(input.assessmentId, "pdf");
  await adapter.put(docxKey, input.docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await adapter.put(pdfKey, input.pdf, "application/pdf");

  // Next version for this (assessment, language); supersede the current one.
  const prior = await db
    .select({ version: documentDrafts.version })
    .from(documentDrafts)
    .where(and(eq(documentDrafts.assessmentId, input.assessmentId), eq(documentDrafts.language, input.language)))
    .orderBy(desc(documentDrafts.version))
    .limit(1);
  const version = (prior[0]?.version ?? 0) + 1;

  const [row] = await db.transaction(async (tx) => {
    await tx
      .update(documentDrafts)
      .set({ status: "superseded" })
      .where(
        and(
          eq(documentDrafts.assessmentId, input.assessmentId),
          eq(documentDrafts.language, input.language),
          eq(documentDrafts.status, "draft"),
        ),
      );
    return tx
      .insert(documentDrafts)
      .values({
        assessmentId: input.assessmentId,
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        corpusVersion: input.corpusVersion,
        version,
        language: input.language,
        status: "draft",
        changelog: input.changelog,
        docxStorageKey: docxKey,
        pdfStorageKey: pdfKey,
        docxFilename: input.docxFilename,
        pdfFilename: input.pdfFilename,
        storageBackend: adapter.backend,
        createdBy: input.createdBy ?? null,
      })
      .returning();
  });

  return {
    id: row.id,
    assessmentId: row.assessmentId,
    version: row.version,
    language: row.language,
    status: row.status,
    changelog: row.changelog,
    docxFilename: row.docxFilename,
    pdfFilename: row.pdfFilename,
    createdAt: row.createdAt,
  };
}

export async function listDrafts(assessmentId: number, db: DbLike = defaultDb): Promise<StoredDraft[]> {
  const rows = await db
    .select()
    .from(documentDrafts)
    .where(eq(documentDrafts.assessmentId, assessmentId))
    .orderBy(desc(documentDrafts.createdAt));
  return rows.map((r) => ({
    id: r.id,
    assessmentId: r.assessmentId,
    version: r.version,
    language: r.language,
    status: r.status,
    changelog: r.changelog,
    docxFilename: r.docxFilename,
    pdfFilename: r.pdfFilename,
    createdAt: r.createdAt,
  }));
}

export interface DraftFile {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

export async function getDraftFile(
  draftId: number,
  format: "docx" | "pdf",
  db: DbLike = defaultDb,
): Promise<DraftFile | null> {
  const [row] = await db.select().from(documentDrafts).where(eq(documentDrafts.id, draftId)).limit(1);
  if (!row) return null;
  const key = format === "docx" ? row.docxStorageKey : row.pdfStorageKey;
  const bytes = await getStorageAdapter().getBytes(key);
  return {
    bytes,
    filename: format === "docx" ? row.docxFilename : row.pdfFilename,
    contentType:
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
  };
}
