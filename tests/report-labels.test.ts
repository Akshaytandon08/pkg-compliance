// COMMIT 1 — display vocabulary. Two guarantees:
//   (1) every value of every user-visible enum has a plain-language label, drawn
//       from the SOURCE OF TRUTH for that vocabulary rather than a list copied
//       into this test (a copied list rots and stops catching anything);
//   (2) no raw enum token or snake_case identifier reaches the rendered report or
//       passport, except on the deliberately-muted rule-reference line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLAIM_TYPE_LABEL,
  CONFIDENCE_LABEL,
  DESIGN_ASSESSMENT_LABEL,
  ERROR_CATEGORY_LABEL,
  EVIDENCE_STATE_LABEL,
  EVIDENCE_TYPE_LABEL,
  LEGIBILITY_LABEL,
  RISK_LABEL,
  VALIDATION_LABEL,
  ISSUER_TYPE_LABEL,
  VERDICT_LABEL,
  claimTypeLabel,
  issuerTypeLabel,
  evidenceTypeLabel,
  humanise,
  reasonLabel,
  ruleReference,
  verdictAriaLabel,
  verdictLabel,
} from "../src/lib/report/labels.ts";
import { EVIDENCE_TYPES, ISSUER_TYPES } from "../src/lib/vocab.ts";
import { LEGIBILITY } from "../src/lib/extraction/types.ts";
import { PROMPTS } from "../src/lib/extraction/prompts.ts";

// A label must read as English. These are the two shapes an enum leak takes.
const SCREAMING_SNAKE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
const LOWER_SNAKE = /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/;

function assertReadable(label: string, what: string): void {
  assert.ok(label.length > 0, `${what}: label must not be empty`);
  assert.doesNotMatch(label, SCREAMING_SNAKE, `${what}: leaks a SCREAMING_SNAKE enum token`);
  assert.doesNotMatch(label, LOWER_SNAKE, `${what}: leaks a snake_case identifier`);
  assert.match(label, /^[A-Z0-9]/, `${what}: label should start capitalised`);
}

// --- (1) every vocabulary is fully covered ----------------------------------

test("every evidence type in the corpus vocabulary has a readable label", () => {
  for (const t of EVIDENCE_TYPES) {
    assert.ok(EVIDENCE_TYPE_LABEL[t], `evidence type "${t}" has no label`);
    assertReadable(evidenceTypeLabel(t), `evidence type ${t}`);
  }
});

test("every extraction claim type the prompts can emit has a readable label", () => {
  const claimTypes = new Set(Object.values(PROMPTS).flatMap((p) => p.claimTypes));
  for (const t of claimTypes) {
    assert.ok(CLAIM_TYPE_LABEL[t], `claim type "${t}" has no label — add it to labels.ts`);
    assertReadable(claimTypeLabel(t), `claim type ${t}`);
  }
});

