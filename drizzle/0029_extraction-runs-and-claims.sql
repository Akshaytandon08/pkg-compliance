CREATE TYPE "public"."extracted_claim_status" AS ENUM('pending', 'confirmed', 'rejected', 'manual');--> statement-breakpoint
CREATE TYPE "public"."extraction_run_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'refused');--> statement-breakpoint
CREATE TABLE "extracted_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"claim_type" text NOT NULL,
	"parameter" text,
	"value" text,
	"unit" text,
	"test_method" text,
	"issuer" text,
	"accreditation_ref" text,
	"issue_date" date,
	"expiry" date,
	"scope_text" text,
	"confidence" double precision,
	"provenance" jsonb,
	"status" "extracted_claim_status" DEFAULT 'pending' NOT NULL,
	"supersedes_id" integer,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"doc_class" text,
	"status" "extraction_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" double precision,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extracted_claims" ADD CONSTRAINT "extracted_claims_run_id_extraction_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_document_id_evidence_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."evidence_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Immutability of a CONFIRMED claim, enforced by the database (brief: a
-- confirmed claim is a human-attested fact that a verdict may rest on). Once a
-- claim's status is 'confirmed' it can no longer be updated or deleted. Confirming
-- (pending -> confirmed) is still allowed, since OLD.status is not yet 'confirmed'.
-- A correction never edits a confirmed claim: it INSERTs a new claim whose
-- supersedes_id points back at the one it replaces (the old row is kept).
CREATE OR REPLACE FUNCTION enforce_confirmed_claim_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmed' THEN
      RAISE EXCEPTION
        'extracted_claim % is confirmed and immutable; it cannot be deleted (supersede it with a new claim instead)',
        OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'confirmed' THEN
    RAISE EXCEPTION
      'extracted_claim % is confirmed and immutable; corrections must be a new claim linked via supersedes_id, not an in-place edit',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER extracted_claim_confirmed_immutable
BEFORE UPDATE OR DELETE ON extracted_claims
FOR EACH ROW EXECUTE FUNCTION enforce_confirmed_claim_immutable();
