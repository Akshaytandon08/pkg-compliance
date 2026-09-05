// Request templates are drafting aids the user sends OUT — never conformity
// documents, never system-issued. This asserts the generated text says so and
// carries no issuing/certifying language (brief §1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, supplierDeclarationRequest, labTestRequest, type TemplateInput } from "../src/lib/report/templates.ts";
import { findLanguageViolations } from "../src/lib/report/language.ts";

const input: TemplateInput = {
  packName: "Client A — traction-cell (demo)",
  asOf: "2026-08-12",
  component: { name: "Green polyester strap (PET)", material: "plastic", composition: "PET with green pigment" },
  checkpoint: {
    id: "EU-PPWR-heavy-metals",
    requirementText: "The sum of Pb+Cd+Hg+Cr(VI) shall not exceed 100 mg/kg.",
    thresholds: [{ parameter: "Pb+Cd+Hg+Cr(VI) sum", operator: "<=", value: 100, unit: "mg/kg" }],
    testMethod: "CR 13695-1:2000",
    citation: "Regulation (EU) 2025/40, Article 5. https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng",
  },
};

test("both templates carry no issuing/certifying language", () => {
  for (const kind of ["supplier_declaration", "lab_test"] as const) {
    const text = renderTemplate(kind, input);
    assert.deepEqual(findLanguageViolations(text), [], `language violation in ${kind}`);
  }
});

test("templates state they are a drafting aid, not a system-issued document", () => {
  for (const text of [supplierDeclarationRequest(input), labTestRequest(input)]) {
    assert.match(text, /drafting aid/);
    assert.match(text, /not issued by this tool/);
    assert.match(text, /request template you send out/);
  }
});

test("templates are populated from the checkpoint threshold, method and component", () => {
  const supplier = supplierDeclarationRequest(input);
  assert.match(supplier, /Pb\+Cd\+Hg\+Cr\(VI\) sum <= 100 mg\/kg/);
  assert.match(supplier, /CR 13695-1:2000/);
  assert.match(supplier, /Green polyester strap \(PET\)/);
  const lab = labTestRequest(input);
  assert.match(lab, /accredited laboratory/);
  assert.match(lab, /pass\/fail/);
});