test("every reason code the engine can produce has a readable label", () => {
  // Read the union from evaluate.ts so this cannot fall behind the engine: a new
  // ReasonCode without a label fails here rather than reaching a user.
  const src = readFileSync(new URL("../src/lib/engine/evaluate.ts", import.meta.url), "utf8");
  const union = src.match(/export type ReasonCode =([\s\S]*?);/)?.[1] ?? "";
  const codes = [...union.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
  assert.ok(codes.length >= 9, `expected to find the ReasonCode union, found ${codes.length}`);
  for (const code of codes) {
    const label = reasonLabel(code as never);
    assertReadable(label, `reason code ${code}`);
    assert.notEqual(label, "Reviewed", `reason code "${code}" fell through to the generic fallback`);
  }
});

test("every legibility, validation, verdict, risk, state and error value has a label", () => {
  for (const l of LEGIBILITY) assertReadable(LEGIBILITY_LABEL[l], `legibility ${l}`);
  for (const [k, v] of Object.entries(VALIDATION_LABEL)) assertReadable(v, `validation ${k}`);
  for (const [k, v] of Object.entries(VERDICT_LABEL)) assertReadable(v, `verdict ${k}`);
  for (const [k, v] of Object.entries(RISK_LABEL)) assertReadable(v, `risk ${k}`);
  for (const [k, v] of Object.entries(EVIDENCE_STATE_LABEL)) assertReadable(v, `evidence state ${k}`);
  for (const [k, v] of Object.entries(ERROR_CATEGORY_LABEL)) assertReadable(v, `error category ${k}`);
  for (const [k, v] of Object.entries(DESIGN_ASSESSMENT_LABEL)) assertReadable(v, `design assessment ${k}`);
  for (const [k, v] of Object.entries(CONFIDENCE_LABEL)) assertReadable(v, `confidence ${k}`);
});

test("prose and table registers both cover the evidence vocabulary", () => {
  // deltaActions.ts keeps sentence-form phrasings ("a supplier declaration").
  // Different register, not a second source of truth — but it must not fall
  // behind the vocabulary either.
  const prose = readFileSync(new URL("../src/lib/report/deltaActions.ts", import.meta.url), "utf8");
  for (const t of EVIDENCE_TYPES) {
    assert.match(prose, new RegExp(`\\b${t}:`), `evidence type "${t}" has no prose phrasing in deltaActions.ts`);
  }
});

// --- upcoming, specifically -------------------------------------------------

test("an upcoming verdict states the date — the only question a reader has", () => {
  assert.equal(verdictLabel("upcoming", "Applies from 2026-09-27"), "Upcoming — applies from 2026-09-27");
  assert.equal(
    verdictLabel("upcoming", "Applies from 2030-01-01 or later, pending the Article 6(4) delegated acts"),
    "Upcoming — applies from 2030-01-01",
  );
  assert.equal(verdictLabel("upcoming"), "Upcoming", "with no date it must still read as English");
  assertReadable(verdictLabel("upcoming", "Applies from 2026-09-27"), "upcoming chip");
});

test("a not-applicable row shows its recorded reason, not a generic label", () => {
  const stated = "No wood in this pack, so ISPM-15 does not apply.";
  assert.equal(reasonLabel("NOT_APPLICABLE_SCOPE", stated), stated);
  // …and falls back to a readable label when no reason was recorded.
  assertReadable(reasonLabel("NOT_APPLICABLE_SCOPE", null), "not-applicable fallback");
});

test("verdict chips carry an accessible name naming the rule", () => {
  const aria = verdictAriaLabel("gap", "Heavy metals sum must not exceed 100 mg/kg");
  assert.match(aria, /Heavy metals sum/);
  assert.match(aria, /Gap/);
});

// --- (2) no enum leaks in the rendered surfaces -----------------------------

const RENDER_SOURCES = [
  "../src/app/(app)/assessments/[id]/report/page.tsx",
  "../src/app/passport/[token]/page.tsx",
  // The inline add-evidence form renders evidence types too — it leaked
  // `supplier declaration` (underscore-stripped) until the live scan found it.
  "../src/app/(app)/assessments/[id]/report/AddEvidenceForm.tsx",
  // INTAKE (Sprint 13). Absent from this list until today, which is exactly why
  // the new-assessment form shipped rendering `wood_solid`, `supplier_declaration`
  // and an underscore-stripped "no inherent risk" for months: the report and the
  // passport were guarded and the screen that CREATES their data was not.
  "../src/app/(app)/assessments/new/page.tsx",
  "../src/app/(app)/assessments/new/OrganisationPicker.tsx",
  "../src/app/(app)/assessments/[id]/evidence/ClaimReview.tsx",
];

test("the report and passport never render a raw enum expression", () => {
  // Patterns that put an enum on screen verbatim. `ruleReference()` is the one
  // sanctioned place an identifier appears, and it is muted + tooltipped.
  const banned: { pattern: RegExp; why: string }[] = [
    { pattern: /\{\s*outcome\.reasonCode\s*\}/, why: "renders the raw reason code" },
    { pattern: /\{\s*[a-z]\w*\.verdict\s*\}/, why: "renders the raw verdict token" },
    { pattern: /\.replace\(\/_\/g/, why: "underscore-stripping instead of a label" },
    { pattern: /risk \$\{/, why: 'interpolates a derived risk as a default "risk low"' },
    { pattern: /\{card\.checkpointId\}@\{card\.version\}/, why: "shows the version suffix by default" },
  ];
  for (const rel of RENDER_SOURCES) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    for (const { pattern, why } of banned) {
      assert.doesNotMatch(src, pattern, `${rel}: ${why}`);
    }
  }
});

test("passport headings and group labels read as English, not as enum values", () => {
  // Sprint 10: the passport gained headings, group labels and issuer/material
  // vocabularies that are rendered directly. The enum-leak rule applies to them
  // like anything else a reader sees — `wood_solid` reached the public page as
  // itself before this was checked.
  const src = readFileSync(new URL("../src/app/passport/[token]/page.tsx", import.meta.url), "utf8");

  // Visible labels only — the `label:` fields of the group tables. Deliberately
  // not every string in the file: `verdict: "not_applicable"` is a DATA value
  // matched against the payload, and a test that cannot tell a datum from a label
  // would have to be silenced rather than obeyed.
  const labels = [...src.matchAll(/\blabel:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(labels.length >= 5, `found only ${labels.length} labels — the scan is broken`);
  for (const label of labels) {
    assert.doesNotMatch(label, LOWER_SNAKE, `passport renders "${label}" as a snake_case identifier`);
    assert.doesNotMatch(label, SCREAMING_SNAKE, `passport renders "${label}" as an enum constant`);
  }

  // And the headings a reader actually scans.
  for (const heading of ["Rules", "Materials", "Producer registrations", "Attestations", "Proof", "Key value"]) {
    assert.ok(
      new RegExp(heading, "i").test(src),
      `passport is missing the "${heading}" heading the v3-lite layout depends on`,
    );
  }
});

test("every issuer type has a readable label, from ONE definition", () => {
  // ISSUER_TYPE_LABEL lived in the passport page AND the evidence drawer as two
  // identical copies — the exact drift labels.ts exists to prevent, and it would
  // have let the public page and the gated report disagree about what
  // `accredited_lab` is called. It is now defined once.
  for (const t of ISSUER_TYPES) {
    assert.ok(ISSUER_TYPE_LABEL[t], `issuer type "${t}" has no label`);
    assertReadable(
      issuerTypeLabel(t).replace(/^./, (c) => c.toUpperCase()),
      `issuer type ${t}`,
    );
  }
  // An unknown type degrades to English rather than leaking the identifier.
  assert.equal(issuerTypeLabel("some_new_kind"), "Some new kind");

  // And no render source defines its own copy.
  for (const rel of RENDER_SOURCES) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(
      src,
      /const ISSUER_TYPE_LABEL/,
      `${rel} defines its own issuer-type map instead of importing the one in labels.ts`,
    );
  }
});

test("the passport never calls anyone an auditor", () => {
  // House rule: this system does not audit, and must not borrow the word for a
  // verifier, a lab or a confirming assessor. Checked on the rendered sources
  // rather than on a vocabulary, because the word would arrive as prose.
  for (const rel of RENDER_SOURCES) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\bauditor/i, `${rel} uses the word "auditor"`);
  }
});

test("the rule reference is muted, tooltipped, and hides the version by default", () => {
  assert.equal(ruleReference("EU-PPWR-heavy-metals", 3), "EU-PPWR-heavy-metals");
  assert.equal(ruleReference("EU-PPWR-heavy-metals", 3, true), "EU-PPWR-heavy-metals@3");
  // Only the surfaces that actually SHOW a rule reference, named explicitly.
  // This used to be inferred from the filename ending in "page.tsx", which broke
  // the moment the intake page joined RENDER_SOURCES: the new-assessment form
  // shows no rule references, so demanding a tooltip there was meaningless.
  const surfacesShowingTheReference = [
    "../src/app/(app)/assessments/[id]/report/page.tsx",
    "../src/app/passport/[token]/page.tsx",
  ];
  for (const rel of surfacesShowingTheReference) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.match(src, /RULE_REFERENCE_TOOLTIP/, `${rel}: the identifier must carry the tooltip`);
    assert.match(src, /ruleReference\(/, `${rel}: the identifier must go through ruleReference()`);
  }
});

// --- (3) live HTML, when a running report is available -----------------------

const origin = process.env.REPORT_SMOKE_ORIGIN;
const liveGate = { skip: origin ? false : "set REPORT_SMOKE_ORIGIN (+ REPORT_SMOKE_PATH) to scan real HTML" };

test("rendered HTML contains no enum token outside the muted reference line", liveGate, async () => {
  const path = process.env.REPORT_SMOKE_PATH ?? "/";
  const res = await fetch(`${origin!.replace(/\/+$/, "")}${path}`, { redirect: "follow" });
  assert.equal(res.status, 200, `expected 200 from ${path}`);
  const html = await res.text();

  // Strip the sanctioned reference lines (the muted, tooltipped identifier) and
  // anything inside an href/URL, then look for leaks in what a reader sees.
  const visible = html
    // Script/style BODIES are not user-visible text. Next inlines the RSC
    // payload (props, chunk names) in <script>, which is not a rendering leak —
    // scanning it would only ever produce false positives.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // The sanctioned muted rule-reference line.
    .replace(/<p[^>]*title="Rule reference[^"]*"[^>]*>[\s\S]*?<\/p>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ");

  // Both need the g flag for matchAll; the module-level patterns stay non-global
  // because assertReadable uses them with .test()/doesNotMatch, where a shared
  // lastIndex would make results depend on call order.
  const screaming = [...visible.matchAll(new RegExp(SCREAMING_SNAKE, "g"))].map((m) => m[0]);
  const snake = [...visible.matchAll(new RegExp(LOWER_SNAKE, "g"))].map((m) => m[0]);
  assert.deepEqual(screaming, [], `SCREAMING_SNAKE enum tokens visible: ${screaming.join(", ")}`);
  assert.deepEqual(snake, [], `snake_case identifiers visible: ${snake.join(", ")}`);
});

