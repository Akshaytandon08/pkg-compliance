# Extraction harness — error analysis (synthetic ceiling)

> **These are synthetic-ceiling figures, not the acceptance metric.** Acceptance is measured only on the product owner's real, PII-scrubbed document set. This analysis classifies misses on the 25-document synthetic set to guide prompt work; it does not certify accuracy.

Runs analysed: `claude-opus-5` (2026-09-09T08-04-07-029Z), `claude-sonnet-5` (2026-09-09T08-04-07-029Z). No API calls — offline over the persisted runs.


## claude-opus-5

Field accuracy: **38.4% canonical** (strict baseline 38.4%). Usable 100%, refusals 0, silent errors 2, cost/doc $0.0500.

### Miss classification, per document class

| Document class | Fields | Matched (canon) | (a) model wrong/absent | (b) comparison-too-strict | (c) abstained |
|---|--:|--:|--:|--:|--:|
| supplier_declaration | 147 | 60 (40.8%) | 50 | 0 | 37 |
| lab_test_report | 105 | 45 (42.9%) | 49 | 0 | 11 |
| heat_treatment_certificate | 70 | 19 (27.1%) | 32 | 0 | 19 |
| mill_declaration | 71 | 27 (38.0%) | 17 | 0 | 27 |
| **all** | **393** | **151 (38.4%)** | **148** | **0** | **94** |

### Field accuracy per tier (strict → canonical)

| Tier | Fields | Strict | Canonical |
|---|--:|--:|--:|
| A | 80 | 31.3% | 31.3% |
| B | 160 | 40.0% | 40.0% |
| C | 73 | 38.4% | 38.4% |
| D | 80 | 42.5% | 42.5% |

### False-positive flags (derived − expected), by type

| False-positive flag | Count | Triggering documents |
|---|--:|---|
| flag_wrong_standard | 8 | 02, 05, 20, 21, 22, 23, 24, 25 |
| flag_missing_sum | 6 | 01, 02, 04, 05, 06, 09 |
| flag_scope_mismatch | 6 | 03, 04, 05, 07, 09, 10 |
| **total** | **20** | |

<details><summary>(a) model wrong/absent — fields</summary>

