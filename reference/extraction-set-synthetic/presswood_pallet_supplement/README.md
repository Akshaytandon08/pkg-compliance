# Synthetic pressed-wood pallet supplement

Five additional fictional packaging documents, one per requested regional footprint. Evaluation date: 8 September 2026. This supplement continues document IDs SYN-21 through SYN-25 and retains the original manifest's root JSON array and required claim fields.

## Inventory

| File | Region | Footprint (mm) | Height (mm) | Empty mass (kg) | Dynamic claim (kg) | Tier |
|---|---|---|---:|---:|---:|:---:|
| `21_presswood_na-4840_A.pdf` | North America | 1219 × 1016 | 145 | 18.0 | Up to 1,134 | A |
| `22_presswood_eu-1208_B.pdf` | Europe | 1200 × 800 | 145 | 14.5 | Up to 1,134 | B |
| `23_presswood_au-1165_B.pdf` | Australia | 1165 × 1165 | 145 | 19.0 | Up to 1,134 | B |
| `24_presswood_as-1111_C.pdf` | Asia - square | 1100 × 1100 | 145 | 16.0 | Up to 1,134 | C |
| `25_presswood_as-1210_D.jpg` | Asia - rectangular | 1200 × 1000 | 145 | 18.0 | Up to 1,134 | D |

A = clean digital PDF; B = digital PDF with tables, fictional logo, signature image and stamp; C = 180-dpi image-only PDF with skew/noise and stamp across the resin-solids figure; D = 1200-pixel-wide simulated phone-photo JPG. Four PDFs + one JPG + manifest.json + README.md = seven ZIP members. The separate original 20-document ZIP is unchanged.

## Confirmed recipe and percentage bases

- 25% Melamine Urea Formaldehyde (MUF) resin, as supplied, by total input weight.
- 75% crushed wood by total input weight.
- MUF resin contains 55% solids by resin weight and is described by the supplier as E0 grade.
- 25 + 75 = 100%. The 55% figure is nested within the resin specification and must never be added as a third constituent. The user confirmed this interpretation on 8 September 2026.
- For a hypothetical 100 kg input batch, there are 25 kg of supplied resin and 75 kg crushed wood. The resin's solids contribution is 25 × 0.55 = 13.75 kg; its remaining 11.25 kg is its non-solids fraction. This arithmetic is derived context, not a finished-pallet composition or emission result. Wood moisture, curing changes, volatile loss and final mass are unspecified. Do not claim 13.75% resin in the final dry pallet.
- E0 is reproduced only as a supplier resin-grade designation. No emission threshold, test method, measured formaldehyde value or accredited certificate was supplied. The document explicitly leaves those items unverified. Do not interpret E0 as zero formaldehyde or proof of regulatory compliance.

## Physical specification choices

The provided millimetre footprints control these fixtures: 1219 × 1016; 1200 × 800; 1165 × 1165; 1100 × 1100; and 1200 × 1000. Inch dimensions are nominal/rounded. Exact 48 inches equals 1219.2 mm, so 1219 mm is the requested nominal size. The rectangular Asian version uses L × W = 1200 × 1000 mm and therefore 47.24 × 39.37 inches; the prompt's inch order was reversed.

For useful extraction values, all five fixtures use a synthetic 145 mm nominal height and a nominal empty mass within the requested 14–20 kg range. Each carries a fictional manufacturer dynamic-load claim up to 1,134 kg with uniformly distributed payload. These are explicit generator assumptions extending the supplied general GMA envelope to each test version; the size alone does not establish weight or load capability. No ISO 8611 or other load-test pass, static/racking capacity, or safety factor is invented. The ordinary general ranges are not measurements from a real presswood product.

Use metric values as canonical. The prompt's 5.5–6 inch height range converts to 139.7–152.4 mm, which is not exactly the stated 142–152 mm range. The selected 145 mm falls within both. 2,500 lb is approximately 1,134 kg; the rounding is deliberate.

The Europe version is a presswood pallet with the requested 1200 × 800 mm footprint. It is not labelled as an actual EUR1/EPAL-certified pallet. The regional names are descriptive fixture labels, not a declaration that the article is certified to a regional or ISO pallet construction standard.

## Processed-wood and chemical claims

These are manufacturer declarations, not heat-treatment certificates. For the fictional construction, the complete pallet and feet are resin-bonded crushed wood moulded using heat and pressure, with no solid-sawn components. The source claims the ISPM 15 section 2.1 processed-wood exemption. An HT certificate and IPPC mark are therefore deliberately recorded as not issued under that exemption; do not fabricate a treatment-provider number or a 56 °C / 30-minute treatment record. A construction with added solid-wood runners or other raw-wood parts would require a fresh applicability assessment. Exemption from ISPM 15 is not blanket clearance from every destination-country import condition.

Official support for the wholly processed-wood distinction: [Australian Department of Agriculture — ISPM 15 scope and exemptions](https://www.agriculture.gov.au/biosecurity-trade/import/goods/timber-packaging/ispm-15), particularly the “What products does ISPM 15 apply to?” section. The declaration asserts facts about a synthetic manufacturing process; it does not verify a real factory or real pallet.

The heavy-metals sums are additional fictional supplier results to continue the original extraction-test theme. The supplied fixture rule is Pb + Cd + Hg + Cr(VI) <=100 mg/kg under Regulation (EU) 2025/40 Article 5(4), with CR 13695-1:2000 as its reference assessment basis. No per-metal results, laboratory accreditation or laboratory report are fabricated as supporting documents in this supplement. These assertions must be classified as manufacturer claims, not accredited test evidence.

## Ground-truth use

The manifest distinguishes source claims, absent evidence and derived interpretation. Every expected claim includes issuer/type, accreditation_ref (null), issue and validity dates, scope, units and assessment method where relevant. The synthetic validity period is 8 September 2026 through 7 September 2027.

In SYN-24, the stamp obscures the resin-solids figure. Its authored 55% value is retained as generator ground truth, but the expected extraction behaviour is low confidence and human review. A cautious null/abstention with the correct flag is successful behaviour. Do not use another pallet's resin-solids value to fill the obscured field automatically. Its bounding box is in the pre-rotation master PDF coordinate system.

Clean specimens have trap = none. Their `interpretation_checks` nevertheless require correct distinction of an unverified grade/load assertion, the two percentage denominators, regional-footprint equivalence and conditional ISPM 15 exemption. These five documents do not attempt to repeat all eight trap types from the original dossier.

Every page carries “SYNTHETIC-DEMO — fictional test document”. All issuer names, people, addresses, signatures, logos and identifiers are invented. Email addresses use .invalid; phone and tax identifiers are deliberately unusable demo values. Run any identity-verification stage in fixture mode. No real accreditation or certification is asserted.

## User-supplied dimensional references

- [iGPS — regional pallet dimensions](https://igps.net/what-are-iso-standard-pallet-dimensions/)
- [PalletOne — nominal North American footprint](https://www.palletone.com/what-is-the-standard-pallet-size/)
- [TranPak — standard pallet dimensions by region](https://www.tranpak.com/faq/standard-pallet-size-dimensions/)
- [Shapiro — general pallet dimension guidance](https://www.shapiro.com/resources/standard-pallet-dimensions-everything-shippers-need-to-know/)

These are context links for the requested footprints. They are not product-specific evidence for the fictional presswood design, its recipe, load rating or chemical claims.
