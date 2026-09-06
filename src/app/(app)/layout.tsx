import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "../_components/Wordmark";

// The gated application shell: header + nav for every route EXCEPT the public
// passport (which lives outside this route group and so renders on the bare root
// layout). Keeping the nav here is what stops the public passport from emitting
// requests to gated routes.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="bg-teal text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center" aria-label="pkg-compliance home">
            <Wordmark variant="light" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="text-white/80 hover:text-white">
              Assessments
            </Link>
            <Link href="/corpus" className="text-white/80 hover:text-white">
              Corpus
            </Link>
            <Link
              href="/assessments/new"
              className="rounded-md bg-p600 px-3 py-1.5 font-medium text-white hover:bg-p700"
            >
              New assessment
            </Link>
          </nav>
        </div>
        {/* lang-ok: states what the product is NOT (brief §1) */}
        <p className="bg-p900/40 px-6 py-1.5 text-center text-xs text-white/85">
          Qualification screening and evidence assembly only — not a Declaration of Conformity or certification.
        </p>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
