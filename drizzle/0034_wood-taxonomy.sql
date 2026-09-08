ALTER TABLE "checkpoints" ADD COLUMN "not_applicable_reason" text;--> statement-breakpoint
-- Material taxonomy (Sprint 4b / B2): `wood` splits into wood_solid / wood_processed.
-- ISPM-15 v2 narrows the heat-treatment obligation to SOLID wood only; processed
-- wood (plywood, OSB, moulded/pressed wood, MDF) is exempt under ISPM 15 §2.1. v2 is
-- seeded DRAFT — promotion to in_force is a human act (corpus:approve). v1 stays
-- in_force meanwhile; via the material hierarchy it still applies to both subtypes.
INSERT INTO checkpoints
  (id, version, geography, jurisdiction_level, stack, material, legal_role, persona_relevance, packaging_level, trigger_date, sunset_date, status, requirement_text, test_method, citation, citation_verified_date, notes, not_applicable_reason, subject, thresholds, evidence_requirements, applies_when, citation_verified_by, recurrence, later_of_condition, exemptions, future_law_watch, source_corroborating, confidence, official_register, register_operator, producer_responsibility_organisation, registration_threshold, contribution_threshold)
SELECT
  id, 2, geography, jurisdiction_level, stack,
  ARRAY['wood_solid']::text[],
  legal_role, persona_relevance, packaging_level, trigger_date, sunset_date,
  'draft',
  requirement_text, test_method, citation, NULL, notes,
  'Processed wood (plywood, OSB, moulded/pressed wood, MDF) is exempt under ISPM 15 §2.1. This exemption is not blanket clearance from destination-country import conditions.',
  subject, thresholds, evidence_requirements,
  '{"bom_material_present":"wood_solid"}'::jsonb,
  NULL, recurrence, later_of_condition, exemptions, future_law_watch, source_corroborating, confidence, official_register, register_operator, producer_responsibility_organisation, registration_threshold, contribution_threshold
FROM checkpoints
WHERE id = 'INTL-ISPM15-heat-treatment' AND version = 1;
--> statement-breakpoint
-- Migrate existing wood components to the solid subtype (all current wood data is
-- solid pine pallets/crates). Processed-wood components are entered as wood_processed.
UPDATE assessment_components SET material = 'wood_solid' WHERE material = 'wood';
