// Climatiq search adapter. READ-ONLY: it looks factors up and returns
// candidates. It never writes one — choosing a factor is a human act, the same
// discipline as corpus approval (AGENTS.md), because a factor is a claim about
// the physical world that will be printed next to a customer's product.
//
// API shape pinned to the Climatiq Data API reference:
//   GET https://api.climatiq.io/data/v1/search
//   Authorization: Bearer <CLIMATIQ_API_KEY>
//   required: data_version; plus query / region / year / unit_type / … filters
//
// The key is read from the environment by this module and never logged, never
// echoed into an error message, and never written to a stored row.

const SEARCH_URL = "https://api.climatiq.io/data/v1/search";

/** Climatiq's data version selector. `^N` pins a major and takes its latest
 *  minor — the provider's own recommendation for production use. Overridable so
 *  a stored factor can be re-checked against the version it came from. */
export const DEFAULT_DATA_VERSION = process.env.CLIMATIQ_DATA_VERSION ?? "^21";

export interface FactorCandidate {
  activityId: string;
  name: string;
  source: string;
  sourceDataset: string | null;
  region: string;
  regionName: string | null;
  year: number;
  factor: number | null;
  unit: string | null;
  unitType: string | null;
  /** Provider's own quality flags, e.g. "notable_methodological_variance". */
  qualityFlags: string[];
  /** "public" | "premium" — a premium row needs an entitled key to estimate. */
  accessType: string | null;
  sourceLink: string | null;
  lcaActivity: string | null;
  description: string | null;
}

interface RawResult {
  activity_id?: string;
  name?: string;
  source?: string;
  source_dataset?: string;
  source_link?: string;
  region?: string;
  region_name?: string;
  year?: number;
  factor?: number;
  unit?: string;
  unit_type?: string;
  data_quality_flags?: string[];
  access_type?: string;
  source_lca_activity?: string;
  description?: string;
}

export class ClimatiqError extends Error {}

function apiKey(): string {
  const key = process.env.CLIMATIQ_API_KEY;
  if (!key) {
    throw new ClimatiqError(
      "CLIMATIQ_API_KEY is not set. Add it to .env (owner-supplied) — this tool cannot search without it.",
    );
  }
  return key;
}

export interface SearchOptions {
  query: string;
  region?: string;
  year?: number;
  unitType?: string;
  resultsPerPage?: number;
  dataVersion?: string;
  /** Injected in tests; defaults to global fetch. Keeps the unit tests offline. */
  fetchImpl?: typeof fetch;
}

/**
 * Search Climatiq for candidate factors. Returns them in the provider's own
 * relevance order — this module does NOT rank, score or pre-select, because a
 * shortlist that quietly promotes one row is a choice made by the machine.
 */
export async function searchFactors(opts: SearchOptions): Promise<FactorCandidate[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    data_version: opts.dataVersion ?? DEFAULT_DATA_VERSION,
    query: opts.query,
    results_per_page: String(opts.resultsPerPage ?? 10),
  });
  if (opts.region) params.set("region", opts.region);
  if (opts.year) params.set("year", String(opts.year));
  if (opts.unitType) params.set("unit_type", opts.unitType);

  let response: Response;
  try {
    response = await doFetch(`${SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
  } catch (err) {
    // Never interpolate the key or the Authorization header into an error.
    throw new ClimatiqError(`Climatiq search request failed: ${err instanceof Error ? err.message : "network error"}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ClimatiqError(
      `Climatiq search returned HTTP ${response.status}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }

  const payload = (await response.json()) as { results?: RawResult[] };
  return (payload.results ?? []).map(toCandidate);
}

function toCandidate(r: RawResult): FactorCandidate {
  return {
    activityId: r.activity_id ?? "",
    name: r.name ?? "",
    source: r.source ?? "",
    sourceDataset: r.source_dataset ?? null,
    region: r.region ?? "",
    regionName: r.region_name ?? null,
    year: r.year ?? 0,
    factor: typeof r.factor === "number" ? r.factor : null,
    unit: r.unit ?? null,
    unitType: r.unit_type ?? null,
    qualityFlags: r.data_quality_flags ?? [],
    accessType: r.access_type ?? null,
    sourceLink: r.source_link ?? null,
    lcaActivity: r.source_lca_activity ?? null,
    description: r.description ?? null,
  };
}

/**
 * Free-text search terms for the materials the demo packs actually contain.
 * These are DELIBERATELY finer-grained than the BOM material vocabulary — the
 * owner shortlists against "kraft liner", then decides which BOM material
 * (`corrugated`) that factor should stand for. Keeping the two apart is what
 * stops a search convenience from silently becoming a modelling decision.
 */
export const DEMO_MATERIAL_QUERIES: { key: string; bomMaterial: string; query: string; unitType: string }[] = [
  { key: "corrugated_b_flute", bomMaterial: "corrugated", query: "corrugated board packaging", unitType: "Weight" },
  { key: "kraft_liner", bomMaterial: "corrugated", query: "kraftliner paper production", unitType: "Weight" },
  { key: "ldpe_film", bomMaterial: "plastic", query: "low density polyethylene film", unitType: "Weight" },
  { key: "pet_strap", bomMaterial: "plastic", query: "polyethylene terephthalate granulate", unitType: "Weight" },
  { key: "pine_solid_wood", bomMaterial: "wood_solid", query: "sawnwood softwood pine", unitType: "Weight" },
  { key: "plywood", bomMaterial: "wood_processed", query: "plywood production", unitType: "Weight" },
  { key: "muf_presswood", bomMaterial: "wood_processed", query: "melamine urea formaldehyde particleboard", unitType: "Weight" },
];
