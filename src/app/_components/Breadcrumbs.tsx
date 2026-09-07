import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Breadcrumb trail for gated pages, e.g. Assessments › <pack> › Report. Long
// names truncate with the full name on hover (title). The last crumb is the
// current page and is not a link.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-n500">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link href={c.href} className="max-w-[16rem] truncate hover:text-n800" title={c.label}>
                {c.label}
              </Link>
            ) : (
              <span className={`max-w-[16rem] truncate ${last ? "text-n700" : ""}`} title={c.label} aria-current={last ? "page" : undefined}>
                {c.label}
              </span>
            )}
            {!last && <span className="text-n300">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
