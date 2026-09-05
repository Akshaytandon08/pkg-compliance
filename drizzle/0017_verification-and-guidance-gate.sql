ALTER TABLE "checkpoints" ADD COLUMN "citation_verified_by" text;--> statement-breakpoint
ALTER TABLE "evidence_guidance" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evidence_guidance" ADD COLUMN "verified_by" text;--> statement-breakpoint

-- Guidance approval gate — the same trigger-level enforcement checkpoints have
-- (closes the finding-#5 asymmetry: one gate standard everywhere).
--   1. A guidance row cannot be 'approved' without approved_by + corpus_version.
--   2. Once approved, its content fields are immutable (a change needs a new
--      draft/version), so the report only ever renders human-approved advice.
CREATE OR REPLACE FUNCTION enforce_guidance_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    IF NEW.approved_by IS NULL OR NEW.corpus_version IS NULL THEN
      RAISE EXCEPTION
        'guidance %@%/% cannot be approved without approved_by and corpus_version (human sign-off is a hard gate)',
        NEW.checkpoint_id, NEW.checkpoint_version, NEW.evidence_type;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    IF NEW.issuer_guidance IS DISTINCT FROM OLD.issuer_guidance
      OR NEW.must_contain IS DISTINCT FROM OLD.must_contain
      OR NEW.red_flags IS DISTINCT FROM OLD.red_flags
      OR NEW.typical_source_org_role IS DISTINCT FROM OLD.typical_source_org_role
      OR NEW.cost_turnaround_note IS DISTINCT FROM OLD.cost_turnaround_note
    THEN
      RAISE EXCEPTION
        'guidance %@%/% is approved; its content is immutable (create a new draft to change it)',
        OLD.checkpoint_id, OLD.checkpoint_version, OLD.evidence_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER evidence_guidance_approval_gate
BEFORE INSERT OR UPDATE ON evidence_guidance
FOR EACH ROW EXECUTE FUNCTION enforce_guidance_approval();
