// Liability guardrail (docs/BRIEF.md §1): output language is "qualification
// screening" and "evidence assembly" — never certification language. This scans
// source and prompts for forbidden phrases. "certificate" (an evidence INPUT
// users upload) is allowed; labelling anything as certification is not.
// Escape hatch for legitimate mentions (e.g. UI copy explaining what this is
// NOT): put "lang-ok" on the same line, or on its own line to cover the next
// five lines (for wrapped JSX/markdown text).
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const FORBIDDEN = [
  "declaration of conformity",
  "certification",
  "audit-grade",
  "audit grade",
];
const SCAN_DIRS = ["src", "prompts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".txt", ".json"]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

let failures = 0;
for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = [...walk(dir)];
  } catch {
    continue; // directory absent
  }
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    let suppressUntil = -1;
    lines.forEach((line, i) => {
      if (line.includes("lang-ok")) {
        suppressUntil = i + 5;
        return;
      }
      if (i <= suppressUntil) return;
      const lower = line.toLowerCase();
      for (const phrase of FORBIDDEN) {
        if (lower.includes(phrase)) {
          console.error(`${file}:${i + 1} forbidden phrase "${phrase}"`);
          failures++;
        }
      }
    });
  }
}

if (failures > 0) {
  console.error(`\n${failures} forbidden-language violation(s). See docs/BRIEF.md §1.`);
  process.exit(1);
}
console.log("Language check passed.");
