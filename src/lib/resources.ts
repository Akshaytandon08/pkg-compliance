// The documents offered from the app nav's Resources menu.
//
// They live in `public/docs/` under their plain-language filenames, so the file
// that lands in the user's Downloads folder is already named the way they would
// name it — `Packaging-Compliance-FAQ.docx`, not `faq_v11_final.docx`. That is
// the same rule `src/lib/doc-export/filename.ts` applies to generated exports.
//
// They are NOT in the access gate's bypass list, and must not be: a bypassed
// path is public, and these are internal guidance. A signed-in user's browser
// sends its Basic Auth credentials with every same-origin request, the download
// included, so the gate never gets in their way — see tests/resources.test.ts,
// which pins both halves of that claim.
//
// Every string here reaches the screen, so it is covered by the language
// guardrail (findLanguageViolations): these describe what a document contains.
// Nothing here may describe this tool as certifying, verifying or declaring.

export interface Resource {
  /** Public path under `public/`. */
  href: string;
  /** What the entry is called in the menu. */
  label: string;
  /** One line saying what is inside, so the menu is readable without opening it. */
  description: string;
  /** Format, version and date — the same line for both, updated when they are. */
  meta: string;
}

const RESOURCE_META = "Word document · v1.1 · 14 Sep 2026";

export const RESOURCES: readonly Resource[] = [
  {
    href: "/docs/Packaging-Compliance-FAQ.docx",
    label: "FAQ — PPWR and this tool",
    description: "Common questions about the regulation and what this screening covers.",
    meta: RESOURCE_META,
  },
  {
    href: "/docs/Packaging-Compliance-User-Guide.docx",
    label: "User guide",
    description: "How to run a screening, add evidence and read the report.",
    meta: RESOURCE_META,
  },
] as const;
