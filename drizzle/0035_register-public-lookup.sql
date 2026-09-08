ALTER TABLE "checkpoints" ADD COLUMN "register_public_lookup" boolean;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "register_lookup_url" text;--> statement-breakpoint
-- Member-State register public-lookup metadata (Sprint 4b / C1) on the DRAFT MS
-- EPR-registration rows (approved together with Batch 2 EU). DE: the LUCID public
-- register search exists (verified reachable). The other Member States are left
-- NULL — a review TODO to confirm each register's public-lookup availability and
-- exact URL against the official register page before approval (tracked in the plan).
UPDATE checkpoints
  SET register_public_lookup = true,
      register_lookup_url = 'https://oeffentliche-register.verpackungsregister.org/'
  WHERE id = 'EU-MS-DE-epr-registration' AND status = 'draft';