| Document | Field (parameter) | Expected |
|---|---|---|
| 01 | heavy_metals_sum_limit | 100 |
| 01 | signatory_name | Avir Neral |
| 01 | document_reference | SYN/2026/0001 |
| 01 | batch_reference | SYN-LOT-26-001 |
| 02 | heavy_metals_sum_limit | 100 |
| 02 | signatory_name | Mehira Vayel |
| 02 | document_reference | SYN/2026/0002 |
| 02 | batch_reference | SYN-LOT-26-002 |
| 03 | assessment_basis | RoHS supplier review |
| 03 | signatory_name | Ruhan Telvi |
| 03 | signatory_designation | Head - Quality Assurance |
| 03 | document_reference | SYN/2026/0003 |
| 04 | heavy_metals_sum_limit | 100 |
| 04 | signatory_name | Seyana Kerv |
| 04 | document_reference | SYN/2026/0004 |
| 04 | batch_reference | SYN-LOT-26-004 |
| 05 | document_valid_until | 2027-08-23 |
| 05 | signatory_name | Kiran Orev |
| 05 | document_reference | SYN/2026/0005 |
| 05 | batch_reference | SYN-LOT-26-005 |
| 06 | product_grade | PP Cap PC38, natural |
| 06 | accreditation_reference | NABL-TC-SYN-001 |
| 06 | screening_method | XRF |
| 06 | heavy_metals_sum_limit | 100 |
| 06 | document_reference | SYN/2026/0006 |
| 06 | batch_reference | SYN-LOT-26-006 |
| 06 | client | Evratyn Export Assemblies |
| 06 | sample_received_date | 2026-08-18 |
| 06 | test_start_date | 2026-08-20 |
| 06 | test_end_date | 2026-08-22 |
| 07 | product_grade | Printed PE Pouch PP90, blue print |
| 07 | accreditation_reference | NABL-TC-SYN-002 |
| 07 | screening_method | XRF |
| 07 | document_reference | SYN/2026/0007 |
| 07 | batch_reference | SYN-LOT-26-007 |
| 07 | client | Evratyn Export Assemblies |
| 07 | sample_received_date | 2026-08-18 |
| 07 | test_start_date | 2026-08-20 |
| 07 | test_end_date | 2026-08-22 |
| 08 | product_grade | HDPE Bottle HB500, unpigmented |
| 08 | accreditation_reference | NABL-TC-SYN-003 |
| 08 | screening_method | XRF |
| 08 | heavy_metals_sum_limit | 100 |
| 08 | batch_reference | SYN-LOT-26-008 |
| 08 | client | Evratyn Export Assemblies |
| 08 | sample_received_date | 2026-08-18 |
| 08 | test_start_date | 2026-08-20 |
| 08 | test_end_date | 2026-08-22 |
| 09 | product_grade | Kraft Liner KL150, uncoated |
| 09 | accreditation_reference | NABL-TC-SYN-004 |
| 09 | screening_method | XRF |
| 09 | confirmation_method | CR 13695-1:2000 |
| 09 | heavy_metals_sum_limit | 100 |
| 09 | document_reference | SYN/2026/0009 |
| 09 | batch_reference | SYN-LOT-26-009 |
| 09 | client | Evratyn Export Assemblies |
| 09 | sample_received_date | 2026-08-18 |
| 09 | test_start_date | 2026-08-20 |
| 09 | test_end_date | 2026-08-22 |
| 10 | product_grade | Pigmented PP Tray PT60 |
| 10 | accreditation_reference | NABL-TC-SYN-005 |
| 10 | screening_method | XRF |
| 10 | heavy_metals_sum_limit | 100 |
| 10 | document_reference | SYN/2026/0010 |
| 10 | batch_reference | SYN-LOT-26-010 |
| 10 | client | Evratyn Export Assemblies |
| 10 | sample_received_date | 2026-08-18 |
| 10 | test_start_date | 2026-08-20 |
| 10 | test_end_date | 2026-08-22 |
| 11 | product_grade | Solid-wood pallet SWP1208 |
| 11 | quantity | 160 |
| 11 | minimum_core_temperature | 56 |
| 11 | ippc_mark_code | IN-SYN-011 HT |
| 11 | ippc_country_code | IN |
| 11 | ippc_provider_code | SYN-011 |
| 11 | treatment_code | HT |
| 12 | quantity | 48 |
| 12 | ippc_mark_code | IN-SYN-012 HT |
| 12 | ippc_country_code | IN |
| 12 | ippc_provider_code | SYN-012 |
| 12 | treatment_code | HT |
| 13 | quantity | 220 |
| 13 | ippc_mark_code | IN-SYN-013 HT |
| 13 | processed_wood_exemption | Plywood separator sheets exempt |
| 13 | ippc_country_code | IN |
| 13 | ippc_provider_code | SYN-013 |
| 13 | treatment_code | HT |
| 14 | quantity | 96 |
| 14 | batch_reference | SYN-LOT-26-014 |
| 14 | minimum_core_temperature | 56 |
| 14 | document_valid_until | 2027-08-23 |
| 14 | ippc_mark_code | IN-SYN-014 HT |
| 14 | signatory_designation | Treatment supervisor |
| 14 | ippc_country_code | IN |
| 14 | ippc_provider_code | SYN-014 |
| 14 | treatment_code | HT |
| 15 | quantity | 72 |
| 15 | batch_reference | SYN-LOT-26-015 |
| 15 | ippc_mark_code | IN-SYN-015 HT |
| 15 | ippc_country_code | IN |
| 15 | ippc_provider_code | SYN-015 |
| 16 | virgin_fibre_share | 35 |
| 16 | coatings | Uncoated; no intentionally added metal-c |
| 16 | document_reference | SYN/2026/0016 |
| 16 | batch_reference | SYN-LOT-26-016 |
| 17 | coatings | Uncoated; no intentionally added metal-c |
| 17 | batch_reference | SYN-LOT-26-017 |
| 18 | virgin_fibre_share | 0 |
| 18 | coatings | Uncoated; no intentionally added metal-c |
| 18 | batch_reference | SYN-LOT-26-018 |
| 19 | coatings | Uncoated; no intentionally added metal-c |
| 19 | heavy_metals_sum_limit | 100 |
| 20 | virgin_fibre_share | 60 |
| 20 | inks | No printing ink applied at mill |
| 20 | adhesives | Water-based starch for corrugated grades |
| 20 | coatings | Uncoated; no intentionally added metal-c |
| 20 | document_reference | SYN/2026/0020 |
| 20 | batch_reference | SYN-LOT-26-020 |
| 21 | construction | Wholly moulded processed wood, including |
| 21 | solid_sawn_components_present | false |
| 21 | ispm15_status | processed_wood_exemption_claimed |
| 21 | signatory_name | Avira Nelvon |
| 21 | signatory_designation | Head - Quality Assurance |
| 21 | batch_reference | SYN-PW-260908-21 |
| 22 | solid_sawn_components_present | false |
| 22 | ispm15_status | processed_wood_exemption_claimed |
| 22 | signatory_name | Avira Nelvon |
| 22 | signatory_designation | Head - Quality Assurance |
| 22 | batch_reference | SYN-PW-260908-22 |
| 23 | dynamic_load_capacity | 1134 |
| 23 | solid_sawn_components_present | false |
| 23 | ispm15_status | processed_wood_exemption_claimed |
| 23 | signatory_name | Avira Nelvon |
| 23 | signatory_designation | Head - Quality Assurance |
| 23 | batch_reference | SYN-PW-260908-23 |
| 24 | dynamic_load_capacity | 1134 |
| 24 | solid_sawn_components_present | false |
| 24 | ispm15_status | processed_wood_exemption_claimed |
| 24 | signatory_name | Avira Nelvon |
| 24 | signatory_designation | Head - Quality Assurance |
| 25 | product_grade | Pressed-wood pallet PW-AS-1210, 1200 x 1 |
| 25 | regional_footprint | Asia - rectangular |
| 25 | dynamic_load_capacity | 1134 |
| 25 | solid_sawn_components_present | false |
| 25 | ispm15_status | processed_wood_exemption_claimed |
| 25 | signatory_name | Avira Nelvon |
| 25 | signatory_designation | Head - Quality Assurance |
| 25 | batch_reference | SYN-PW-260908-25 |

</details>
<details><summary>(c) abstained where extraction expected — fields</summary>

