// Seeds the three demonstration packs the 5-minute demo runs on (see
// docs/DEMO_SCRIPT.md). All three are flagged demo=true so the report and the
// public passport show a visible "Demonstration data" tag, and every fabricated
// evidence reference is prefixed SYNTHETIC-DEMO — a synthetic pack must never be
// mistaken for a real screening.
//
// Rule-facing shape (which checkpoints fire, which evidence satisfies them) is
// derived from the IN-FORCE corpus, not invented:
//   - non-food, no wood  → PFAS + wood rules do not apply;
//   - food_contact true   → PFAS applies and needs a lab_test/test_report;
//   - a supplier_declaration satisfies heavy-metals / SoC / composite-relevant.
//
// Idempotent: deletes any pack with these exact names first, then recreates —
// so a second run (and the DEMO_SCRIPT reset) leaves exactly three demo packs.
// Works against local and hosted DB (uses the app's DATABASE_URL).
//   Run:  node --env-file=.env scripts/seed-demo-suite.ts
import { inArray } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { assessments, organisations } from "../src/db/schema.ts";
import { createAssessment, type NewAssessment } from "../src/db/assessments.ts";
import { createOrganisation, type NewOrganisation } from "../src/db/organisations.ts";

const GOLDEN = "Client A — traction-cell (demo)";
const CARTON = "Demo — corrugated export carton";
const POUCH = "Demo — food-contact laminate pouch";

const SD = "SYNTHETIC-DEMO"; // prefix stamped on every fabricated evidence reference

const supplierDeclaration = (component: string, material: string) => ({
  evidenceType: "supplier_declaration",
  reference: `${SD} — supplier declaration (heavy metals, SoC, composition) for ${component}`,
  scopeComponents: [component],
  scopeMaterials: [material],
});

// The obligated economic operator each pack is screened FOR. A screening is
// always prepared for a named legal person — that is what a declaration of
// conformity is signed by and what an EPR register knows — so the demo packs
// carry one rather than leaving the report header blank.
//
// SYNTHETIC-DEMO appears in the legal name itself, not only in the demo flag.
// These names reach a draft declaration of conformity and the public passport's
// declarant block, which are precisely the artefacts that must never be mistaken
// for a real one; a marker on the name survives a screenshot or a PDF that has
// been separated from its "Demonstration data" tag.
const orgs: Record<string, NewOrganisation> = {
  [GOLDEN]: {
    legalName: `Meridian Cell Technologies Private Limited (${SD})`,
    tradingName: "Meridian Cell",
    country: "IN",
    registeredAddress: `${SD} — Plot 14, Hosur Industrial Area, Karnataka 635109, India`,
    primaryContact: "compliance@example.invalid",
    // Non-EU manufacturer shipping into DE with no EU establishment: no EPR
    // registration on file, which is part of what this pack demonstrates.
    roleDefault: "manufacturer",
    demo: true,
  },
  [CARTON]: {
    legalName: `Rheinsolt Verpackungswerke GmbH (${SD})`,
    tradingName: "Rheinsolt",
    country: "DE",
    registeredAddress: `${SD} — Industriestraße 8, 47051 Duisburg, Germany`,
    primaryContact: "verpackung@example.invalid",
    roleDefault: "epr_producer",
    demo: true,
    registrations: [
      {
        scheme: "epr_packaging",
        registerName: "LUCID (Zentrale Stelle Verpackungsregister)",
        registrationNumber: `${SD}-DE4102938475610`,
        jurisdiction: "DE",
        validFrom: "2024-01-15",
      },
    ],
  },
  [POUCH]: {
    // A Dutch brand owner placing on the German market: establishment and EPR
    // obligation sit in different Member States, which is the case the
    // per-Member-State registration list exists for.
    legalName: `Kestrel Foods Europe B.V. (${SD})`,
    tradingName: "Kestrel Foods",
    country: "NL",
    registeredAddress: `${SD} — Havenweg 22, 3011 AB Rotterdam, Netherlands`,
    primaryContact: "qa@example.invalid",
    roleDefault: "epr_producer",
    demo: true,
    registrations: [
      {
        scheme: "epr_packaging",
        registerName: "LUCID (Zentrale Stelle Verpackungsregister)",
        registrationNumber: `${SD}-DE5820394857261`,
        jurisdiction: "DE",
        validFrom: "2023-06-01",
      },
      {
        scheme: "epr_packaging",
        registerName: "Stichting Verpact (Mijn Verpact)",
        registrationNumber: `${SD}-NL-VPT-88214`,
        jurisdiction: "NL",
        validFrom: "2022-03-01",
      },
    ],
  },
};

