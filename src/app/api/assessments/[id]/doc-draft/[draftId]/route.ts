import { getDraftFile } from "@/db/doc-drafts";

// Gated download of a stored draft artefact. ?format=docx (attachment, the
// document the manufacturer signs) or ?format=pdf (inline preview). Filenames are
// plain-language (set on the stored row), never internal ids.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; draftId: string }> }) {
  const { draftId } = await params;
  const idNum = Number(draftId);
  if (!Number.isInteger(idNum)) return Response.json({ error: "Invalid draft id." }, { status: 400 });

  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const file = await getDraftFile(idNum, format);
  if (!file) return Response.json({ error: "Draft not found." }, { status: 404 });

  const disposition = format === "pdf" ? "inline" : "attachment";
  return new Response(file.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename="${file.filename}"`,
    },
  });
}