| Document | Field (parameter) | Expected |
|---|---|---|
| 01 | document_valid_until | 2027-08-23 |
| 01 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 01 | signatory_designation | Head - Quality Assurance |
| 02 | document_valid_until | 2027-08-23 |
| 02 | signatory_designation | Head - Quality Assurance |
| 03 | compliance_standard | RoHS |
| 04 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 04 | signatory_designation | Head - Quality Assurance |
| 05 | signatory_designation | Manager - Distribution Quality |
| 06 | signatory_name | Elina Sorev |
| 06 | signatory_designation | Authorised signatory - Trace Analysis |
| 07 | signatory_name | Daren Kelvi |
| 07 | signatory_designation | Authorised signatory - Trace Analysis |
| 08 | signatory_name | Miraya Oren |
| 08 | signatory_designation | Authorised signatory - Trace Analysis |
| 08 | document_reference | SYN/2026/0008 |
| 09 | signatory_name | Nevir Selen |
| 09 | signatory_designation | Authorised signatory - Trace Analysis |
| 10 | signatory_name | Ishara Terv |
| 10 | signatory_designation | Authorised signatory - Trace Analysis |
| 11 | batch_reference | SYN-LOT-26-011 |
| 11 | document_valid_until | 2027-08-23 |
| 11 | signatory_name | Revan Myel |
| 11 | signatory_designation | Treatment supervisor |
| 11 | document_reference | SYN/2026/0011 |
| 12 | batch_reference | SYN-LOT-26-012 |
| 12 | document_valid_until | 2027-08-23 |
| 12 | signatory_name | Nira Valen |
| 12 | signatory_designation | Treatment supervisor |
| 12 | document_reference | SYN/2026/0012 |
| 13 | product_grade | Solid-wood pallet SWP1000 |
| 13 | document_valid_until | 2027-08-23 |
| 13 | signatory_name | Arvik Soral |
| 13 | signatory_designation | Treatment supervisor |
| 14 | signatory_name | Divara Nelv |
| 14 | document_reference | SYN/2026/0014 |
| 15 | document_valid_until | 2026-07-31 |
| 15 | signatory_name | Teyal Arven |
| 15 | signatory_designation | Treatment supervisor |
| 16 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 16 | inks | No printing ink applied at mill |
| 16 | adhesives | Water-based starch for corrugated grades |
| 16 | heavy_metals_sum | 31.0 |
| 16 | heavy_metals_sum_limit | 100 |
| 16 | signatory_name | Nivara Toren |
| 16 | signatory_designation | Technical Head - Materials |
| 17 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 17 | inks | No printing ink applied at mill |
| 17 | adhesives | Water-based starch for corrugated grades |
| 17 | heavy_metals_sum | 24.6 |
| 17 | heavy_metals_sum_limit | 100 |
| 17 | signatory_name | Aren Meyvi |
| 17 | signatory_designation | Technical Head - Materials |
| 17 | document_reference | SYN/2026/0017 |
| 18 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 18 | inks | No printing ink applied at mill |
| 18 | adhesives | Water-based starch for corrugated grades |
| 18 | signatory_name | Miraq Neral |
| 18 | signatory_designation | Technical Head - Materials |
| 19 | inks | No printing ink applied at mill |
| 19 | adhesives | Water-based starch for corrugated grades |
| 19 | signatory_name | Levira Sen |
| 19 | signatory_designation | Technical Head - Materials |
| 20 | heavy_metals_sum_limit | 100 |
| 20 | signatory_name | Varen Ilvi |
| 20 | signatory_designation | Technical Head - Materials |
| 21 | regional_footprint | North America |
| 21 | length | 1219 |
| 21 | width | 1016 |
| 21 | height | 145 |
| 21 | empty_mass | 18.0 |
| 21 | dynamic_load_capacity | 1134 |
| 21 | processing | Resin bonding, heat and pressure |
| 22 | regional_footprint | Europe |
| 22 | length | 1200 |
| 22 | width | 800 |
| 22 | height | 145 |
| 22 | empty_mass | 14.5 |
| 22 | dynamic_load_capacity | 1134 |
| 22 | construction | Wholly moulded processed wood, including |
| 22 | processing | Resin bonding, heat and pressure |
| 23 | regional_footprint | Australia |
| 23 | length | 1165 |
| 23 | width | 1165 |
| 23 | construction | Wholly moulded processed wood, including |
| 23 | processing | Resin bonding, heat and pressure |
| 24 | length | 1100 |
| 24 | width | 1100 |
| 24 | construction | Wholly moulded processed wood, including |
| 24 | processing | Resin bonding, heat and pressure |
| 25 | length | 1200 |
| 25 | width | 1000 |
| 25 | construction | Wholly moulded processed wood, including |
| 25 | processing | Resin bonding, heat and pressure |

</details>

## claude-sonnet-5

Field accuracy: **9.9% canonical** (strict baseline 9.9%). Usable 88%, refusals 1, silent errors 1, cost/doc $0.0150.

### Miss classification, per document class

| Document class | Fields | Matched (canon) | (a) model wrong/absent | (b) comparison-too-strict | (c) abstained |
|---|--:|--:|--:|--:|--:|
| supplier_declaration | 147 | 15 (10.2%) | 22 | 0 | 110 |
| lab_test_report | 105 | 8 (7.6%) | 37 | 0 | 60 |
| heat_treatment_certificate | 70 | 5 (7.1%) | 26 | 0 | 39 |
| mill_declaration | 71 | 11 (15.5%) | 4 | 0 | 56 |
| **all** | **393** | **39 (9.9%)** | **89** | **0** | **265** |

### Field accuracy per tier (strict → canonical)

| Tier | Fields | Strict | Canonical |
|---|--:|--:|--:|
| A | 80 | 7.5% | 7.5% |
| B | 160 | 14.4% | 14.4% |
| C | 73 | 4.1% | 4.1% |
| D | 80 | 8.8% | 8.8% |

### False-positive flags (derived − expected), by type

| False-positive flag | Count | Triggering documents |
|---|--:|---|
| flag_low_confidence | 9 | 07, 10, 11, 12, 13, 15, 16, 21, 23 |
| flag_scope_mismatch | 5 | 08, 14, 15, 23, 25 |
| flag_missing_sum | 3 | 01, 02, 05 |
| flag_wrong_standard | 1 | 07 |
| **total** | **18** | |

<details><summary>(a) model wrong/absent — fields</summary>

