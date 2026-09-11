// A4/B1 harness — runs the extraction pipeline over the synthetic sets and reports
// a SYNTHETIC CEILING (NOT the acceptance metric). Validates every file's SHA-256
// first, extracts each document with the ExtractionProvider (live), derives flags
// deterministically (requested_scope is external context to the matcher), and
// scores field accuracy (expected-to-extract fields only), flag accuracy, silent
// errors (prominent), refusals, usable rate, latency and cost/doc per model. With
// no ANTHROPIC_API_KEY it runs DRY: manifest + hash validation and the matcher are
// exercised, but no model is called.
//
//   node --env-file=.env eval/extraction/run.ts [model ...]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AnthropicExtractionProvider } from "../../src/lib/extraction/index.ts";
import { extractWithSafeguards } from "../../src/lib/extraction/safeguards.ts";
import type { ExtractionResult } from "../../src/lib/extraction/types.ts";
import { loadExtractionSet, validateHashes, type ManifestDoc } from "./manifest.ts";
import { scoreDoc, aggregate, type DocScore, type ModelReport } from "./score.ts";

const RESULTS_DIR = fileURLToPath(new URL("./results/", import.meta.url));
const DEFAULT_MODELS = ["claude-sonnet-5", "claude-opus-5"];

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

async function runModel(model: string, docs: ManifestDoc[]): Promise<{ report: ModelReport; scores: DocScore[]; promptVersions: Record<string, string> }> {
  const provider = new AnthropicExtractionProvider({ model });
  const scores: DocScore[] = [];
  const promptVersions: Record<string, string> = {};
  for (const doc of docs) {
    const bytes = new Uint8Array(readFileSync(doc.absPath));
    const scanned = doc.tier === "C" || doc.tier === "D";
    let result: ExtractionResult & { safeguardMode?: string; extraCalls?: number };
    try {
      // Grounding for text-layer documents, two-pass agreement for image-only.
      const safe = await extractWithSafeguards(provider, { docClass: doc.class, bytes, contentType: doc.contentType, scanned });
      result = { ...safe, safeguardMode: safe.safeguards.mode, extraCalls: safe.safeguards.extraCalls };
    } catch (err) {
      result = { status: "failed", provider: "anthropic", model, promptVersion: "?", claims: [], usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0, error: err instanceof Error ? err.message : String(err) };
    }
    promptVersions[doc.class] = result.promptVersion;
    const score = scoreDoc(doc, result);
    scores.push(score);
    process.stdout.write(`  ${doc.file.padEnd(34)} ${result.status.padEnd(10)} fields ${score.fieldMatched}/${score.fieldTotal} flags[${score.derivedFlags.join(",")}] ${score.silentErrors.length ? "SILENT!" : ""}\n`);
  }
  return { report: aggregate(model, scores), scores, promptVersions };
}

function printReport(report: ModelReport): void {
  console.log(`\n  Model: ${report.model}   (${report.docs} documents)`);
  console.log(`    Field accuracy (canonical comparison):        ${pct(report.fieldAccuracy)}   (strict baseline ${pct(report.fieldAccuracyStrict)})`);
  const tiers = Object.keys(report.byTier).sort();
  console.log(`    By tier (canonical):                          ${tiers.map((t) => `${t} ${pct(report.byTier[t].total ? report.byTier[t].matched / report.byTier[t].total : 0)}`).join("  ")}`);
  console.log(`    Flag exact-set match rate:                    ${pct(report.flagExactRate)}   (TP ${report.flagTP} / FP ${report.flagFP} / FN ${report.flagFN})`);
  if (report.flagExactRateV2 !== null) {
    console.log(`      …against PROPOSED v2 expected flags:        ${pct(report.flagExactRateV2)}   (proposal only — not ground truth)`);
  }
  console.log(`    Silent errors:                                ${report.silentErrorCount}   ← wrong/guessed value, unflagged`);
  const lg = report.legibility;
  console.log(`    Per-field legibility:                         clear ${lg.clear}, partially_obscured ${lg.partially_obscured}, illegible ${lg.illegible}, unreported ${lg.unreported}`);
  console.log(`    Post-validator rejections:                    type-mismatch ${report.typeMismatches}, ungrounded ${report.ungrounded}, pass-disagreement ${report.passDisagreement}`);
  console.log(`    Extra API calls (two-pass on image-only docs): ${report.extraCalls}`);
  console.log(`    Refusals (distinct from extracted-nothing):   ${report.refusals}`);
  console.log(`    Usable-document rate:                         ${pct(report.usableRate)}`);
  console.log(`    Median latency:                               ${report.medianLatencyMs} ms`);
  console.log(`    Cost/doc:                                     $${report.costPerDocUsd.toFixed(4)}   (total $${report.totalCostUsd.toFixed(4)})`);
  if (report.silentErrors.length > 0) {
    console.log(`    SILENT-ERROR LIST:`);
    for (const e of report.silentErrors) console.log(`      - [${e.kind}] ${e.file}: ${e.detail}`);
  }
}

