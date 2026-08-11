-- Pre-approval text finalisation (rulings on Commit 9 findings). All rows stay
-- 'draft'; this only sharpens wording before the approval pass.

-- no-transitional-stock: rewrite as two explicit cases (replace, not append) so
-- the "must comply" rule and the transitional relief cannot be misread together.
UPDATE checkpoints SET
  requirement_text = '(a) Placing on the market from 12 August 2026: packaging placed on the market on or after 12 August 2026 must comply with this Regulation regardless of its date of manufacture. (b) Packaging already placed on the market before 12 August 2026: transitional relief applies per Commission FAQ guidance (non-binding) — such stock need not be withdrawn, destroyed or relabelled solely because the Regulation becomes applicable; missing identification may be provided via accompanying documentation, and best-efforts reconstruction of documentation is expected.'
  WHERE id = 'EU-PPWR-no-transitional-stock';
--> statement-breakpoint

-- soc-minimisation: qualify the method to the specific annex, not the whole standard.
UPDATE checkpoints SET
  test_method = 'EN 13428:2004, Annex C only (hazardous-substance minimisation assessment) — not the general source-reduction body of the standard.'
  WHERE id = 'EU-PPWR-soc-minimisation';
--> statement-breakpoint

-- declaration-of-conformity: the closing evidence is the user's DoC itself, now a
-- distinct evidence type rather than a generic technical_file.
UPDATE checkpoints SET
  evidence_requirements = '{"allOf":[{"anyOf":["conformity_declaration"]}]}'::jsonb,
  notes = 'SUBJECT: packaging_unit. Pinpoints Art 39 + Annex VIII, manufacturer definition Art 3(1)(13), verified via secondary cross-check, confirm on primary. DoC stated as the USER''s obligation by design; the system never issues one. Evidence is the operator''s own conformity_declaration (SCHEMA_DELTAS #6 resolved). FAQ (interpretive): one DoC per packaging unit, in each supplied Member State''s language. See docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-declaration-of-conformity';