| Document | Field (parameter) | Expected |
|---|---|---|
| 01 | heavy_metals_sum_limit | 100 |
| 01 | signatory_name | Avir Neral |
| 02 | document_valid_until | 2027-08-23 |
| 02 | heavy_metals_sum_limit | 100 |
| 02 | signatory_name | Mehira Vayel |
| 02 | document_reference | SYN/2026/0002 |
| 02 | batch_reference | SYN-LOT-26-002 |
| 03 | assessment_basis | RoHS supplier review |
| 04 | signatory_name | Seyana Kerv |
| 05 | heavy_metals_sum_limit | 100 |
| 05 | signatory_name | Kiran Orev |
| 05 | batch_reference | SYN-LOT-26-005 |
| 06 | Pb | 12.4 |
| 06 | Cd | 0.8 |
| 06 | Hg | 0.2 |
| 06 | Cr(VI) | 3.6 |
| 07 | Pb_detection_limit | 0.5 |
| 07 | Cd_detection_limit | 0.1 |
| 07 | Hg_detection_limit | 0.05 |
| 07 | Cr(VI)_detection_limit | 0.5 |
| 07 | accreditation_reference | NABL-TC-SYN-002 |
| 07 | screening_method | XRF |
| 07 | confirmation_method | CR 13695-1:2000 |
| 07 | heavy_metals_sum_limit | 100 |
| 07 | signatory_name | Daren Kelvi |
| 07 | document_reference | SYN/2026/0007 |
| 07 | batch_reference | SYN-LOT-26-007 |
| 07 | client | Evratyn Export Assemblies |
| 07 | sample_received_date | 2026-08-18 |
| 07 | test_start_date | 2026-08-20 |
| 07 | test_end_date | 2026-08-22 |
| 08 | Pb_detection_limit | 0.1 |
| 08 | Cd_detection_limit | 0.2 |
| 08 | Hg_detection_limit | 0.1 |
| 08 | Cr(VI)_detection_limit | 0.1 |
| 08 | accreditation_reference | NABL-TC-SYN-003 |
| 08 | screening_method | XRF |
| 08 | confirmation_method | CR 13695-1:2000 |
| 08 | heavy_metals_sum_limit | 100 |
| 08 | sample_received_date | 2026-08-18 |
| 08 | test_start_date | 2026-08-20 |
| 08 | test_end_date | 2026-08-22 |
| 09 | Pb | 0.8 |
| 10 | Pb | 0.0060 |
| 10 | Cd | 0.0010 |
| 10 | Hg | 0.0005 |
| 10 | Cr(VI) | 0.0025 |
| 10 | accreditation_reference | NABL-TC-SYN-005 |
| 10 | sample_received_date | 2026-08-18 |
| 11 | treatment_date | 2026-08-24 |
| 11 | ippc_mark_code | IN-SYN-011 HT |
| 11 | treatment_code | HT |
| 12 | quantity | 48 |
| 12 | treatment_date | 2026-08-24 |
| 12 | document_valid_until | 2027-08-23 |
| 12 | ippc_country_code | IN |
| 12 | ippc_provider_code | SYN-012 |
| 12 | treatment_code | HT |
| 13 | treatment_date | 2026-08-24 |
| 13 | ippc_mark_code | IN-SYN-013 HT |
| 13 | treatment_code | HT |
| 14 | quantity | 96 |
| 14 | treatment_date | 2026-08-24 |
| 14 | minimum_core_temperature | 56 |
| 14 | ippc_country_code | IN |
| 14 | ippc_provider_code | SYN-014 |
| 14 | treatment_code | HT |
| 15 | quantity | 72 |
| 15 | treatment_date | 2026-04-20 |
| 15 | minimum_core_temperature | 56 |
| 15 | continuous_duration | 30 |
| 15 | ippc_mark_code | IN-SYN-015 HT |
| 15 | ippc_country_code | IN |
| 15 | ippc_provider_code | SYN-015 |
| 15 | treatment_code | HT |
| 16 | virgin_fibre_share | 35 |
| 16 | batch_reference | SYN-LOT-26-016 |
| 17 | product_grade | Kraft Liner KL200, 200 GSM |
| 18 | virgin_fibre_share | 0 |
| 21 | crushed_wood_input_share | 75 |
| 24 | crushed_wood_input_share | 75 |
| 25 | product_grade | Pressed-wood pallet PW-AS-1210, 1200 x 1 |
| 25 | empty_mass | 18.0 |
| 25 | MUF_resin_grade | E0 |
| 25 | solid_sawn_components_present | false |
| 25 | heavy_metals_sum_limit | 100 |
| 25 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 25 | signatory_designation | Head - Quality Assurance |
| 25 | batch_reference | SYN-PW-260908-25 |

</details>
<details><summary>(c) abstained where extraction expected — fields</summary>

