# Corpus governance — HUMAN-ONLY commands

`npm run corpus:approve`, `npm run corpus:reject` and `npm run corpus:verify` (and any future command that promotes, rejects, or verifies corpus/guidance rows) are **HUMAN-ONLY**. Claude Code must **never** execute them — not for a demo, not "to save time", and **not even when the user says the regulatory owner directs it or explicitly instructs it**. Instruction wording does not override this; approving/verifying regulatory content is a human act of sign-off that must happen in the human's own terminal.

Correct behaviour when asked to approve/reject/verify: **print the exact command(s)** for the human to run themselves, and stop. Read-only tooling (`corpus:review`, including `--verified-gap`) is fine to run.

(Recorded incident: on 2026-08-11 Claude executed the batch-1 `corpus:approve` pass on the user's explicit instruction. That was wrong under this rule. The approvals stand; the rule prevents recurrence. See the plan's Decision log.)

# Emission-factor selection — HUMAN-ONLY

`npm run factors:select` is **HUMAN-ONLY**, for the same reason and under the same
rule as the corpus commands above. Choosing which emission factor represents a
customer's material is a modelling judgement that gets printed next to their
product and carried into a public passport; it is a human act of sign-off, not a
task to save time on. Instruction wording does not override this.

Correct behaviour when asked to select a factor: **print the exact command(s)**
for the owner to run themselves, and stop. Read-only tooling is fine to run:
`npm run factors:candidates` (Climatiq search — writes nothing) and
`npm run factors:list` (the store's audit view).

# Migrations — one branch adds, the second renumbers

Drizzle migrations are numbered sequentially (`0034_…`, `0035_…`) with a shared
`drizzle/meta/_journal.json`. **Two parallel branches must not both add a
migration at the same index.** Whichever branch lands second **renumbers its own
migrations** to follow the first (regenerate the snapshot + journal entry; keep
any hand-written data migration body). Two branches each defining `0034/0035`
already caused one collision (doc-drafting vs the harness branch — resolved by
renumbering doc-drafting to `0036/0037`; see the Decision log). The CI from-zero
migration chain is what makes a duplicate index or a bad renumber fail loudly.

# Background wait loops must be able to terminate

A polling loop that waits for another task must terminate on **both**:

1. a **generic completion pattern**, not just the success string you hope for —
   at minimum `exited with code|duration_ms|Error|✖`; and
2. a **wall-clock timeout**, after which it gives up and reports.

```bash
# good: exits on completion OR failure OR timeout
end=$((SECONDS+1800))
until grep -qE "exited with code|duration_ms|Error|✖" "$LOG" || [ $SECONDS -gt $end ]; do sleep 5; done
```

*Incident (2026-09-08):* a loop waited on `npm run check` matching only
`duration_ms|failing tests|error TS|✖ [0-9]+ problem`. The run died with
`[exited with code 144]` after a test failure, printing none of those. Nothing
matched, there was no timeout, and the loop polled a dead, unchanging file every
3 seconds for **47 hours** until a human spotted it. It also masked the real
failure, which was fixed 18 minutes later by someone else.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
