-- Refine the confirmed-claim immutability trigger (from 0029): block only in-place
-- UPDATE of a confirmed claim — that is the real guarantee (a confirmed value can
-- never be silently changed; a correction is a NEW claim linked via supersedes_id).
--
-- DELETE is no longer blocked. Blocking it also blocked the legitimate cascade
-- teardown of a whole assessment (assessment -> document -> run -> claim), which is
-- an administrative removal of everything, not tampering with a confirmed value.
-- Deletion is governed by the cascade/administrative policy, not this trigger.
DROP TRIGGER IF EXISTS extracted_claim_confirmed_immutable ON extracted_claims;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_confirmed_claim_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'confirmed' THEN
    RAISE EXCEPTION
      'extracted_claim % is confirmed and immutable; corrections must be a new claim linked via supersedes_id, not an in-place edit',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER extracted_claim_confirmed_immutable
BEFORE UPDATE ON extracted_claims
FOR EACH ROW EXECUTE FUNCTION enforce_confirmed_claim_immutable();
