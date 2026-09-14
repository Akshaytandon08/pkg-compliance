import type { Metadata } from "next";

// The intake page is a client component, so its title lives here: `metadata` is
// server-only and a "use client" module cannot export it.
export const metadata: Metadata = {
  title: "New assessment",
};

export default function NewAssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