| Document | Field (parameter) | Expected |
|---|---|---|
| 01 | document_valid_until | 2027-08-23 |
| 01 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 01 | signatory_designation | Head - Quality Assurance |
| 01 | document_reference | SYN/2026/0001 |
| 01 | batch_reference | SYN-LOT-26-001 |
| 02 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 02 | signatory_designation | Head - Quality Assurance |
| 03 | document_valid_until | 2027-08-23 |
| 03 | compliance_standard | RoHS |
| 03 | signatory_name | Ruhan Telvi |
| 03 | signatory_designation | Head - Quality Assurance |
| 03 | document_reference | SYN/2026/0003 |
| 03 | batch_reference | SYN-LOT-26-003 |
| 04 | document_valid_until | 2027-08-23 |
| 04 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 04 | heavy_metals_sum_limit | 100 |
| 04 | signatory_designation | Head - Quality Assurance |
| 04 | document_reference | SYN/2026/0004 |
| 04 | batch_reference | SYN-LOT-26-004 |
| 05 | document_valid_until | 2027-08-23 |
| 05 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 05 | signatory_designation | Manager - Distribution Quality |
| 05 | document_reference | SYN/2026/0005 |
| 06 | Pb_detection_limit | 0.5 |
| 06 | Cd_detection_limit | 0.1 |
| 06 | Hg_detection_limit | 0.05 |
| 06 | Cr(VI)_detection_limit | 0.5 |
| 06 | heavy_metals_sum | 17.0 |
| 06 | product_grade | PP Cap PC38, natural |
| 06 | accreditation_reference | NABL-TC-SYN-001 |
| 06 | screening_method | XRF |
| 06 | confirmation_method | CR 13695-1:2000 |
| 06 | heavy_metals_sum_limit | 100 |
| 06 | signatory_name | Elina Sorev |
| 06 | signatory_designation | Authorised signatory - Trace Analysis |
| 06 | document_reference | SYN/2026/0006 |
| 06 | batch_reference | SYN-LOT-26-006 |
| 06 | client | Evratyn Export Assemblies |
| 06 | sample_received_date | 2026-08-18 |
| 06 | test_start_date | 2026-08-20 |
| 06 | test_end_date | 2026-08-22 |
| 07 | product_grade | Printed PE Pouch PP90, blue print |
| 07 | signatory_designation | Authorised signatory - Trace Analysis |
| 08 | product_grade | HDPE Bottle HB500, unpigmented |
| 08 | signatory_name | Miraya Oren |
| 08 | signatory_designation | Authorised signatory - Trace Analysis |
| 08 | document_reference | SYN/2026/0008 |
| 08 | batch_reference | SYN-LOT-26-008 |
| 08 | client | Evratyn Export Assemblies |
| 09 | Pb_detection_limit | 0.1 |
| 09 | Cd_detection_limit | 0.2 |
| 09 | Hg_detection_limit | 0.1 |
| 09 | Cr(VI)_detection_limit | 0.1 |
| 09 | heavy_metals_sum | <1.5 |
| 09 | product_grade | Kraft Liner KL150, uncoated |
| 09 | accreditation_reference | NABL-TC-SYN-004 |
| 09 | screening_method | XRF |
| 09 | confirmation_method | CR 13695-1:2000 |
| 09 | heavy_metals_sum_limit | 100 |
| 09 | signatory_name | Nevir Selen |
| 09 | signatory_designation | Authorised signatory - Trace Analysis |
| 09 | document_reference | SYN/2026/0009 |
| 09 | batch_reference | SYN-LOT-26-009 |
| 09 | client | Evratyn Export Assemblies |
| 09 | sample_received_date | 2026-08-18 |
| 09 | test_start_date | 2026-08-20 |
| 09 | test_end_date | 2026-08-22 |
| 10 | Pb_detection_limit | 0.0001 |
| 10 | Cd_detection_limit | 0.0001 |
| 10 | Hg_detection_limit | 0.0001 |
| 10 | Cr(VI)_detection_limit | 0.0001 |
| 10 | heavy_metals_sum | 0.01 |
| 10 | product_grade | Pigmented PP Tray PT60 |
| 10 | screening_method | XRF |
| 10 | confirmation_method | CR 13695-1:2000 |
| 10 | heavy_metals_sum_limit | 100 |
| 10 | signatory_name | Ishara Terv |
| 10 | signatory_designation | Authorised signatory - Trace Analysis |
| 10 | document_reference | SYN/2026/0010 |
| 10 | batch_reference | SYN-LOT-26-010 |
| 10 | client | Evratyn Export Assemblies |
| 10 | test_start_date | 2026-08-20 |
| 10 | test_end_date | 2026-08-22 |
| 11 | product_grade | Solid-wood pallet SWP1208 |
| 11 | quantity | 160 |
| 11 | batch_reference | SYN-LOT-26-011 |
| 11 | minimum_core_temperature | 56 |
| 11 | continuous_duration | 30 |
| 11 | document_valid_until | 2027-08-23 |
| 11 | signatory_name | Revan Myel |
| 11 | signatory_designation | Treatment supervisor |
| 11 | document_reference | SYN/2026/0011 |
| 11 | ippc_country_code | IN |
| 11 | ippc_provider_code | SYN-011 |
| 12 | batch_reference | SYN-LOT-26-012 |
| 12 | signatory_name | Nira Valen |
| 12 | signatory_designation | Treatment supervisor |
| 12 | document_reference | SYN/2026/0012 |
| 13 | product_grade | Solid-wood pallet SWP1000 |
| 13 | quantity | 220 |
| 13 | batch_reference | SYN-LOT-26-013 |
| 13 | minimum_core_temperature | 56 |
| 13 | continuous_duration | 30 |
| 13 | document_valid_until | 2027-08-23 |
| 13 | processed_wood_exemption | Plywood separator sheets exempt |
| 13 | signatory_name | Arvik Soral |
| 13 | signatory_designation | Treatment supervisor |
| 13 | document_reference | SYN/2026/0013 |
| 13 | ippc_country_code | IN |
| 13 | ippc_provider_code | SYN-013 |
| 14 | product_grade | Solid-wood pallet SWP1111 |
| 14 | batch_reference | SYN-LOT-26-014 |
| 14 | document_valid_until | 2027-08-23 |
| 14 | signatory_name | Divara Nelv |
| 14 | signatory_designation | Treatment supervisor |
| 14 | document_reference | SYN/2026/0014 |
| 15 | product_grade | Solid-wood crate SWC75 |
| 15 | batch_reference | SYN-LOT-26-015 |
| 15 | document_valid_until | 2026-07-31 |
| 15 | signatory_name | Teyal Arven |
| 15 | signatory_designation | Treatment supervisor |
| 15 | document_reference | SYN/2026/0015 |
| 16 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 16 | inks | No printing ink applied at mill |
| 16 | adhesives | Water-based starch for corrugated grades |
| 16 | coatings | Uncoated; no intentionally added metal-c |
| 16 | heavy_metals_sum | 31.0 |
| 16 | heavy_metals_sum_limit | 100 |
| 16 | signatory_name | Nivara Toren |
| 16 | signatory_designation | Technical Head - Materials |
| 16 | document_reference | SYN/2026/0016 |
| 17 | grammage | 200 |
| 17 | virgin_fibre_share | 70 |
| 17 | recycled_fibre_share | 30 |
| 17 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 17 | inks | No printing ink applied at mill |
| 17 | adhesives | Water-based starch for corrugated grades |
| 17 | coatings | Uncoated; no intentionally added metal-c |
| 17 | heavy_metals_sum | 24.6 |
| 17 | heavy_metals_sum_limit | 100 |
| 17 | signatory_name | Aren Meyvi |
| 17 | signatory_designation | Technical Head - Materials |
| 17 | document_reference | SYN/2026/0017 |
| 17 | batch_reference | SYN-LOT-26-017 |
| 18 | grammage | 150 |
| 18 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 18 | inks | No printing ink applied at mill |
| 18 | adhesives | Water-based starch for corrugated grades |
| 18 | coatings | Uncoated; no intentionally added metal-c |
| 18 | signatory_name | Miraq Neral |
| 18 | signatory_designation | Technical Head - Materials |
| 19 | product_grade | Corrugated Sheet 3-ply CS3-420 |
| 19 | grammage | 420 |
| 19 | virgin_fibre_share | 20 |
| 19 | recycled_fibre_share | 80 |
| 19 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 19 | inks | No printing ink applied at mill |
| 19 | adhesives | Water-based starch for corrugated grades |
| 19 | coatings | Uncoated; no intentionally added metal-c |
| 19 | heavy_metals_sum_limit | 100 |
| 19 | signatory_name | Levira Sen |
| 19 | signatory_designation | Technical Head - Materials |
| 19 | document_reference | SYN/2026/0019 |
| 19 | batch_reference | SYN-LOT-26-019 |
| 20 | product_grade | Kraft Liner KL175, 175 GSM |
| 20 | grammage | 175 |
| 20 | virgin_fibre_share | 60 |
| 20 | recycled_fibre_share | 40 |
| 20 | substance_minimisation_standard | EN 13428:2004 Annex C |
| 20 | inks | No printing ink applied at mill |
| 20 | adhesives | Water-based starch for corrugated grades |
| 20 | coatings | Uncoated; no intentionally added metal-c |
| 20 | heavy_metals_sum | 19.8 |
| 20 | heavy_metals_sum_limit | 100 |
| 20 | signatory_name | Varen Ilvi |
| 20 | signatory_designation | Technical Head - Materials |
| 20 | document_reference | SYN/2026/0020 |
| 20 | batch_reference | SYN-LOT-26-020 |
| 21 | regional_footprint | North America |
| 21 | length | 1219 |
| 21 | width | 1016 |
| 21 | height | 145 |
| 21 | empty_mass | 18.0 |
| 21 | dynamic_load_capacity | 1134 |
| 21 | MUF_resin_input_share | 25 |
| 21 | MUF_resin_solids_content | 55 |
| 21 | MUF_resin_grade | E0 |
| 21 | construction | Wholly moulded processed wood, including |
| 21 | processing | Resin bonding, heat and pressure |
| 21 | solid_sawn_components_present | false |
| 21 | ispm15_status | processed_wood_exemption_claimed |
| 21 | heavy_metals_sum | 21.6 |
| 21 | heavy_metals_sum_limit | 100 |
| 21 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 21 | signatory_name | Avira Nelvon |
| 21 | signatory_designation | Head - Quality Assurance |
| 21 | batch_reference | SYN-PW-260908-21 |
| 22 | product_grade | Pressed-wood pallet PW-EU-1208, 1200 x 8 |
| 22 | regional_footprint | Europe |
| 22 | length | 1200 |
| 22 | width | 800 |
| 22 | height | 145 |
| 22 | empty_mass | 14.5 |
| 22 | dynamic_load_capacity | 1134 |
| 22 | MUF_resin_input_share | 25 |
| 22 | crushed_wood_input_share | 75 |
| 22 | MUF_resin_solids_content | 55 |
| 22 | MUF_resin_grade | E0 |
| 22 | construction | Wholly moulded processed wood, including |
| 22 | processing | Resin bonding, heat and pressure |
| 22 | solid_sawn_components_present | false |
| 22 | ispm15_status | processed_wood_exemption_claimed |
| 22 | heavy_metals_sum | 27.9 |
| 22 | heavy_metals_sum_limit | 100 |
| 22 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 22 | signatory_name | Avira Nelvon |
| 22 | signatory_designation | Head - Quality Assurance |
| 22 | batch_reference | SYN-PW-260908-22 |
| 23 | product_grade | Pressed-wood pallet PW-AU-1165, 1165 x 1 |
| 23 | regional_footprint | Australia |
| 23 | length | 1165 |
| 23 | width | 1165 |
| 23 | height | 145 |
| 23 | empty_mass | 19.0 |
| 23 | dynamic_load_capacity | 1134 |
| 23 | MUF_resin_input_share | 25 |
| 23 | crushed_wood_input_share | 75 |
| 23 | MUF_resin_solids_content | 55 |
| 23 | MUF_resin_grade | E0 |
| 23 | construction | Wholly moulded processed wood, including |
| 23 | processing | Resin bonding, heat and pressure |
| 23 | solid_sawn_components_present | false |
| 23 | ispm15_status | processed_wood_exemption_claimed |
| 23 | heavy_metals_sum | 32.4 |
| 23 | heavy_metals_sum_limit | 100 |
| 23 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 23 | signatory_name | Avira Nelvon |
| 23 | signatory_designation | Head - Quality Assurance |
| 23 | batch_reference | SYN-PW-260908-23 |
| 24 | regional_footprint | Asia - square |
| 24 | length | 1100 |
| 24 | width | 1100 |
| 24 | height | 145 |
| 24 | empty_mass | 16.0 |
| 24 | dynamic_load_capacity | 1134 |
| 24 | MUF_resin_input_share | 25 |
| 24 | MUF_resin_grade | E0 |
| 24 | construction | Wholly moulded processed wood, including |
| 24 | processing | Resin bonding, heat and pressure |
| 24 | solid_sawn_components_present | false |
| 24 | ispm15_status | processed_wood_exemption_claimed |
| 24 | heavy_metals_sum | 18.7 |
| 24 | heavy_metals_sum_limit | 100 |
| 24 | compliance_standard | Regulation (EU) 2025/40 Article 5(4) |
| 24 | signatory_name | Avira Nelvon |
| 24 | signatory_designation | Head - Quality Assurance |
| 24 | batch_reference | SYN-PW-260908-24 |
| 25 | regional_footprint | Asia - rectangular |
| 25 | length | 1200 |
| 25 | width | 1000 |
| 25 | height | 145 |
| 25 | dynamic_load_capacity | 1134 |
| 25 | construction | Wholly moulded processed wood, including |
| 25 | processing | Resin bonding, heat and pressure |
| 25 | ispm15_status | processed_wood_exemption_claimed |

