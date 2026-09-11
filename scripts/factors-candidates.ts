// Emission-factor CANDIDATE SHORTLIST — read-only.
//
//   npm run factors:candidates -- --material <m> [--region EU] [--year 2023]
//                                 [--query "free text"] [--limit 10]
//   npm run factors:candidates -- --all          # every demo material at once
//
// Queries the Climatiq search API and prints the shortlist for the OWNER to
// choose from. It writes NOTHING. Choosing a factor is scripts/factors-select.ts,
// which is human-only for the same reason corpus:approve is: a factor is a claim
// about the physical world that gets printed next to a customer's product, and
// the machine must not make that claim on anyone's behalf.
//
// `--material` accepts either a BOM material (corrugated, plastic, wood_solid,
// wood_processed, metal) or one of the finer demo keys below, which carry a
// tuned search query. The key is a SEARCH convenience — which BOM material the
// chosen factor stands for is decided at selection time, not here.
import { DEMO_MATERIAL_QUERIES, searchFactors, ClimatiqError, DEFAULT_DATA_VERSION } from "../src/lib/factors/climatiq.ts";
import { parseArgs } from "./corpus-lib.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // CLIMATIQ_API_KEY may still be set in the environment
}

const args = parseArgs(process.argv.slice(2));
const all = args.all === true;
const material = typeof args.material === "string" ? args.material : null;
const limit = typeof args.limit === "string" ? Number(args.limit) : 10;
const region = typeof args.region === "string" ? args.region : undefined;
const year = typeof args.year === "string" ? Number(args.year) : undefined;
const queryOverride = typeof args.query === "string" ? args.query : null;

if (!all && !material) {
  console.error("Usage: npm run factors:candidates -- --material <m> [--region EU] [--year 2023] [--query \"…\"]");
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
        query: queryOverride ?? material!.replace(/_/g, " "),
        unitType: "Weight",
      },
    ];

console.log(`Climatiq data_version ${DEFAULT_DATA_VERSION} — candidate shortlists`);
console.log("Read-only. Nothing is stored. Choose with:");
console.log('  npm run factors:select -- --material <bom-material> --activity-id <id> --selected-by "Akshay Tandon"\n');

let failures = 0;
for (const target of targets) {
  const query = queryOverride && !all ? queryOverride : target.query;
  console.log("─".repeat(78));
  console.log(`${target.key}   →  BOM material: ${target.bomMaterial}`);
  console.log(`query: "${query}"${region ? `  region: ${region}` : ""}${year ? `  year: ${year}` : ""}`);
  console.log("─".repeat(78));
  try {
    const results = await searchFactors({
      query,
      region,
      year,
      unitType: target.unitType,
      resultsPerPage: Number.isFinite(limit) ? limit : 10,
    });
    if (results.length === 0) {
      console.log("  (no candidates — widen the query or drop the region/year filter)\n");
      continue;
    }
    for (const [i, r] of results.entries()) {
      const value = r.factor != null ? `${r.factor} ${r.unit ?? ""}`.trim() : "value not returned by search";
      console.log(`  [${i + 1}] ${r.activityId}`);
      console.log(`      ${r.name}`);
      console.log(`      dataset:  ${r.source}${r.sourceDataset ? ` / ${r.sourceDataset}` : ""}`);
      console.log(`      region:   ${r.region}${r.regionName ? ` (${r.regionName})` : ""}    year: ${r.year}`);
      console.log(`      value:    ${value}${r.unitType ? `   [${r.unitType}]` : ""}`);
      if (r.lcaActivity) console.log(`      boundary: ${r.lcaActivity}`);
      if (r.accessType) console.log(`      access:   ${r.accessType}`);
      if (r.qualityFlags.length) console.log(`      ⚠ flags:  ${r.qualityFlags.join(", ")}`);
      if (r.sourceLink) console.log(`      terms:    ${r.sourceLink}`);
      console.log("");
    }
  } catch (err) {
    failures++;
    console.error(`  FAILED: ${err instanceof ClimatiqError ? err.message : String(err)}\n`);
  }
}

console.log("─".repeat(78));
console.log("Before selecting, read the dataset's licence terms and record what they say");
console.log("about republishing the VALUE (--licence-note / --permit-value-display).");
console.log("The public passport shows the computed result and the source NAME only,");
console.log("unless you have said the terms allow the value itself.");
process.exit(failures > 0 ? 1 : 0);
