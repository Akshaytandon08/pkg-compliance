// The single status/verdict chip used everywhere (report, list, passport). One
// component, one palette — verdict colours from the Fitsol green/semantic scales,
// the demo tag deliberately in accent-blue so it never reads as a verdict.
export type ChipStatus =
  | "qualified"
  | "conditional"
  | "gap"
  | "not_applicable"
  | "pending" // pending regulatory approval (draft/contested)
  | "upcoming" // exists, but does not apply yet as of the screening date
  | "demo";

const STYLES: Record<ChipStatus, string> = {
  qualified: "bg-p100 text-p800",
  conditional: "bg-warning-light text-warning-dark",
  gap: "bg-error-light text-error-dark",
  not_applicable: "bg-n50 text-n600",
  pending: "border border-dashed border-n300 bg-n50 text-n600",
  // Informational, deliberately NOT a warning colour: a future requirement is
  // not something outstanding today. Dashed border marks it as not-yet-live.
  upcoming: "border border-dashed border-accent-blue/40 bg-accent-blue/5 text-accent-blue",
  demo: "bg-accent-blue/10 text-accent-blue",
};

const DEFAULT_LABEL: Record<ChipStatus, string> = {
  qualified: "Qualified",
  conditional: "Conditional",
  gap: "Gap",
  not_applicable: "Not applicable",
  pending: "Pending approval",
  upcoming: "Upcoming",
  demo: "Demonstration data",
};

export function StatusChip({
  status,
  label,
  ariaLabel,
}: {
  status: ChipStatus;
  label?: string;
  /** Accessible name. Colour carries meaning for sighted readers, so a chip
   *  should state its subject as well as its value to a screen reader. */
  ariaLabel?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
      {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : {})}
    >
      {label ?? DEFAULT_LABEL[status]}
    </span>
  );
}

/** Normalises a raw verdict/disposition string to a ChipStatus. */
export function toChipStatus(verdict: string): ChipStatus {
  if (verdict === "qualified" || verdict === "conditional" || verdict === "gap") return verdict;
  if (verdict === "not_applicable") return "not_applicable";
  // `upcoming` must not fall through to "pending" — "Pending approval" would say
  // the rule is unapproved, when in fact it is approved and simply future-dated.
  if (verdict === "upcoming") return "upcoming";
  return "pending";
}
