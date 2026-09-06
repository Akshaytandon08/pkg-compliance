"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Assessments", match: (p: string) => p === "/" || p.startsWith("/assessments") },
  { href: "/corpus", label: "Corpus", match: (p: string) => p.startsWith("/corpus") },
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (active: boolean) =>
    active ? "text-white font-medium" : "text-white/75 hover:text-white";

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-5 text-sm sm:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.match(pathname))} aria-current={l.match(pathname) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
        <Link href="/assessments/new" className="rounded-md bg-p600 px-3 py-1.5 font-medium text-white hover:bg-p700">
          New assessment
        </Link>
      </nav>

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-white sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile menu panel */}
      {open && (
        <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-1 bg-teal px-6 py-3 text-sm sm:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`py-1.5 ${linkClass(l.match(pathname))}`}>
              {l.label}
            </Link>
          ))}
          <Link href="/assessments/new" onClick={() => setOpen(false)} className="mt-1 rounded-md bg-p600 px-3 py-1.5 text-center font-medium text-white hover:bg-p700">
            New assessment
          </Link>
        </div>
      )}
    </>
  );
}