// ---- main ----------------------------------------------------------------
// Args: bare model names, and optional --class=<docClass> to re-run ONE class
// live (Part 3: prompt v2 iterates one class at a time). --class also tags the
// persisted filename so a partial re-run does not overwrite a full-set run.
const rawArgs = process.argv.slice(2);
// Accept both `--class=x` and `--class x` (and the same for --runs), so the form
// in the runbook works as written.
function flagValue(name: string): string | undefined {
  const eq = rawArgs.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = rawArgs.indexOf(`--${name}`);
  return i >= 0 && rawArgs[i + 1] && !rawArgs[i + 1].startsWith("--") ? rawArgs[i + 1] : undefined;
}
const classFilter = flagValue("class");
// --docs=16,17,18 and --tier=C,D keep a targeted test to exactly the documents it
// needs. Paying for a whole class to exercise three documents is how a budget
// disappears into runs nobody asked for.
const docFilter = flagValue("docs")?.split(",").map((d) => d.trim()).filter(Boolean);
const tierFilter = flagValue("tier")?.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
// --runs=N repeats the whole set N times per model. Acceptance for silent errors
// is the UNION across runs (a single clean run proves nothing when the count is
// nondeterministic), and N runs also give field-accuracy variance.
const runsPerModel = Math.max(1, Number(flagValue("runs") ?? 1));
const consumed = new Set([classFilter, flagValue("docs"), flagValue("tier"), runsPerModel > 1 ? String(runsPerModel) : undefined].filter(Boolean) as string[]);
const bare = rawArgs.filter((a) => !a.startsWith("--") && !consumed.has(a));
const models = bare.length > 0 ? bare : DEFAULT_MODELS;

let docs = loadExtractionSet();
if (!docs) {
  console.error("Extraction set not found at reference/extraction-set-synthetic/ — STOP. Nothing composed.");
  process.exit(2);
}
if (docFilter) {
  docs = docs.filter((d) => docFilter.some((prefix) => d.file.startsWith(prefix)));
  console.log(`DOC FILTER: ${docFilter.join(",")} — ${docs.length} document(s).`);
}
if (tierFilter) {
  docs = docs.filter((d) => tierFilter.includes(d.tier));
  console.log(`TIER FILTER: ${tierFilter.join(",")} — ${docs.length} document(s).`);
}
if (classFilter) {
  docs = docs.filter((d) => d.class === classFilter);
  if (docs.length === 0) {
    console.error(`--class=${classFilter} matched no documents. Classes: supplier_declaration, lab_test_report, heat_treatment_certificate, mill_declaration.`);
    process.exit(2);
  }
  console.log(`CLASS FILTER: ${classFilter} — ${docs.length} document(s). Partial re-run (not a full-set ceiling).`);
}

const hash = validateHashes(docs);
if (!hash.ok) {
  console.error(`SHA-256 validation FAILED before scoring — refusing to run.`);
  for (const m of hash.mismatches) console.error(`  mismatch ${m.file}: expected ${m.expected.slice(0, 12)}… got ${m.actual.slice(0, 12)}…`);
  for (const f of hash.missing) console.error(`  missing ${f}`);
  process.exit(1);
}
console.log(`SHA-256 validated for all ${hash.count} documents.`);

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\nDRY MODE — ANTHROPIC_API_KEY is not set. Manifest + hashes validated; matcher exercised; NO MODEL CALLED.");
  // Exercise the matcher on an empty extraction so the code path is covered.
  const sample = scoreDoc(docs[0], { status: "refused", provider: "anthropic", model: "dry", promptVersion: "dry", claims: [], usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0 });
  console.log(`Matcher exercised on ${docs[0].file}: derivedFlags=[${sample.derivedFlags.join(",")}], expected=[${sample.expectedFlags.join(",")}].`);
  process.exit(0);
}

console.log(`\n===== SYNTHETIC CEILING — not the acceptance metric =====`);
console.log(`(${docs.length} synthetic documents; the acceptance metric is the product owner's real PII-scrubbed set.)`);

