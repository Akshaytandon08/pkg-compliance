-- Batch 2 (India) — all DRAFT. Packaging restrictions (Stack A) and producer
-- obligations (Stack B) relevant to exporters into India, under the Plastic
-- Waste Management Rules, 2016 (as amended) and the Schedule II EPR guidelines.
--
-- Every NUMERIC value (recycled-content %, category targets, carry-bag micron
-- thickness) is on the re-verify list and could NOT be fetched from the official
-- national source here — so thresholds are left EMPTY and the row carries a
-- TODO. No consultancy-sourced numbers, no guessed values.
--
-- applies_when uses {"destination_market":"IN"} — a key the engine does not
-- recognise, so it yields CONTEXT_REQUIRED (never a false pass) until a
-- destination-market context field is added (enhancement proposed in the report,
-- not improvised here; assessment_context is EU-Member-State-only today).

INSERT INTO checkpoints (
  id, version, geography, jurisdiction_level, stack, subject, material, legal_role,
  persona_relevance, packaging_level, trigger_date, sunset_date, status,
  requirement_text, thresholds, evidence_requirements, applies_when, test_method,
  citation, citation_verified_date, notes
) VALUES

-- 1. EPR registration (Stack B)
('IN-PWM-epr-registration', 1, 'IN', 'national', 'B', 'organisation', '{all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', NULL, NULL, 'draft',
 'Producers, importers and brand owners (PIBOs) of plastic packaging must register on the CPCB EPR portal and comply with the Extended Producer Responsibility obligations under Schedule II.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended), Schedule II (EPR guidelines, notified Feb 2022); CPCB EPR portal. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: organisation. EPR registration for PIBOs on eprplastic.cpcb.gov.in. TODO: confirm the exact amendment gazette S.O. number on egazette.gov.in and the primary Schedule II text.'),

-- 2. Recycled content in plastic packaging (Stack B) — numeric TODO
('IN-PWM-epr-recycled-content', 1, 'IN', 'national', 'B', 'component', '{plastic,all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', NULL, NULL, 'draft',
 'Plastic packaging must contain a minimum share of recycled plastic, differentiated by packaging category, as prescribed under the Schedule II EPR guidelines and CPCB notifications.',
 NULL, '{"allOf":[{"anyOf":["registration","technical_file"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended), Schedule II — recycled-content obligations. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: component. thresholds EMPTY — category-wise recycled-content percentages are on the re-verify list. TODO: obtain the current percentages and the phase-in years directly from the CPCB/MoEF notification (do not seed a number until confirmed on primary).'),

-- 3. Category-wise EPR targets (Stack B) — numeric TODO
('IN-PWM-epr-targets', 1, 'IN', 'national', 'B', 'organisation', '{plastic,all}', '{epr_producer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', NULL, NULL, 'draft',
 'PIBOs must meet category-wise EPR targets (collection/recycling, end-of-life disposal, and use of recycled content) for the plastic packaging categories, evidenced via the CPCB EPR portal and plastic credits.',
 NULL, '{"allOf":[{"anyOf":["registration"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended), Schedule II — category-wise EPR targets. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: organisation. thresholds EMPTY — the category-wise target percentages and years are on the re-verify list. TODO: pull the target tables directly from the CPCB/MoEF notification.'),

-- 4. Single-use plastic ban (Stack A)
('IN-PWM-sup-ban', 1, 'IN', 'national', 'A', 'component', '{plastic,all}', '{manufacturer,importer,distributor}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', NULL, NULL, 'draft',
 'Identified single-use plastic items with low utility and high littering potential are banned from manufacture, import, stocking, distribution, sale and use; packaging must not include a banned single-use plastic item.',
 NULL, '{"allOf":[{"anyOf":["supplier_declaration"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management (Amendment) Rules, 2021 — single-use plastic ban effective 1 July 2022. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: component. Ban is a list of items (not a numeric threshold). TODO: confirm the current banned-item list and the amendment gazette S.O. number on egazette.gov.in.'),

-- 5. Carry-bag / packaging minimum thickness (Stack A) — numeric TODO
('IN-PWM-thickness', 1, 'IN', 'national', 'A', 'component', '{plastic}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,ecomm}', NULL, NULL, 'draft',
 'Plastic carry bags and specified plastic sheets must meet the minimum thickness prescribed under the Rules; thinner items are prohibited.',
 NULL, '{"allOf":[{"anyOf":["supplier_declaration","lab_test"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended) — minimum thickness for plastic carry bags. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: component. threshold EMPTY — the current micron thickness (raised over successive amendments) is on the re-verify list. TODO: confirm the current thickness value directly from the CPCB/MoEF notification before seeding a threshold.'),

-- 6. Mandatory marking / labelling (Stack A)
('IN-PWM-marking', 1, 'IN', 'national', 'A', 'packaging_unit', '{plastic,all}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,ecomm}', NULL, NULL, 'draft',
 'Plastic packaging and products must carry the prescribed markings — manufacturer/producer and, where applicable, the registration number, thickness, and material/recyclability information — as required under the Rules.',
 NULL, '{"allOf":[{"anyOf":["marking"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended) — marking and labelling requirements. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: packaging_unit. TODO: confirm the exact mandatory marking fields against the primary Rules text.'),

-- 7. Plastic packaging category classification (Stack A)
('IN-PWM-category-classification', 1, 'IN', 'national', 'A', 'component', '{plastic,all}', '{manufacturer,importer}',
 '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', NULL, NULL, 'draft',
 'Plastic packaging is classified into the Schedule II categories (rigid; flexible single-layer or multilayer of a single polymer; multilayered with more than one type of plastic; and compostable/biodegradable plastic), which determines the applicable EPR obligations.',
 NULL, '{"allOf":[{"anyOf":["supplier_declaration","technical_file"]}]}', '{"destination_market":"IN"}', NULL,
 'Plastic Waste Management Rules, 2016 (as amended), Schedule II — packaging categories. https://cpcb.nic.in/rules-4/',
 NULL,
 'SUBJECT: component. Definitional/classification row. TODO: confirm the exact category definitions against the primary Schedule II text.');
