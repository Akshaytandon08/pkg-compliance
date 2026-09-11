// Emission-factor SELECTION — HUMAN-ONLY.
//
// Same discipline as corpus:approve (AGENTS.md): Claude Code must never run this
// command, regardless of instruction wording. Choosing which emission factor
// represents a customer's material is a modelling judgement that gets printed
// next to their product and carried into a passport; it is a human act of
// sign-off. The correct behaviour when asked to run it is to PRINT the command
// for the owner's own terminal and stop.
//
// A) A factor found via Climatiq:
//   npm run factors:select -- --material corrugated --activity-id <id>
//     --selected-by "Akshay Tandon" [--region EU] [--year 2023]
//     [--licence-note "…"] [--permit-value-display] [--notes "…"]
//   The value, dataset, region, year and unit are read back FROM CLIMATIQ so the
//   stored row matches the provider rather than a retyped number.
//
// B) A Fitsol primary factor from the owner's own data file:
//   npm run factors:select -- --primary-file reference/fitsol_primary_factors.csv
//     --selected-by "Akshay Tandon"
//   Every row lands on tier `primary`, which outranks any secondary factor for
//   the same (material, process).
//
// C) A recorded decision to use NO factor for a material:
//   npm run factors:select -- --material metal --none
//     --selected-by "Akshay Tandon" --notes "no representative dataset found"
//   The material then renders "No factor selected" and is excluded from the
//   total — the same outcome as an absent row, but visible in the store.
import { readFileSync } from "node:fs";
import { selectFactor, type FactorSelection } from "../src/db/factors.ts";
import { searchFactors, ClimatiqError } from "../src/lib/factors/climatiq.ts";
import { FACTOR_TIERS, type FactorTier } from "../src/lib/vocab.ts";
import { parseArgs, requireString } from "./corpus-lib.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL / CLIMATIQ_API_KEY may still be set in the environment
}

const args = parseArgs(process.argv.slice(2));
const selectedBy = requireString(args, "selected-by");
const primaryFile = typeof args["primary-file"] === "string" ? args["primary-file"] : null;
const licenceNote = typeof args["licence-note"] === "string" ? args["licence-note"] : null;
const permitValueDisplay = args["permit-value-display"] === true;
const notes = typeof args.notes === "string" ? args.notes : null;

if (permitValueDisplay && !licenceNote) {
  console.error("--permit-value-display requires --licence-note: record WHICH terms permit it.");
  console.error("A licensing decision must be traceable to the sentence it came from.");
  process.exit(1);
}

function report(what: string, row: { id: number; version: number }, s: FactorSelection) {
  console.log(
    `selected ${what}: ${s.material}/${s.process} v${row.version} (#${row.id}) — ` +
      `${s.tier === "none" ? "NO FACTOR" : `${s.factor} ${s.unit}`} · ${s.source}` +
      `${s.sourceDataset ? ` / ${s.sourceDataset}` : ""} · ${s.region} · ${s.year}`,
  );
}

