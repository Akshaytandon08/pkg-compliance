import Link from "next/link";
import { listAssessments } from "@/db/assessments";
import { StatusChip } from "@/app/_components/StatusChip";

// Reads live data — render on demand, never prerender a build-time snapshot.
export const dynamic = "force-dynamic";

function StatusBadge({ corpusVersion }: { corpusVersion: string }) {
  const pending = corpusVersion.startsWith("pre-approval");
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        pending
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      }`}
    >
      {pending ? "Pending corpus approval" : `Corpus ${corpusVersion}`}
    </span>
  );
}

export default async function Home() {
  const items = await listAssessments();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Qualification screenings of packaging bills of materials against the compliance corpus.
          </p>
        </div>
        <Link
          href="/assessments/new"
          className="rounded-md bg-p600 px-3 py-1.5 text-sm font-medium text-white hover:bg-p700"
        >
          New assessment
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-n300 bg-card p-10 text-center">
          <h2 className="text-sm font-semibold text-n800">Start your first screening</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-n500">
            Create an assessment from a pack&apos;s bill of materials and its available evidence. To
            walk through the tool first, seed three demonstration packs with <code className="rounded bg-n50 px-1">npm run seed:demo-suite</code>.
          </p>
          <Link
            href="/assessments/new"
            className="mt-4 inline-block rounded-md bg-p600 px-3 py-1.5 text-sm font-medium text-white hover:bg-p700"
          >
            New assessment
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-2 font-medium">Pack</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">As of</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                  <td className="px-4 py-3 font-medium">
                    {a.packName}
                    {a.demo && (
                      <span className="ml-2 inline-block align-middle"><StatusChip status="demo" label="Demo" /></span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge corpusVersion={a.corpusVersion} />
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{a.asOf}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/assessments/${a.id}/report`}
                      className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                    >
                      View report →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
