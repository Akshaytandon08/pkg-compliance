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
import { requireIntendedTarget } from "../src/lib/factors/target.ts";
import { seedConfirmedHeavyMetalsClaim } from "./seed-demo-claim.ts";
import { parseArgs } from "./corpus-lib.ts";

// This script DELETES and recreates the demo packs, so it says which database
// it is about to do that to, and refuses a remote one without --remote.
requireIntendedTarget(parseArgs(process.argv.slice(2)).remote === true, "seed:demo-suite");

const GOLDEN = "Client A — traction-cell (demo)";
const CARTON = "Demo — corrugated export carton";
const POUCH = "Demo — food-contact laminate pouch";

const SD = "SYNTHETIC-DEMO"; // prefix stamped on every fabricated evidence reference

// A supplier declaration is issued by the supplier's own quality function — the
// weakest issuer type, and the passport now says so rather than leaving a reader
// to assume a lab was involved.
const supplierDeclaration = (component: string, material: string) => ({
  evidenceType: "supplier_declaration",
  reference: `${SD} — supplier declaration (heavy metals, SoC, composition) for ${component}`,
  scopeComponents: [component],
  scopeMaterials: [material],
  issuedDate: "2026-03-14",
});

// --- Minimal traceability (Sprint 10) --------------------------------------
// Applied by component NAME after the packs are declared, rather than inlined
// into each literal: twelve components across three packs, and threading three
// more fields through every one of them by hand is how a seed drifts out of
// step with itself.
//
// `recycledShare` is deliberately absent (not zero) on the wood pallet and the
// two pouch components: "not stated" and "stated as none" are different facts,
// and the passport renders them differently. The LDPE bag carries an explicit 0
// so both cases appear in the demo.
type Trace = { countryOfOrigin: string; supplierName: string; recycledShare?: number };
const TRACE: Record<string, Trace> = {
  "Pine wood pallet / crate (heat treated)": { countryOfOrigin: "Karnataka, India", supplierName: `${SD} — Hosur Timber & Pallets Pvt Ltd` },
  'Nails (2")': { countryOfOrigin: "Maharashtra, India", supplierName: `${SD} — Sahyadri Fasteners`, recycledShare: 0.62 },
  "Corrugated sheet": { countryOfOrigin: "Tamil Nadu, India", supplierName: `${SD} — Coimbatore Board Mills`, recycledShare: 0.71 },
  "Honeycomb buffer": { countryOfOrigin: "Tamil Nadu, India", supplierName: `${SD} — Coimbatore Board Mills`, recycledShare: 0.68 },
  "Edge board": { countryOfOrigin: "Gujarat, India", supplierName: `${SD} — Vapi Paper Converters`, recycledShare: 0.55 },
  "Poly packet (LDPE bag)": { countryOfOrigin: "Gujarat, India", supplierName: `${SD} — Vapi Polyfilms`, recycledShare: 0 },
  "Green polyester strap (PET)": { countryOfOrigin: "Maharashtra, India", supplierName: `${SD} — Nashik Strapping Industries`, recycledShare: 0.3 },
  "Outer carton (B-flute corrugated)": { countryOfOrigin: "North Rhine-Westphalia, Germany", supplierName: `${SD} — Duisburg Wellpappe GmbH`, recycledShare: 0.74 },
  "Inner fitting (corrugated)": { countryOfOrigin: "North Rhine-Westphalia, Germany", supplierName: `${SD} — Duisburg Wellpappe GmbH`, recycledShare: 0.74 },
  "Kraft paper label": { countryOfOrigin: "Bavaria, Germany", supplierName: `${SD} — Augsburg Etiketten GmbH`, recycledShare: 0.4 },
  "Laminate film (PET/AL/PE)": { countryOfOrigin: "North Brabant, Netherlands", supplierName: `${SD} — Eindhoven Flexibles B.V.` },
  "Barrier coating": { countryOfOrigin: "North Brabant, Netherlands", supplierName: `${SD} — Eindhoven Flexibles B.V.` },
};

