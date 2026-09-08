CREATE TYPE "public"."evidence_request_status" AS ENUM('open', 'fulfilled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "evidence_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"checkpoint_id" text NOT NULL,
	"component_id" integer,
	"token" text NOT NULL,
	"status" "evidence_request_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "evidence_documents" ADD COLUMN "evidence_request_id" integer;--> statement-breakpoint
ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE set null ON UPDATE no action;