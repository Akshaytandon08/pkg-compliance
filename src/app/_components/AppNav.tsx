"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { RESOURCES } from "@/lib/resources";

const LINKS = [
  { href: "/", label: "Assessments", match: (p: string) => p === "/" || p.startsWith("/assessments") },
  { href: "/corpus", label: "Corpus", match: (p: string) => p.startsWith("/corpus") },
  { href: "/notifications", label: "Notifications", match: (p: string) => p.startsWith("/notifications") },
];

const RESOURCES_MENU_ID = "app-nav-resources";

/**
 * The Resources dropdown.
 *
 * Kept as its own component so the menu owns its open state and its focus
 * handling, and the surrounding nav keeps none of it. The items are real links
 * to static files, so this is a menu of navigations, not of commands — Enter and
 * Space on an item follow the link natively and nothing here intercepts them.
 *
 * Focus is the whole job: the trigger opens the menu and moves focus INTO it,
 * Escape closes and puts focus back on the trigger, and an outside click closes
 * without stealing focus from wherever the user clicked.
 */
function ResourcesMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openAt = (index: number) => {
    setOpen(true);
    // The items do not exist until this render commits, so the focus call waits
    // a frame rather than reaching for a node that is not mounted yet.
    requestAnimationFrame(() => itemRefs.current[index]?.focus());
  };

  // An outside click closes the menu. Focus is NOT returned here: the user has
  // just chosen somewhere else to be, and yanking focus back to the trigger
  // would undo their own click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? index + 1 : index - 1;
      // Wraps, so the list has no dead ends in either direction.
      const wrapped = (next + RESOURCES.length) % RESOURCES.length;
      itemRefs.current[wrapped]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itemRefs.current[RESOURCES.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      // Tabbing out of the menu is a deliberate exit, not a dismissal to undo.
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={RESOURCES_MENU_ID}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openAt(0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openAt(RESOURCES.length - 1);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            close(true);
          }
        }}
        className="flex items-center gap-1 text-white/75 hover:text-white"
      >
        Resources
        <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          id={RESOURCES_MENU_ID}
          role="menu"
          aria-label="Resources"
          className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {RESOURCES.map((r, i) => (
            <a
              key={r.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitem"
              href={r.href}
              download
              onClick={() => close(false)}
              onKeyDown={(e) => onItemKeyDown(e, i)}
              className="block px-4 py-3 text-left hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
            >
              <span className="block font-medium text-neutral-900">{r.label}</span>
              <span className="mt-0.5 block text-xs text-neutral-600">{r.description}</span>
              <span className="mt-1 block text-xs text-neutral-500">{r.meta}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <ResourcesMenu />
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
          {/* On a phone the two documents are listed inline under a heading: a
              dropdown inside an already-open drawer is a second thing to open
              for no benefit. */}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-white/60">Resources</p>
          {RESOURCES.map((r) => (
            <a
              key={r.href}
              href={r.href}
              download
              onClick={() => setOpen(false)}
              className="py-1.5 text-white/75 hover:text-white"
            >
              <span className="block">{r.label}</span>
              <span className="block text-xs text-white/60">{r.meta}</span>
            </a>
          ))}
          <Link href="/assessments/new" onClick={() => setOpen(false)} className="mt-1 rounded-md bg-p600 px-3 py-1.5 text-center font-medium text-white hover:bg-p700">
            New assessment
          </Link>
        </div>
      )}
    </>
  );
}
