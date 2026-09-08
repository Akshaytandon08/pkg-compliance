import { eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocuments } from "@/db/schema";
import { getStorageAdapter, verifyDownload } from "@/lib/storage";

// Gated, signed, short-lived download of a stored evidence file. This route is
// NOT in the access-gate bypass list, so in production it also requires Basic
// Auth — the signature is defence in depth, never the only gate. A link is valid
// only for the document it was signed for and only until it expires.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return Response.json({ error: "Invalid document id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  const verdict = verifyDownload(documentId, exp, sig);
  if (verdict !== "ok") {
    // 403 for a bad signature, 410 Gone for an expired-but-authentic link.
    const status = verdict === "expired" ? 410 : 403;
    return Response.json({ error: `Link ${verdict}.` }, { status });
  }

  const [doc] = await db
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.id, documentId))
    .limit(1);
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const bytes = await getStorageAdapter().getBytes(doc.storageKey);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": doc.contentType,
        "Content-Length": String(doc.byteSize),
        // Private artefact — never cached by a shared proxy; original filename on save.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.\- ]/g, "_")}"`,
      },
    });
  } catch {
    return Response.json({ error: "Stored file unavailable." }, { status: 502 });
  }
}
