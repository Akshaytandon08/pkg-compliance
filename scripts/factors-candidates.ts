// Emission-factor CANDIDATE SHORTLIST — read-only.
//
//   npm run factors:candidates -- --all [--access public] [--limit 5]
//   npm run factors:candidates -- --material ldpe_film [--query "free text"]
//                                 [--region EU] [--year 2023] [--data-version ^36]
//
// Queries the Climatiq search API and prints the shortlist for the OWNER to
// choose from. It writes NOTHING. Choosing a factor is scripts/factors-select.ts,
// which is human-only for the same reason corpus:approve is: a factor is a claim
// about the physical world that gets printed next to a customer's product, and
// the machine must not make that claim on anyone's behalf.
//
// Each material runs SEVERAL queries (see DEMO_MATERIAL_QUERIES) because
// Climatiq's fuzzy match surfaces different datasets for different phrasings.
// Results are merged on activity_id and printed in the order the provider
// returned them — this script does not rank, score or pre-select, because a
// shortlist that quietly promotes one row is a choice made by the machine.
//
// `--material` accepts either a BOM material or one of the finer demo keys. The
// key is a SEARCH convenience — which BOM material the chosen factor stands for
// is decided at selection time, not here.
import {
  DEMO_MATERIAL_QUERIES,
  searchFactors,
  ClimatiqError,
  DEFAULT_DATA_VERSION,
  type FactorCandidate,
} from "../src/lib/factors/climatiq.ts";
import { parseArgs } from "./corpus-lib.ts";
import {
  CANONICAL_MASS_UNIT,
  UnitError,
  isCarbonStorageVariant,
  isProductionBoundary,
  toPerKilogram,
} from "../src/lib/factors/units.ts";
import { licenceFor } from "../src/lib/factors/licences.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // CLIMATIQ_API_KEY may still be set in the environment
}

const args = parseArgs(process.argv.slice(2));
const all = args.all === true;
const material = typeof args.material === "string" ? args.material : null;
const limit = typeof args.limit === "string" ? Number(args.limit) : 5;
const region = typeof args.region === "string" ? args.region : undefined;
const year = typeof args.year === "string" ? Number(args.year) : undefined;
const queryOverride = typeof args.query === "string" ? args.query : null;
const includeUnusable = args["include-unusable"] === true;
const dataVersion = typeof args["data-version"] === "string" ? args["data-version"] : DEFAULT_DATA_VERSION;
// Default to PUBLIC: a premium row cannot be read back at selection time without
// an entitled key, so listing one offers a choice that cannot be acted on.
const accessType = args.access === false || args.access === "any" ? undefined : (typeof args.access === "string" ? args.access : "public");

if (!all && !material) {
  console.error('Usage: npm run factors:candidates -- --material <m> [--access public] [--limit 5]');
  console.error("       npm run factors:candidates -- --all");
  console.error(`\nDemo materials: ${DEMO_MATERIAL_QUERIES.map((m) => m.key).join(", ")}`);
  process.exit(1);
}

if (!process.env.CLIMATIQ_API_KEY) {
  console.error("CLIMATIQ_API_KEY is not set.");
  console.error("Add it to .env (owner-supplied). This tool cannot search without it, and it will");
  console.error("not invent candidates — an emission factor with no provider behind it is not data.");
  process.exit(1);
}

const targets = all
  ? DEMO_MATERIAL_QUERIES
  : [
      DEMO_MATERIAL_QUERIES.find((m) => m.key === material) ?? {
        key: material!,
        bomMaterial: material!,
        queries: [queryOverride ?? material!.replace(/_/g, " ")],
        unitType: "Weight",
        targetNote: "",
        targetSources: [],
      },
    ];

console.log(`Climatiq search — data_version ${dataVersion}, access_type ${accessType ?? "any"}`);
console.log("Read-only. Nothing is stored. Choose with:");
console.log('  npm run factors:select -- --material <bom-material> --activity-id <id> --selected-by "Akshay Tandon"\n');

/** What the value becomes once converted to the unit the engine uses, or why it
 *  cannot be. Shown on the shortlist so a row that would be refused at selection
 *  is visible BEFORE the owner picks it. */
function perKg(r: FactorCandidate): string {
  if (r.factor == null) return "";
  try {
    const c = toPerKilogram(r.factor, r.unit);
    return c.note ? `   →  ${Number(c.factor.toPrecision(6))} ${CANONICAL_MASS_UNIT}` : "";
  } catch (err) {
    return `   →  CANNOT CONVERT: ${err instanceof UnitError ? "unrecognised unit" : "bad value"}`;
  }
}

