-- Commission PPWR FAQ, 2nd edition (DG ENV, Aug 2026) amendments. The FAQ is
-- NON-BINDING interpretive guidance: it is recorded in notes / requirement_text
-- / test_method, and NEVER in the citation field (which stays primary law).
-- Provenance register: docs/regulatory-sources.md. All rows stay 'draft'.
--
-- Also collapses food_contact_only into applies_when ({"food_contact": true}),
-- so applicability has a single mechanism rather than a special-case flag.

-- Recreate the immutability trigger without food_contact_only (dropped below).
-- applies_when stays in the frozen set; rule 1 unchanged.
CREATE OR REPLACE FUNCTION enforce_checkpoint_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_force' THEN
    IF NOT EXISTS (
      SELECT 1 FROM checkpoint_approvals a
      WHERE a.checkpoint_id = NEW.id
        AND a.checkpoint_version = NEW.version
    ) THEN
      RAISE EXCEPTION
        'checkpoint %@% cannot be in_force without an approval record (regulatory owner sign-off is a hard gate)',
        NEW.id, NEW.version;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'in_force' THEN
    IF NEW.requirement_text IS DISTINCT FROM OLD.requirement_text
      OR NEW.thresholds IS DISTINCT FROM OLD.thresholds
      OR NEW.citation IS DISTINCT FROM OLD.citation
      OR NEW.test_method IS DISTINCT FROM OLD.test_method
      OR NEW.evidence_requirements IS DISTINCT FROM OLD.evidence_requirements
      OR NEW.applies_when IS DISTINCT FROM OLD.applies_when
      OR NEW.subject IS DISTINCT FROM OLD.subject
      OR NEW.material IS DISTINCT FROM OLD.material
      OR NEW.legal_role IS DISTINCT FROM OLD.legal_role
      OR NEW.packaging_level IS DISTINCT FROM OLD.packaging_level
      OR NEW.geography IS DISTINCT FROM OLD.geography
      OR NEW.jurisdiction_level IS DISTINCT FROM OLD.jurisdiction_level
      OR NEW.stack IS DISTINCT FROM OLD.stack
      OR NEW.trigger_date IS DISTINCT FROM OLD.trigger_date
      OR NEW.sunset_date IS DISTINCT FROM OLD.sunset_date
    THEN
      RAISE EXCEPTION
        'checkpoint %@% is approved and in_force; substantive changes require a new version, not an in-place edit',
        OLD.id, OLD.version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
ALTER TABLE "checkpoints" DROP COLUMN "food_contact_only";
--> statement-breakpoint

-- Heavy metals — Commission-recommended verification method.
UPDATE checkpoints SET
  test_method = 'CR 13695-1:2000 (Commission-recommended reference method for the four heavy metals)',
  notes = notes || ' FAQ (interpretive): CR 13695-1:2000 is the recommended verification method — non-binding, see docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-heavy-metals';
--> statement-breakpoint

-- Substances-of-concern minimisation — reference method, no presumption of conformity.
UPDATE checkpoints SET
  test_method = 'EN 13428:2004 Annex C (reference method; presumption of conformity withdrawn)',
  notes = notes || ' FAQ (interpretive): EN 13428:2004 Annex C is the reference method with no presumption of conformity — non-binding, see docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-soc-minimisation';
--> statement-breakpoint

-- PFAS — no harmonised standard; Commission Notice three-step framework is the reference.
UPDATE checkpoints SET
  test_method = 'No harmonised standard. Commission Notice C/2026/3084 three-step framework: TF screening, py-GC/MS, TOP.',
  notes = notes || ' FAQ (interpretive): no harmonised PFAS verification standard and no defined Union-level conformity pathway; Commission Notice C/2026/3084 three-step framework (TF screening, py-GC/MS, TOP) is the current reference. See docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-pfas-food-contact';
--> statement-breakpoint

-- Declaration of conformity — one per packaging unit, in each Member State's language.
UPDATE checkpoints SET
  requirement_text = requirement_text || ' A single declaration of conformity covers the packaging unit as a whole (not one per component), drawn up in the language(s) of each Member State where the packaging is supplied.',
  notes = notes || ' FAQ (interpretive): one DoC per packaging unit, in each supplied Member State''s language. See docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-declaration-of-conformity';
--> statement-breakpoint

-- No-transitional-stock — FAQ softening + Article 71 pinpoint.
UPDATE checkpoints SET
  requirement_text = requirement_text || ' Per Commission FAQ guidance (non-binding): stock already placed on the market before 12 August 2026 need not be withdrawn, destroyed or relabelled solely because the Regulation becomes applicable; missing identification may be provided via accompanying documentation, and best-efforts reconstruction of documentation is expected.',
  citation = 'Regulation (EU) 2025/40, Article 71 (application date). https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng',
  notes = 'SUBJECT: packaging_unit. Applicability/scope rule. Article 71 (application date) — pin confirmed via FAQ Chapter XVI reference, verify on primary. FAQ softening (pre-12-Aug stocks, accompanying-document identification, best-efforts reconstruction) is interpretive and non-binding. See docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-no-transitional-stock';
--> statement-breakpoint

-- Technical documentation — the manufacturer must hold the file.
UPDATE checkpoints SET
  notes = notes || ' FAQ (interpretive): retention by the supplier alone is insufficient — the manufacturer must hold the technical file. See docs/regulatory-sources.md.'
  WHERE id = 'EU-PPWR-technical-documentation';
