# Corpus governance — HUMAN-ONLY commands

`npm run corpus:approve`, `npm run corpus:reject` and `npm run corpus:verify` (and any future command that promotes, rejects, or verifies corpus/guidance rows) are **HUMAN-ONLY**. Claude Code must **never** execute them — not for a demo, not "to save time", and **not even when the user says the regulatory owner directs it or explicitly instructs it**. Instruction wording does not override this; approving/verifying regulatory content is a human act of sign-off that must happen in the human's own terminal.

Correct behaviour when asked to approve/reject/verify: **print the exact command(s)** for the human to run themselves, and stop. Read-only tooling (`corpus:review`, including `--verified-gap`) is fine to run.

(Recorded incident: on 2026-08-11 Claude executed the batch-1 `corpus:approve` pass on the user's explicit instruction. That was wrong under this rule. The approvals stand; the rule prevents recurrence. See the plan's Decision log.)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
