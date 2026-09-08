import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssessment } from "@/db/assessments";
import { listClaimsForAssessment } from "@/db/claims";
import { listActivity } from "@/db/activity";
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
  const activity = await listActivity(assessmentId);
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

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No activity yet.</p>
        ) : (
          <ol className="mt-2 space-y-2 border-l border-neutral-200 pl-4">
            {activity.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-neutral-300" />
                <p className="text-sm text-neutral-700">{e.summary}</p>
                <p className="text-xs text-neutral-400">
                  {e.at.toISOString().replace("T", " ").slice(0, 16)} · {e.actor}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
