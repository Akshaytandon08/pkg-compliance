-- Schema deltas (pass 2 of 2): retire the superseded columns and update the
-- immutability trigger to freeze the new ones.

-- Recreate the approval trigger's function so its frozen-field list references
-- thresholds (not threshold) and evidence_requirements (not evidence_type), and
-- adds subject. Rule 1 (approval required for in_force) is unchanged.
CREATE OR REPLACE FUNCTION enforce_checkpoint_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: only an approval record permits in_force.
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

  -- Rule 2: approved content is frozen. Status may still move (e.g. to
  -- contested or superseded), but the substance cannot.
  IF TG_OP = 'UPDATE' AND OLD.status = 'in_force' THEN
    IF NEW.requirement_text IS DISTINCT FROM OLD.requirement_text
      OR NEW.thresholds IS DISTINCT FROM OLD.thresholds
      OR NEW.citation IS DISTINCT FROM OLD.citation
      OR NEW.test_method IS DISTINCT FROM OLD.test_method
      OR NEW.evidence_requirements IS DISTINCT FROM OLD.evidence_requirements
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

ALTER TABLE "checkpoints" DROP COLUMN "threshold";--> statement-breakpoint
ALTER TABLE "checkpoints" DROP COLUMN "evidence_type";
