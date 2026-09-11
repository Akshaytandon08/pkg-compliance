// Emission-factor store — read-only audit view.
//   npm run factors:list
// Shows every version of every factor with its provenance, newest first, and
// marks the one the engine would use today (primary outranks secondary; within a
// tier, the highest version wins).
import { listFactorHistory, currentFactorSet } from "../src/db/factors.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // DATABASE_URL may still be set in the environment
}

const rows = await listFactorHistory();
if (rows.length === 0) {
  console.log("No emission factors selected. Every material renders \"No factor selected\"");
  console.log("and is excluded from the footprint total.\n");
  console.log("Shortlist candidates:  npm run factors:candidates -- --all");
  process.exit(0);
}

const current = new Set((await currentFactorSet()).map((f) => f.id));
for (const r of rows) {
  const mark = current.has(r.id) ? "→" : " ";
  const value = r.tier === "none" ? "NO FACTOR" : `${r.factor} ${r.unit}`;
  console.log(`${mark} ${r.material}/${r.process} v${r.version}  ${value}  [${r.tier}]`);
  console.log(`    ${r.source}${r.sourceDataset ? ` / ${r.sourceDataset}` : ""} · ${r.region} · ${r.year}`);
  if (r.activityId) console.log(`    activity_id: ${r.activityId}`);
  if (r.methodology) console.log(`    boundary:    ${r.methodology}`);
  console.log(`    selected by ${r.selectedBy} on ${r.selectedAt.toISOString().slice(0, 10)}`);
  console.log(`    value on public passport: ${r.valueDisplayPermitted ? "PERMITTED" : "withheld"}${r.licenceNote ? ` — ${r.licenceNote}` : ""}`);
  if (r.notes) console.log(`    notes: ${r.notes}`);
  console.log("");
}
console.log("→ marks the factor the engine uses today. Assessments already evaluated keep");
console.log("  the version they pinned.");
process.exit(0);
