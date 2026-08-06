-- Approval history must be undeletable. ON DELETE RESTRICT means an approved
-- checkpoint cannot be deleted at all: its approval row blocks the delete.
-- Checkpoints are never deleted; they transition to status 'superseded'.
-- (Supersedes the earlier CASCADE, which would have let an approved checkpoint
-- be removed and take its own audit record with it.)
ALTER TABLE "checkpoint_approvals" DROP CONSTRAINT "checkpoint_approvals_checkpoint_version_fk";
--> statement-breakpoint
ALTER TABLE "checkpoint_approvals" ADD CONSTRAINT "checkpoint_approvals_checkpoint_version_fk" FOREIGN KEY ("checkpoint_id","checkpoint_version") REFERENCES "public"."checkpoints"("id","version") ON DELETE restrict ON UPDATE no action;