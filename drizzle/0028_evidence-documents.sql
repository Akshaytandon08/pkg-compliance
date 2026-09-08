CREATE TABLE "evidence_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"component_id" integer,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_backend" text NOT NULL,
	"storage_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" integer,
	"source" text NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_documents" ADD CONSTRAINT "evidence_documents_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_documents" ADD CONSTRAINT "evidence_documents_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE set null ON UPDATE no action;