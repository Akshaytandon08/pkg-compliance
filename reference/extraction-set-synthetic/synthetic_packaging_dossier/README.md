# Synthetic packaging-compliance extraction dossier

Evaluation date: **8 September 2026**. All 20 documents and every issuer identity are fictional test fixtures. Every page carries **SYNTHETIC-DEMO — fictional test document**. The regulatory reference strings and numerical requirements are supplied by the commissioning brief and reproduced as fixture requirements; this package is not legal advice or actual conformity evidence.

## Contents

20 source documents (16 PDFs, four JPGs), `manifest.json` and this README. There are five documents per class, with A/B/B/C/D tier allocation in every class. Document 07 is a three-page laboratory report. Document 12 is English/Hindi. The ZIP contains exactly these 22 files; no clean masters or previews of degraded documents are included.

## Document inventory

| File | Class | Tier | Trap(s) |
|---|---|:---:|---|
| `01_supplier_declaration_A.pdf` | Supplier | A | none |
| `02_supplier_declaration_B.pdf` | Supplier | B | none |
| `03_supplier_declaration_B.pdf` | Supplier | B | wrong_standard |
| `04_supplier_declaration_C.pdf` | Supplier | C | obscured_value |
| `05_supplier_declaration_D.jpg` | Supplier | D | issuer_not_authoritative |
| `06_lab_test_report_A.pdf` | Lab | A | none |
| `07_lab_test_report_B.pdf` | Lab | B | none |
| `08_lab_test_report_B.pdf` | Lab | B | below_detection_notation |
| `09_lab_test_report_C.pdf` | Lab | C | obscured_value, below_detection_notation |
| `10_lab_test_report_D.jpg` | Lab | D | unit_trap |
| `11_heat_treatment_certificate_A.pdf` | ISPM 15 | A | none |
| `12_heat_treatment_certificate_B.pdf` | ISPM 15 | B | none |
| `13_heat_treatment_certificate_B.pdf` | ISPM 15 | B | none |
| `14_heat_treatment_certificate_C.pdf` | ISPM 15 | C | obscured_value |
| `15_heat_treatment_certificate_D.jpg` | ISPM 15 | D | expired |
| `16_mill_declaration_A.pdf` | Mill | A | none |
| `17_mill_declaration_B.pdf` | Mill | B | none |
| `18_mill_declaration_B.pdf` | Mill | B | per_metal_no_sum |
| `19_mill_declaration_C.pdf` | Mill | C | obscured_value |
| `20_mill_declaration_D.jpg` | Mill | D | scope_mismatch |

## Assumptions and scoring conventions

- The brief simultaneously calls for one or two deliberate traps per class, an obscured numeric value in every Tier C specimen, two distinct detection-limit reports, and coverage of all eight trap types. We interpret the one/two rule as substantive trap scenarios per class in addition to mandatory scan-quality and detection-notation scenarios. Supplier: wrong standard and trader issuer. Lab: unit/boundary trap, plus required <LOD/ND and scan cases. ISPM 15: expired document, plus scan case. Mill: missing sum and scope mismatch, plus scan case. This preserves the explicitly required specimens without dropping a trap.
- The requested singular `trap` and `expected_extraction_behaviour` fields are retained. `additional_traps` and `secondary_expected_behaviours` record additional cases; `expected_flags` records all flags expected for a document. Document 09 combines an obscured Cr(VI) concentration with ND notation. The absence of an accreditation number is an alternative in the brief: this dossier uses the trader scenario instead, and all five labs carry obviously fake NABL references.
- `requested_scope` is external test-request context. It is intentionally not printed on a supplier's document. Supply it separately to the pipeline to test scope matching. Document 20 must be flagged even if all printed values are extracted perfectly.
- `expected_claims` are source claims, not independently established compliance facts. A false or incomplete source assertion must still be extracted faithfully and flagged. Missing sums have `value: null` and `presence: absent`.
- Decimal values are JSON strings to preserve source precision; per-analyte numeric values use the same source units as the document. Additional normalized values are provided where useful. `ppm` means mass-based ppm (1 ppm = 1 mg/kg); `%` means mass percent (1% = 10,000 mg/kg).
- Document 10: 0.0060 + 0.0010 + 0.0005 + 0.0025 = 0.01%, equivalent to exactly 100 mg/kg. The supplied rule allows equality; never label the value comfortably below the limit. No uncertainty guard band is assumed.
- Document 08: Pb 2.4 + Cr(VI) 0.5 = 2.9 mg/kg; Cd <0.2 and Hg <0.1 make the nonnegative aggregate interval [2.9, 3.2) mg/kg. Document 09: quantified sum 1.2 mg/kg with ND bounds 0.2 and 0.1 makes [1.2, 1.5) mg/kg. Neither ND nor <LOD should be silently converted to zero. The printed upper bounds are computed sum rows, not exact measured sums.
- For obscured fields, authored values are in the manifest only as generator ground truth. The expected result is abstention/low confidence plus `flag_low_confidence`, not a forced exact answer. Master-PDF bounding boxes identify the field before scan rotation; they are not final raster pixel coordinates. No invisible text layer is embedded in Tier C PDFs.
- Tier A PDFs are simple digital pages. Tier B PDFs include a small fictional logo, tables/panels, a stamp graphic and a transparent raster signature overlay. Tier C pages are rasterised at 180 dpi, rotated by 1–3 degrees, mildly blurred/noised, and stamped across a numeric field. Tier D JPGs are perspective-distorted 1200-pixel-wide photographs with uneven illumination, shadow, blur and JPEG compression.
- All invented organisations, persons and addresses are designated synthetic. Contacts use `.invalid` email domains, deliberately non-routable all-zero demo telephone prefixes, invalid DEMO-GST identifiers and fictitious localities. NABL-TC-SYN-001 to -005 and IN-SYN provider codes are intentionally invalid test credentials. Names, codes, logos and signatures are generated fixtures and assert no affiliation with real entities. Regulatory bodies and standards occur only as required reference names.
- Heat-treatment certificates use the brief's 56 °C core / 30 continuous minute HT requirement. Their provider validity dates are invented document-control terms; the fixture does not imply ISPM 15 sets a universal expiry. The 220 plywood sheets mentioned in Document 13 are separate processed-wood accessories and exempt; the 220 solid-wood pallets remain in the HT scope.
- In the wrong-standard and missing-sum specimens, the intentionally omitted reference/aggregate supersedes the ordinary class template. Do not fill those omissions from other documents or from this README. No other document's result should be transferred to the tested material.
- Testing identities are expected to be recognised as synthetic fixtures by the test harness. If the pipeline includes live accreditation verification, run in fixture mode or expect all five fake lab IDs to be rejected; `extract` never means a real credential has been validated.

## Manifest schema

The root is one JSON array with exactly 20 objects. Every `expected_claims` item contains `parameter`, `value`, `unit`, `test_method`, `issuer`, `issuer_type`, `accreditation_ref`, `issue_date`, `valid_until`, and `scope`. Null means absent/not applicable, never an inferred zero. Optional fields describe comparators, raw notation, LODs, interval bounds and visible/obscured status. Each document additionally has its filename, class, tier, primary trap, expected behaviour, notes, external requested scope, evaluation date, SHA-256, page count and rendering metadata.

Validate the hashes before a test run. Measure field accuracy separately from correct problem-flagging; successful abstention on obscured data is a correct result.
