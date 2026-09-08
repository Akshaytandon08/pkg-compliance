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
    let result: ExtractionResult;
    try {
      result = await provider.extract({ docClass: doc.class, bytes, contentType: doc.contentType, scanned });
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
  console.log(`    Field accuracy (expected-to-extract fields):  ${pct(report.fieldAccuracy)}`);
  console.log(`    Flag exact-set match rate:                    ${pct(report.flagExactRate)}   (TP ${report.flagTP} / FP ${report.flagFP} / FN ${report.flagFN})`);
  console.log(`    Silent errors:                                ${report.silentErrorCount}   ← wrong/guessed value, unflagged`);
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
const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_MODELS;

const docs = loadExtractionSet();
if (!docs) {
  console.error("Extraction set not found at reference/extraction-set-synthetic/ — STOP. Nothing composed.");
  process.exit(2);
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

for (const model of models) {
  console.log(`\n---- running ${model} over ${docs.length} documents ----`);
  const { report, scores, promptVersions } = await runModel(model, docs);
  printReport(report);
  // Persist the run with prompt_version pinned per document class.
  const persist = { evaluated_at: stamp, model, prompt_versions: promptVersions, report, per_document: scores };
  writeFileSync(`${RESULTS_DIR}${stamp}_${model}.json`, JSON.stringify(persist, null, 2));
  summary.push({ model, fieldAccuracy: report.fieldAccuracy, flagExactRate: report.flagExactRate, silentErrors: report.silentErrorCount, refusals: report.refusals, usableRate: report.usableRate, medianLatencyMs: report.medianLatencyMs, costPerDocUsd: report.costPerDocUsd });
}

console.log(`\n===== default chosen by the numbers =====`);
console.table(summary);
console.log(`Runs persisted under eval/extraction/results/ (prompt_version pinned per class).`);

const shared = (globalThis as { dbClient?: { end: (o?: { timeout?: number }) => Promise<void> } }).dbClient;
if (shared) await shared.end({ timeout: 5 });
