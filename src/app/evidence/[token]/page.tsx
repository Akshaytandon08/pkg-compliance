import { eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceRequests } from "@/db/schema";
import { Wordmark } from "@/app/_components/Wordmark";
import { isRequestExpired } from "@/lib/evidence-requests/message";
import { DropZone } from "./DropZone";

// PUBLIC magic-link intake — reached without the access gate (see src/proxy.ts).
// Deliberately minimal: it discloses NO assessment detail (no pack name, no BOM,
// no identities) — only whether the link is live and an optional free-text note
// the assessor chose to include. Renders on the bare root layout (no app nav).
export const dynamic = "force-dynamic";

export default async function EvidenceIntakePage({ params }: PageProps<"/evidence/[token]">) {
  const { token } = await params;
  const valid = /^[0-9a-f]{32}$/.test(token);
  const [req] = valid
    ? await db.select().from(evidenceRequests).where(eq(evidenceRequests.token, token)).limit(1)
    : [];

  const expired = req ? isRequestExpired(req) : false;
  const unavailable = !req || req.status === "cancelled" || expired;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Wordmark />
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Upload a document</h1>
        {unavailable ? (
          <p className="mt-3 text-sm text-neutral-600">
            {expired
              ? "This link has expired. Please ask your contact for a new one."
              : "This link is not available. Please check the link or ask your contact for a new one."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-600">
              Please upload a supporting document (PDF, JPG or PNG, up to 15 MB). This
              link is private to a single request.
            </p>
            {req.note && (
              <p className="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">{req.note}</p>
            )}
            <div className="mt-4">
              <DropZone token={token} />
            </div>
          </>
        )}
      </div>
      <p className="text-center text-xs text-neutral-400">
        If you did not expect this request, you can ignore this page.
      </p>
    </div>
  );
}
