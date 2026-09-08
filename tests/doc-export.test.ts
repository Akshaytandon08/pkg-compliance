// COMMIT 2 — DoC draft export: plain-language filenames, eligibility gating, and
// the OUTPUT-LEVEL language guardrail on the produced .docx (extract text, run the
// same speaker-based check). Pure — no DB, no server — so it runs in npm run check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportFilename, DOC_KINDS } from "../src/lib/doc-export/filename.ts";
import { assessDoCEligibility } from "../src/lib/doc-export/eligibility.ts";
import { renderDocx } from "../src/lib/doc-export/docx.ts";
import { docxToText } from "../src/lib/doc-export/docx-text.ts";
import { FITSOL_BRAND, type DraftDocument } from "../src/lib/doc-export/model.ts";
import { findLanguageViolations } from "../src/lib/report/language.ts";
import type { PackReport, CheckpointCard } from "../src/lib/engine/pack.ts";
import type { AssessmentContextRecord } from "../src/db/schema.ts";

// --- filenames ------------------------------------------------------------
test("export filenames are plain-language and carry no internal ids", () => {
  const en = exportFilename({ kind: DOC_KINDS.doc, subject: "Demo — corrugated export carton", date: "2026-09-08", language: "en", ext: "docx" });
  assert.equal(en, "Draft-EU-Declaration-of-Conformity-Demo-corrugated-export-carton-2026-09-08.docx");
  const de = exportFilename({ kind: DOC_KINDS.doc, subject: "Carton", date: "2026-09-08", language: "de", ext: "pdf" });
  assert.equal(de, "Draft-EU-Declaration-of-Conformity-Carton-DE-2026-09-08.pdf");
  assert.doesNotMatch(en, /\bid\b|#\d|assessment_\d/i);
});

// --- eligibility ----------------------------------------------------------
function card(id: string, verdict: string, citation = "Regulation (EU) 2025/40, Article 15 (x). http"): CheckpointCard {
  return {
    checkpointId: id, version: 1, subject: "component", requirementText: id, citation, testMethod: null,
    evidenceRequirements: { allOf: [] }, outcome: { disposition: "verdict", verdict, reasonCode: "EVIDENCE_COMPLETE" } as CheckpointCard["outcome"],
    confidence: "H", laterOfCondition: null, exemptions: null,
  } as CheckpointCard;
}
function report(cards: CheckpointCard[]): PackReport {
  return {
    corpusVersion: "batch-1", asOf: "2026-09-08",
    componentSections: [{ component: { line: "1", name: "x", material: "corrugated", documents: [] }, cards }],
    packagingUnit: [], organisation: [], caveats: [],
    counts: { qualified: 0, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 },
    overall: { verdict: "qualified", evaluatedCount: cards.length },
  } as unknown as PackReport;
}
// A branded, own-spec pack → the user is the manufacturer (FAQ: branded → trademark owner).
const euCtx: AssessmentContextRecord = {
  destination_markets: ["EU"], destination_member_states: ["DE"], food_contact: false, persona: "2b",
  declared_reusable: false, legal_role_facts: { packaging_branded: true, custom_vs_standardised: "standardised", spec_defined_by: "user", manufacturer_is_non_eu: false },
};

test("a user who is the manufacturer with all requirements qualified + tech-doc is eligible", () => {
  const e = assessDoCEligibility(euCtx, report([card("EU-PPWR-technical-documentation", "qualified"), card("EU-PPWR-heavy-metals", "qualified")]));
  assert.equal(e.eligible, true, e.blockers.join(" "));
});

test("A1: a NON-EU, branded, own-spec manufacturer with all requirements qualified IS eligible", () => {
  const ctx = { ...euCtx, legal_role_facts: { ...euCtx.legal_role_facts, manufacturer_is_non_eu: true } };
  const e = assessDoCEligibility(ctx, report([card("EU-PPWR-technical-documentation", "qualified"), card("EU-PPWR-heavy-metals", "qualified")]));
  assert.equal(e.eligible, true, `non-EU must not block; got: ${e.blockers.join(" ")}`);
  // And no blocker mentions EU establishment.
  assert.ok(!e.blockers.some((b) => /EU-established|non-EU/i.test(b)));
});

test("an unbranded custom pack whose customer defined the spec is blocked, naming the customer", () => {
  const ctx = { ...euCtx, legal_role_facts: { packaging_branded: false, custom_vs_standardised: "custom" as const, spec_defined_by: "customer" as const } };
  const e = assessDoCEligibility(ctx, report([card("EU-PPWR-technical-documentation", "qualified")]));
  assert.equal(e.eligible, false);
  assert.ok(e.blockers.some((b) => /specification defined by your customer, who is therefore the manufacturer/i.test(b)), e.blockers.join(" "));
  assert.ok(!e.blockers.some((b) => /EU-established/i.test(b)));
});

test("the user declaring they act for the manufacturer unblocks the role gate", () => {
  const base = { packaging_branded: false, custom_vs_standardised: "custom" as const, spec_defined_by: "customer" as const };
  const blocked = assessDoCEligibility({ ...euCtx, legal_role_facts: base }, report([card("EU-PPWR-technical-documentation", "qualified")]));
  assert.equal(blocked.eligible, false);
  const declared = assessDoCEligibility({ ...euCtx, legal_role_facts: { ...base, acts_for_manufacturer: true } }, report([card("EU-PPWR-technical-documentation", "qualified")]));
  assert.equal(declared.eligible, true, declared.blockers.join(" "));
});

test("a gap and a missing tech-doc each block with their own reason", () => {
  const gap = assessDoCEligibility(euCtx, report([card("EU-PPWR-technical-documentation", "qualified"), card("EU-PPWR-heavy-metals", "gap")]));
  assert.equal(gap.eligible, false);
  assert.ok(gap.blockers.some((b) => /not every applicable requirement is qualified/i.test(b)));

  const noTechDoc = assessDoCEligibility(euCtx, report([card("EU-PPWR-heavy-metals", "qualified")]));
  assert.ok(noTechDoc.blockers.some((b) => /technical-documentation/i.test(b)));
});

test("empty destination Member States block", () => {
  const e = assessDoCEligibility({ ...euCtx, destination_member_states: [] }, report([card("EU-PPWR-technical-documentation", "qualified")]));
  assert.ok(e.blockers.some((b) => /Member States are not set/i.test(b)));
});

// --- manufacturer derivation (FAQ rules) ---------------------------------
test("deriveManufacturer follows the FAQ rules", async () => {
  const { deriveManufacturer } = await import("../src/lib/doc-export/manufacturer.ts");
  // branded → trademark owner (own spec → user)
  assert.equal(deriveManufacturer({ packaging_branded: true, spec_defined_by: "user" }).isAssessingUser, true);
  // branded, customer's trademark → customer
  assert.equal(deriveManufacturer({ packaging_branded: true, spec_defined_by: "customer" }).party, "customer");
  // unbranded + standardised → physical producer (not assumed to be the user)
  assert.equal(deriveManufacturer({ packaging_branded: false, custom_vs_standardised: "standardised" }).party, "physical_producer");
  // unbranded + custom → spec-definer
  assert.equal(deriveManufacturer({ packaging_branded: false, custom_vs_standardised: "custom", spec_defined_by: "user" }).isAssessingUser, true);
  assert.equal(deriveManufacturer({ packaging_branded: false, custom_vs_standardised: "custom", spec_defined_by: "customer" }).party, "customer");
  // insufficient facts → unknown, not a silent assignment
  assert.equal(deriveManufacturer({}).party, "unknown");
});

// --- docx-text guardrail (COMMIT 2.4) ------------------------------------
function docModel(blocks: DraftDocument["blocks"]): DraftDocument {
  return { watermark: "DRAFT — not a declaration until signed", brand: FITSOL_BRAND, blocks, title: "t", language: "en" };
}

test("the verbatim Annex 'issued' text passes the produced-docx guardrail", async () => {
  const model = docModel([
    { type: "annexElement", ref: "3", fixedText: "This declaration of conformity is issued under the sole responsibility of the manufacturer." },
    { type: "annexElement", ref: "7", fixedText: "Where applicable, the notified body … performed … and issued the certificate(s): …" },
  ]);
  const text = await docxToText(await renderDocx(model));
  assert.deepEqual(findLanguageViolations(text), [], "Annex fixed text must pass");
});

test("first-person issuing language in the produced docx FAILS the guardrail", async () => {
  const model = docModel([{ type: "paragraph", text: "We hereby certify that this packaging conforms." }]);
  const text = await docxToText(await renderDocx(model));
  const violations = findLanguageViolations(text);
  assert.ok(violations.length > 0, "system issuing-claim in the docx must be caught");
});

// --- retrofitted request templates (COMMIT 3) ----------------------------
test("request templates build a .docx, carry the disclaimer, and pass the guardrail", async () => {
  const { buildRequestModel } = await import("../src/lib/doc-export/request-doc.ts");
  const input = {
    packName: "Retail carton", asOf: "2026-09-08",
    component: { name: "Outer box", material: "corrugated", composition: "Kraft" },
    checkpoint: { id: "EU-PPWR-heavy-metals", requirementText: "Sum of heavy metals below 100 ppm", thresholds: [{ parameter: "Pb+Cd+Hg+CrVI", operator: "<" as const, value: 100, unit: "ppm" }], testMethod: "EN 13695-1", citation: "Regulation (EU) 2025/40, Article 5. https://x" },
  };
  for (const kind of ["supplier_declaration", "lab_test"] as const) {
    const model = buildRequestModel(kind, input);
    // A request is a letter it sends out — no diagonal DRAFT watermark.
    assert.equal(model.diagonalWatermark, undefined);
    const text = await docxToText(await renderDocx(model));
    assert.match(text, /not issued by this tool/);
    assert.match(text, /Pb\+Cd\+Hg\+CrVI/);
    assert.deepEqual(findLanguageViolations(text), [], `${kind} request must pass the guardrail`);
  }
});