test("humanise is a last resort that still reads as English", () => {
  assert.equal(humanise("some_unmapped_token"), "Some unmapped token");
});

// --- COMMIT 3: no development placeholder reaches a customer surface --------

import { NO_FACTOR_LABEL, factorSourceLabel, factorTierLabel } from "../src/lib/report/labels.ts";
import { PCF_DISCLAIMER, SCREENING_DISCLAIMER } from "../src/lib/report/language.ts";

// Words that belong in a backlog, not in front of a customer. "Placeholder" and
// "replace with" describe OUR state of work; a reader wants to know what the
// number is, not what we still intend to do about it. SEED-ESTIMATE joined them
// in Sprint 9 — the tier and every row carrying it are gone.
const DEV_PLACEHOLDER =
  /\bplaceholder\b|\breplace with\b|\bTODO\b|\bTBC\b|\bto be confirmed\b|\bcoming soon\b|SEED-ESTIMATE/i;

test("a factor names its publisher and dataset — that is what makes it checkable", () => {
  assert.equal(
    factorSourceLabel({ source: "ecoinvent", sourceDataset: "ecoinvent 3.10 cut-off" }),
    "ecoinvent / ecoinvent 3.10 cut-off",
  );
  // A dataset equal to (or absent from) the publisher is not repeated.
  assert.equal(factorSourceLabel({ source: "Fitsol", sourceDataset: null }), "Fitsol");
  assert.equal(factorSourceLabel({ source: "Fitsol", sourceDataset: "Fitsol" }), "Fitsol");
});

