-- assessment_context support: a checkpoint-level applies_when, keyed on
-- assessment_context fields. Resolves the organisation-subject gap — a
-- checkpoint can declare the context it needs; the engine yields a
-- CONTEXT_REQUIRED caveat when that context is absent, never a silent pass.

ALTER TABLE "checkpoints" ADD COLUMN "applies_when" jsonb;--> statement-breakpoint

-- PFAS applies only to food-contact packaging — structural, not prose.
UPDATE checkpoints SET applies_when = '{"food_contact": true}'::jsonb
  WHERE id = 'EU-PPWR-pfas-food-contact';--> statement-breakpoint

-- Producer registration depends on the Member States of first placing, which
-- the BOM does not carry. "present" = the field must be a non-empty array; if
-- absent, the checkpoint yields a CONTEXT_REQUIRED caveat rather than a verdict.
UPDATE checkpoints SET applies_when = '{"destination_member_states": "present"}'::jsonb
  WHERE id = 'EU-EPR-producer-registration';--> statement-breakpoint

-- applies_when is substantive: add it to the immutability trigger's frozen set.
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
      OR NEW.food_contact_only IS DISTINCT FROM OLD.food_contact_only
    THEN
      RAISE EXCEPTION
        'checkpoint %@% is approved and in_force; substantive changes require a new version, not an in-place edit',
        OLD.id, OLD.version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
