// Seeds the anonymised golden pack (Client A traction-cell) as a demo
// assessment, so the app has something to show before any real upload. Faithful
// to the golden run: evidence is mostly absent (the pack is blocked by missing
// evidence, not chemistry); only the pine pallet carries its HT/IPPC mark.
//
// Run with env loaded:  node --env-file=.env scripts/seed-demo.ts
import { createAssessment, listAssessments, type NewComponent } from "../src/db/assessments.ts";

const PACK_NAME = "Client A — traction-cell (demo)";

const components: NewComponent[] = [
  {
    line: "1",
    name: "Pine wood pallet / crate (heat treated)",
    material: "wood_solid",
    composition: "Pine, heat treated (ISPM 15 HT)",
    sourcedFrom: "IN",
    evidence: [
      {
        evidenceType: "marking",
        reference: "IPPC/HT mark IN-747 HT",
        scopeComponents: ["Pine wood pallet / crate (heat treated)"],
        scopeMaterials: ["wood_solid"],
      },
    ],
  },
  { line: "2", name: "Nails (2\")", material: "metal", composition: "Steel fastener", sourcedFrom: "IN", evidence: [] },
  { line: "3", name: "Corrugated sheet", material: "corrugated", composition: "Paper / cardboard", sourcedFrom: "IN", evidence: [] },
  { line: "4", name: "Honeycomb buffer", material: "corrugated", composition: "Kraft paper 100%", sourcedFrom: "IN", evidence: [] },
  { line: "5", name: "Edge board", material: "corrugated", composition: "Kraft layers + water-based adhesive", sourcedFrom: "IN", evidence: [] },
  { line: "6", name: "Poly packet (LDPE bag)", material: "plastic", composition: "LDPE mono-material", sourcedFrom: "IN", evidence: [] },
  {
    line: "7",
    name: "Green polyester strap (PET)",
    material: "plastic",
    composition: "PET with green pigment",
    sourcedFrom: "IN",
    riskAnnotation: "at_risk",
    riskRationale:
      "Green/yellow pigment families historically include lead chromate, which fails Pb and Cr(VI) simultaneously. Modern organic pigments comply but must be evidenced by a pigment specification or an XRF/lab test.",
    riskAnnotatedBy: "Akshay Tandon",
    evidence: [],
  },
];

const existing = await listAssessments();
if (existing.some((a) => a.packName === PACK_NAME)) {
  console.log(`Demo assessment "${PACK_NAME}" already exists — skipping.`);
  process.exit(0);
}

const id = await createAssessment({
  packName: PACK_NAME,
  description: "Anonymised golden-run pack: pallet/transport, industrial B2B, non-food-contact.",
  asOf: "2026-08-12",
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
  components,
});

console.log(`Seeded demo assessment #${id} — "${PACK_NAME}".`);
console.log("Open /assessments/" + id + "/report to view the screening.");
process.exit(0);
