-- INTL-ISPM15-heat-treatment (draft). First multi-regime checkpoint: an IPPC/FAO
-- international standard with an EU plant-health import anchor. applies_when here
-- references a BOM material fact (solid wood present), NOT assessment_context —
-- documented in eval/README. The IPPC (HT) mark on the component is itself
-- evidence. Review queue becomes 12. Stays draft.

INSERT INTO checkpoints (
  id, version, geography, jurisdiction_level, stack, subject, material, legal_role,
  persona_relevance, packaging_level, trigger_date, sunset_date, status,
  requirement_text, thresholds, evidence_requirements, applies_when, test_method,
  citation, citation_verified_date, notes
) VALUES (
  'INTL-ISPM15-heat-treatment', 1, 'EU', 'EU', 'A', 'component', '{wood}', '{manufacturer,importer}',
  '{1,2a,2b}', '{transport,pallet,outer}', NULL, NULL, 'draft',
  'Solid-wood packaging material (pallets, crates, dunnage) must be heat-treated (HT: minimum 56°C core for 30 continuous minutes) and bear the IPPC mark with the ISPM 15 treatment code and country/producer code. The HT mark on the component is itself the primary evidence. Plywood, OSB and other processed/engineered wood are exempt.',
  NULL,
  '{"allOf":[{"anyOf":["marking","supplier_declaration"]}]}'::jsonb,
  '{"bom_material_present":"wood"}'::jsonb,
  'ISPM 15 heat treatment (HT): minimum 56°C core temperature for 30 continuous minutes; verification of the IPPC mark and treatment code.',
  'ISPM 15 (IPPC/FAO) — International Standard for Phytosanitary Measures No. 15, Regulation of wood packaging material in international trade; EU import anchor: Regulation (EU) 2016/2031 (plant health). https://www.ippc.int/en/core-activities/standards-setting/ispms/ · https://eur-lex.europa.eu/eli/reg/2016/2031/oj/eng',
  NULL,
  'SUBJECT: component. First multi-regime checkpoint (IPPC standard + EU plant-health anchor). applies_when references a BOM material fact (solid wood present), not assessment_context — see eval/README. The HT (IPPC) mark on the component is itself evidence (marking). Plywood/OSB/processed wood are EXEMPT — verify that stamp absence on those does not trigger port queries. Confirm ISPM 15 revision and the Regulation (EU) 2016/2031 pinpoint on primary before approval.'
);
