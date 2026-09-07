CREATE TYPE "public"."checkpoint_confidence" AS ENUM('H', 'M', 'L');--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "later_of_condition" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "exemptions" jsonb;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "future_law_watch" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "source_corroborating" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "confidence" "checkpoint_confidence";--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "official_register" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "register_operator" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "producer_responsibility_organisation" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "registration_threshold" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "contribution_threshold" text;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_register_not_pro" CHECK ("checkpoints"."official_register" IS NULL OR "checkpoints"."producer_responsibility_organisation" IS NULL OR "checkpoints"."official_register" <> "checkpoints"."producer_responsibility_organisation");--> statement-breakpoint
-- Extend the in_force immutability trigger to the new substantive fields: once a
-- checkpoint is approved, changing any of them requires a new version. The
-- approval gate itself (needing a checkpoint_approvals row) is unchanged.
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
      OR NEW.recurrence IS DISTINCT FROM OLD.recurrence
      OR NEW.subject IS DISTINCT FROM OLD.subject
      OR NEW.material IS DISTINCT FROM OLD.material
      OR NEW.legal_role IS DISTINCT FROM OLD.legal_role
      OR NEW.packaging_level IS DISTINCT FROM OLD.packaging_level
      OR NEW.geography IS DISTINCT FROM OLD.geography
      OR NEW.jurisdiction_level IS DISTINCT FROM OLD.jurisdiction_level
      OR NEW.stack IS DISTINCT FROM OLD.stack
      OR NEW.trigger_date IS DISTINCT FROM OLD.trigger_date
      OR NEW.sunset_date IS DISTINCT FROM OLD.sunset_date
      OR NEW.later_of_condition IS DISTINCT FROM OLD.later_of_condition
      OR NEW.exemptions IS DISTINCT FROM OLD.exemptions
      OR NEW.future_law_watch IS DISTINCT FROM OLD.future_law_watch
      OR NEW.source_corroborating IS DISTINCT FROM OLD.source_corroborating
      OR NEW.confidence IS DISTINCT FROM OLD.confidence
      OR NEW.official_register IS DISTINCT FROM OLD.official_register
      OR NEW.register_operator IS DISTINCT FROM OLD.register_operator
      OR NEW.producer_responsibility_organisation IS DISTINCT FROM OLD.producer_responsibility_organisation
      OR NEW.registration_threshold IS DISTINCT FROM OLD.registration_threshold
      OR NEW.contribution_threshold IS DISTINCT FROM OLD.contribution_threshold
    THEN
      RAISE EXCEPTION
        'checkpoint %@% is approved and in_force; substantive changes require a new version, not an in-place edit',
        OLD.id, OLD.version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
