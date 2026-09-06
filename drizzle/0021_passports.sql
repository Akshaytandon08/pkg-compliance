CREATE TABLE "passports" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"token" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"prev_hash" text,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passports_token_version_uq" UNIQUE("token","version")
);
--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;