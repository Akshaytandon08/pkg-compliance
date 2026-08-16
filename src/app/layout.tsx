import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pkg-compliance",
  description:
    "Packaging compliance qualification screening and evidence assembly",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              pkg-compliance
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
              <Link href="/" className="hover:text-neutral-900 dark:hover:text-white">
                Assessments
              </Link>
              <Link
                href="/assessments/new"
                className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                New assessment
              </Link>
            </nav>
          </div>
          {/* lang-ok: states what the product is NOT (brief §1) */}
          <p className="bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Qualification screening and evidence assembly only — not a Declaration of Conformity or certification.
          </p>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
