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
  /** The data_version the search was run against — stored with any factor
   *  selected from it, so a value can be re-checked against the release it
   *  actually came from. */
  dataVersion: string;
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

/** Climatiq's own paginated search envelope. */
interface SearchResponse {
  results?: RawResult[];
  current_page?: number;
  last_page?: number;
  total_results?: number;
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
  /** "public" restricts results to factors any key may use. A premium row cannot
   *  be read back at selection time without an entitled key, so a shortlist that
   *  includes them offers choices that cannot be acted on. */
  accessType?: string;
  /** Provider dataset filter, e.g. "BEIS" or "Circular Ecology". Used to check
   *  whether a dataset the owner named is present at all, rather than inferring
   *  absence from a free-text query that simply ranked it away. */
  source?: string;
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
  if (opts.accessType) params.set("access_type", opts.accessType);
  if (opts.source) params.set("source", opts.source);

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

  const payload = (await response.json()) as SearchResponse;
  const dataVersion = opts.dataVersion ?? DEFAULT_DATA_VERSION;
  return (payload.results ?? []).map((r) => toCandidate(r, dataVersion));
}

function toCandidate(r: RawResult, dataVersion: string): FactorCandidate {
  return {
    activityId: r.activity_id ?? "",
    dataVersion,
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
 * Search terms for the materials the demo packs actually contain, as specified
 * by the owner. Each material carries SEVERAL queries: Climatiq's fuzzy match
 * surfaces different datasets for different phrasings, and a single query that
 * happens to miss ICE or BEIS would silently narrow the owner's choice.
 *
 * These are DELIBERATELY finer-grained than the BOM material vocabulary — the
 * owner shortlists against "kraft paper", then decides which BOM material
 * (`corrugated`) that factor should stand for. Keeping the two apart is what
 * stops a search convenience from becoming a modelling decision.
 *
 * `targetNote` records which datasets the owner is looking for, so the shortlist
 * can say plainly when none of them came back rather than leaving the reader to
 * notice an absence.
 */
export const DEMO_MATERIAL_QUERIES: {
  key: string;
  bomMaterial: string;
  queries: string[];
  unitType: string;
  targetNote: string;
  /** Datasets the owner named. Each query is ALSO run filtered to these, because
   *  free-text relevance ranked BEIS material-use off the first page entirely —
   *  reporting "not found" on that basis would have been wrong. */
  targetSources: string[];
}[] = [
  {
    key: "corrugated",
    bomMaterial: "corrugated",
    queries: ["corrugated board", "paper and board packaging", "cardboard"],
    unitType: "Weight",
    targetNote: "target: ICE paper/board; BEIS material use — paper & board",
    targetSources: ["BEIS", "Circular Ecology"],
  },
  {
    key: "kraft_paper",
    bomMaterial: "corrugated",
    queries: ["kraft paper", "paper"],
    unitType: "Weight",
    targetNote: "target: ICE / BEIS",
    targetSources: ["BEIS", "Circular Ecology"],
  },
  {
    key: "ldpe_film",
    bomMaterial: "plastic",
    queries: ["LDPE", "polyethylene low density", "plastics average"],
    unitType: "Weight",
    targetNote: "target: BEIS material use; ICE",
    targetSources: ["BEIS", "Circular Ecology"],
  },
  {
    key: "pet_strap",
    bomMaterial: "plastic",
    queries: ["PET", "polyethylene terephthalate"],
    unitType: "Weight",
    targetNote: "target: BEIS; ICE",
    targetSources: ["BEIS", "Circular Ecology"],
  },
  {
    key: "pine_solid_wood",
    bomMaterial: "wood_solid",
    queries: ["timber softwood", "sawn softwood"],
    unitType: "Weight",
    targetNote: "target: ICE",
    targetSources: ["Circular Ecology"],
  },
  {
    key: "plywood",
    bomMaterial: "wood_processed",
    queries: ["plywood"],
    unitType: "Weight",
    targetNote:
      "owner's pick: ICE v3 0.682 cradle-to-gate. EXCLUDE the -0.933 biogenic-storage variant",
    targetSources: ["Circular Ecology"],
  },
  {
    key: "muf_presswood",
    bomMaterial: "wood_processed",
    queries: ["particle board", "particleboard", "MDF", "medium density fibreboard"],
    unitType: "Weight",
    targetNote:
      "none expected — leave for a Fitsol primary factor. Any hit here is a LABELLED PROXY, not a match",
    targetSources: ["Circular Ecology", "BEIS"],
  },
];