</details>

---

## Root cause: the claim-type vocabulary omits ~half the expected fields

Class **(b) is empty for both models (0 of 393 fields)**. Canonicalisation recovers
nothing, because the models return bare values in `value` with the unit in `unit`,
so exact comparison already succeeds wherever a value is emitted at all. The
misses are therefore genuinely (a) wrong/absent or (c) abstained — *not* a
comparison artefact.

The dominant driver is **structural, not prompt wording**: the most-missed
parameters have **no `claim_type` slot** in `src/lib/extraction/prompts.ts`, and
the tool `input_schema` constrains `claim_type` to that enum — so the model
*cannot* emit them, however it is instructed. Miss counts below are out of 10
(5 documents × 2 models), i.e. **10 = missed by both models on every document**:

| Class | `claimTypes` today | Top missed parameters with no slot |
|---|---|---|
| supplier_declaration | material, recycled_content, restricted_substance, declaration_scope, issuer_identity | signatory_designation (20), signatory_name (19), batch_reference (18), compliance_standard (13), heavy_metals_sum_limit (12), document_reference (10), length/width/dynamic_load_capacity/construction (10 each) |
| lab_test_report | measured_parameter, test_method, stated_limit, issuer_identity, accreditation, sample_scope | product_grade, accreditation_reference, screening_method, signatory_name, signatory_designation, document_reference, batch_reference, client, sample_received_date, test_start_date (10 each) |
| heat_treatment_certificate | heat_treatment, ispm15_mark, issuer_identity, registration_authority, material_scope | quantity, document_valid_until, signatory_name, signatory_designation, ippc_country_code, ippc_provider_code (10 each), batch_reference/treatment_code (9), ippc_mark_code/document_reference (8) |
| mill_declaration | grade, recycled_content, certification_scheme, chain_of_custody, issuer_identity, declaration_scope | inks, adhesives, coatings, signatory_name, signatory_designation (10 each), virgin_fibre_share/substance_minimisation_standard/heavy_metals_sum_limit/batch_reference (8) |

