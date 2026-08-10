-- Batch 1 refactor: apply the schema-delta rulings to the seeded rows and
-- sharpen citation pinpoints. Everything stays 'draft' — no status changes, no
-- approvals. Drafts are freely editable (the immutability trigger only freezes
-- in_force rows), and the operator-id draft is deletable (no approval row yet).

-- 1. subject per ruling. Rows 1-5 are already 'component' (0004 backfill);
--    set the packaging_unit / organisation rows.
UPDATE checkpoints SET subject = 'packaging_unit'
  WHERE id IN ('EU-PPWR-technical-documentation', 'EU-PPWR-declaration-of-conformity', 'EU-PPWR-no-transitional-stock');
--> statement-breakpoint
UPDATE checkpoints SET subject = 'organisation'
  WHERE id = 'EU-EPR-producer-registration';
--> statement-breakpoint

-- 2. Split operator identification into manufacturer and importer obligations,
--    which cite different articles. Remove the combined draft, add the two.
DELETE FROM checkpoints WHERE id = 'EU-PPWR-operator-identification';
--> statement-breakpoint
INSERT INTO checkpoints (
  id, version, geography, jurisdiction_level, stack, subject, material, legal_role,
  persona_relevance, packaging_level, trigger_date, sunset_date, status,
  requirement_text, thresholds, evidence_requirements, test_method, citation,
  citation_verified_date, notes, food_contact_only
) VALUES
(
  'EU-PPWR-operator-id-manufacturer', 1, 'EU', 'EU', 'A', 'packaging_unit', '{all}', '{manufacturer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The manufacturer shall indicate on the packaging (or on a label or an accompanying document) their name, registered trade name or trademark, and postal address.',
  NULL,
  '{"allOf":[{"anyOf":["marking"]}]}'::jsonb, NULL,
  'Regulation (EU) 2025/40, Article 15(5) and (6) (manufacturer identification and marking). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: packaging_unit. Split from EU-PPWR-operator-identification. Pinpoints Art 15(5),(6) verified via secondary cross-check, confirm on primary.',
  false
),
(
  'EU-PPWR-operator-id-importer', 1, 'EU', 'EU', 'A', 'packaging_unit', '{all}', '{importer}',
  '{1,2a,2b}', '{sales,inner,outer,transport,pallet,ecomm}', '2026-08-12', NULL, 'draft',
  'The importer shall indicate on the packaging their name, registered trade name or trademark, and postal address.',
  NULL,
  '{"allOf":[{"anyOf":["marking"]}]}'::jsonb, NULL,
  'Regulation (EU) 2025/40, Article 18(3) (importer identification). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  NULL,
  'SUBJECT: packaging_unit. Split from EU-PPWR-operator-identification. Per Art 18(3), details may alternatively be provided via a data carrier/QR or an accompanying document. Pinpoint Art 18(3) verified via secondary cross-check, confirm on primary.',
  false
);
--> statement-breakpoint

-- 3. Citation pinpoints, sharpened. Status "verified via secondary cross-check,
--    confirm on primary" — citation_verified_date stays NULL until confirmed.
UPDATE checkpoints SET
  citation = 'Regulation (EU) 2025/40, Article 15(1) (manufacturer obligations) + Article 38 (conformity assessment, Module A) + Annex VII (technical documentation). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  notes = 'SUBJECT: packaging_unit. Pinpoints Art 15(1) + Art 38 + Annex VII verified via secondary cross-check, confirm on primary.'
  WHERE id = 'EU-PPWR-technical-documentation';
--> statement-breakpoint
UPDATE checkpoints SET
  citation = 'Regulation (EU) 2025/40, Article 39 + Annex VIII (EU declaration of conformity); "manufacturer" defined at Article 3(1)(13). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  notes = 'SUBJECT: packaging_unit. Pinpoints Art 39 + Annex VIII, manufacturer definition Art 3(1)(13), verified via secondary cross-check, confirm on primary. DoC stated as the USER''s obligation by design; the system never issues one. No evidence_type for a declaration in the vocabulary — modelled as CNF anyOf[technical_file]; see delta #6.'
  WHERE id = 'EU-PPWR-declaration-of-conformity';
--> statement-breakpoint
UPDATE checkpoints SET
  citation = 'Regulation (EU) 2025/40, Articles 44-45 (registration of producers). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  notes = 'SUBJECT: organisation. STACK B (EPR). Pinpoints Art 44-45 verified via secondary cross-check, confirm on primary. WATCH: a December 2025 Commission proposal would suspend the authorised-representative obligation to 2035 for EU-based companies only — pending, and does not affect non-EU producers (persona 2a). Track before approval.'
  WHERE id = 'EU-EPR-producer-registration';
--> statement-breakpoint

-- 4. thresholds as arrays. Row 1 (heavy metals) was already migrated to a
--    one-element array by 0004; set it explicitly for clarity. Row 2 (PFAS)
--    now carries its three simultaneous limits (delta #8).
UPDATE checkpoints SET
  thresholds = '[{"parameter":"Pb+Cd+Hg+Cr(VI) sum","operator":"<=","value":100,"unit":"mg/kg"}]'::jsonb
  WHERE id = 'EU-PPWR-heavy-metals';
--> statement-breakpoint
UPDATE checkpoints SET
  thresholds = '[
    {"parameter":"single PFAS","operator":"<=","value":25,"unit":"ppb","applies_when":"targeted analysis"},
    {"parameter":"sum of PFAS","operator":"<=","value":250,"unit":"ppb","applies_when":"targeted, non-polymeric"},
    {"parameter":"total organic fluorine","operator":"<=","value":50,"unit":"ppm"}
  ]'::jsonb,
  notes = 'SUBJECT: component. FOOD-CONTACT ONLY. Three simultaneous limits now structured (delta #8 resolved). Values from verified facts ledger; confirm Article 5 PFAS pinpoint and units on primary.'
  WHERE id = 'EU-PPWR-pfas-food-contact';
