// The real liability guardrail. The risk lives in GENERATED OUTPUT, not in
// source strings, so these tests assert on what a rendered report says: it must
// carry the screening-only disclaimer and must never speak as an issuer, while
// remaining free to instruct the user about their own DoC obligations.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findLanguageViolations,
  SCREENING_DISCLAIMER,
} from "../src/lib/report/language.ts";

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

// --- Output-level assertions: enabled when the renderer lands (Sprint 2) -----

const RENDERER_PENDING = { skip: "renderQualificationReport lands in Sprint 2" };

test("rendered qualification report carries the screening disclaimer", RENDERER_PENDING, () => {
  // const report = renderQualificationReport(exideFixture, corpusVersion);
  // assert.ok(report.includes(SCREENING_DISCLAIMER));
});

test("rendered qualification report contains no issuing language", RENDERER_PENDING, () => {
  // const report = renderQualificationReport(exideFixture, corpusVersion);
  // assert.deepEqual(findLanguageViolations(report), []);
});

test("rendered report still instructs the user on their DoC obligation", RENDERER_PENDING, () => {
  // The inverse failure mode: over-sanitising output until it no longer tells
  // the user what they must actually do.
  // const report = renderQualificationReport(exideFixture, corpusVersion);
  // assert.match(report, /Declaration of Conformity/);
  // assert.match(report, /Annex VIII/);
});

test("rendered report records corpus version and as-of date", RENDERER_PENDING, () => {
  // Reproducibility: any report must be re-derivable months later.
  // const report = renderQualificationReport(exideFixture, corpusVersion);
  // assert.match(report, /Corpus version:/);
  // assert.match(report, /As of:/);
});

test("contested and draft checkpoints render as caveats, never verdicts", RENDERER_PENDING, () => {
  // assert.match(report, /under legal challenge/);
  // assert.doesNotMatch(contestedSection, /Qualified|Gap/);
});

test("PCF output is labelled screening-grade", RENDERER_PENDING, () => {
  // const pcf = renderPcf(...);
  // assert.match(pcf, /screening-grade/);
  // assert.deepEqual(findLanguageViolations(pcf), []);
});
