-- Schema deltas (pass 1 of 2): add subject, thresholds[], evidence_requirements
-- and backfill existing rows. Pass 2 (0005) drops the superseded columns and
-- updates the immutability trigger. Split so drizzle-kit sees additions then
-- deletions separately (its rename-resolver needs a TTY otherwise).

CREATE TYPE "public"."checkpoint_subject" AS ENUM('component', 'packaging_unit', 'organisation');--> statement-breakpoint

-- subject: NOT NULL. Backfill every existing row to 'component' via a temporary
-- default, then drop the default so new inserts must state the subject.
-- (Batch 1's packaging_unit/organisation rows are set in migration 0006.)
ALTER TABLE "checkpoints" ADD COLUMN "subject" "checkpoint_subject" NOT NULL DEFAULT 'component';--> statement-breakpoint
ALTER TABLE "checkpoints" ALTER COLUMN "subject" DROP DEFAULT;--> statement-breakpoint

-- thresholds: single object -> one-element array; NULL stays NULL.
ALTER TABLE "checkpoints" ADD COLUMN "thresholds" jsonb;--> statement-breakpoint
UPDATE "checkpoints"
  SET "thresholds" = CASE WHEN "threshold" IS NULL THEN NULL ELSE jsonb_build_array("threshold") END;--> statement-breakpoint

-- evidence_requirements: the old flat evidence_type list meant "any of these",
-- so it maps to a single CNF clause: allOf:[ anyOf:[ ...types ] ].
ALTER TABLE "checkpoints" ADD COLUMN "evidence_requirements" jsonb;--> statement-breakpoint
UPDATE "checkpoints"
  SET "evidence_requirements" =
    jsonb_build_object('allOf', jsonb_build_array(jsonb_build_object('anyOf', to_jsonb("evidence_type"))));--> statement-breakpoint
ALTER TABLE "checkpoints" ALTER COLUMN "evidence_requirements" SET NOT NULL;