function line(r: FactorCandidate, i: number) {
  const value = r.factor != null ? `${r.factor} ${r.unit ?? ""}`.trim() : "value not returned by search";
  const storage = isCarbonStorageVariant(r.lcaActivity);
  const production = isProductionBoundary(r.lcaActivity);
  console.log(`  [${i}] ${r.activityId}`);
  console.log(`      ${r.name}`);
  console.log(`      value:    ${value}${r.unitType ? `   [${r.unitType}]` : ""}${perKg(r)}`);
  console.log(
    `      boundary: ${r.lcaActivity ?? "not stated"}` +
      (storage
        ? "   ✗ CARBON STORAGE variant — not comparable with cradle-to-gate; selection refuses it"
        : production
          ? ""
          : "   ✗ NOT a production boundary — selection refuses it without --allow-boundary"),
  );
  console.log(`      dataset:  ${r.source}${r.sourceDataset ? ` / ${r.sourceDataset}` : ""}`);
  console.log(`      region:   ${r.region}${r.regionName ? ` (${r.regionName})` : ""}    year: ${r.year}`);
  console.log(`      access:   ${r.accessType ?? "unstated"}    data_version: ${r.dataVersion}`);
  if (r.qualityFlags.length) console.log(`      ⚠ flags:  ${r.qualityFlags.join(", ")}`);
  console.log(`      terms:    ${r.sourceLink ?? "no source link returned"}`);
  // Recorded reading of this dataset's terms (docs/reference/factor-dataset-licences.md).
  // Input to the owner's decision — factors:select still requires an explicit
  // --licence-note and --permit-value-display.
  const lic = licenceFor(r.source);
  if (lic) {
    const mark = lic.valuePublication === "permitted" ? "✓" : "✗";
    console.log(`      licence:  ${mark} ${lic.licence} (read ${lic.readOn})`);
    console.log(`                ${lic.summary}`);
    if (lic.warning) console.log(`                ⚠ ${lic.warning}`);
  } else {
    console.log("      licence:  not yet read — read the terms link before selecting");
  }
  console.log("");
}

let failures = 0;
for (const target of targets) {
  const queries = queryOverride && !all ? [queryOverride] : target.queries;
  console.log("═".repeat(78));
  console.log(`${target.key}   →  BOM material: ${target.bomMaterial}`);
  if (target.targetNote) console.log(`${target.targetNote}`);
  console.log(`queries: ${queries.map((q) => `"${q}"`).join(", ")}${region ? `  region: ${region}` : ""}${year ? `  year: ${year}` : ""}`);
  if (target.targetSources.length) console.log(`also run filtered to: ${target.targetSources.join(", ")}`);
  console.log("═".repeat(78));

  // Merge across the material's queries on activity_id, preserving first-seen
  // order. Climatiq ranks within one query; across queries there is no common
  // ranking, and inventing one would be this script making the choice.
  const merged = new Map<string, FactorCandidate>();
  // Named target datasets FIRST, so a dataset the owner asked for cannot be
  // ranked off the list by free-text relevance — which is exactly what happened
  // to BEIS material-use on the unfiltered pass.
  const passes: { query: string; source?: string }[] = [
    ...target.targetSources.flatMap((source) => queries.map((query) => ({ query, source }))),
    ...queries.map((query) => ({ query })),
  ];
  for (const pass of passes) {
    try {
      const results = await searchFactors({
        query: pass.query,
        source: pass.source,
        region,
        year,
        unitType: target.unitType,
        accessType,
        dataVersion,
        resultsPerPage: 20,
      });
      for (const r of results) {
        // BEIS republishes the SAME activity_id every year. Deduplicating on
        // first-seen would offer the owner an arbitrary old revision (2018) of a
        // row the provider has since restated — so keep the newest year. This is
        // deduplication, not ranking: it picks between copies of one row, never
        // between different rows.
        const held = merged.get(r.activityId);
        if (!held || r.year > held.year) merged.set(r.activityId, r);
      }
    } catch (err) {
      failures++;
      console.error(
        `  query "${pass.query}"${pass.source ? ` [${pass.source}]` : ""} FAILED: ` +
          `${err instanceof ClimatiqError ? err.message : String(err)}\n`,
      );
    }
  }

  // Drop the rows `factors:select` would refuse anyway: a wrong system boundary,
  // a carbon-storage variant, or a unit that cannot be converted to per-kg. This
  // is NOT ranking — the script still does not prefer one valid candidate over
  // another — it is declining to offer choices that cannot be acted on. A search
  // for "cardboard" returns more waste-disposal rows than production rows, and
  // they would otherwise fill the shortlist.
  const usable = (r: FactorCandidate) => {
    if (!isProductionBoundary(r.lcaActivity) || isCarbonStorageVariant(r.lcaActivity)) return false;
    if (r.factor == null) return false;
    try {
      toPerKilogram(r.factor, r.unit);
      return true;
    } catch {
      return false;
    }
  };
  const all_ = [...merged.values()];
  const shown = includeUnusable ? all_ : all_.filter(usable);
  const suppressed = all_.length - shown.length;
  const rows = shown.slice(0, Number.isFinite(limit) ? limit : 5);

  if (rows.length === 0) {
    console.log(
      suppressed > 0
        ? `  (no usable public candidates — ${suppressed} match(es) suppressed: wrong system boundary,\n` +
            "   carbon-storage variant, or a unit that cannot be converted. --include-unusable to see them)\n"
        : "  (no public candidates for any of these queries)\n",
    );
    continue;
  }
  rows.forEach((r, i) => line(r, i + 1));
  if (shown.length > rows.length) {
    console.log(`  … ${shown.length - rows.length} further usable match(es) not shown (--limit ${limit}).`);
  }
  if (suppressed > 0 && !includeUnusable) {
    console.log(
      `  … ${suppressed} match(es) suppressed — selection would refuse them (wrong boundary,\n` +
        "    carbon-storage variant, or unconvertible unit). --include-unusable to see them.",
    );
  }
  console.log("");
}

console.log("═".repeat(78));
console.log("Before selecting, read the dataset's licence terms (the `terms:` link above) and");
console.log('record what they say about republishing the VALUE: --licence-note "…" and, only if');
console.log("they permit it, --permit-value-display. The public passport shows the computed");
console.log("result and the source NAME by default, never the licensed value.");
process.exit(failures > 0 ? 1 : 0);
