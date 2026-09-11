// Seeds the emission_factors reference table from reference/emission_factors_seed.csv.
// Idempotent: replaces the whole table each run (reference data, not user data).
// Every seeded row is data_quality 'SEED-ESTIMATE' and names no source, because
// it has none. The report renders that tier as "Screening factor — indicative"
// rather than naming a source it cannot name (see labels.ts factorSourceLabel).
//   Run:  node --env-file=.env scripts/seed-factors.ts
import { readFileSync } from "node:fs";
import { db } from "../src/db/index.ts";
import { emissionFactors } from "../src/db/schema.ts";

const csv = readFileSync(new URL("../reference/emission_factors_seed.csv", import.meta.url), "utf8");
const lines = csv.trim().split("\n");
const header = lines[0].split(",");
const rows = lines.slice(1).map((line) => {
  const cells = line.split(",");
  const rec = Object.fromEntries(header.map((h, i) => [h.trim(), cells[i]?.trim() ?? ""]));
  return {
    material: rec.material,
    process: rec.process,
    factor: Number(rec.factor),
    unit: rec.unit,
    source: rec.source,
    year: Number(rec.year),
    geography: rec.geography,
    dataQuality: rec.data_quality,
    notes: rec.notes || null,
  };
});

if (rows.some((r) => !Number.isFinite(r.factor) || !Number.isInteger(r.year))) {
  console.error("Malformed factor/year in the CSV — aborting.");
  process.exit(1);
}

await db.delete(emissionFactors);
await db.insert(emissionFactors).values(rows);
console.log(`Seeded ${rows.length} emission factors (all SEED-ESTIMATE — indicative, unsourced).`);
process.exit(0);