test("tier labels read as English and carry no leftover SEED-ESTIMATE", () => {
  assert.equal(factorTierLabel("primary"), "Primary (Fitsol)");
  assert.equal(factorTierLabel("secondary_database"), "Secondary database");
  assert.equal(factorTierLabel("none"), NO_FACTOR_LABEL);
  for (const t of ["primary", "secondary_database", "none"]) {
    assert.doesNotMatch(factorTierLabel(t), DEV_PLACEHOLDER);
  }
});

test("a material with no factor says so plainly", () => {
  assert.equal(NO_FACTOR_LABEL, "No factor selected");
  assert.doesNotMatch(NO_FACTOR_LABEL, DEV_PLACEHOLDER);
});

test("neither standing disclaimer describes our own unfinished work", () => {
  assert.doesNotMatch(PCF_DISCLAIMER, DEV_PLACEHOLDER);
  assert.doesNotMatch(SCREENING_DISCLAIMER, DEV_PLACEHOLDER);
});

test("no rendered report or passport string carries a development placeholder", () => {
  for (const file of [
    "../src/app/(app)/assessments/[id]/report/page.tsx",
    "../src/app/passport/[token]/page.tsx",
  ]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    // JSX text and string literals only — a code comment is not a customer surface.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    const hit = DEV_PLACEHOLDER.exec(code);
    assert.equal(hit, null, `${file} renders "${hit?.[0]}"`);
  }
});

test("SEED-ESTIMATE is gone from the whole source tree, not just the screen", () => {
  // The tier was removed in migration 0039 along with every row that carried it.
  // Anything still naming it is either dead code or a stale document.
  for (const file of [
    "../src/lib/engine/pcf.ts",
    "../src/lib/vocab.ts",
    "../src/db/factors.ts",
    "../src/lib/report/labels.ts",
    "../src/lib/report/language.ts",
  ]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(src, /SEED-ESTIMATE/, `${file} still names the retired tier`);
  }
});