mkdirSync(RESULTS_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const summary: Record<string, unknown>[] = [];

// COST DISCIPLINE: API spend is the constraint. The ceiling is CUMULATIVE across
// invocations, so the ledger is persisted — an in-process counter resets every
// time the script is run and therefore cannot enforce a cumulative budget at all.
// Override the ceiling with SPEND_CEILING_USD; reset the ledger by deleting it.
const SPEND_CEILING_USD = Number(process.env.SPEND_CEILING_USD ?? 8);
const LEDGER_PATH = `${RESULTS_DIR}.spend-ledger.json`;

function readLedger(): { totalUsd: number; runs: number } {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as { totalUsd: number; runs: number };
  } catch {
    return { totalUsd: 0, runs: 0 };
  }
}
let cumulativeSpendUsd = readLedger().totalUsd;
console.log(`Spend ledger: $${cumulativeSpendUsd.toFixed(4)} already recorded (ceiling $${SPEND_CEILING_USD}).`);

function recordSpend(report: ModelReport): boolean {
  const ledger = readLedger();
  cumulativeSpendUsd = ledger.totalUsd + report.totalCostUsd;
  writeFileSync(LEDGER_PATH, JSON.stringify({ totalUsd: cumulativeSpendUsd, runs: ledger.runs + 1 }, null, 2));
  console.log(`    RUNNING COST: $${report.totalCostUsd.toFixed(4)} this run — $${cumulativeSpendUsd.toFixed(4)} CUMULATIVE (ceiling $${SPEND_CEILING_USD})`);
  if (cumulativeSpendUsd > SPEND_CEILING_USD) {
    console.error(`\nSTOPPING: cumulative spend $${cumulativeSpendUsd.toFixed(2)} exceeded the $${SPEND_CEILING_USD} ceiling. Reporting what completed.`);
    return false;
  }
  return true;
}

for (const model of models) {
  const runReports: ModelReport[] = [];
  for (let run = 1; run <= runsPerModel; run++) {
    console.log(`\n---- running ${model} over ${docs.length} documents (run ${run}/${runsPerModel}) ----`);
    const { report, scores, promptVersions } = await runModel(model, docs);
    printReport(report);
    runReports.push(report);
    const withinBudget = recordSpend(report);
    // Persist each run with prompt_version pinned per document class.
    const persist = { evaluated_at: stamp, run, runs_total: runsPerModel, model, class_filter: classFilter ?? null, prompt_versions: promptVersions, report, per_document: scores };
    const scope = classFilter ?? (docFilter ? `docs-${docFilter.join("-")}` : undefined) ?? (tierFilter ? `tier-${tierFilter.join("")}` : undefined);
    const tag = `${scope ? `${model}_${scope}` : model}${runsPerModel > 1 ? `_run${run}` : ""}`;
    writeFileSync(`${RESULTS_DIR}${stamp}_${tag}.json`, JSON.stringify(persist, null, 2));
    if (!withinBudget) break;
  }

  // Across-run acceptance: silent errors are the UNION (deduped), and accuracy is
  // reported with its spread so a lucky run cannot be mistaken for the ceiling.
  const accs = runReports.map((r) => r.fieldAccuracy);
  const union = new Map<string, string>();
  for (const r of runReports) for (const e of r.silentErrors) union.set(`${e.file}|${e.kind}|${e.detail}`, `[${e.kind}] ${e.file}: ${e.detail}`);
  if (runsPerModel > 1) {
    console.log(`\n  ===== ${model}: ACROSS ${runsPerModel} RUNS =====`);
    console.log(`    Field accuracy per run: ${accs.map((a) => pct(a)).join(", ")}`);
    console.log(`    Field accuracy min/mean/max: ${pct(Math.min(...accs))} / ${pct(accs.reduce((a, b) => a + b, 0) / accs.length)} / ${pct(Math.max(...accs))}  (spread ${pct(Math.max(...accs) - Math.min(...accs))})`);
    console.log(`    Refusals per run: ${runReports.map((r) => r.refusals).join(", ")}`);
    console.log(`    Silent errors per run: ${runReports.map((r) => r.silentErrorCount).join(", ")}`);
    console.log(`    UNIONED silent errors: ${union.size}   ${union.size === 0 ? "← target met" : "← TARGET NOT MET"}`);
    for (const line of union.values()) console.log(`      - ${line}`);
  }
  const last = runReports[runReports.length - 1];
  summary.push({
    model,
    runs: runsPerModel,
    fieldAccuracyMean: accs.reduce((a, b) => a + b, 0) / accs.length,
    fieldAccuracySpread: Math.max(...accs) - Math.min(...accs),
    silentErrorsUnioned: union.size,
    refusalsTotal: runReports.reduce((a, r) => a + r.refusals, 0),
    usableRate: last.usableRate,
    medianLatencyMs: last.medianLatencyMs,
    costPerDocUsd: last.costPerDocUsd,
  });
}

console.log(`\n===== default chosen by the numbers =====`);
console.table(summary);
console.log(`Runs persisted under eval/extraction/results/ (prompt_version pinned per class).`);

const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
if (shared) await shared.end({ timeout: 5 });
