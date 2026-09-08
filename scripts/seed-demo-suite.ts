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
import { assessments } from "../src/db/schema.ts";
import { createAssessment, type NewAssessment } from "../src/db/assessments.ts";

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

  // 2. Corrugated export carton — non-food, no wood, every component carries a
  //    supplier declaration, so the component checkpoints resolve qualified.
  {
    packName: CARTON,
    description: "Corrugated transit carton, OEM shipping own goods; complete supplier evidence.",
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
        evidence: [supplierDeclaration("Outer carton (B-flute corrugated)", "corrugated")],
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

for (const pack of packs) {
  const id = await createAssessment(pack);
  console.log(`Seeded demo #${id} — "${pack.packName}" (demo=true).`);
}
console.log("\nThree demo packs seeded. Open / to run the demo (see docs/DEMO_SCRIPT.md).");
process.exit(0);
