-- Sprint 9, Commit 1 — retire the SEED-ESTIMATE tier.
--
-- Every row in this table was a seeded order-of-magnitude guess with no
-- traceable origin, carried on the tier 'SEED-ESTIMATE'. The tier is removed and
-- so are the rows: a factor is a claim about the physical world, and a number
-- nobody can trace is worse than no number. Until the owner selects factors
-- (npm run factors:select) every material renders "No factor selected" and is
-- excluded from the footprint total with a visible note.
--
-- This is reference data, not user data — no assessment loses anything that was
-- ever true, and the footprint it feeds has always been labelled a screening
-- estimate. Deleting before the provenance columns are added (0040) is also what
-- lets those columns be NOT NULL without a fabricated backfill.
DELETE FROM "emission_factors";--> statement-breakpoint
ALTER TABLE "emission_factors" DROP COLUMN "geography";--> statement-breakpoint
ALTER TABLE "emission_factors" DROP COLUMN "data_quality";
