ALTER TABLE "assessment_components" ADD COLUMN "country_of_origin" text;--> statement-breakpoint
ALTER TABLE "assessment_components" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "assessment_components" ADD COLUMN "recycled_share" double precision;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "issuer_name" text;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "issuer_type" text;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "accreditation_ref" text;