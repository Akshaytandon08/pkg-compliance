// The single status/verdict chip used everywhere (report, list, passport). One
// component, one palette — verdict colours from the Fitsol green/semantic scales,
// the demo tag deliberately in accent-blue so it never reads as a verdict.
export type ChipStatus =
  | "qualified"
  | "conditional"
  | "gap"
  | "not_applicable"
  | "pending" // pending regulatory approval (draft/contested)
  | "demo";

const STYLES: Record<ChipStatus, string> = {
  qualified: "bg-p100 text-p800",
  conditional: "bg-warning-light text-warning-dark",
  gap: "bg-error-light text-error-dark",
  not_applicable: "bg-n50 text-n600",
  pending: "border border-dashed border-n300 bg-n50 text-n600",
  demo: "bg-accent-blue/10 text-accent-blue",
};

const DEFAULT_LABEL: Record<ChipStatus, string> = {
  qualified: "Qualified",
  conditional: "Conditional",
  gap: "Gap",
  not_applicable: "Not applicable",
  pending: "Pending approval",
  demo: "Demonstration data",
};

export function StatusChip({ status, label }: { status: ChipStatus; label?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {label ?? DEFAULT_LABEL[status]}
    </span>
  );
}

/** Normalises a raw verdict/disposition string to a ChipStatus. */
export function toChipStatus(verdict: string): ChipStatus {
  if (verdict === "qualified" || verdict === "conditional" || verdict === "gap") return verdict;
  if (verdict === "not_applicable") return "not_applicable";
  return "pending";
}
