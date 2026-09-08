CREATE TABLE "assessment_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
ALTER TABLE "assessment_activity" ADD CONSTRAINT "assessment_activity_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;