// The real liability guardrail. The risk lives in GENERATED OUTPUT, not in
// source strings, so these tests assert on what a rendered report says: it must
// carry the screening-only disclaimer and must never speak as an issuer, while
// remaining free to instruct the user about their own DoC obligations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findLanguageViolations,
  SCREENING_DISCLAIMER,
  PCF_DISCLAIMER,
} from "../src/lib/report/language.ts";
import { evaluatePack } from "../src/lib/engine/pack.ts";
import type { AssessmentContext } from "../src/lib/engine/evaluate.ts";

const ctx = {
  destination_member_states: ["DE"], food_contact: false, persona: "2a",
  declared_reusable: false, legal_role_facts: {},
} as unknown as AssessmentContext;

// --- Detector behaviour: the corpus must be able to state law precisely ------

test("permits legitimate legal terminology as a user obligation", () => {
  // Verbatim and near-verbatim from the reference artefacts. If any of these
  // trip the guardrail, seeders would paraphrase legal text to get past it —
  // corrupting the precision the citations exist to protect.
  const permitted = [
    "Issue Declaration of Conformity per Annex VIII; retain 5 years (single-use)",
    "EU Declaration of Conformity issued per Annex VIII; retained 5 yrs (single-use) / 10 yrs (reusable)",
    "The obligated economic operator must compile technical documentation per Annex VII (Module A self-assessment).",
    "Confirm who is 'manufacturer' (brand/spec owner) per Commission guidance.",
    "Recycled-content certificates (e.g. mass-balance/UL/SCS) required from 2030.",
    "Does your organisation hold ISO 14001 certification? Yes — certificate attached.",
    "Certification held by the supplier: FSC Chain of Custody.",
    "This screening does not verify compliance.",
    "Screening-grade product carbon footprint, ISO 14067-aligned methodology.",
  ];
  for (const text of permitted) {
    assert.deepEqual(
      findLanguageViolations(text),
      [],
      `wrongly flagged: ${text}`,
    );
  }
});

test("catches the system presenting itself as issuer, certifier or verifier", () => {
  const forbidden = [
    "We certify that this packaging complies with Regulation (EU) 2025/40.",
    "Fitsol certifies the heavy-metal content of every component.",
    "This report certifies conformity with Annex VIII.",
    "This document declares conformity for the packaging specification.",
    "This packaging is hereby certified as compliant.",
    "We hereby declare that the components meet the 100 mg/kg limit.",
    "We issue a Declaration of Conformity on your behalf.",
    "Audit-grade product carbon footprint.",
    "audit grade emissions figure",
    "Verified PCF for this SKU.",
    "This passport verifies the recycled content.",
  ];
  for (const text of forbidden) {
    const violations = findLanguageViolations(text);
    assert.ok(violations.length > 0, `missed violation: ${text}`);
  }
});

test("disclaimer itself passes the guardrail", () => {
  assert.deepEqual(findLanguageViolations(SCREENING_DISCLAIMER), []);
});

// --- Output-level assertions -------------------------------------------------
// These were six permanently-skipped stubs waiting on a `renderQualificationReport`
// that was never built — the report became a React page instead. Empty tests with
// an obsolete reason are worse than no tests: they read as coverage and assert
// nothing. Each intent is now pointed at code that actually exists.

test("the screening disclaimer exists, is unambiguous, and passes the guardrail", () => {
  assert.match(SCREENING_DISCLAIMER, /not a Declaration of Conformity/i);
  assert.match(SCREENING_DISCLAIMER, /does not verify compliance/i);
  assert.deepEqual(findLanguageViolations(SCREENING_DISCLAIMER), []);
});

test("the disclaimer still tells the user what THEY must do (not over-sanitised)", () => {
  // The inverse failure mode: scrubbing output until it no longer states the
  // user's own obligation. Responsibility must remain explicitly theirs.
  assert.match(SCREENING_DISCLAIMER, /Responsibility/i);
  assert.match(SCREENING_DISCLAIMER, /obligated economic operator/i);
});

test("the report page renders the disclaimer verbatim, not a paraphrase", () => {
  // Structural: the page must use the shared constant, so the wording cannot
  // drift out of sync with the guardrail that polices it.
  const page = readFileSync(new URL("../src/app/(app)/assessments/[id]/report/page.tsx", import.meta.url), "utf8");
  assert.match(page, /SCREENING_DISCLAIMER/, "the report page must render the shared disclaimer constant");
});

test("a pack report records corpus version and as-of date (reproducibility)", () => {
  // Any report must be re-derivable months later, so both must be on the object.
  const report = evaluatePack({
    checkpoints: [], context: ctx, components: [], asOf: "2026-08-12", corpusVersion: "batch-1",
  });
  assert.equal(report.corpusVersion, "batch-1");
  assert.equal(report.asOf, "2026-08-12");
});

test("contested and draft checkpoints render as caveats, never verdicts", () => {
  const mk = (status: string, id: string) => ({
    id, version: 1, status, subject: "packaging_unit", requirementText: "r",
    citation: "c https://eur-lex.europa.eu/x", testMethod: null,
    evidenceRequirements: { allOf: [{ anyOf: ["supplier_declaration"] }] },
    appliesWhen: null, material: null, triggerDate: null, sunsetDate: null,
    confidence: "H", laterOfCondition: null, exemptions: null, notApplicableReason: null,
  }) as never;
  const report = evaluatePack({
    checkpoints: [mk("contested", "C-1"), mk("draft", "D-1")],
    context: ctx, components: [], asOf: "2026-08-12", corpusVersion: "v",
  });
  assert.equal(report.caveats.length, 2, "both must be caveats");
  assert.equal(report.counts.qualified + report.counts.gap + report.counts.conditional, 0, "neither may yield a verdict");
  assert.equal(report.overall.verdict, "pending");
  assert.match(report.caveats.map((c) => c.caveat?.label ?? "").join(" "), /challenge|approval/i);
});

test("the PCF label says screening-grade and passes the guardrail", () => {
  assert.match(PCF_DISCLAIMER, /Screening-grade/i);
  assert.match(PCF_DISCLAIMER, /not audit-level/i);
  assert.deepEqual(findLanguageViolations(PCF_DISCLAIMER), []);
});