**Implication for prompt v2.** Re-wording the four prompts cannot fix these; the
fix is to **extend the claim-type vocabulary** (document identity: signatory,
designation, document_reference, batch_reference, validity dates; per-class:
stated limits + compliance standard outside lab reports, granular IPPC mark
components, mill substance groups, physical dimensions). That is a change to the
extraction *schema surface*, and it propagates to `extracted_claims.claim_type`
and to the deterministic claim→checkpoint matcher — so it is a decision to take
deliberately, not a prompt tweak. Wording-only work is confined to the residual
(a)/(c) on parameters that *do* have a slot.

## Model behaviour differs in kind, not just degree

- **sonnet** *abstains*: 265 of 354 misses are (c) — it emits few claims (lab
  reports frequently 0 usable numeric values), 1 refusal, 88% usable.
- **opus** *attempts*: only 94 (c) but 148 (a) — it fills more fields and is
  wrong more often, 100% usable.

## Silent errors are NOT zero at baseline

The acceptance bar is **0 silent errors**. This run: **sonnet 1, opus 2** — and
the prior run recorded 0 for both, on the same prompts. So the silent-error count
is **nondeterministic across runs**, and a single clean run does not demonstrate
the bar is met. Both opus silent errors are `guessed_obscured_value`: it produced
a confident value for a deliberately obscured field without `flag_low_confidence`
(`19_mill_declaration_C.pdf` → `heavy_metals_sum` = "CR 13695-1:2000", truth
"38.2"; `24_presswood_as-1111_C.pdf` → `MUF_resin_solids_content` = "25", truth
"55"). Obscured-field abstention is the safety-critical behaviour and is the
first thing prompt v2 must harden.

## Correction to previously reported ceilings

Earlier runs reported **30.5% (sonnet) / 68.7% (opus)**. Those used a matcher with
a token-subset rule that counted a match whenever every ≥3-character token of the
expected value appeared *anywhere* in *any* claim field — so "Grade A" matched
"Grade B", and an expected standard's digits matched inside an unrelated method
string. That rule has been removed. The safe figures are **9.9% / 38.4%**; the
`canonical.test.ts` suite pins the equality-preserving guarantee.

---

# Results at prompt 1.3.0 (grounding + two-pass) — 3-run means

> **Synthetic ceiling, not the acceptance metric.** 25 generated documents.
> Acceptance is measured only on the product owner's real, PII-scrubbed set.

`claude-sonnet-5`, 3 runs, prompt 1.3.0. Sampling cannot be pinned on these
models (they reject `temperature`), so every figure is a 3-run mean with its
spread, and silent errors are the **union** across runs.

| Metric | 1.0.0 | 1.2.0 (3 runs) | **1.3.0 (3 runs)** |
|---|--:|--:|--:|
| Field accuracy (mean) | 9.9% | 61.9% | **51.7%** |
| Spread across runs | — | 6.6 pts | **13.0 pts** |
| Per run | — | 58.3 / 64.9 / 62.6 | **43.5 / 55.0 / 56.5** |
| **Unioned silent errors** | 1 (1 run) | **2** | **0 — target met** |
| Refusals (total) | 1 | 0 | 2 |
| Usable-document rate | 92% | 92–100% | 96% |
| Cost/doc | $0.0150 | $0.0227 | **$0.0351** |
| Median latency | 8.4 s | 44 s | 39 s |

## The two mechanisms' catch counts (per run)

| Mechanism | run 1 | run 2 | run 3 | total |
|---|--:|--:|--:|--:|
| Type-mismatch (wrong type for field) | 9 | 13 | 14 | 36 |
| **Ungrounded** (snippet absent from text) | 2 | 0 | 1 | **3** |
| **Pass-disagreement** (image-only) | 23 | 21 | 10 | **54** |
| Extra API calls (two-pass) | 10 | 10 | 10 | 30 |

**Two-pass does the heavy lifting; grounding catches little — and that is itself a
finding.** Only 3 snippets across 3 runs could not be located in the document,
meaning the model quotes faithfully when it has text to quote. The uncertainty is
concentrated in the image-only documents, where there is no text to check and two
independent reads disagree 10–23 times per run.

## The cost of safety, stated plainly

Silent errors went 2 → **0**, which was the objective. Field accuracy fell 61.9% →
51.7% and the run-to-run spread doubled (6.6 → 13.0 pts). Both follow directly
from the mechanisms: ~31 values per run are now WITHHELD, and some of those were
correct — two-pass is deliberately conservative, discarding a value whenever two
reads differ even though one of them was right. Part of the increased "instability"
is therefore the safeguards' own variability (disagreements ranged 23/21/10), not
the model's.

That is the intended trade: a withheld value is visible to a reviewer and costs a
manual entry; a wrong value that reaches a verdict is invisible and costs a wrong
verdict. The accuracy number is the price, and it should be quoted alongside the
silent-error count rather than on its own.

## Field stability (per-field, 3 runs)

| Prompt | Fields | Always matched | Never matched | Unstable |
|---|--:|--:|--:|--:|
| 1.2.0 | 393 | 191 | 106 | 96 (24.4%) |
| 1.3.0 | 393 | 116 | 101 | 176 (44.8%) |

## mill_declaration instability: the remedy does not address the cause

Two-pass agreement was expected to stabilise it. **It cannot**, because two-pass is
image-only and the instability is on text-layer documents:

