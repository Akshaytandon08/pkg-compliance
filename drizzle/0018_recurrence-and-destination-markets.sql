-- Approved schema rulings (SCHEMA_DELTAS #2 destination market, #3 recurrence).
--   1. recurrence: recurring-obligation cadence for Stack B filings.
--   2. destination_markets[] on assessment_context — the regime-level superset of
--      destination_member_states; India rows key off it via a new `contains`
--      applies_when operator, the EU Member-State layer keys off member states.
-- All corpus edits below touch DRAFT batch-2 rows only; batch-1 stays untouched.

ALTER TABLE "checkpoints" ADD COLUMN "recurrence" jsonb;--> statement-breakpoint

-- recurrence joins the frozen set: once a checkpoint is in_force, its cadence is
-- substantive content and cannot be edited in place (a change needs a new version).
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

-- Backfill destination_markets on existing assessments. All existing packs are
-- the EU demos (destination_member_states populated), so their market superset
-- is ["EU"]. Mapping: a Member-State list implies the "EU" regime; India adds
-- "IN" (no existing pack ships to India). Idempotent — only sets when absent.
UPDATE assessments
SET assessment_context = jsonb_set(
      assessment_context,
      '{destination_markets}',
      CASE
        WHEN jsonb_array_length(COALESCE(assessment_context->'destination_member_states', '[]'::jsonb)) > 0
        THEN '["EU"]'::jsonb
        ELSE '[]'::jsonb
      END,
      true
    )
WHERE NOT (assessment_context ? 'destination_markets');
--> statement-breakpoint

-- Re-express India rows: {"destination_market":"IN"} (an unrecognised key that
-- yielded CONTEXT_REQUIRED) → {"destination_markets":{"contains":"IN"}}, now a
-- first-class applicability condition the engine evaluates.
UPDATE checkpoints
SET applies_when = '{"destination_markets":{"contains":"IN"}}'::jsonb
WHERE geography = 'IN' AND applies_when = '{"destination_market":"IN"}'::jsonb;
--> statement-breakpoint

-- Re-express the six Member-State registration rows: {"destination_member_states":
-- "present"} (applies whenever ANY MS is a destination) → per-Member-State
-- {"destination_member_states":{"contains":"<cc>"}} (applies only when THAT MS is
-- a destination). Also stamp the recurring filing cadence: annual (P1Y). The
-- specific national due date is per-MS and on the primary re-verify list, so
-- `due` is omitted rather than guessed — the calendar states the cadence.
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"DE"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-DE-epr-registration';--> statement-breakpoint
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"FR"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-FR-epr-registration';--> statement-breakpoint
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"ES"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-ES-epr-registration';--> statement-breakpoint
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"IT"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-IT-epr-registration';--> statement-breakpoint
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"NL"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-NL-epr-registration';--> statement-breakpoint
UPDATE checkpoints SET
  applies_when = '{"destination_member_states":{"contains":"PL"}}'::jsonb,
  recurrence = '{"every":"P1Y"}'::jsonb
  WHERE id = 'EU-MS-PL-epr-registration';--> statement-breakpoint

-- France national labelling applies when FR is a destination.
UPDATE checkpoints
SET applies_when = '{"destination_member_states":{"contains":"FR"}}'::jsonb
WHERE id = 'EU-MS-FR-labelling-triman-infotri';
