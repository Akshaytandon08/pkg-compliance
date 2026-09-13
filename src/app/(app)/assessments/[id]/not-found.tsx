import Link from "next/link";

// Inside the gated app, so the reader is a colleague who followed a stale link —
// most often to a demo pack, which the seed deletes and recreates with new ids.
export default function AssessmentNotFound() {
  return (
    <div className="rounded-lg border border-n50 bg-card p-5 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight text-n800">This screening could not be found</h1>
      <p className="mt-2 text-sm leading-relaxed text-n600">
        It may have been removed, or the link may be stale — re-seeding the demo packs deletes and
        recreates them, which changes their ids.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-sky-700 underline">
        Back to all screenings
      </Link>
    </div>
  );
}
