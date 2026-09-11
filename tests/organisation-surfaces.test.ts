// Where the organisation reaches a reader: the report header, the public
// passport, and Annex VIII element 2 of a declaration draft. Pure — no DB, no
// server — so it runs in `npm run check`.
//
// The three properties worth pinning are the ones that would do damage if they
// regressed quietly: an absent organisation must never be filled in with a
// placeholder; a pre-filled legal field must never look like a signed fact; and
// a passport minted before organisations existed must still hash to what it did.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countryLabel, legalRoleLabel, preparedForLine } from "../src/lib/report/labels.ts";
import { buildDoCDraft, type DoCDraftInputs } from "../src/lib/doc-export/doc-draft.ts";
import { FIELD_PREFIX_BLANK, FIELD_PREFIX_FILLED, FITSOL_BRAND, type DraftDocument } from "../src/lib/doc-export/model.ts";
import { renderDocx } from "../src/lib/doc-export/docx.ts";
import { docxToText } from "../src/lib/doc-export/docx-text.ts";
import { findLanguageViolations } from "../src/lib/report/language.ts";
import { passportContentHash, type PassportPayload } from "../src/db/passport.ts";
import type { PackReport } from "../src/lib/engine/pack.ts";
import type { AssessmentContextRecord } from "../src/db/schema.ts";
import type { DocTemplateRecord } from "../src/db/doc-templates.ts";

// --- the "prepared for" line ------------------------------------------------

test("the identity line reads legal name · country · role", () => {
  assert.equal(
    preparedForLine({ legalName: "Rheinsolt GmbH", country: "DE", roleDefault: "epr_producer" }),
    "Rheinsolt GmbH · Germany · EPR producer",
  );
});

test("a part the record does not hold is OMITTED, never filled with a placeholder", () => {
  const line = preparedForLine({ legalName: "Kestrel Foods Europe B.V.", country: "NL", roleDefault: null });
  assert.equal(line, "Kestrel Foods Europe B.V. · Netherlands");
  assert.doesNotMatch(line, /unknown|TBC|to be confirmed|—/i);
});

test("an unrecognised country or role degrades to the raw value, never to nothing", () => {
  assert.equal(countryLabel("ZZ"), "ZZ");
  assert.equal(countryLabel("Ruritania"), "Ruritania");
  assert.equal(legalRoleLabel("waste_management_operator"), "Waste management operator");
});

// --- Annex VIII element 2 ---------------------------------------------------

const template = {
  templateId: "eu-doc-annex-viii",
  version: 1,
  title: "EU declaration of conformity",
  sourceCitation: "Regulation (EU) 2025/40, Annex VIII",
  elements: [
    { ref: "2", fixedText: "Name and address of the manufacturer and, where applicable, of its authorised representative:", fillLabel: null },
  ],
} as unknown as DocTemplateRecord;

const context: AssessmentContextRecord = {
  destination_markets: ["EU"], destination_member_states: ["DE"], food_contact: false, persona: "2b",
  declared_reusable: false,
  legal_role_facts: { packaging_branded: true, custom_vs_standardised: "standardised", spec_defined_by: "user", manufacturer_is_non_eu: false },
};

const emptyReport = {
  corpusVersion: "batch-1", asOf: "2026-09-11",
  componentSections: [], packagingUnit: [], organisation: [], caveats: [], upcoming: [],
  counts: { qualified: 0, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 },
  overall: { verdict: "qualified", evaluatedCount: 0 },
} as unknown as PackReport;

function draft(organisation: DoCDraftInputs["organisation"]) {
  return buildDoCDraft({
    template, packName: "Carton", draftVersion: 1, context, report: emptyReport,
    components: [], language: "en", generatedDate: "2026-09-11", organisation,
  });
}

function fields(d: ReturnType<typeof draft>) {
  return d.blocks.filter((b) => b.type === "field") as Extract<DraftDocument["blocks"][number], { type: "field" }>[];
}

test("element 2 pre-fills from the organisation, registrations included", () => {
  const [field] = fields(draft({
    legalName: "Rheinsolt Verpackungswerke GmbH",
    tradingName: "Rheinsolt",
    country: "DE",
    registeredAddress: "Industriestraße 8, 47051 Duisburg",
    registrations: [{ jurisdiction: "DE", registerName: "LUCID", registrationNumber: "DE4102938475610" }],
  }));
  assert.match(field.value!, /Rheinsolt Verpackungswerke GmbH \(trading as Rheinsolt\)/);
  assert.match(field.value!, /Industriestraße 8, 47051 Duisburg/);
  assert.match(field.value!, /Producer registration — DE: DE4102938475610 \(LUCID\)/);
});

test("no organisation leaves element 2 blank — a declarant is never invented", () => {
  const [field] = fields(draft(null));
  assert.equal(field.value, undefined);
  assert.match(field.label, /manufacturer name and address/);
});

test("a pre-filled element 2 says CONFIRM BEFORE SIGNING, not 'to complete'", async () => {
  const model = draft({ legalName: "Rheinsolt Verpackungswerke GmbH", country: "DE" });
  const text = await docxToText(await renderDocx(model));
  assert.match(text, /CONFIRM BEFORE SIGNING/);
  assert.ok(
    !text.includes(FIELD_PREFIX_BLANK.trim()),
    "a filled field must not read as an empty one — the signer would skim past it",
  );
  assert.ok(FIELD_PREFIX_FILLED.includes("CONFIRM BEFORE SIGNING"));
  // The pre-filled identity must not turn the draft into a claim by this tool.
  assert.deepEqual(findLanguageViolations(text), []);
});

// --- passport backward compatibility ---------------------------------------

const legacyPayload: PassportPayload = {
  disclosureModel: "v2",
  packName: "Carton", corpusVersion: "batch-1", asOf: "2026-09-11", demo: false,
  materialComposition: [{ material: "corrugated", componentCount: 1 }],
  counts: { qualified: 1, conditional: 0, gap: 0, not_applicable: 0, caveat: 0 },
  overallVerdict: "qualified", checkpoints: [],
  pcf: { totalKgCo2e: 1.23, unit: "kg CO2e", resolvedComponents: 1, unresolvedComponents: 0 },
};

test("a passport minted before organisations existed hashes exactly as it did", () => {
  // The field is OMITTED rather than set to null when there is no organisation,
  // so the canonical form of an old payload is untouched and its stored hash
  // still verifies. Setting `declarant: undefined` explicitly must not differ.
  const before = passportContentHash(legacyPayload);
  const after = passportContentHash({ ...legacyPayload, declarant: undefined });
  assert.equal(after, before, "an absent declarant must not perturb the hash chain");
});

test("adding a declarant IS a content change — it is disclosed, so it is chained", () => {
  const withDeclarant: PassportPayload = {
    ...legacyPayload,
    declarant: { legalName: "Rheinsolt Verpackungswerke GmbH", country: "DE", role: "epr_producer" },
  };
  assert.notEqual(passportContentHash(withDeclarant), passportContentHash(legacyPayload));
});

test("the passport brand tokens are untouched by any of this", () => {
  assert.equal(FITSOL_BRAND.wordmark, "Fitsol");
});
