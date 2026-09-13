// Recorded readings of each dataset's terms, keyed by the `source` Climatiq
// reports. Full readings with quotes and fetch dates:
// docs/reference/factor-dataset-licences.md
//
// These exist so the shortlist can say, next to a candidate, what its terms
// appear to allow — the decision a reader would otherwise have to go and make
// for every row before knowing whether the row is even usable.
//
// They are INPUT TO the owner's decision, never the decision. `factors:select`
// still requires an explicit --licence-note and --permit-value-display, because
// accepting a licence is a human act and a stale reading must not silently
// become a permission. `readOn` is here so a reading that has aged is visible
// as aged.

export type ValuePublication = "permitted" | "restricted" | "unread";

export interface DatasetLicence {
  /** Matched case-insensitively against Climatiq's `source`. */
  source: string;
  licence: string;
  /** Whether the terms appear to permit republishing the factor VALUE publicly. */
  valuePublication: ValuePublication;
  /** One line a reader can act on. */
  summary: string;
  /** Anything that restricts use beyond attribution — dates, commercial limits. */
  warning?: string;
  termsUrl: string;
  readOn: string; // ISO date
}

export const DATASET_LICENCES: DatasetLicence[] = [
  {
    source: "BEIS",
    licence: "Open Government Licence v3.0",
    valuePublication: "permitted",
    summary: "OGL v3.0 — copy, publish, distribute and adapt, with Crown copyright attribution.",
    termsUrl: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024",
    readOn: "2026-09-13",
  },
  {
    source: "ICM Database",
    licence: "CC-BY 4.0 (UNSW / CRCLCL), open access",
    valuePublication: "permitted",
    summary: "CC-BY 4.0 — share and adapt, including commercially, with credit to CRCLCL.",
    warning:
      "Every ICM row here is AU, 2019, cradle_to_shelf (a WIDER boundary than cradle-to-gate) and carries Climatiq's notable_methodological_variance flag.",
    termsUrl: "https://unsworks.unsw.edu.au/entities/dataset/abbeea2d-0679-45c5-aeb7-54338cafeb08",
    readOn: "2026-09-13",
  },
  {
    source: "Circular Ecology",
    licence: "ICE Database — attribution + link; educational-use transition",
    valuePublication: "restricted",
    summary: "Attribution to Circular Ecology AND a link to the official download page.",
    warning:
      "NON-EDUCATIONAL USE NOT PERMITTED AFTER 2026-09-30; no commercial use of the Educational database or its derivatives. Advanced-version users must not distribute derived works to unregistered parties outside their organisation without written permission — a public passport showing an ICE value is exactly that. Commercial route: IC+ (https://circularecology.com/ic-plus.html).",
    termsUrl: "https://circularecology.com/embodied-carbon-footprint-database.html",
    readOn: "2026-09-13",
  },
];

/** The recorded reading for a Climatiq `source`, or null when none was read. */
export function licenceFor(source: string | null | undefined): DatasetLicence | null {
  const s = (source ?? "").trim().toLowerCase();
  if (!s) return null;
  return DATASET_LICENCES.find((l) => s.includes(l.source.toLowerCase())) ?? null;
}