| Doc | Tier | Mode | 1.3.0 claims per run |
|---|---|---|---|
| 16 | A | grounding | 19 / 19 / **1** |
| 17 | B | grounding | 17 / 17 / 17 |
| 18 | B | grounding | **0** / 19 / **0** |
| 19 | C | **two_pass** | 16 / 16 / 16 |
| 20 | D | **two_pass** | 18 / 18 / 19 |

The failure is intermittent **whole-document dropout** — the model returns 0–1
claims instead of ~19, with status `succeeded` — and it lands on tier A/B docs,
which two-pass never touches. The two image-tier documents, where two-pass does
apply, are the stable ones in both prompt versions.

**Recommended fix (not implemented):** retry once when a document with a
substantial text layer yields ~0 claims. It is cheap (fires only on failure), it
targets the actual cause, and it needs no extra call on the healthy path.

## Flag scoring: legacy vs the proposed v2 ground truth

From the same runs, computed offline: legacy 28 / 20 / 20% → v2 **32 / 20 / 24%**.
Accepting the proposed diff (7 documents, 60 justified rejections, 33 excluded as
unprovable — see [flag-groundtruth-proposal.md](flag-groundtruth-proposal.md))
improves the flag score only modestly. So the stale ground truth explains *part*
of the false-positive gap, not all of it; the rest is genuine over-flagging that
still needs work.

---

# Commits 6–7: two mechanisms, opposite outcomes (2026-09-11)

> Synthetic-ceiling figures. Acceptance is measured only on the product owner's
> real, PII-scrubbed set. Sampling cannot be pinned on these models, so every
> figure is reported per run with its spread, never as a single number.

## Commit 6 — retry-on-empty: implemented, **does not recover the dropout**

A text-layer document returning < 3 claims with status `succeeded` is retried
once (`DROPOUT_RETRY` logged with before/after counts). It fires only on failure,
so the healthy path costs nothing; a discarded retry is still charged, because
understating spend would defeat the budget ceiling.

Docs 16/17/18, sonnet, 3 runs:

| | doc 16 | doc 17 | doc 18 |
|---|--:|--:|--:|
| run 1 | 11/14 | 10/14 | refused |
| run 2 | **0/14** | 10/14 | 12/16 |
| run 3 | **0/14** | 10/14 | 12/16 |

`DROPOUT_RETRY` fired twice, both on doc 16 (`textLayerChars=1414`), and recovered
**neither** (1→1, 0→0). **Dropout incidence 3/9 before, 3/9 after.**

**The finding:** retrying an *identical* request reproduces the *identical*
near-empty answer. The failure is stable per (document, prompt) within a run even
though it varies between runs. Recovery therefore needs a **varied** retry — a
user-turn nudge, or reordering the pages — which changes the prompt and so
belongs to a prompt-version bump. **Deferred past Tuesday**; the mechanism stays
in place so the variation has somewhere to land.

A `refused` result is deliberately not retried: refusals return before the
text-layer branch, per the "status succeeded" condition.

## Commit 7 — majority tiebreak: **reduces withholding; accuracy gain not established**

On a two-pass disagreement over a verdict-driving value a third pass runs and
2-of-3 carries; only a genuine three-way split is withheld. The third pass is
bought **only** when the first two disagree. **On by default.**

Image tiers C/D, 10 documents, sonnet, 3 runs. Baseline is the *same 10
documents* recomputed offline from persisted claims — no new API calls:

| | accuracy | withheld | silent | usable | extra calls |
|---|--:|--:|--:|--:|--:|
| baseline run 1 | 54.9% | 23 | 0 | 100% | 10 |
| baseline run 2 | 60.8% | 21 | 0 | 100% | 10 |
| baseline run 3 | 61.4% | 10 | 0 | 100% | 10 |
| **baseline mean** | **59.0%** | 54 total | **0** | | 30 |
| tiebreak run 1 | 69.3% | 10 | 0 | 100% | 18 |
| tiebreak run 2 | *17.0%* | *3* | *1* | *30%* | *6* |
| tiebreak run 3 | 54.2% | 13 | 0 | 100% | 18 |
| **tiebreak mean (clean runs 1+3)** | **61.8%** | 23 | **0** | 100% | 36 |

**Run 2 is not a result.** Seven of its ten documents returned status `failed` —
API errors, not model behaviour — which is why it cost $0.20 against ~$0.75 for a
real run. Run 3 returned to 100% usable, so it was a transient outage. Its
"silent error" is an artefact: the scope-transfer detector fires when a
document's expected flags include `flag_scope_mismatch` and the extraction
produced *no claims at all*, so there was no value to be wrong about. Counting it
would be measuring the outage.

**Conclusion.** Withholding falls (23/21 → 10/13) and silent errors stay at 0 on
clean runs, so the mechanism does what it was built to do: most disagreements are
one bad read against two good ones, not genuine ambiguity. But a 2.8-point mean
gain sits inside a 15-point run-to-run spread, so the **accuracy** improvement is
**not established** by this test. Cost: extra calls 10 → 18 per clean run,
$0.077/doc.

## Why N > 1 runs, concretely

After run 1 alone the tiebreak read as **69.3%, +10.3 points over baseline**.
Reporting there would have been an overclaim: run 3 came in at 54.2%, below two
of the three baseline runs, and the honest mean is 61.8% against 59.0% — inside
the noise. One run is an anecdote.

## Provisional default model: **sonnet**; opus comparison **outstanding**

Opus at the current prompt version was **not** run. Reasons, recorded so the gap
is visible rather than implied:

1. **Frugality** — a full-set opus run costs ~$2.75 against $2.32 of remaining
   budget. Launching it would have been cut off mid-run by the ledger: money
   spent, no comparison produced.
2. **API instability** — the transient failures that wrecked run 2 above would
   have made a single opus run unreadable, and there is no budget for a repeat.
3. **No demo dependency** — nothing in the Tuesday demo turns on the model
   choice; sonnet is the current default and stays so.

The only opus data at prompt 1.3.0 is a 10-document gate (68.7% accuracy, 0
silent errors, 100% usable, $0.098/doc), which is one class of one run and not a
basis for a recommendation. **Opus variance is measured at the real-document
acceptance run**, where the comparison actually decides something.
