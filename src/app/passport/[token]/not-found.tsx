import { Wordmark } from "@/app/_components/Wordmark";

// A passport is reached by QR from a printed label, so the most likely way to
// land here is a mistyped or superseded token — not a broken link. The framework
// default ("404 — This page could not be found") tells that reader nothing and
// carries no sign they are in the right place at all.
export default function PassportNotFound() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Wordmark />
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">This passport could not be found</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          The link may have been mistyped, or the packaging may have been re-screened since this code
          was printed — a new screening publishes a new passport.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Ask whoever supplied the packaging for the current passport link. Nothing is wrong with the
          packaging itself: this page says only that no passport exists at this address.
        </p>
      </div>
    </div>
  );
}
