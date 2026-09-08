import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DocClass } from "../../src/lib/extraction/types.ts";

// Loader + integrity gate for the synthetic extraction sets (B1). Two sets share
// one schema: the 20-doc dossier and the 5-doc presswood supplement. Every file's
// SHA-256 is validated against its manifest entry BEFORE any scoring — a mismatch
// aborts the run (you are not scoring the bytes you think you are).

const SET_ROOT = fileURLToPath(new URL("../../reference/extraction-set-synthetic/", import.meta.url));
const SETS = ["synthetic_packaging_dossier", "presswood_pallet_supplement"] as const;

export interface ExpectedClaim {
  parameter: string;
  value: string | null;
  unit: string | null;
  test_method: string | null;
  issuer: string | null;
  issuer_type: string | null;
  accreditation_ref: string | null;
  issue_date: string | null;
  valid_until: string | null;
  scope: string | null;
  visibility?: string; // "obscured" on Tier-C hidden fields
  comparator?: string;
  presence?: string; // "absent" for deliberately-missing values (e.g. missing sum)
  [k: string]: unknown;
}

export interface ObscuredField {
  page: number;
  parameter: string;
  authored_value?: string;
  [k: string]: unknown;
}

export interface ManifestDoc {
  file: string;
  class: DocClass;
  tier: "A" | "B" | "C" | "D";
  expected_claims: ExpectedClaim[];
  trap: string | null;
  expected_flags: string[];
  requested_scope: string | null;
  obscured_fields?: ObscuredField[];
  page_count?: number;
  language?: string;
  notes?: string;
  sha256: string;
  document_id?: string;
  // resolved at load time
  absPath: string;
  setName: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
}

function contentTypeFor(file: string): ManifestDoc["contentType"] {
  if (file.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (file.toLowerCase().endsWith(".png")) return "image/png";
  return "image/jpeg";
}

/** Load both sets, resolving each document's absolute path. Returns null when the
 *  set root is absent (so the harness can report "set missing" rather than crash). */
export function loadExtractionSet(): ManifestDoc[] | null {
  if (!existsSync(SET_ROOT)) return null;
  const docs: ManifestDoc[] = [];
  for (const setName of SETS) {
    const manifestPath = path.join(SET_ROOT, setName, "manifest.json");
    if (!existsSync(manifestPath)) return null;
    const arr = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestDoc[];
    for (const d of arr) {
      docs.push({
        ...d,
        setName,
        absPath: path.join(SET_ROOT, setName, d.file),
        contentType: contentTypeFor(d.file),
      });
    }
  }
  return docs;
}

export interface HashResult {
  ok: boolean;
  mismatches: { file: string; expected: string; actual: string }[];
  missing: string[];
  count: number;
}

/** Validate every document's SHA-256 against its manifest entry. */
export function validateHashes(docs: ManifestDoc[]): HashResult {
  const mismatches: HashResult["mismatches"] = [];
  const missing: string[] = [];
  for (const d of docs) {
    if (!existsSync(d.absPath)) {
      missing.push(d.file);
      continue;
    }
    const actual = createHash("sha256").update(readFileSync(d.absPath)).digest("hex");
    if (actual.toLowerCase() !== d.sha256.toLowerCase()) {
      mismatches.push({ file: d.file, expected: d.sha256, actual });
    }
  }
  return { ok: mismatches.length === 0 && missing.length === 0, mismatches, missing, count: docs.length };
}
