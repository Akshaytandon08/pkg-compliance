CREATE TABLE "assessment_factor_pins" (
	"assessment_id" integer NOT NULL,
	"factor_id" integer NOT NULL,
	CONSTRAINT "assessment_factor_pins_assessment_id_factor_id_pk" PRIMARY KEY("assessment_id","factor_id")
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "factors_pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "tier" text NOT NULL;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "source_dataset" text;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "activity_id" text;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "region" text NOT NULL;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "methodology" text;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "licence_note" text;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "value_display_permitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "selected_by" text NOT NULL;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD COLUMN "selected_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_factor_pins" ADD CONSTRAINT "assessment_factor_pins_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_factor_pins" ADD CONSTRAINT "assessment_factor_pins_factor_id_emission_factors_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."emission_factors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_material_process_version" UNIQUE("material","process","version");