// --- B) Fitsol primary factors from the owner's file ------------------------
if (primaryFile) {
  const csv = readFileSync(primaryFile, "utf8").trim();
  const [headerLine, ...lines] = csv.split("\n");
  const header = headerLine.split(",").map((h) => h.trim());
  const required = ["material", "process", "factor", "unit", "region", "year"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    console.error(`${primaryFile} is missing required column(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  if (lines.length === 0) {
    console.error(`${primaryFile} has a header but no rows — nothing to select.`);
    console.error("This file is owner-supplied; it ships empty on purpose (see its README note).");
    process.exit(1);
  }
  let n = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(",");
    const rec = Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
    const factor = Number(rec.factor);
    const year = Number(rec.year);
    if (!Number.isFinite(factor) || !Number.isInteger(year)) {
      console.error(`Malformed factor/year in row: ${line}`);
      process.exit(1);
    }
    const selection: FactorSelection = {
      material: rec.material,
      process: rec.process,
      factor,
      unit: rec.unit,
      tier: "primary",
      source: rec.source || "Fitsol",
      sourceDataset: rec.source_dataset || null,
      activityId: null,
      region: rec.region,
      year,
      methodology: rec.methodology || null,
      retrievedAt: new Date(),
      licenceNote: rec.licence_note || licenceNote,
      // Fitsol's own data: the terms are Fitsol's to set, so the file may say so
      // per row. Absent, it stays false like everything else.
      valueDisplayPermitted: (rec.value_display_permitted ?? "").toLowerCase() === "true" || permitValueDisplay,
      selectedBy,
      notes: rec.notes || notes,
    };
    report("primary", await selectFactor(selection), selection);
    n++;
  }
  console.log(`\n${n} primary factor(s) selected from ${primaryFile}.`);
  process.exit(0);
}

// --- C) A recorded decision to use no factor --------------------------------
const material = requireString(args, "material");
const process_ = typeof args.process === "string" ? args.process : "production";

if (args.none === true) {
  const selection: FactorSelection = {
    material,
    process: process_,
    factor: 0,
    unit: "kgCO2e/kg",
    tier: "none",
    source: "none selected",
    region: "—",
    year: new Date().getFullYear(),
    selectedBy,
    notes,
    licenceNote,
  };
  report("none", await selectFactor(selection), selection);
  console.log(`\n${material} will render "No factor selected" and stay out of the total.`);
  process.exit(0);
}

// --- A) A Climatiq factor ---------------------------------------------------
const activityId = requireString(args, "activity-id");
const region = typeof args.region === "string" ? args.region : undefined;
const year = typeof args.year === "string" ? Number(args.year) : undefined;

if (!process.env.CLIMATIQ_API_KEY) {
  console.error("CLIMATIQ_API_KEY is not set — cannot read the factor back from the provider.");
  console.error("Add it to .env (owner-supplied). Values are never retyped by hand here: the");
  console.error("stored row must match what the provider actually publishes.");
  process.exit(1);
}

let candidate;
try {
  const results = await searchFactors({ query: activityId, region, year, resultsPerPage: 25 });
  candidate = results.find((r) => r.activityId === activityId);
} catch (err) {
  console.error(err instanceof ClimatiqError ? err.message : String(err));
  process.exit(1);
}

if (!candidate) {
  console.error(`No Climatiq result with activity_id "${activityId}"${region ? ` in region ${region}` : ""}.`);
  console.error("Re-run npm run factors:candidates and copy the id exactly.");
  process.exit(1);
}
if (candidate.factor == null || !candidate.unit) {
  console.error(`Climatiq returned no value/unit for "${activityId}" — nothing to store.`);
  console.error("This usually means the factor is premium and your key is not entitled to it.");
  process.exit(1);
}
if (candidate.qualityFlags.length) {
  console.warn(`⚠ provider quality flags on this factor: ${candidate.qualityFlags.join(", ")}`);
}

const tier: FactorTier = "secondary_database";
if (!FACTOR_TIERS.includes(tier)) throw new Error("unreachable");

const selection: FactorSelection = {
  material,
  process: process_,
  factor: candidate.factor,
  unit: candidate.unit,
  tier,
  source: candidate.source,
  sourceDataset: candidate.sourceDataset,
  activityId: candidate.activityId,
  region: candidate.region,
  year: candidate.year,
  methodology: candidate.lcaActivity,
  retrievedAt: new Date(),
  licenceNote,
  valueDisplayPermitted: permitValueDisplay,
  selectedBy,
  notes,
};
report("secondary", await selectFactor(selection), selection);
if (!permitValueDisplay) {
  console.log("\nThe public passport will show the computed result and the source NAME only.");
  console.log("Re-select with --licence-note \"…\" --permit-value-display once you have read the terms.");
}
process.exit(0);
