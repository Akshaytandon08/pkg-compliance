CREATE TABLE "org_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer NOT NULL,
	"scheme" text NOT NULL,
	"register_name" text,
	"registration_number" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"valid_from" date,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"country" text NOT NULL,
	"registered_address" text,
	"primary_contact" text,
	"role_default" text,
	"demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "organisation_id" integer;--> statement-breakpoint
ALTER TABLE "org_registrations" ADD CONSTRAINT "org_registrations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;