const packs: NewAssessment[] = [
  // 1. The anonymised golden run — evidence mostly absent (blocked by missing
  //    evidence, not chemistry); only the pine pallet carries its HT/IPPC mark.
  {
    packName: GOLDEN,
    description: "Anonymised golden-run pack: pallet/transport, industrial B2B, non-food-contact.",
    asOf: "2026-08-12",
    demo: true,
    context: {
      destination_markets: ["EU"],
      destination_member_states: ["DE"],
      food_contact: false,
      persona: "2a",
      declared_reusable: false,
      legal_role_facts: {
        packaging_branded: false,
        custom_vs_standardised: "custom",
        spec_defined_by: "customer",
        manufacturer_is_non_eu: true,
      },
    },
    components: [
      {
        line: "1",
        name: "Pine wood pallet / crate (heat treated)",
        material: "wood_solid",
        composition: "Pine, heat treated (ISPM 15 HT)",
        weightGrams: 12000,
        sourcedFrom: "IN",
        evidence: [
          {
            evidenceType: "marking",
            reference: `${SD} — IPPC/HT mark IN-747 HT`,
            scopeComponents: ["Pine wood pallet / crate (heat treated)"],
            scopeMaterials: ["wood_solid"],
          },
        ],
      },
      { line: "2", name: "Nails (2\")", material: "metal", composition: "Steel fastener", weightGrams: 200, sourcedFrom: "IN", evidence: [] },
      { line: "3", name: "Corrugated sheet", material: "corrugated", composition: "Paper / cardboard", weightGrams: 800, sourcedFrom: "IN", evidence: [] },
      { line: "4", name: "Honeycomb buffer", material: "corrugated", composition: "Kraft paper 100%", weightGrams: 300, sourcedFrom: "IN", evidence: [] },
      { line: "5", name: "Edge board", material: "corrugated", composition: "Kraft layers + water-based adhesive", weightGrams: 250, sourcedFrom: "IN", evidence: [] },
      { line: "6", name: "Poly packet (LDPE bag)", material: "plastic", composition: "LDPE mono-material", weightGrams: 40, sourcedFrom: "IN", evidence: [] },
      {
        line: "7",
        name: "Green polyester strap (PET)",
        material: "plastic",
        composition: "PET with green pigment",
        weightGrams: 60,
        sourcedFrom: "IN",
        riskAnnotation: "at_risk",
        riskRationale:
          "Green/yellow pigment families historically include lead chromate, which fails Pb and Cr(VI) simultaneously. Modern organic pigments comply but must be evidenced by a pigment specification or an XRF/lab test.",
        riskAnnotatedBy: "Demo seed",
        evidence: [],
      },
    ],
  },

  // 2. Corrugated export carton — non-food, no wood, EU manufacturer. Every
  //    component carries a supplier declaration (component checkpoints qualify) AND
  //    the packaging-unit / organisation obligations are evidenced (technical file,
  //    operator marking, EPR registration), so this pack is eligible for a DRAFT EU
  //    declaration of conformity. The DoC itself is the artefact being drafted, so
  //    it is not pre-required (see eligibility.ts DOC_ITSELF_CHECKPOINT).
  {
    packName: CARTON,
    description: "Corrugated transit carton, OEM shipping own goods; complete supplier + unit-level evidence.",
    asOf: "2026-08-12",
    demo: true,
    context: {
      destination_markets: ["EU"],
      destination_member_states: ["DE"],
      food_contact: false,
      persona: "2b",
      declared_reusable: false,
      legal_role_facts: {
        packaging_branded: true,
        custom_vs_standardised: "standardised",
        spec_defined_by: "user",
        manufacturer_is_non_eu: false,
      },
    },
    components: [
      {
        line: "1",
        name: "Outer carton (B-flute corrugated)",
        material: "corrugated",
        composition: "Kraft linerboard + fluting, water-based flexo print",
        weightGrams: 900,
        sourcedFrom: "DE",
        evidence: [
          supplierDeclaration("Outer carton (B-flute corrugated)", "corrugated"),
          // Packaging-unit / organisation obligations (subject != component, so the
          // evaluator matches these regardless of component scope).
          {
            evidenceType: "technical_file",
            reference: `${SD} — technical documentation (Annex VII) held by the manufacturer for the carton`,
            scopeComponents: ["Outer carton (B-flute corrugated)"],
            scopeMaterials: ["corrugated"],
          },
          {
            evidenceType: "marking",
            reference: `${SD} — operator identification marking (EU manufacturer name + address on pack)`,
            scopeComponents: ["Outer carton (B-flute corrugated)"],
            scopeMaterials: ["corrugated"],
          },
          {
            evidenceType: "registration",
            reference: `${SD} — EPR producer registration (DE packaging register)`,
            scopeComponents: ["Outer carton (B-flute corrugated)"],
            scopeMaterials: ["corrugated"],
          },
        ],
      },
      {
        line: "2",
        name: "Inner fitting (corrugated)",
        material: "corrugated",
        composition: "Kraft die-cut insert, unbleached",
        weightGrams: 350,
        sourcedFrom: "DE",
        evidence: [supplierDeclaration("Inner fitting (corrugated)", "corrugated")],
      },
      {
        line: "3",
        name: "Kraft paper label",
        material: "corrugated",
        composition: "Uncoated kraft label, water-based adhesive",
        weightGrams: 15,
        sourcedFrom: "DE",
        evidence: [supplierDeclaration("Kraft paper label", "corrugated")],
      },
    ],
  },

  // 3. Food-contact laminate pouch — food_contact true, so PFAS applies (the
  //    contrast to the carton). The barrier coating is annotated at_risk on
  //    fluorochemistry grounds and has NO lab test → a TEST_REQUIRED conditional.
  {
    packName: POUCH,
    description: "Food-contact stand-up pouch, brand owner; PFAS applicability + at-risk coating.",
    asOf: "2026-08-12",
    demo: true,
    context: {
      destination_markets: ["EU"],
      destination_member_states: ["DE"],
      food_contact: true,
      persona: "1",
      declared_reusable: false,
      legal_role_facts: {
        packaging_branded: true,
        custom_vs_standardised: "custom",
        spec_defined_by: "user",
        manufacturer_is_non_eu: false,
      },
    },
    components: [
      {
        line: "1",
        name: "Laminate film (PET/AL/PE)",
        material: "plastic",
        composition: "Multi-layer laminate: PET / aluminium foil / PE; plastic fraction ≥5% (composite)",
        weightGrams: 8,
        sourcedFrom: "DE",
        evidence: [supplierDeclaration("Laminate film (PET/AL/PE)", "plastic")],
      },
      {
        line: "2",
        name: "Barrier coating",
        material: "plastic",
        composition: "Functional grease/moisture barrier coating",
        weightGrams: 1,
        sourcedFrom: "DE",
        riskAnnotation: "at_risk",
        riskRationale:
          "Some grease-barrier coatings historically used per- and polyfluoroalkyl substances (PFAS). Food-contact placing on the EU market must evidence the PFAS restriction by lab test / test report; none is on file.",
        riskAnnotatedBy: "Demo seed",
        evidence: [],
      },
    ],
  },
];

// Idempotent reset: remove any prior copies of these packs (cascades to
// components + evidence), then recreate. demo data only — never touches a real
// pack, whose name would not match.
await db.delete(assessments).where(inArray(assessments.packName, [GOLDEN, CARTON, POUCH]));
// Organisations are deleted second: assessments.organisation_id is ON DELETE SET
// NULL, so removing them first would orphan rather than cascade.
await db.delete(organisations).where(
  inArray(
    organisations.legalName,
    Object.values(orgs).map((o) => o.legalName),
  ),
);

for (const pack of packs) {
  const organisationId = await createOrganisation(orgs[pack.packName]);
  const id = await createAssessment({ ...pack, organisationId });
  console.log(
    `Seeded demo #${id} — "${pack.packName}" (demo=true), prepared for org #${organisationId}.`,
  );
}
console.log("\nThree demo packs seeded. Open / to run the demo (see docs/DEMO_SCRIPT.md).");
process.exit(0);
