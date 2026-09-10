import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "../_components/Wordmark";
import { AppNav } from "../_components/AppNav";

// The gated application shell: header + nav for every route EXCEPT the public
// passport (which lives outside this route group and so renders on the bare root
// layout). Keeping the nav here is what stops the public passport from emitting
// requests to gated routes.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Skip link: the first focusable element on every gated page, so a keyboard
          or screen-reader user is not forced through the header and nav on each
          navigation. Visible only while focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-p800 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-p600"
      >
        Skip to content
      </a>
      <header className="relative bg-teal text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center" aria-label="pkg-compliance home">
            <Wordmark variant="light" />
          </Link>
          <AppNav />
        </div>
        {/* lang-ok: states what the product is NOT (brief §1) */}
        <p className="bg-p900/40 px-6 py-1.5 text-center text-xs text-white/85">
          Qualification screening and evidence assembly only — not a Declaration of Conformity or certification.
        </p>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
