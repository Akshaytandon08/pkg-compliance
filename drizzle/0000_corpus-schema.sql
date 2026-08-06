CREATE TYPE "public"."checkpoint_status" AS ENUM('draft', 'in_force', 'upcoming', 'contested', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_level" AS ENUM('EU', 'MS', 'national', 'state');--> statement-breakpoint
CREATE TYPE "public"."stack" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TABLE "checkpoint_approvals" (
	"checkpoint_id" text NOT NULL,
	"checkpoint_version" integer NOT NULL,
	"corpus_version_id" integer NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"primary_source_url" text NOT NULL,
	"notes" text,
	CONSTRAINT "checkpoint_approvals_checkpoint_id_checkpoint_version_pk" PRIMARY KEY("checkpoint_id","checkpoint_version")
);
--> statement-breakpoint
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
	"status" "checkpoint_status" DEFAULT 'draft' NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "checkpoint_approvals" ADD CONSTRAINT "checkpoint_approvals_corpus_version_id_corpus_versions_id_fk" FOREIGN KEY ("corpus_version_id") REFERENCES "public"."corpus_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_approvals" ADD CONSTRAINT "checkpoint_approvals_checkpoint_version_fk" FOREIGN KEY ("checkpoint_id","checkpoint_version") REFERENCES "public"."checkpoints"("id","version") ON DELETE cascade ON UPDATE no action;