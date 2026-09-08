import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssessment } from "@/db/assessments";
import { listClaimsForAssessment } from "@/db/claims";
import { signDownload, downloadPath } from "@/lib/storage";
import { ClaimReview } from "./ClaimReview";

// Gated review of extracted claims for an assessment. A claim is EVIDENCE awaiting
// a human's Confirm; the provenance link opens the source document (signed,
// short-lived, still behind the access gate). Manual entry stays available on the
// report — this surface only reviews what extraction proposed.
export const dynamic = "force-dynamic";

export default async function ClaimReviewPage({ params }: PageProps<"/assessments/[id]/evidence">) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isInteger(assessmentId)) notFound();

  const assessment = await getAssessment(assessmentId);
  if (!assessment) notFound();

  const claims = await listClaimsForAssessment(assessmentId);
  // Sign a short-lived source link per distinct document, server-side.
  const withSource = claims.map((c) => {
    const signed = signDownload(c.documentId);
    return { ...c, sourceUrl: downloadPath(c.documentId, signed) };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href={`/assessments/${assessmentId}/report`} className="text-sm text-neutral-500 hover:underline">
          ← Back to report
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Extracted claims — {assessment.packName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Each value below was read from a document by the extractor. Nothing here affects a
          verdict until you confirm it. Confirming attaches it as evidence and re-evaluates on
          the report.
        </p>
      </div>

      {withSource.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          No extracted claims yet. Upload a document (via a request link or manually) and run
          extraction to populate this list.
        </p>
      ) : (
        <ClaimReview
          assessmentId={assessmentId}
          claims={withSource}
          components={assessment.components.map((c) => ({ id: c.id, name: c.name, material: c.material }))}
        />
      )}
    </div>
  );
}
