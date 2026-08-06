// Cheap lexical tripwire over source and prompts. This is NOT the real
// guardrail — output-level tests in tests/report-language.test.ts are, because
// the risk lives in generated reports, not in source strings. This catches
// obvious slips early (a hardcoded "audit-grade" in UI copy, an issuing claim
// baked into a prompt template).
//
// Legitimate discussion of Declarations of Conformity and client-held
// certifications is expected and permitted — see src/lib/report/language.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { findLanguageViolations } from "../src/lib/report/language.ts";

const SCAN_DIRS = ["src", "prompts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".txt", ".json"]);
// The guardrail's own definitions and tests necessarily contain the patterns.
const SKIP_FILES = new Set(["src/lib/report/language.ts"]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

let failures = 0;
for (const dir of SCAN_DIRS) {
  let files: string[];
  try {
    files = [...walk(dir)];
  } catch {
    continue; // directory absent
  }
  for (const file of files) {
    if (SKIP_FILES.has(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const violation of findLanguageViolations(line)) {
        console.error(
          `${file}:${i + 1} "${violation.match}" — ${violation.rule}`,
        );
        failures++;
      }
    });
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} forbidden-language violation(s). See docs/BRIEF.md §1.`,
  );
  process.exit(1);
}
console.log("Language tripwire passed.");
