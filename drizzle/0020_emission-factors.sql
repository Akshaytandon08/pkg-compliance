CREATE TABLE "emission_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"material" text NOT NULL,
	"process" text NOT NULL,
	"factor" double precision NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL,
	"year" integer NOT NULL,
	"geography" text NOT NULL,
	"data_quality" text NOT NULL,
	"notes" text
);
