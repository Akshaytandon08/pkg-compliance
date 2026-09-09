// Offline error analysis (Parts 1 & 2) — reads the PERSISTED enriched runs and
// emits a markdown report. NO API calls. For each model it classifies every
// missed field (a: model wrong/absent · b: comparison too strict · c: abstained),
// per document class; tabulates the false-positive flags by type with their
// triggering document; and reports field accuracy per tier and the corrected
// (canonical) ceiling vs the strict baseline.
//
//   node --experimental-strip-types eval/extraction/analyze.ts > docs/extraction-error-analysis.md
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

function newestRuns(): Persisted[] {
  // Full-set runs only: "<stamp>_claude-<model>-5.json" (a class-tagged partial
  // run has an extra "_<class>" suffix and is excluded from the full-set report).
  const files = readdirSync(RESULTS_DIR).filter((f) => /_claude-(sonnet|opus)-5\.json$/.test(f));
  const byStamp = new Map<string, string[]>();
  for (const f of files) {
    const stamp = f.slice(0, f.indexOf("_claude"));
    (byStamp.get(stamp) ?? byStamp.set(stamp, []).get(stamp)!).push(f);
  }
  const latest = [...byStamp.keys()].sort().at(-1)!;
  return byStamp.get(latest)!.sort().map((f) => JSON.parse(readFileSync(RESULTS_DIR + f, "utf8")) as Persisted);
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const CLASSES = ["supplier_declaration", "lab_test_report", "heat_treatment_certificate", "mill_declaration"] as const;
const TIERS = ["A", "B", "C", "D"] as const;

function missTableByClass(docs: DocScore[]): string {
  // per class: total fields, matched, and miss buckets a/b/c
  const rows: string[] = [];
  rows.push("| Document class | Fields | Matched (canon) | (a) model wrong/absent | (b) comparison-too-strict | (c) abstained |");
  rows.push("|---|--:|--:|--:|--:|--:|");
  let tA = 0, mA = 0, a = 0, b = 0, c = 0;
  for (const cls of CLASSES) {
    const fs = docs.filter((d) => d.class === cls).flatMap((d) => d.fields);
    const total = fs.length;
    const matched = fs.filter((f) => f.canonical).length;
    const ma = fs.filter((f) => f.classification === "a_model_wrong").length;
    const mb = fs.filter((f) => f.classification === "b_comparison").length;
    const mc = fs.filter((f) => f.classification === "c_abstained").length;
    tA += total; mA += matched; a += ma; b += mb; c += mc;
    rows.push(`| ${cls} | ${total} | ${matched} (${pct(matched, total)}) | ${ma} | ${mb} | ${mc} |`);
  }
  rows.push(`| **all** | **${tA}** | **${mA} (${pct(mA, tA)})** | **${a}** | **${b}** | **${c}** |`);
  return rows.join("\n");
}

function tierTable(report: ModelReport): string {
  const rows: string[] = [];
  rows.push("| Tier | Fields | Strict | Canonical |");
  rows.push("|---|--:|--:|--:|");
  for (const t of TIERS) {
    const x = report.byTier[t];
    if (!x) continue;
    rows.push(`| ${t} | ${x.total} | ${pct(x.matchedStrict, x.total)} | ${pct(x.matched, x.total)} |`);
  }
  return rows.join("\n");
}

function fpFlagTable(docs: DocScore[]): string {
  const byFlag = new Map<string, string[]>();
  for (const d of docs) for (const f of d.falsePositiveFlags) (byFlag.get(f) ?? byFlag.set(f, []).get(f)!).push(d.file);
  const rows: string[] = [];
  rows.push("| False-positive flag | Count | Triggering documents |");
  rows.push("|---|--:|---|");
  let total = 0;
  for (const [flag, files] of [...byFlag.entries()].sort((x, y) => y[1].length - x[1].length)) {
    total += files.length;
    rows.push(`| ${flag} | ${files.length} | ${files.map((f) => f.split("_")[0]).join(", ")} |`);
  }
  rows.push(`| **total** | **${total}** | |`);
  return rows.join("\n");
}

function missDetail(docs: DocScore[], kind: "a_model_wrong" | "c_abstained"): string {
  const rows: string[] = ["| Document | Field (parameter) | Expected |", "|---|---|---|"];
  for (const d of docs) for (const f of d.fields) if (f.classification === kind) rows.push(`| ${d.file.split("_")[0]} | ${f.parameter} | ${f.expected.slice(0, 40)} |`);
  return rows.length > 2 ? rows.join("\n") : "_none_";
}

// ---- render ---------------------------------------------------------------
const runs = newestRuns();
const out: string[] = [];
out.push("# Extraction harness — error analysis (synthetic ceiling)\n");
out.push("> **These are synthetic-ceiling figures, not the acceptance metric.** Acceptance is measured only on the product owner's real, PII-scrubbed document set. This analysis classifies misses on the 25-document synthetic set to guide prompt work; it does not certify accuracy.\n");
out.push(`Runs analysed: ${runs.map((r) => `\`${r.model}\` (${r.evaluated_at})`).join(", ")}. No API calls — offline over the persisted runs.\n`);

for (const r of runs) {
  const d = r.per_document;
  out.push(`\n## ${r.model}\n`);
  out.push(`Field accuracy: **${pct(r.report.byTier ? d.reduce((a, s) => a + s.fieldMatched, 0) : 0, d.reduce((a, s) => a + s.fieldTotal, 0))} canonical** (strict baseline ${(100 * r.report.fieldAccuracyStrict).toFixed(1)}%). Usable ${(100 * r.report.usableRate).toFixed(0)}%, refusals ${r.report.refusals}, silent errors ${r.report.silentErrorCount}, cost/doc $${r.report.costPerDocUsd.toFixed(4)}.\n`);
  out.push("### Miss classification, per document class\n");
  out.push(missTableByClass(d));
  out.push("\n### Field accuracy per tier (strict → canonical)\n");
  out.push(tierTable(r.report));
  out.push("\n### False-positive flags (derived − expected), by type\n");
  out.push(fpFlagTable(d));
  out.push("\n<details><summary>(a) model wrong/absent — fields</summary>\n");
  out.push(missDetail(d, "a_model_wrong"));
  out.push("\n</details>\n<details><summary>(c) abstained where extraction expected — fields</summary>\n");
  out.push(missDetail(d, "c_abstained"));
  out.push("\n</details>");
}

process.stdout.write(out.join("\n") + "\n");
