import Link from "next/link";
import { getNotifications } from "@/db/notifications";
import { isDigestEnabled, type NotificationKind } from "@/lib/notifications/digest";

// Gated in-app notifications. Derived from live state: documents awaiting
// extraction, claims awaiting confirmation, evidence expiring within 60 days.
export const dynamic = "force-dynamic";

const SECTIONS: { kind: NotificationKind; label: string; accent: string }[] = [
  { kind: "awaiting_confirmation", label: "Awaiting confirmation", accent: "text-amber-700" },
  { kind: "received", label: "Documents received", accent: "text-sky-700" },
  { kind: "expiring", label: "Expiring within 60 days", accent: "text-red-700" },
];

export default async function NotificationsPage() {
  const items = await getNotifications();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Outstanding items across all assessments.{" "}
          {isDigestEnabled()
            ? "A digest email is enabled."
            : "Email digest is off (set a mail transport + NOTIFICATIONS_DIGEST=1 to enable)."}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          Nothing needs attention right now.
        </p>
      ) : (
        SECTIONS.map(({ kind, label, accent }) => {
          const group = items.filter((i) => i.kind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind}>
              <h2 className={`text-sm font-semibold uppercase tracking-wide ${accent}`}>
                {label} ({group.length})
              </h2>
              <ul className="mt-2 space-y-2">
                {group.map((i, idx) => (
                  <li
                    key={`${kind}-${i.assessmentId}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <span>
                      <span className="font-medium text-neutral-800">{i.packName}</span>
                      <span className="text-neutral-600"> — {i.detail}</span>
                      {i.date && <span className="text-neutral-400"> · {i.date}</span>}
                    </span>
                    <Link
                      href={`/assessments/${i.assessmentId}/${kind === "expiring" ? "report" : "evidence"}`}
                      className="text-neutral-500 hover:underline"
                    >
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
