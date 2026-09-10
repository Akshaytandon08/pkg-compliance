// COMMIT 4 — per-field run-to-run variance, offline over persisted runs (no API
// calls). mill_declaration swung 59.2 / 63.4 / 42.3% across three runs at prompt
// 1.2.0, which is a 21-point spread on identical inputs. A class that unstable
// cannot be relied on, and the mean hides it — so this reports WHICH fields flip
// rather than just how far the aggregate moved.
//
//   node --experimental-strip-types eval/extraction/variance.ts <stampPrefix> <model> [class]
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DocScore, ModelReport } from "./score.ts";

const RESULTS_DIR = fileURLToPath(new URL("./results/", import.meta.url));

interface Persisted {
  evaluated_at: string;
  model: string;
  prompt_versions: Record<string, string>;
  report: ModelReport;
  per_document: DocScore[];
}

const stampPrefix = process.argv[2];
const modelFilter = process.argv[3];
const classFilter = process.argv[4];
if (!stampPrefix || !modelFilter) {
  console.error("usage: variance.ts <stampPrefix> <model> [docClass]");
  console.error("  a single stamp holds runs for BOTH models, so the model is required —");
  console.error("  mixing them silently averages one model's runs into the other's.");
  process.exit(2);
}

const files = readdirSync(RESULTS_DIR)
  .filter((f) => f.startsWith(stampPrefix) && f.includes(modelFilter) && /_run\d+\.json$/.test(f))
  .sort();
if (files.length < 2) {
  console.error(`need at least 2 runs matching "${stampPrefix}" + "${modelFilter}"; found ${files.length}`);
  process.exit(2);
}
const runs = files.map((f) => JSON.parse(readFileSync(RESULTS_DIR + f, "utf8")) as Persisted);

console.log(`# Per-field variance — ${runs[0].model}, ${runs.length} runs (${stampPrefix})`);
console.log(`prompt versions: ${JSON.stringify(runs[0].prompt_versions)}`);
if (classFilter) console.log(`class filter: ${classFilter}`);

// Field identity is (document, parameter). For each, record whether it matched in
// each run; a field that is not always the same is UNSTABLE.
type Cell = { matched: boolean[]; expected: string };
const fields = new Map<string, Cell>();
for (let i = 0; i < runs.length; i++) {
  for (const d of runs[i].per_document) {
    if (classFilter && d.class !== classFilter) continue;
    for (const f of d.fields) {
      const key = `${d.file}::${f.parameter}`;
      const cell = fields.get(key) ?? { matched: new Array(runs.length).fill(false), expected: f.expected };
      cell.matched[i] = f.canonical;
      fields.set(key, cell);
    }
  }
}

const unstable = [...fields.entries()].filter(([, c]) => new Set(c.matched).size > 1);
const alwaysHit = [...fields.values()].filter((c) => c.matched.every(Boolean)).length;
const alwaysMiss = [...fields.values()].filter((c) => c.matched.every((m) => !m)).length;

console.log(`\n## Stability`);
console.log(`| Fields | Always matched | Never matched | **Unstable (flips between runs)** |`);
console.log(`|--:|--:|--:|--:|`);
console.log(`| ${fields.size} | ${alwaysHit} | ${alwaysMiss} | **${unstable.length}** (${((100 * unstable.length) / fields.size).toFixed(1)}%) |`);

// Per-class summary so the unstable share is comparable across classes.
const byClass = new Map<string, { total: number; unstable: number }>();
for (const [key, c] of fields) {
  const file = key.split("::")[0];
  const cls = runs[0].per_document.find((d) => d.file === file)?.class ?? "?";
  const e = byClass.get(cls) ?? { total: 0, unstable: 0 };
  e.total++;
  if (new Set(c.matched).size > 1) e.unstable++;
  byClass.set(cls, e);
}
console.log(`\n## Unstable share per class`);
console.log(`| Class | Fields | Unstable | % |`);
console.log(`|---|--:|--:|--:|`);
for (const [cls, e] of [...byClass.entries()].sort((a, b) => b[1].unstable / b[1].total - a[1].unstable / a[1].total)) {
  console.log(`| ${cls} | ${e.total} | ${e.unstable} | ${((100 * e.unstable) / e.total).toFixed(1)}% |`);
}

console.log(`\n## The unstable fields`);
console.log(`| Document | Field | Expected | ${runs.map((_, i) => `run ${i + 1}`).join(" | ")} |`);
console.log(`|---|---|---|${runs.map(() => "---").join("|")}|`);
for (const [key, c] of unstable.sort((a, b) => a[0].localeCompare(b[0]))) {
  const [file, param] = key.split("::");
  console.log(`| ${file.split("_")[0]} | ${param} | ${c.expected.slice(0, 28)} | ${c.matched.map((m) => (m ? "hit" : "—")).join(" | ")} |`);
}

// Did the safeguards touch the unstable documents? A field that stopped flipping
// because its value is now WITHHELD is stabilised in the only sense that matters
// for safety: it no longer sometimes-passes a wrong value.
console.log(`\n## Safeguard activity on these documents (per run)`);
console.log(`| Document | ${runs.map((_, i) => `run ${i + 1} mode / ungrounded / disagree`).join(" | ")} |`);
console.log(`|---|${runs.map(() => "---").join("|")}|`);
const docs = [...new Set(unstable.map(([k]) => k.split("::")[0]))].sort();
for (const file of docs) {
  const cells = runs.map((r) => {
    const d = r.per_document.find((x) => x.file === file);
    return d ? `${d.safeguardMode ?? "n/a"} / ${d.ungrounded ?? 0} / ${d.passDisagreement ?? 0}` : "—";
  });
  console.log(`| ${file.split("_")[0]} | ${cells.join(" | ")} |`);
}
