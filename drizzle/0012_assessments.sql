CREATE TABLE "assessment_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"line" text NOT NULL,
	"name" text NOT NULL,
	"material" text NOT NULL,
	"composition" text,
	"weight_grams" integer,
	"sourced_from" text
);
--> statement-breakpoint
CREATE TABLE "assessment_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"evidence_type" text NOT NULL,
	"reference" text,
	"issued_date" date,
	"expiry_date" date,
	"scope_components" text[],
	"scope_materials" text[],
	"scope_parameters" text[]
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pack_name" text NOT NULL,
	"description" text,
	"assessment_context" jsonb NOT NULL,
	"corpus_version" text NOT NULL,
	"as_of" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_components" ADD CONSTRAINT "assessment_components_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE cascade ON UPDATE no action;