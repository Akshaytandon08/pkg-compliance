ALTER TABLE "assessment_evidence" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "document_id" integer;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "extracted_claim_id" integer;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_document_id_evidence_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."evidence_documents"("id") ON DELETE set null ON UPDATE no action;