// Who issued each evidence record, by component name + evidence type. Every
// record gets an issuer: "we do not know who stands behind this" is not a state
// the demo should show, and a blank issuer reads as an oversight rather than a
// fact.
type Issuer = { issuerName: string; issuerType: string; accreditationRef?: string };
const DEFAULT_ISSUER: Record<string, Issuer> = {
  supplier_declaration: { issuerName: `${SD} — supplier quality function`, issuerType: "mill" },
  // A marking's issuer depends on WHICH marking: an ISPM-15 heat-treatment mark
  // is stamped by a registered treater, an operator-identification marking is
  // applied by the manufacturer. Keying both to the treater put an Indian timber
  // treater's name on a German carton's operator marking.
  marking: { issuerName: `${SD} — manufacturer, on-pack marking`, issuerType: "manufacturer_qa" },
  technical_file: { issuerName: `${SD} — Rheinsolt Verpackungswerke GmbH, technical documentation`, issuerType: "manufacturer_qa" },
  registration: { issuerName: `${SD} — Zentrale Stelle Verpackungsregister (LUCID)`, issuerType: "manufacturer_qa" },
  lab_test: { issuerName: `${SD} — Orvantis Materials Laboratory`, issuerType: "accredited_lab", accreditationRef: `${SD} — NABL TC-9914 (ISO/IEC 17025)` },
  test_report: { issuerName: `${SD} — Orvantis Materials Laboratory`, issuerType: "accredited_lab", accreditationRef: `${SD} — NABL TC-9914 (ISO/IEC 17025)` },
};
// Per-component overrides, so a reader sees the ACTUAL maker named on the
// declaration rather than a generic "supplier quality function".
const ISSUER_BY_COMPONENT: Record<string, Issuer> = Object.fromEntries(
  Object.entries(TRACE).map(([component, t]) => [
    component,
    { issuerName: `${t.supplierName}, quality function`, issuerType: "mill" },
  ]),
);

function applyTraceability(pack: NewAssessment): NewAssessment {
  return {
    ...pack,
    components: pack.components.map((c) => ({
      ...c,
      ...(TRACE[c.name] ?? {}),
      evidence: c.evidence.map((e) => {
        const isHeatTreatmentMark = /IPPC|HT mark/i.test(e.reference ?? "");
        const issuer =
          e.evidenceType === "supplier_declaration"
            ? ISSUER_BY_COMPONENT[c.name] ?? DEFAULT_ISSUER.supplier_declaration
            : isHeatTreatmentMark
              ? { issuerName: `${SD} — Hosur Timber & Pallets Pvt Ltd, ISPM-15 registered treater`, issuerType: "treatment_provider" }
              : DEFAULT_ISSUER[e.evidenceType];
        return { ...e, ...(issuer ?? {}) };
      }),
    })),
  };
}

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
        // The one ACCREDITED-LAB attestation in the demo suite. It exists so the
        // passport can show the strongest issuer type next to the weakest
        // (a mill's own declaration) — that contrast is the point of showing an
        // issuer at all.
        //
        // NOTE: this component used to carry no evidence, and DEMO_SCRIPT used it
        // for the live "add evidence → Conditional flips to Qualified" moment.
        // That moment moved to the Corrugated sheet (see DEMO_SCRIPT §5), which
        // still has no evidence on file.
        evidence: [
          {
            evidenceType: "lab_test",
            // Values taken VERBATIM from the synthetic dossier manifest, entry
            // SYN-06 (06_lab_test_report_A.pdf, tier A, trap: none) — see
            // reference/extraction-set-synthetic/synthetic_packaging_dossier/manifest.json.
            // They were invented the first time this was seeded, which was wrong:
            // the dossier is the owner's document set and a demo must not put
            // numbers in a laboratory's mouth that the laboratory never reported.
            reference: `${SD} — lab test report SYN/2026/0006 (manifest SYN-06): Pb 12.4, Cd 0.8, Hg 0.2, Cr(VI) 3.6 mg/kg; sum 17.0 mg/kg against a 100 mg/kg limit`,
            issuedDate: "2026-08-24",
            expiryDate: "2027-08-23",
            scopeComponents: ["Green polyester strap (PET)"],
            scopeMaterials: ["plastic"],
            scopeParameters: ["Pb", "Cd", "Hg", "Cr(VI)"],
          },
        ],
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

for (const rawPack of packs) {
  const pack = applyTraceability(rawPack);
  const organisationId = await createOrganisation(orgs[pack.packName]);
  const id = await createAssessment({ ...pack, organisationId });
  console.log(
    `Seeded demo #${id} — "${pack.packName}" (demo=true), prepared for org #${organisationId}.`,
  );
  // The one CONFIRMED extracted claim in the suite. It exists so the key-value
  // line has something real to render; every other demo record is metadata only.
  if (pack.packName === GOLDEN) {
    const claimId = await seedConfirmedHeavyMetalsClaim(id);
    if (claimId) console.log(`  … confirmed heavy-metals claim #${claimId} (manifest SYN-06) on the PET strap.`);
  }
}
console.log("\nThree demo packs seeded. Open / to run the demo (see docs/DEMO_SCRIPT.md).");
process.exit(0);
