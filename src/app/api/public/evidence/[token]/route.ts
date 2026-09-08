import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocuments, evidenceRequests } from "@/db/schema";
import { generateStorageKey, getStorageAdapter } from "@/lib/storage";
import { sniffContentType, validateUpload } from "@/lib/evidence-intake/validate";
import { scanForViruses } from "@/lib/evidence-intake/scan";
import { intakeRateLimiter } from "@/lib/evidence-intake/rate-limit";
import { isRequestExpired } from "@/lib/evidence-requests/message";
import { logActivity } from "@/db/activity";

// PUBLIC, token-scoped evidence upload (bypasses the access gate — the token is
// the authorisation). A supplier with no account uploads a PDF/JPG/PNG here. The
// route never discloses assessment detail; it only accepts a file against an open
// request. Content type is sniffed from bytes (client MIME is not trusted), size
// is capped, uploads are rate-limited, and bytes pass the virus-scan hook before
// they are stored.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return Response.json({ error: "Invalid link." }, { status: 404 });
  }

  if (!intakeRateLimiter.take(token)) {
    return Response.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }

  const [req] = await db
    .select()
    .from(evidenceRequests)
    .where(eq(evidenceRequests.token, token))
    .limit(1);
  if (!req || req.status === "cancelled") {
    return Response.json({ error: "This link is not available." }, { status: 404 });
  }
  if (isRequestExpired(req)) {
    if (req.status !== "expired") {
      await db.update(evidenceRequests).set({ status: "expired" }).where(eq(evidenceRequests.id, req.id));
    }
    return Response.json({ error: "This link has expired." }, { status: 410 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "Malformed upload." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "No file provided." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffContentType(bytes);
  const validation = validateUpload({ contentType: sniffed ?? file.type, size: bytes.byteLength });
  if (!validation.ok) {
    const message =
      validation.reason === "too-large"
        ? "File is too large (max 15 MB)."
        : validation.reason === "empty"
          ? "File is empty."
          : "Only PDF, JPG or PNG files are accepted.";
    return Response.json({ error: message }, { status: validation.reason === "too-large" ? 413 : 400 });
  }
  // The sniffed type is authoritative; if it disagrees with a disallowed client
  // MIME we have already rejected above via sniffed ?? file.type.
  if (!sniffed) {
    return Response.json({ error: "Only PDF, JPG or PNG files are accepted." }, { status: 400 });
  }

  const scan = await scanForViruses(bytes);
  if (scan === "infected") {
    return Response.json({ error: "The file failed a security scan." }, { status: 422 });
  }
  if (scan === "unavailable") {
    return Response.json({ error: "Security scan unavailable. Please try again later." }, { status: 503 });
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = generateStorageKey(req.assessmentId, sniffed);
  try {
    await getStorageAdapter().put(storageKey, bytes, sniffed);
  } catch {
    return Response.json({ error: "Could not store the file." }, { status: 502 });
  }

  await db.insert(evidenceDocuments).values({
    assessmentId: req.assessmentId,
    componentId: req.componentId ?? null,
    filename: file.name || "upload",
    contentType: sniffed,
    byteSize: bytes.byteLength,
    sha256,
    storageBackend: getStorageAdapter().backend,
    storageKey,
    source: "magic-link",
    evidenceRequestId: req.id,
  });
  await db.update(evidenceRequests).set({ status: "fulfilled" }).where(eq(evidenceRequests.id, req.id));

  await logActivity(req.assessmentId, {
    kind: "document_received",
    actor: "supplier (magic-link)",
    summary: `Document received: ${file.name || "upload"}`,
    meta: { requestId: req.id, checkpointId: req.checkpointId, contentType: sniffed },
  });

  return Response.json({ ok: true }, { status: 201 });
}
