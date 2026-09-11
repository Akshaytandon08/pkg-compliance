// COMMIT 3 — propose (do NOT apply) additions to the manifest's expected_flags.
//
// The manifest's expected flags were authored before legibility, type-mismatch,
// grounding and two-pass existed. So when the post-validator correctly withholds
// a bad value and raises flag_low_confidence, the harness scores that as a FALSE
// POSITIVE — the ground truth simply has no opinion about a signal that did not
// exist when it was written. That makes flag metrics incomparable across prompt
// versions and, worse, makes the safety mechanisms look like noise.
//
// This emits a DIFF for the owner to accept or reject. It changes nothing: the
// manifest is ground truth, and ground truth is authored by a human, not
// inferred by the thing being measured. Acceptance is the owner's call.
//
//   node --experimental-strip-types eval/extraction/flag-groundtruth.ts <stampPrefix> <model>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadExtractionSet } from "./manifest.ts";
import type { DocScore } from "./score.ts";

const RESULTS_DIR = fileURLToPath(new URL("./results/", import.meta.url));
const OVERLAY_PATH = fileURLToPath(new URL("./expected-flags-v2.json", import.meta.url));

interface Persisted { model: string; prompt_versions: Record<string, string>; per_document: DocScore[] }

const stampPrefix = process.argv[2];
const modelFilter = process.argv[3];
if (!stampPrefix || !modelFilter) {
  console.error("usage: flag-groundtruth.ts <stampPrefix> <model>");
  process.exit(2);
}
const files = readdirSync(RESULTS_DIR).filter((f) => f.startsWith(stampPrefix) && f.includes(modelFilter) && f.endsWith(".json")).sort();
if (files.length === 0) { console.error("no runs matched"); process.exit(2); }
const runs = files.map((f) => JSON.parse(readFileSync(RESULTS_DIR + f, "utf8")) as Persisted);
const docs = loadExtractionSet();
if (!docs) { console.error("extraction set missing"); process.exit(2); }
const byFile = new Map(docs.map((d) => [d.file, d]));

/** Was this rejection demonstrably right — i.e. did we withhold something that
 *  was actually WRONG, or that the document does not support? Anything we cannot
 *  demonstrate is left out of the proposal. */
interface Justification { file: string; parameter: string; kind: string; rejected: string; why: string }

const justified: Justification[] = [];
const unjustified: Justification[] = [];

for (const run of runs) {
  for (const d of run.per_document) {
    const manifest = byFile.get(d.file);
    if (!manifest) continue;
    const obscured = new Set((manifest.obscured_fields ?? []).map((o) => String(o.parameter).toLowerCase()));
    for (const c of d.rawClaims) {
      if (!c.validation || c.validation === "ok") continue;
      const param = (c.parameter ?? c.claimType).toLowerCase();
      const rejected = String(c.rejectedValue ?? "");
      const entry = { file: d.file, parameter: param, kind: c.validation, rejected };

      // (a) the field is one the generator deliberately obscured → withholding is right
      if (obscured.has(param)) {
        justified.push({ ...entry, why: "field is deliberately obscured in the source; a value here is a guess" });
        continue;
      }
      // (b) the rejected value contradicts the authored truth → withholding is right
      const expected = manifest.expected_claims.find((e) => String(e.parameter).toLowerCase() === param);
      if (expected?.value != null && rejected && String(expected.value).trim() !== rejected.trim()) {
        justified.push({ ...entry, why: `rejected "${rejected}" but the document states "${expected.value}"` });
        continue;
      }
      // (c) ungrounded / disagreement are deterministic facts about the evidence
      if (c.validation === "ungrounded") {
        justified.push({ ...entry, why: "quoted span is not present in the document's text layer" });
        continue;
      }
      if (c.validation === "pass_disagreement") {
        justified.push({ ...entry, why: "two independent passes read this field differently; at most one can be right" });
        continue;
      }
      unjustified.push({ ...entry, why: "rejection could not be shown to be correct against ground truth" });
    }
  }
}

// Propose flag_low_confidence on documents with at least one justified rejection
// that the manifest does not already expect.
const proposals = new Map<string, Justification[]>();
for (const j of justified) {
  const m = byFile.get(j.file)!;
  if (m.expected_flags.includes("flag_low_confidence")) continue;
  (proposals.get(j.file) ?? proposals.set(j.file, []).get(j.file)!).push(j);
}

const overlay: Record<string, string[]> = {};
for (const d of docs) {
  overlay[d.file] = proposals.has(d.file) ? [...d.expected_flags, "flag_low_confidence"].sort() : [...d.expected_flags].sort();
}
writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2) + "\n");

const lines: string[] = [];
lines.push("# Proposed expected_flags additions (NOT APPLIED — for owner acceptance)\n");
lines.push(`Source runs: \`${modelFilter}\` @ ${stampPrefix} (${runs.length} run(s)); prompt ${JSON.stringify(runs[0].prompt_versions)}.\n`);
lines.push("The manifest's expected flags predate the legibility, type-mismatch, grounding and");
lines.push("two-pass signals. Where the post-validator withheld a value and that was");
lines.push("**demonstrably** the right call, the document should expect `flag_low_confidence`;");
lines.push("otherwise the safety mechanism scores as a false positive forever.\n");
lines.push("**Nothing here is applied.** The manifest is ground truth and ground truth is");
lines.push("authored by a human. Accept or reject each row.\n");
lines.push(`## Proposed: add \`flag_low_confidence\` to ${proposals.size} document(s)\n`);
lines.push("| Document | current expected_flags | justified rejections | why |");
lines.push("|---|---|--:|---|");
for (const [file, js] of [...proposals.entries()].sort()) {
  const m = byFile.get(file)!;
  const why = [...new Set(js.map((j) => j.why))][0];
  lines.push(`| ${file} | ${m.expected_flags.join(", ") || "(none)"} | ${js.length} | ${why} |`);
}
lines.push(`\n## Rejections that could NOT be justified (${unjustified.length}) — excluded from the proposal\n`);
if (unjustified.length === 0) lines.push("_none_\n");
else {
  lines.push("| Document | field | kind | rejected value |");
  lines.push("|---|---|---|---|");
  for (const u of unjustified.slice(0, 25)) lines.push(`| ${u.file} | ${u.parameter} | ${u.kind} | ${u.rejected.slice(0, 30)} |`);
}
lines.push(`\nOverlay written to \`eval/extraction/expected-flags-v2.json\`. While it exists the`);
lines.push("harness reports the legacy score and the v2 score side by side; it is not used");
lines.push("as ground truth until the owner folds it into the manifest.\n");

const out = fileURLToPath(new URL("../../docs/flag-groundtruth-proposal.md", import.meta.url));
writeFileSync(out, lines.join("\n"));
console.log(`Proposed additions for ${proposals.size} document(s); ${justified.length} justified, ${unjustified.length} unjustified rejections.`);
console.log(`Diff  → docs/flag-groundtruth-proposal.md`);
console.log(`Overlay → eval/extraction/expected-flags-v2.json (side-by-side scoring only)`);
