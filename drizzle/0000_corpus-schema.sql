CREATE TYPE "public"."checkpoint_status" AS ENUM('in_force', 'upcoming', 'contested', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_level" AS ENUM('EU', 'MS', 'national', 'state');--> statement-breakpoint
CREATE TYPE "public"."stack" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"geography" text NOT NULL,
	"jurisdiction_level" "jurisdiction_level" NOT NULL,
	"stack" "stack" NOT NULL,
	"material" text[] NOT NULL,
	"legal_role" text[] NOT NULL,
	"persona_relevance" text[] NOT NULL,
	"packaging_level" text[] NOT NULL,
	"trigger_date" date,
	"sunset_date" date,
	"status" "checkpoint_status" NOT NULL,
	"requirement_text" text NOT NULL,
	"threshold" jsonb,
	"evidence_type" text[] NOT NULL,
	"test_method" text,
	"citation" text NOT NULL,
	"citation_verified_date" date,
	"notes" text,
	"food_contact_only" boolean DEFAULT false NOT NULL,
	CONSTRAINT "checkpoints_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "corpus_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "corpus_versions_label_unique" UNIQUE("label")
);
