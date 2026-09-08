CREATE TYPE "public"."doc_draft_status" AS ENUM('draft', 'superseded');--> statement-breakpoint
CREATE TABLE "document_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"template_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"corpus_version" text NOT NULL,
	"version" integer NOT NULL,
	"language" text NOT NULL,
	"status" "doc_draft_status" DEFAULT 'draft' NOT NULL,
	"changelog" text,
	"docx_storage_key" text NOT NULL,
	"pdf_storage_key" text NOT NULL,
	"docx_filename" text NOT NULL,
	"pdf_filename" text NOT NULL,
	"storage_backend" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;